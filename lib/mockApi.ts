/**
 * In-memory stand-in for the server, used while the emulator suite is not
 * running. Dev only: `MOCK_API` in lib/api.ts flips the whole client onto it.
 *
 * Deliberately holds no real coach prompts or guide content (non-negotiable
 * rule #1) — guides here are placeholder text, and chat replies are canned.
 */
import type {
  ChatResponse,
  EntitlementState,
  GetSkillResponse,
  ListSkillsResponse,
  MeterState,
  SkillListItem,
  SkillMeta,
} from '@/server-shared/api';

const DAY_MS = 24 * 60 * 60 * 1000;

const SKILLS: SkillMeta[] = [
  {
    id: 'finance',
    title: 'Personal Finance Foundations',
    promise: 'Get your money organized in a weekend.',
    tier: 'standard',
    emoji: '💰',
    coachName: 'Nadia',
    coachTagline: 'Money habits • education only, not financial advice',
    summary:
      'A calm, no-jargon setup you can build in a weekend: a spending audit that ends, an order of operations for what to fund next, and automatic transfers that keep working after motivation runs out.',
    starters: [
      'Help me build a simple budget',
      'Emergency fund or pay debt first?',
      'Where is my money actually going?',
    ],
  },
  {
    id: 'negotiation',
    title: 'Negotiation & Deals',
    promise: 'Ask for more, and get it, without the sweaty palms.',
    tier: 'pro',
    emoji: '🤝',
    coachName: 'Marcus',
    coachTagline: 'Deals & negotiation • practice partner, not your lawyer',
    summary:
      'A working playbook for salary talks, freelance rates and everyday asks: set your walk-away, anchor high, survive the silence, and trade instead of caving.',
    starters: [
      'Help me ask for a raise',
      'They lowballed my offer — what now?',
      'Roleplay a tough client with me',
    ],
  },
  {
    id: 'strength',
    title: 'Strength Programming',
    promise: 'Build a training plan that actually progresses.',
    tier: 'standard',
    emoji: '🏋️',
    coachName: 'Coach Vera',
    coachTagline: 'Strength & programming • not a medical professional',
    summary:
      'The structure that keeps lifts going up: how much to do, how to arrange it around a real schedule, and exactly what to change when a lift stalls.',
    starters: [
      'Build me a 3-day full-body plan',
      'My bench has been stuck for two months',
      'I can only train twice a week',
    ],
  },
];

const PLACEHOLDER_GUIDE = [
  {
    heading: 'Placeholder guide',
    body: 'Guide content is served by the backend. Running against the mock API, so only this placeholder is shown.',
  },
  {
    heading: 'Why you see this',
    body: 'Start the Firebase emulators and set `MOCK_API` to false in lib/api.ts to load the real guide.',
  },
];

// ------------------------------------------------------------------ state

let entitlement: EntitlementState = {
  status: 'free',
  trialEndsAt: null,
  unlockedSkillIds: [],
  messageCapPerDay: 3,
  onboarded: false,
  freeSkillId: null,
  reviewBonusClaimed: false,
};

let meter: MeterState = {
  periodStart: new Date().toISOString(),
  used: 0,
  limit: 3,
  unit: 'messages',
  lifetimeMessages: 0,
  activeDays: 1,
};

const delay = <T,>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const syncMeterLimit = () => {
  meter = { ...meter, limit: entitlement.messageCapPerDay };
};

// ------------------------------------------------------------------- api

export const listSkills = (): Promise<ListSkillsResponse> =>
  delay({
    skills: SKILLS.map(({ summary, coachTagline, starters, ...row }) => row as SkillListItem),
  });

export const getSkill = ({ skillId }: { skillId: string }): Promise<GetSkillResponse> => {
  const meta = SKILLS.find((s) => s.id === skillId);
  if (!meta) return Promise.reject(new Error(`Unknown skill: ${skillId}`));
  const entitled = entitlement.unlockedSkillIds.includes(skillId);
  return delay({ meta, guide: entitled ? PLACEHOLDER_GUIDE : null, entitled });
};

export const getEntitlement = (): Promise<EntitlementState> => delay(entitlement);

export const getUsage = (): Promise<MeterState> => delay(meter);

export const setOnboardingChoice = ({
  freeSkillId,
}: {
  freeSkillId: string;
}): Promise<EntitlementState> => {
  entitlement = {
    ...entitlement,
    status: 'free',
    onboarded: true,
    freeSkillId,
    unlockedSkillIds: [freeSkillId],
  };
  syncMeterLimit();
  return delay(entitlement);
};

export const activateTrial = (): Promise<EntitlementState> => {
  entitlement = {
    ...entitlement,
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
    unlockedSkillIds: SKILLS.map((s) => s.id),
    messageCapPerDay: 30,
  };
  syncMeterLimit();
  return delay(entitlement);
};

export const redeemReviewBonus = (): Promise<EntitlementState> => {
  entitlement = {
    ...entitlement,
    reviewBonusClaimed: true,
    messageCapPerDay: entitlement.messageCapPerDay + 3,
  };
  syncMeterLimit();
  return delay(entitlement);
};

export const sendChat = (
  skillId: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<ChatResponse> => {
  const last = messages[messages.length - 1]?.content ?? '';
  meter = {
    ...meter,
    used: meter.used + 1,
    lifetimeMessages: meter.lifetimeMessages + 1,
  };
  return delay(
    {
      reply: `[mock ${skillId} coach] You said: “${last}”. The real coach replies once the backend is running.`,
      usage: { inputTokens: 0, outputTokens: 0 },
      meter,
    },
    600
  );
};

// ------------------------------------------------------------------ auth

export interface MockUser {
  uid: string;
  displayName: string;
  email: string;
  providerId: string;
}

const PROFILES: Record<'google' | 'apple', MockUser> = {
  google: {
    uid: 'mock-google-user',
    displayName: 'Alex Rivera',
    email: 'alex@gmail.com',
    providerId: 'google.com',
  },
  apple: {
    uid: 'mock-apple-user',
    displayName: 'Sam Carter',
    email: 'sam@icloud.com',
    providerId: 'apple.com',
  },
};

let currentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const emit = () => listeners.forEach((fn) => fn(currentUser));

export function onAuthChange(fn: (user: MockUser | null) => void): () => void {
  listeners.add(fn);
  fn(currentUser);
  return () => listeners.delete(fn);
}

export async function signIn(provider: 'google' | 'apple'): Promise<void> {
  currentUser = PROFILES[provider];
  emit();
}

export async function signOut(): Promise<void> {
  currentUser = null;
  entitlement = {
    status: 'free',
    trialEndsAt: null,
    unlockedSkillIds: [],
    messageCapPerDay: 3,
    onboarded: false,
    freeSkillId: null,
    reviewBonusClaimed: false,
  };
  meter = { ...meter, used: 0, limit: 3, lifetimeMessages: 0 };
  emit();
}
