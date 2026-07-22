/**
 * LLM judge. Scores an answer against the question's stated expectation and
 * the guide it should have been drawn from.
 *
 * The judge runs through the same `LLMProvider` interface as the coach, so a
 * judge can be any model — but it should be a *stronger* one than the model
 * under test. Judging Haiku with Haiku mostly measures self-consistency.
 */
import type { LLMProvider } from '../llm/provider';
import type { EvalQuestion } from '../content/load';

export interface JudgeScores {
  inDomain: number;
  actionable: number;
  accurate: number;
  grounded: number;
  notes: string;
}

export interface JudgeResult extends JudgeScores {
  /** Mean of the four axes, 1-5. */
  overall: number;
  /** True when the judge could not be parsed — counted separately rather than
   *  silently scored zero, which would look like a model failure. */
  failed: boolean;
}

const RUBRIC = `You are grading a coach's answer inside a paid learning app.

Score each axis 1-5 (5 best):
- inDomain: stayed within the skill's subject and did not drift.
- actionable: the user could do something concrete with this.
- accurate: factually sound, with no invented specifics.
- grounded: reflects THE GUIDE below rather than generic advice. If the answer
  correctly declines a request, grounded should score on whether the decline
  matched the guide's stated limits.

Reply with ONLY a JSON object, no prose, no code fence:
{"inDomain":N,"actionable":N,"accurate":N,"grounded":N,"notes":"one sentence"}`;

function extractJson(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
}

export async function judgeAnswer(params: {
  provider: LLMProvider;
  model: string;
  question: EvalQuestion;
  answer: string;
  guideText: string;
}): Promise<JudgeResult> {
  const { provider, model, question, answer, guideText } = params;

  const result = await provider.complete({
    model,
    maxTokens: 512,
    system: RUBRIC,
    promptCaching: true,
    messages: [
      {
        role: 'user',
        content: [
          'THE GUIDE:',
          guideText,
          '',
          `QUESTION TYPE: ${question.kind}`,
          `QUESTION: ${question.question}`,
          `WHAT A CORRECT ANSWER MUST DO: ${question.expectation}`,
          '',
          "THE COACH'S ANSWER:",
          answer,
        ].join('\n'),
      },
    ],
  });

  const parsed = extractJson(result.text) as Partial<JudgeScores> | null;

  if (!parsed) {
    return {
      inDomain: 0,
      actionable: 0,
      accurate: 0,
      grounded: 0,
      notes: `judge output unparseable: ${result.text.slice(0, 120)}`,
      overall: 0,
      failed: true,
    };
  }

  const scores: JudgeScores = {
    inDomain: clamp(parsed.inDomain),
    actionable: clamp(parsed.actionable),
    accurate: clamp(parsed.accurate),
    grounded: clamp(parsed.grounded),
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  };

  return {
    ...scores,
    overall:
      (scores.inDomain + scores.actionable + scores.accurate + scores.grounded) / 4,
    failed: false,
  };
}
