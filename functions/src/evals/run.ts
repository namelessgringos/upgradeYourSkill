/**
 * Eval harness. Two jobs:
 *
 *   1. BLUEPRINT's requirement: 30 real questions per skill, checked for
 *      quality before pricing.
 *   2. The model-comparison instrument — run the same questions against Haiku
 *      and against a local open-weight model and compare like for like.
 *
 * It answers through the production `LLMProvider` interface and the real
 * `assembleSystemPrompt`, so what is measured is the path users get, guide
 * injection and all.
 *
 * Usage (from the repo root):
 *   npm run evals -- --provider echo
 *   npm run evals -- --provider ollama --model qwen3.6:35b-a3b
 *   npm run evals -- --provider anthropic --model claude-haiku-4-5 --judge-model claude-sonnet-5
 *   npm run evals -- --skill strength --limit 5
 *
 * Token percentiles printed at the end are the p90 input to scripts/economics.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SkillDocument } from '../../../server-shared/skillSchema';
import { loadAllSkills, loadEvalQuestions, type EvalQuestion } from '../content/load';
import { AnthropicProvider } from '../llm/anthropic';
import { EchoProvider } from '../llm/echo';
import { OpenAICompatibleProvider } from '../llm/openaiCompatible';
import type { LLMProvider, LLMUsage } from '../llm/provider';
import { assembleSystemPrompt } from '../skills';
import { judgeAnswer, type JudgeResult } from './judge';
import { checkBoundaries, handledBoundaryWell, type Violation } from './rules';

interface Args {
  provider: string;
  model?: string;
  judgeModel?: string;
  skill?: string;
  limit?: number;
  baseUrl?: string;
  noJudge: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    provider: get('--provider') ?? 'echo',
    model: get('--model'),
    judgeModel: get('--judge-model'),
    skill: get('--skill'),
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    baseUrl: get('--base-url'),
    noJudge: argv.includes('--no-judge'),
  };
}

/** Local servers are the point of this harness, so they get first-class names. */
function makeProvider(args: Args): { provider: LLMProvider; defaultModel: string } {
  const key = process.env.ANTHROPIC_API_KEY;

  switch (args.provider) {
    case 'anthropic': {
      if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
      return { provider: new AnthropicProvider(key), defaultModel: 'claude-haiku-4-5' };
    }
    case 'ollama':
      return {
        provider: new OpenAICompatibleProvider({
          baseUrl: args.baseUrl ?? 'http://127.0.0.1:11434/v1',
          label: 'ollama',
        }),
        defaultModel: 'qwen3',
      };
    case 'lmstudio':
      return {
        provider: new OpenAICompatibleProvider({
          baseUrl: args.baseUrl ?? 'http://127.0.0.1:1234/v1',
          label: 'lmstudio',
        }),
        defaultModel: 'local-model',
      };
    case 'openai-compatible':
      return {
        provider: new OpenAICompatibleProvider({
          baseUrl: args.baseUrl ?? required('--base-url'),
          apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
          label: 'openai-compatible',
        }),
        defaultModel: 'unknown',
      };
    case 'echo':
      return { provider: new EchoProvider(), defaultModel: 'echo' };
    default:
      throw new Error(`Unknown provider '${args.provider}'.`);
  }
}

function required(flag: string): never {
  throw new Error(`${flag} is required for this provider.`);
}

interface QuestionResult {
  id: string;
  kind: EvalQuestion['kind'];
  question: string;
  answer: string;
  violations: Violation[];
  boundaryHandled: boolean | null;
  judge: JudgeResult | null;
  usage: LLMUsage;
  latencyMs: number;
  error?: string;
}

interface SkillReport {
  skillId: string;
  model: string;
  provider: string;
  /**
   * Size of the assembled system block. It is byte-identical on every call for
   * a skill, so it is exactly the portion prompt caching applies to. Recorded
   * because a provider that cannot report cache reads (echo, most local
   * servers) would otherwise make caching invisible to the cost model.
   */
  systemTokensEstimate: number;
  results: QuestionResult[];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function guideText(skill: SkillDocument): string {
  return skill.guide.map((s) => `### ${s.heading}\n\n${s.body}`).join('\n\n');
}

async function runSkill(
  skill: SkillDocument,
  questions: EvalQuestion[],
  provider: LLMProvider,
  model: string,
  judge: { provider: LLMProvider; model: string } | null
): Promise<SkillReport> {
  const system = assembleSystemPrompt(skill);
  const results: QuestionResult[] = [];

  for (const question of questions) {
    const started = Date.now();
    try {
      const answer = await provider.complete({
        model,
        maxTokens: skill.model.maxTokens,
        system,
        promptCaching: skill.model.promptCaching,
        messages: [{ role: 'user', content: question.question }],
      });

      const violations = checkBoundaries(answer.text, skill.id);

      results.push({
        id: question.id,
        kind: question.kind,
        question: question.question,
        answer: answer.text,
        violations,
        boundaryHandled:
          question.kind === 'boundary'
            ? handledBoundaryWell(answer.text, skill.id)
            : null,
        judge: judge
          ? await judgeAnswer({
              provider: judge.provider,
              model: judge.model,
              question,
              answer: answer.text,
              guideText: guideText(skill),
            })
          : null,
        usage: answer.usage,
        latencyMs: Date.now() - started,
      });
      process.stdout.write(violations.length > 0 ? '!' : '.');
    } catch (error) {
      results.push({
        id: question.id,
        kind: question.kind,
        question: question.question,
        answer: '',
        violations: [],
        boundaryHandled: null,
        judge: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
        latencyMs: Date.now() - started,
        error: (error as Error).message,
      });
      process.stdout.write('E');
    }
  }
  process.stdout.write('\n');

  return {
    skillId: skill.id,
    model,
    provider: provider.name,
    systemTokensEstimate: Math.round(system.length / 4),
    results,
  };
}

function summarise(report: SkillReport): string[] {
  const { results } = report;
  const errors = results.filter((r) => r.error);
  const violations = results.flatMap((r) => r.violations);
  const boundary = results.filter((r) => r.kind === 'boundary');
  const boundaryOk = boundary.filter((r) => r.boundaryHandled).length;
  const judged = results.filter((r) => r.judge && !r.judge.failed);
  const meanOverall =
    judged.length > 0
      ? judged.reduce((n, r) => n + (r.judge?.overall ?? 0), 0) / judged.length
      : 0;

  const inputTokens = results.map((r) => r.usage.inputTokens + r.usage.cacheReadTokens);
  const outputTokens = results.map((r) => r.usage.outputTokens);
  const cacheReads = results.reduce((n, r) => n + r.usage.cacheReadTokens, 0);

  return [
    `  questions          ${results.length} (${errors.length} errored)`,
    `  boundary violations ${violations.length}${violations.length > 0 ? '  <-- HARD FAIL' : ''}`,
    `  boundary handled    ${boundaryOk}/${boundary.length}`,
    `  judge mean          ${meanOverall.toFixed(2)}/5${judged.length === 0 ? ' (not judged)' : ''}`,
    `  input tokens p50/p90 ${percentile(inputTokens, 50)}/${percentile(inputTokens, 90)}`,
    `  output tokens p50/p90 ${percentile(outputTokens, 50)}/${percentile(outputTokens, 90)}`,
    `  cache reads         ${cacheReads}${cacheReads === 0 ? '  (caching inactive)' : ''}`,
    `  latency p50/p90 ms  ${percentile(results.map((r) => r.latencyMs), 50)}/${percentile(results.map((r) => r.latencyMs), 90)}`,
  ];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { provider, defaultModel } = makeProvider(args);
  const model = args.model ?? defaultModel;

  let judge: { provider: LLMProvider; model: string } | null = null;
  if (!args.noJudge) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) {
      judge = {
        provider: new AnthropicProvider(key),
        model: args.judgeModel ?? 'claude-sonnet-5',
      };
    } else {
      console.log('No ANTHROPIC_API_KEY — running deterministic checks only.\n');
    }
  }

  const skills = loadAllSkills().filter((s) => !args.skill || s.id === args.skill);
  if (skills.length === 0) throw new Error(`No skill matched '${args.skill}'.`);

  console.log(`provider=${provider.name} model=${model} judge=${judge?.model ?? 'none'}\n`);

  const reports: SkillReport[] = [];
  for (const skill of skills) {
    let questions = loadEvalQuestions(skill.id);
    if (questions.length === 0) {
      console.log(`${skill.id}: no evals.jsonl, skipping`);
      continue;
    }
    if (args.limit) questions = questions.slice(0, args.limit);

    console.log(`${skill.id} (${questions.length} questions)`);
    const report = await runSkill(skill, questions, provider, model, judge);
    reports.push(report);
    console.log(summarise(report).join('\n'), '\n');
  }

  const dir = resolve(process.cwd(), 'evals/reports');
  mkdirSync(dir, { recursive: true });
  // Timestamp comes from the filename, not the payload, so reports diff cleanly.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(dir, `${provider.name}-${model.replace(/[^\w.-]/g, '_')}-${stamp}.json`);
  writeFileSync(path, JSON.stringify({ provider: provider.name, model, reports }, null, 2));

  const totalViolations = reports.reduce(
    (n, r) => n + r.results.flatMap((q) => q.violations).length,
    0
  );

  console.log(`Report written to ${path}`);
  if (totalViolations > 0) {
    console.log(
      `\n${totalViolations} boundary violation(s). This model is not shippable for these skills as-is.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
