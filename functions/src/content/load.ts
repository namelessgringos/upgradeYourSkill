/**
 * Loads authored skills from `functions/content/` into `SkillDocument`s.
 *
 * Layout per skill — the file split mirrors the public/private split in
 * SKILL_SCHEMA.md, so it is obvious at a glance which file is safe to serve:
 *
 *   functions/content/<skillId>/
 *     meta.json    public metadata
 *     guide.md     public — the product. `##` headings become GuideSection[].
 *     coach.md     PRIVATE — system prompt, with model config + safety
 *                  boundaries in a JSON frontmatter block.
 *     evals.jsonl  30 eval questions (read by the eval harness, not shipped)
 *
 * Frontmatter is JSON rather than YAML on purpose: it needs no parser
 * dependency and has no ambiguity about types or multi-line strings.
 *
 * These files are read by local build/seed/eval scripts only. Nothing at
 * request time touches them — `chat` reads the skill from Firestore.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  GuideSection,
  SkillDocument,
  SkillModelConfig,
} from '../../../server-shared/skillSchema';

/** Scripts run via `npm --prefix functions`, so cwd is the functions package. */
export const CONTENT_DIR = resolve(process.cwd(), 'content');

export interface EvalQuestion {
  id: string;
  question: string;
  /**
   * `boundary` questions must be refused or redirected; `domain` questions
   * must be answered from the guide; `offtopic` must be steered back.
   *
   * `redflag` inverts the boundary test. The user has described something
   * that needs urgent care, so silence is not safety — the coach has to say
   * so, first, and must not reassure. Passing means escalating, not declining.
   */
  kind: 'domain' | 'boundary' | 'offtopic' | 'redflag';
  /** What a correct answer has to do. Given to the judge verbatim. */
  expectation: string;
}

interface CoachFrontmatter {
  model: SkillModelConfig;
  safetyBoundaries: string[];
  examples?: { user: string; assistant: string }[];
  evalSetId?: string;
}

/**
 * Splits `# Title` / `## Section` markdown into guide sections. Only `##`
 * starts a section; anything before the first one (a title, an intro line) is
 * ignored, so authors can keep the file readable on its own.
 */
export function parseGuideMarkdown(markdown: string): GuideSection[] {
  const sections: GuideSection[] = [];
  let heading: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (heading === null) return;
    sections.push({ heading, body: body.join('\n').trim() });
    body = [];
  };

  for (const line of markdown.split('\n')) {
    const match = /^##\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[1].trim();
    } else if (heading !== null) {
      body.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.body.length > 0);
}

/** Extracts the leading `---` JSON block and returns it with the remaining body. */
export function parseFrontmatter(source: string): { data: unknown; body: string } {
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('---')) {
    throw new Error('coach.md must begin with a --- JSON frontmatter block');
  }
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    throw new Error('coach.md frontmatter block is not closed with ---');
  }
  const raw = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).trim();

  try {
    return { data: JSON.parse(raw), body };
  } catch (error) {
    throw new Error(
      `coach.md frontmatter is not valid JSON: ${(error as Error).message}`
    );
  }
}

function read(dir: string, file: string): string {
  const path = join(dir, file);
  if (!existsSync(path)) {
    throw new Error(`missing ${file} in ${dir}`);
  }
  return readFileSync(path, 'utf8');
}

export function loadSkillFromDir(skillId: string, dir: string): SkillDocument {
  const meta = JSON.parse(read(dir, 'meta.json')) as Record<string, unknown>;
  const guide = parseGuideMarkdown(read(dir, 'guide.md'));
  const { data, body } = parseFrontmatter(read(dir, 'coach.md'));
  const front = data as CoachFrontmatter;

  return {
    ...(meta as unknown as SkillDocument),
    id: skillId,
    guide,
    systemPrompt: body,
    safetyBoundaries: front.safetyBoundaries ?? [],
    model: front.model,
    examples: front.examples,
    evalSetId: front.evalSetId,
  };
}

export function listSkillDirs(contentDir = CONTENT_DIR): string[] {
  if (!existsSync(contentDir)) {
    throw new Error(
      `content directory not found at ${contentDir} — run from the functions package`
    );
  }
  return readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function loadAllSkills(contentDir = CONTENT_DIR): SkillDocument[] {
  return listSkillDirs(contentDir).map((id) =>
    loadSkillFromDir(id, join(contentDir, id))
  );
}

export function loadEvalQuestions(
  skillId: string,
  contentDir = CONTENT_DIR
): EvalQuestion[] {
  const path = join(contentDir, skillId, 'evals.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
    .map((line, i) => {
      try {
        return JSON.parse(line) as EvalQuestion;
      } catch (error) {
        throw new Error(
          `${skillId}/evals.jsonl line ${i + 1} is not valid JSON: ${(error as Error).message}`
        );
      }
    });
}
