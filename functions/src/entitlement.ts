/**
 * Entitlement service. Every server call runs through `loadEntitlement`
 * (non-negotiable rule #4) — the check always happens; its *result* decides
 * how much is returned.
 *
 * Storage note: API_CONTRACT.md sketches `users/{uid}/entitlement`, which is a
 * collection path in Firestore, not a document. The profile and entitlement
 * fields live together on the `users/{uid}` document instead — one read per
 * call instead of two. Usage stays a subcollection as specified.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { EntitlementState, EntitlementStatus } from '../../server-shared/api';
import { db } from './admin';
import { listSkillIds } from './skills';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hard daily message caps, enforced server-side.
 *
 * Derived from measurement, not carried over from the UI prototype (which had
 * 5 / 50 / 500 as placeholders). Run `npm run economics` to reproduce.
 *
 * At the measured ~5.8k-token cached system block and a ~400-token answer, a
 * turn costs about $0.0026 on Haiku 4.5. A typical user (~1 turn/day) costs
 * ~$0.08/month, well inside CLAUDE.md's "under 10% of revenue" target.
 *
 * The caps exist to bound the tail, not the typical user:
 *   free   5/day   ~$0.39/mo worst case
 *   trial  30/day  ~$0.55 for the whole 7-day trial — acceptable as acquisition
 *   active 40/day  ~$3.12/mo worst case, versus ~$0.08 typical
 *
 * 500/day was authorising ~$39/month per user, which is loss-making at any
 * plausible price. Trial sits below active deliberately so converting is never
 * a downgrade.
 *
 * PROVISIONAL: measured with the echo provider plus an assumed answer length.
 * Re-derive once a real model has been through the eval harness, and again
 * once a price is set (store commission of 15-30% matters more here than
 * tokens do).
 */
export const DAILY_MESSAGE_CAP: Record<EntitlementStatus, number> = {
  none: 0,
  free: 5,
  trial: 30,
  active: 40,
  paused: 0,
};

interface UserDoc {
  plan?: 'free' | 'trial' | 'active' | 'paused';
  trialEndsAt?: number | null;
  freeSkillId?: string | null;
  onboarded?: boolean;
  reviewBonusClaimed?: boolean;
}

function userRef(uid: string) {
  return db.collection('users').doc(uid);
}

/** Free unlocks exactly the one skill picked at onboarding; trial and paid
 *  unlock everything; nothing else unlocks anything. */
async function resolveUnlocked(
  status: EntitlementStatus,
  freeSkillId: string | null
): Promise<string[]> {
  switch (status) {
    case 'free':
      return freeSkillId ? [freeSkillId] : [];
    case 'trial':
    case 'active':
      return listSkillIds();
    default:
      return [];
  }
}

/**
 * Reads the user's entitlement and resolves it against the clock: an expired
 * trial silently degrades to `free`. Creates the document on first call so a
 * freshly signed-in user is immediately in a known state.
 */
export async function loadEntitlement(uid: string): Promise<EntitlementState> {
  const snap = await userRef(uid).get();

  if (!snap.exists) {
    await userRef(uid).set(
      { plan: 'free', createdAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  const data = (snap.data() ?? {}) as UserDoc;
  const now = Date.now();
  const trialEndsAt = data.trialEndsAt ?? null;
  const trialActive = data.plan === 'trial' && !!trialEndsAt && trialEndsAt > now;

  const status: EntitlementStatus =
    data.plan === 'trial' && !trialActive ? 'free' : data.plan ?? 'free';

  const freeSkillId = data.freeSkillId ?? null;
  const unlockedSkillIds = await resolveUnlocked(status, freeSkillId);

  return {
    status,
    trialEndsAt: trialActive && trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
    unlockedSkillIds,
    messageCapPerDay: DAILY_MESSAGE_CAP[status],
    onboarded: data.onboarded ?? false,
    freeSkillId,
    reviewBonusClaimed: data.reviewBonusClaimed ?? false,
  };
}

export async function completeOnboarding(
  uid: string,
  freeSkillId: string
): Promise<EntitlementState> {
  await userRef(uid).set({ onboarded: true, freeSkillId }, { merge: true });
  return loadEntitlement(uid);
}

export async function startTrial(uid: string): Promise<EntitlementState> {
  const current = await loadEntitlement(uid);
  // A trial is granted once. Re-requesting it must not extend an active plan.
  if (current.status !== 'free') return current;
  await userRef(uid).set(
    { plan: 'trial', trialEndsAt: Date.now() + 7 * DAY_MS },
    { merge: true }
  );
  return loadEntitlement(uid);
}

/**
 * The 5-star-for-a-week bonus from the prototype: one extra trial week,
 * claimable once. Stacks onto a running trial rather than resetting it.
 */
export async function claimReviewBonus(uid: string): Promise<EntitlementState> {
  const snap = await userRef(uid).get();
  const data = (snap.data() ?? {}) as UserDoc;
  if (data.reviewBonusClaimed) return loadEntitlement(uid);

  const now = Date.now();
  const base = data.trialEndsAt && data.trialEndsAt > now ? data.trialEndsAt : now;
  await userRef(uid).set(
    {
      reviewBonusClaimed: true,
      plan: data.plan === 'active' ? 'active' : 'trial',
      trialEndsAt: base + 7 * DAY_MS,
    },
    { merge: true }
  );
  return loadEntitlement(uid);
}

export function isSkillUnlocked(entitlement: EntitlementState, skillId: string): boolean {
  return entitlement.unlockedSkillIds.includes(skillId);
}
