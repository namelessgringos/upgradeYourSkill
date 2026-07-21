import type { LLMProvider, LLMRequest, LLMResult } from './provider';

/**
 * Keyless stand-in so the emulator runs end to end before an Anthropic key
 * exists. Never selected when ANTHROPIC_API_KEY is set. Not a fallback
 * provider — BLUEPRINT puts fallback routing out of scope; this is a dev stub.
 */
export class EchoProvider implements LLMProvider {
  readonly name = 'echo';

  async complete(request: LLMRequest): Promise<LLMResult> {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const text =
      `[echo provider — no ANTHROPIC_API_KEY set]\n\n` +
      `Model that would have been called: ${request.model}\n` +
      `System prompt length: ${request.system.length} chars\n` +
      `You said: ${lastUser?.content ?? '(nothing)'}`;

    // Rough stand-in so the metering path is exercised with non-zero numbers.
    const estimate = (s: string) => Math.ceil(s.length / 4);
    return {
      text,
      usage: {
        inputTokens:
          estimate(request.system) +
          request.messages.reduce((n, m) => n + estimate(m.content), 0),
        outputTokens: estimate(text),
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
    };
  }
}
