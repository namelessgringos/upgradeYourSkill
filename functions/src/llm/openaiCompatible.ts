/**
 * Any endpoint speaking the OpenAI chat-completions shape: Ollama, LM Studio,
 * llama.cpp's server, vLLM, Groq, Together, Fireworks, OpenRouter.
 *
 * This exists to *measure* alternatives to Anthropic, not to serve traffic.
 * BLUEPRINT puts multi-provider routing, escalation, and fallback out of scope
 * for v1 — the interface ships, multiple live providers do not. Nothing in
 * `index.ts` selects this class; only the eval harness does.
 *
 * Deliberately built on `fetch` rather than the OpenAI SDK: the surface used
 * here is one POST, and a dependency would buy nothing.
 */
import type { LLMProvider, LLMRequest, LLMResult } from './provider';

export interface OpenAICompatibleOptions {
  /** e.g. http://127.0.0.1:11434/v1 for Ollama, https://api.groq.com/openai/v1 */
  baseUrl: string;
  /** Local servers generally ignore this; hosted providers require it. */
  apiKey?: string;
  /** Label used in eval reports so results are attributable. */
  label?: string;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.name = options.label ?? 'openai-compatible';
    // Local models on consumer hardware are slow; the default 30s used by most
    // clients is not enough for a long prompt on a Mac.
    this.timeoutMs = options.timeoutMs ?? 300_000;
  }

  async complete(request: LLMRequest): Promise<LLMResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          messages: [
            { role: 'system', content: request.system },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const body = (await response.json()) as ChatCompletionResponse;

      if (!response.ok || body.error) {
        throw new Error(
          `${this.name} returned ${response.status}: ${body.error?.message ?? 'unknown error'}`
        );
      }

      const text = body.choices?.[0]?.message?.content ?? '';
      const promptTokens = body.usage?.prompt_tokens ?? 0;
      // Only some hosted providers report cache hits; local servers never do.
      const cached = body.usage?.prompt_tokens_details?.cached_tokens ?? 0;

      return {
        text,
        usage: {
          // Keep the same accounting as AnthropicProvider: `inputTokens` is the
          // uncached remainder, so cost maths stays comparable across providers.
          inputTokens: Math.max(0, promptTokens - cached),
          outputTokens: body.usage?.completion_tokens ?? 0,
          cacheReadTokens: cached,
          cacheCreationTokens: 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
