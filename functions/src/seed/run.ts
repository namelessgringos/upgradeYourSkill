/**
 * Seeds the skills collection.
 *
 * Against the emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GCLOUD_PROJECT=upgrade-your-skill-dev \
 *   npm --prefix functions run seed
 *
 * Idempotent — writes are keyed by skill id, so re-running updates in place.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_SKILLS } from './skills';

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    // Guard rail: seeding carries the private prompts. Writing them to a real
    // project should be a deliberate act, not a mistyped command.
    if (process.env.ALLOW_PRODUCTION_SEED !== 'yes') {
      throw new Error(
        'FIRESTORE_EMULATOR_HOST is not set. Refusing to seed a live project. ' +
          'Set ALLOW_PRODUCTION_SEED=yes if that is really what you want.'
      );
    }
  }

  initializeApp();
  const db = getFirestore();

  const batch = db.batch();
  for (const skill of SEED_SKILLS) {
    batch.set(db.collection('skills').doc(skill.id), skill);
  }
  await batch.commit();

  console.log(`Seeded ${SEED_SKILLS.length} skills:`);
  for (const skill of SEED_SKILLS) {
    console.log(`  ${skill.id} — ${skill.title} (${skill.model.model})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
