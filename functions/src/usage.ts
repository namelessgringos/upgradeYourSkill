/**
 * Per-user token metering (non-negotiable rule #5). Every chat call writes
 * here, so cost-per-user is queryable from day one — not just aggregate spend.
 *
 * Path: users/{uid}/usage/{YYYY-MM-DD}. The period is a UTC day because the
 * caps that constrain v1 are daily.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { MeterState } from '../../server-shared/api';
import type { LLMUsage } from './llm/provider';
import { db } from './admin';

/** USD per million tokens. Kept beside the metering write so the stored cost
 *  is computed once, at write time, rather than re-derived by every reader. */
interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

const FALLBACK_PRICING = PRICING['claude-haiku-4-5'];

export function periodKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function periodStartIso(key: string): string {
  return `${key}T00:00:00.000Z`;
}

export function estimateCostUsd(model: string, usage: LLMUsage): number {
  const p = PRICING[model] ?? FALLBACK_PRICING;
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheCreationTokens * p.cacheWrite) /
    1_000_000
  );
}

function usageRef(uid: string, key: string) {
  return db.collection('users').doc(uid).collection('usage').doc(key);
}

/** Message count for the current period — the number the daily cap is
 *  enforced against. */
export async function messagesUsedToday(uid: string): Promise<number> {
  const snap = await usageRef(uid, periodKey()).get();
  return (snap.data()?.messages as number | undefined) ?? 0;
}

/**
 * Writes the per-period record and the user's lifetime rollup in one
 * transaction. The rollup exists so the membership screen can show all-time
 * totals without the client (or the server) reading every past period.
 */
export async function recordUsage(
  uid: string,
  skillId: string,
  model: string,
  usage: LLMUsage
): Promise<void> {
  const key = periodKey();
  const period = usageRef(uid, key);
  const user = db.collection('users').doc(uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(period);
    const isNewPeriod = !existing.exists;

    tx.set(
      period,
      {
        periodStart: periodStartIso(key),
        messages: FieldValue.increment(1),
        inputTokens: FieldValue.increment(usage.inputTokens),
        outputTokens: FieldValue.increment(usage.outputTokens),
        cacheReadTokens: FieldValue.increment(usage.cacheReadTokens),
        cacheCreationTokens: FieldValue.increment(usage.cacheCreationTokens),
        costUsd: FieldValue.increment(estimateCostUsd(model, usage)),
        [`bySkill.${skillId}.messages`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      user,
      {
        lifetimeMessages: FieldValue.increment(1),
        lifetimeCostUsd: FieldValue.increment(estimateCostUsd(model, usage)),
        activeDays: FieldValue.increment(isNewPeriod ? 1 : 0),
      },
      { merge: true }
    );
  });
}

export async function getMeter(uid: string, limit: number): Promise<MeterState> {
  const key = periodKey();
  const [periodSnap, userSnap] = await Promise.all([
    usageRef(uid, key).get(),
    db.collection('users').doc(uid).get(),
  ]);

  return {
    periodStart: periodStartIso(key),
    used: (periodSnap.data()?.messages as number | undefined) ?? 0,
    limit,
    unit: 'messages',
    lifetimeMessages: (userSnap.data()?.lifetimeMessages as number | undefined) ?? 0,
    activeDays: (userSnap.data()?.activeDays as number | undefined) ?? 0,
  };
}
