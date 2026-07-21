/**
 * Presentation-only helpers for skills.
 *
 * Skill data itself now comes from the server (see `lib/api.ts`); this file
 * holds the bits that are purely about how it looks. Replaces the prototype's
 * `mockData.ts`.
 */
import { JournalColors } from './theme';
import type { SkillTier } from '@/server-shared/skillSchema';

export type { SkillTier };

/**
 * An artifact the coach can surface in-thread. The chat components still
 * render these, but the v1 `chat` endpoint returns plain text only — nothing
 * produces one yet. Kept because the components are built and the capability
 * is wanted; wiring it up needs a contract change, so it is not v1.
 */
export type Artifact =
  | { kind: 'checklist'; title: string; items: string[] }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] }
  | { kind: 'image'; title: string; caption: string; swatch: string };

/** Tier pill color (single-accent system). */
export function tierColor(tier: SkillTier): string {
  return tier === 'pro' ? JournalColors.accent : JournalColors.selectedBorder;
}

export function tierLabel(tier: SkillTier): string {
  return tier === 'pro' ? 'Pro' : 'Core';
}
