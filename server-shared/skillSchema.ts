/**
 * Skill content schema — the contract between content authors and the app.
 *
 * CRITICAL SPLIT (non-negotiable rule #1): a skill is stored server-side as a
 * `SkillDocument`. The client is only ever sent `SkillPublic`. The coach's
 * system prompt, model config, safety boundaries, and eval set live in
 * `SkillPrivate` and MUST NOT be serialized to the client or bundled in the app.
 *
 * This file is the shared type source. In the Firebase functions it is the
 * Firestore document shape; on the client only `SkillPublic` is imported.
 */

/** Pricing/complexity bucket. In v1 there is ONE subscription price; the tier is
 *  metadata for display + future pricing, not a separate purchase. */
export type SkillTier = 'standard' | 'pro';

/** A section of the static, human-authored guide. Rendered client-side; $0 to
 *  serve; this is the product the subscription pays for. */
export interface GuideSection {
  heading: string;
  /** Markdown-ish body. Kept as authored text; no generation at serve time. */
  body: string;
}

/** Everything safe to send to the client. */
export interface SkillPublic {
  id: string;
  /** Display name, e.g. "Strength Programming". */
  title: string;
  /** One-line promise shown in the flat list. */
  promise: string;
  tier: SkillTier;
  /** Short marketing paragraph for the detail header. */
  summary: string;
  /** Display glyph for list rows and the chat empty state. Cosmetic. */
  emoji: string;
  /** The static written guide — the actual product. */
  guide: GuideSection[];
  /** Suggested opening prompts shown in an empty chat. Cosmetic; the coach is
   *  not constrained to them. */
  starters: string[];
  /** Coach display name + one-line description (cosmetic only in v1; NOT a
   *  persona system — see BLUEPRINT "Out of scope"). */
  coachName: string;
  coachTagline: string;
  /** Whether this skill is live in the catalog. */
  published: boolean;
}

/** Server-only. Never leaves the backend. */
export interface SkillPrivate {
  /** The coach's system instructions. Assembled into every chat call
   *  server-side. NEVER sent to the client. */
  systemPrompt: string;
  /** Explicit boundaries enforced in prompt assembly, appended to the system
   *  prompt (e.g. "Do not diagnose. Do not prescribe. You are not a doctor."). */
  safetyBoundaries: string[];
  /** Model config lives in the DB, not in code (non-negotiable rule #2). */
  model: SkillModelConfig;
  /** Few-shot examples used server-side to shape the coach. */
  examples?: { user: string; assistant: string }[];
  /** Reference to the 30-question eval set for this skill (rule: check Haiku
   *  quality before pricing). */
  evalSetId?: string;
}

export interface SkillModelConfig {
  /** Anthropic model id. Default 'claude-haiku-4-5'. Change per skill in the DB
   *  to upgrade without an app release. */
  model: string;
  /** Whether prompt caching is applied to the (identical every call) system
   *  prompt. Should be true — caching is mandatory for the economics. */
  promptCaching: boolean;
  maxTokens: number;
}

/** The full Firestore document. `SkillPublic` is projected out of this for the
 *  client; `SkillPrivate` never is. */
export interface SkillDocument extends SkillPublic, SkillPrivate {}
