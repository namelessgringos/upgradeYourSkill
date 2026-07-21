/**
 * Validates every authored skill and reports. Run before seeding:
 *
 *   npm --prefix functions run content:build
 *
 * Exits non-zero on any validation error, so it works as a gate in CI or a
 * pre-seed check. Warnings (notably the prompt-caching cliff) are reported but
 * do not fail the build — they cost money, they do not break correctness.
 */
import { validateSkillDocument } from '../../../server-shared/validateSkill';
import { assembleSystemPrompt } from '../skills';
import { loadAllSkills, loadEvalQuestions } from './load';

const EXPECTED_EVAL_QUESTIONS = 30;

export function buildAndValidate(): { ok: boolean } {
  const skills = loadAllSkills();
  if (skills.length === 0) {
    console.error('No skills found in functions/content/');
    return { ok: false };
  }

  let ok = true;

  for (const skill of skills) {
    // Validate against the prompt the server will actually send, not a proxy.
    const assembled = assembleSystemPrompt(skill);
    const result = validateSkillDocument(skill, assembled);
    const evals = loadEvalQuestions(skill.id);

    const status = result.ok ? 'ok  ' : 'FAIL';
    console.log(
      `${status} ${skill.id.padEnd(12)} ` +
        `${result.stats.guideWords} guide words, ` +
        `${result.stats.guideSections} sections, ` +
        `~${result.stats.estimatedSystemTokens} system tokens, ` +
        `${evals.length} evals`
    );

    for (const error of result.errors) console.log(`       error:   ${error}`);
    for (const warning of result.warnings) console.log(`       warning: ${warning}`);

    if (evals.length > 0 && evals.length < EXPECTED_EVAL_QUESTIONS) {
      console.log(
        `       warning: ${evals.length} eval questions, BLUEPRINT asks for ${EXPECTED_EVAL_QUESTIONS}`
      );
    }

    if (!result.ok) ok = false;
  }

  return { ok };
}

if (require.main === module) {
  try {
    const { ok } = buildAndValidate();
    if (!ok) {
      console.error('\nValidation failed. Nothing was written.');
      process.exit(1);
    }
    console.log('\nAll skills valid.');
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
