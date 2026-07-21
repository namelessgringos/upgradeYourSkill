/**
 * Runtime validation for authored skills.
 *
 * `skillSchema.ts` gives compile-time types, which cannot catch a malformed
 * hand-authored content file — that check has to happen when the document is
 * built. This is deliberately dependency-free: the rules below are specific
 * enough that a schema library would add a dependency without adding safety.
 *
 * The word-count rule is the interesting one. BLUEPRINT says a guide that is
 * not worth paying for on its own sinks the product, so the bar is enforced
 * mechanically here rather than left to whoever is authoring that day.
 */
import type { GuideSection, SkillDocument } from './skillSchema';

/** Models a skill may be pinned to. Keeps a typo in a content file from
 *  silently becoming a 404 at chat time. */
export const KNOWN_MODELS = [
  'claude-haiku-4-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
] as const;

/** Floor, not a target. Stops placeholder guides shipping; it is not evidence
 *  anyone will pay. See docs/BLUEPRINT.md. */
export const MIN_GUIDE_WORDS = 1200;

/**
 * Haiku 4.5's minimum cacheable prefix. A system block below this silently
 * does not cache — no error, `cache_read_input_tokens` just stays 0. Falling
 * under it is a warning, not a failure: it costs money, it does not break.
 */
export const MIN_CACHEABLE_TOKENS = 4096;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    guideWords: number;
    guideSections: number;
    /** Rough — 4 chars/token. Verify properly with `messages.count_tokens`
     *  before trusting it for a caching decision. */
    estimatedSystemTokens: number;
  };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function guideWordCount(guide: GuideSection[]): number {
  return guide.reduce(
    (total, section) => total + countWords(section.heading) + countWords(section.body),
    0
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param assembledSystemPrompt the *final* system block as the server will send
 *   it (coach prompt + guide + boundaries). Passing it lets the caching check
 *   measure the real thing rather than a proxy.
 */
export function validateSkillDocument(
  input: unknown,
  assembledSystemPrompt?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const doc = (input ?? {}) as Partial<SkillDocument>;

  const requireString = (field: keyof SkillDocument) => {
    if (!isNonEmptyString(doc[field])) errors.push(`${String(field)} is missing or empty`);
  };

  (['id', 'title', 'promise', 'summary', 'emoji', 'coachName', 'coachTagline', 'systemPrompt'] as const).forEach(
    requireString
  );

  if (doc.tier !== 'standard' && doc.tier !== 'pro') {
    errors.push("tier must be 'standard' or 'pro'");
  }

  if (typeof doc.published !== 'boolean') {
    errors.push('published must be a boolean');
  }

  // --- guide: the product ---------------------------------------------------
  const guide = Array.isArray(doc.guide) ? doc.guide : [];
  if (guide.length === 0) {
    errors.push('guide has no sections');
  }
  guide.forEach((section, i) => {
    if (!isNonEmptyString(section?.heading)) errors.push(`guide[${i}] has no heading`);
    if (!isNonEmptyString(section?.body)) errors.push(`guide[${i}] has no body`);
  });

  const guideWords = guideWordCount(guide);
  if (guideWords < MIN_GUIDE_WORDS) {
    errors.push(
      `guide is ${guideWords} words; minimum is ${MIN_GUIDE_WORDS}. ` +
        'A guide this short is not worth a subscription (BLUEPRINT).'
    );
  }

  // --- safety ---------------------------------------------------------------
  const boundaries = Array.isArray(doc.safetyBoundaries) ? doc.safetyBoundaries : [];
  if (boundaries.length === 0) {
    errors.push('safetyBoundaries is empty — a coach must not ship without boundaries');
  }
  boundaries.forEach((line, i) => {
    if (!isNonEmptyString(line)) errors.push(`safetyBoundaries[${i}] is empty`);
  });

  // --- model config ---------------------------------------------------------
  const model = doc.model;
  if (!model || typeof model !== 'object') {
    errors.push('model config is missing');
  } else {
    if (!KNOWN_MODELS.includes(model.model as (typeof KNOWN_MODELS)[number])) {
      errors.push(
        `model.model '${model.model}' is not in the known-model allowlist ` +
          `(${KNOWN_MODELS.join(', ')})`
      );
    }
    if (typeof model.maxTokens !== 'number' || model.maxTokens <= 0) {
      errors.push('model.maxTokens must be a positive number');
    }
    if (model.promptCaching !== true) {
      warnings.push('model.promptCaching is off — caching is mandatory for the economics');
    }
  }

  // --- cosmetic but UI-required --------------------------------------------
  const starters = Array.isArray(doc.starters) ? doc.starters : [];
  if (starters.length < 2 || starters.length > 4) {
    errors.push(`starters must have 2-4 entries, found ${starters.length}`);
  }

  // --- caching cliff --------------------------------------------------------
  const estimatedSystemTokens = assembledSystemPrompt
    ? Math.round(assembledSystemPrompt.length / 4)
    : 0;
  if (assembledSystemPrompt && estimatedSystemTokens < MIN_CACHEABLE_TOKENS) {
    warnings.push(
      `assembled system prompt is ~${estimatedSystemTokens} tokens, under the ` +
        `${MIN_CACHEABLE_TOKENS}-token minimum cacheable prefix for Haiku 4.5. ` +
        'Prompt caching will silently not apply, so every turn pays full input price.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      guideWords,
      guideSections: guide.length,
      estimatedSystemTokens,
    },
  };
}
