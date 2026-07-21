/**
 * Seeds the skills collection from `functions/content/`.
 *
 * Against the emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GCLOUD_PROJECT=upgrade-your-skill-dev \
 *   npm --prefix functions run seed
 *
 * Idempotent — writes are keyed by skill id, so re-running updates in place.
 * Validation runs first: an invalid skill is never written.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { validateSkillDocument } from '../../../server-shared/validateSkill';
import { loadAllSkills } from '../content/load';
import { assembleSystemPrompt } from '../skills';

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

  const skills = loadAllSkills();

  const invalid = skills
    .map((skill) => ({
      skill,
      result: validateSkillDocument(skill, assembleSystemPrompt(skill)),
    }))
    .filter(({ result }) => !result.ok);

  if (invalid.length > 0) {
    for (const { skill, result } of invalid) {
      console.error(`${skill.id}:`);
      for (const error of result.errors) console.error(`  - ${error}`);
    }
    throw new Error('Refusing to seed invalid skills. Run content:build for detail.');
  }

  initializeApp();
  const db = getFirestore();

  const batch = db.batch();
  for (const skill of skills) {
    batch.set(db.collection('skills').doc(skill.id), skill);
  }
  await batch.commit();

  console.log(`Seeded ${skills.length} skills:`);
  for (const skill of skills) {
    console.log(`  ${skill.id} — ${skill.title} (${skill.model.model})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
