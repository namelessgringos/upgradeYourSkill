import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest, LLMResult } from './provider';

/**
 * The one live provider in v1.
 *
 * Prompt caching is applied to the system block, which is byte-identical on
 * every call for a given skill. Caveat worth knowing: Haiku 4.5's minimum
 * cacheable prefix is 4096 tokens — a shorter system prompt silently does not
 * cache (no error, `cacheReadTokens` just stays 0). Watch that number.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LLMRequest): Promise<LLMResult> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: [
        {
          type: 'text',
          text: request.system,
          ...(request.promptCaching
            ? { cache_control: { type: 'ephemeral' as const } }
            : {}),
        },
      ],
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
