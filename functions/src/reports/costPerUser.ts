/**
 * Cost per user.
 *
 *   npm run cost:report                 # against the emulator
 *   ALLOW_PRODUCTION_READ=yes ...       # against a real project
 *
 * Non-negotiable rule #5 says cost-per-user must be queryable from day one,
 * not just aggregate spend. `usage.ts` has been writing `costUsd` per period
 * and `lifetimeCostUsd` per user since Phase 1; this is the thing that reads
 * it. Aggregate spend hides the one runaway account that matters.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface UserRow {
  uid: string;
  plan: string;
  lifetimeMessages: number;
  lifetimeCostUsd: number;
  activeDays: number;
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.ALLOW_PRODUCTION_READ !== 'yes') {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Set ALLOW_PRODUCTION_READ=yes to read a live project.'
    );
  }

  initializeApp();
  const db = getFirestore();

  const snap = await db.collection('users').get();
  const rows: UserRow[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      plan: (d.plan as string) ?? 'free',
      lifetimeMessages: (d.lifetimeMessages as number) ?? 0,
      lifetimeCostUsd: (d.lifetimeCostUsd as number) ?? 0,
      activeDays: (d.activeDays as number) ?? 0,
    };
  });

  if (rows.length === 0) {
    console.log('No users yet.');
    return;
  }

  rows.sort((a, b) => b.lifetimeCostUsd - a.lifetimeCostUsd);

  const total = rows.reduce((n, r) => n + r.lifetimeCostUsd, 0);
  const messages = rows.reduce((n, r) => n + r.lifetimeMessages, 0);

  console.log('uid                              plan     msgs   active days   cost USD');
  for (const row of rows.slice(0, 25)) {
    console.log(
      `${row.uid.padEnd(32)} ${row.plan.padEnd(8)} ` +
        `${String(row.lifetimeMessages).padStart(5)}   ` +
        `${String(row.activeDays).padStart(11)}   ` +
        `$${row.lifetimeCostUsd.toFixed(4)}`
    );
  }
  if (rows.length > 25) console.log(`... and ${rows.length - 25} more`);

  const mean = total / rows.length;
  // The tail is the point of this report: the mean hides the account that is
  // costing 50x everyone else.
  const p90 = [...rows].sort((a, b) => a.lifetimeCostUsd - b.lifetimeCostUsd)[
    Math.floor(rows.length * 0.9)
  ];

  console.log(`\nusers ${rows.length}   messages ${messages}   total $${total.toFixed(4)}`);
  console.log(`mean $${mean.toFixed(4)}/user   p90 $${(p90?.lifetimeCostUsd ?? 0).toFixed(4)}`);
  console.log(`most expensive: ${rows[0].uid} at $${rows[0].lifetimeCostUsd.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
