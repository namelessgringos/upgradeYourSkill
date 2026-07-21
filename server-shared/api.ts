/**
 * Wire types for the app ⇄ server contract (docs/API_CONTRACT.md).
 *
 * Imported by BOTH the Expo client and the Cloud Functions, so it must stay
 * free of any `firebase-admin` / `react-native` imports. Types only — no
 * runtime dependencies.
 */
import type { GuideSection, SkillPublic, SkillTier } from './skillSchema';

/** Row in the flat skills list. Metadata only — no guide body. */
export interface SkillListItem {
  id: string;
  title: string;
  promise: string;
  tier: SkillTier;
  emoji: string;
  coachName: string;
}

export interface SkillMeta extends SkillListItem {
  summary: string;
  coachTagline: string;
  starters: string[];
}

export interface ListSkillsResponse {
  skills: SkillListItem[];
}

export interface GetSkillResponse {
  meta: SkillMeta;
  /** Populated only when the caller is entitled to this skill. */
  guide: GuideSection[] | null;
  entitled: boolean;
}

/**
 * `free` is an amendment to the frozen contract — the approved prototype ships
 * a free tier (one chosen skill, hard daily cap). See docs/API_CONTRACT.md
 * "Amendment 2026-07-21".
 */
export type EntitlementStatus = 'none' | 'free' | 'trial' | 'active' | 'paused';

export interface EntitlementState {
  status: EntitlementStatus;
  /** ISO 8601. Present while a trial is running. */
  trialEndsAt: string | null;
  /** Skill ids this user may open the guide for and chat with. */
  unlockedSkillIds: string[];
  messageCapPerDay: number;
  onboarded: boolean;
  /** The one skill picked during onboarding; unlocks on the free tier. */
  freeSkillId: string | null;
  reviewBonusClaimed: boolean;
}

export interface MeterState {
  /** ISO 8601 start of the current metering period (a UTC day in v1). */
  periodStart: string;
  used: number;
  limit: number;
  unit: 'messages';
  /** Running totals for the membership screen. Kept as counters server-side so
   *  the client never has to hold a growing usage history. */
  lifetimeMessages: number;
  activeDays: number;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  skillId: string;
  messages: ChatMessageInput[];
}

export interface ChatResponse {
  reply: string;
  usage: { inputTokens: number; outputTokens: number };
  meter: MeterState;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Projects the client-safe subset out of a skill document. */
export function toSkillListItem(skill: SkillPublic): SkillListItem {
  return {
    id: skill.id,
    title: skill.title,
    promise: skill.promise,
    tier: skill.tier,
    emoji: skill.emoji,
    coachName: skill.coachName,
  };
}

export function toSkillMeta(skill: SkillPublic): SkillMeta {
  return {
    ...toSkillListItem(skill),
    summary: skill.summary,
    coachTagline: skill.coachTagline,
    starters: skill.starters,
  };
}
