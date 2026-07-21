# SKILL CONTENT SCHEMA

> **Amended 2026-07-21:** `SkillPublic` gained `emoji` and `starters`. Both are
> cosmetic, both were already in the approved UI, neither is secret. The
> canonical source is `server-shared/skillSchema.ts`.

The contract between content authors and the app. Everything downstream depends
on this, so it is frozen **before** any skill is written. Types:
`server-shared/skillSchema.ts`.

## The split (this is the whole point)

A skill is one Firestore document (`SkillDocument`) with two halves:

| Half | Contains | Who sees it |
|---|---|---|
| `SkillPublic` | id, title, promise, tier, summary, **guide sections**, coach name/tagline, published | **Client + server.** Safe to serialize to the app. |
| `SkillPrivate` | **system prompt**, safety boundaries, model config, few-shot examples, eval set ref | **Server only.** Never serialized to the client, never bundled in the APK. |

The chat endpoint reads `SkillPrivate.systemPrompt`, appends
`safetyBoundaries`, assembles the call server-side, and streams back only the
coach's reply. The client never receives the prompt. This split *is*
non-negotiable rule #1 made concrete — it is what makes the product hard to copy.

## Fields

- **guide** — `GuideSection[]`, human-authored static content. This is the
  product the subscription pays for; it is served as-is at $0 LLM cost. Author
  it first; if the guide is not worth paying for on its own, the app will not
  save it (BLUEPRINT).
- **model** — `SkillModelConfig` in the DB, not in code. Default
  `claude-haiku-4-5`, `promptCaching: true`. Bump one skill to Sonnet by editing
  the document — no app release (rule #2).
- **safetyBoundaries** — explicit per-skill limits, appended to the system
  prompt server-side (rule + safety section of BLUEPRINT). Not left to the
  model's discretion.
- **coachName / coachTagline** — cosmetic only in v1. This is NOT the persona
  system (personas, switching, memory are Out of scope).

## Authoring pipeline (v1, minimal)

1. Author writes the guide + system prompt + boundaries in a plain doc/JSON
   matching `SkillDocument`.
2. A tiny upload script (Firebase Admin) validates against the schema and writes
   the document to the `skills` collection.
3. The client's skill list/detail reads only the projected `SkillPublic` via the
   API (`docs/API_CONTRACT.md`), never the raw document.

Anything fancier (CMS, review workflow, versioning) is post-MVP.
