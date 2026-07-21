/**
 * Provider abstraction (non-negotiable rule #3).
 *
 * Exactly one live provider ships in v1 (Anthropic), but every call site goes
 * through this interface so a second provider is a registration, not a rewrite.
 * BLUEPRINT "Out of scope": multi-provider routing / fallback does NOT ship —
 * only the interface.
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  maxTokens: number;
  /** Assembled server-side. Identical on every call for a given skill, which
   *  is what makes prompt caching worth turning on. */
  system: string;
  /** Cache the system block. Mandatory for the economics — see CLAUDE.md. */
  promptCaching: boolean;
  messages: LLMMessage[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  /** Tokens served from the prompt cache (~0.1x price). Zero means the cache
   *  did not hit — most often because the system prompt is below the model's
   *  minimum cacheable prefix. */
  cacheReadTokens: number;
  /** Tokens written to the cache (~1.25x price). */
  cacheCreationTokens: number;
}

export interface LLMResult {
  text: string;
  usage: LLMUsage;
}

export interface LLMProvider {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResult>;
}
