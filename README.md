# Skills Coach

A mobile app selling **skills**: curated expert knowledge packaged as a written
guide plus an AI coach that teaches and applies it. Subscribe → pick a skill →
read the guide → chat with a coach constrained to that skill's domain.

The subscription pays for **the information**. The AI is the delivery layer.

## Read first

- [`docs/STATUS.md`](./docs/STATUS.md) — **where the project actually is, and what to do next.**
- [`CLAUDE.md`](./CLAUDE.md) — project context & non-negotiable rules.
- [`docs/BLUEPRINT.md`](./docs/BLUEPRINT.md) — **scope authority** (MVP v1 vs out of scope).
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — step-by-step build order.
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — the reused "paper & ink" design system.
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — frozen app ⇄ server contract.
- [`docs/SKILL_SCHEMA.md`](./docs/SKILL_SCHEMA.md) — skill content schema.

## Stack

React Native + Expo (SDK 54) client · Firebase Cloud Functions + Firestore +
Auth server · Anthropic API (Haiku 4.5 default, model-per-skill in the DB).
Client is a thin shell — all prompts assembled server-side.

## Status

**Phase 1 walking skeleton, running on the Firebase emulator.** The whole flow
is real end to end: Firebase Auth sign-in → skills loaded from Firestore →
guide gated by a server-side entitlement check → chat through a Cloud Function
that assembles the prompt server-side and meters tokens per user.

The client is a thin shell: no prompt, model name, or skill config ships in the
app. `constants/mockData.ts` is gone.

Not yet real: no cloud project (emulator only) and no Anthropic key, so `chat`
currently answers via `EchoProvider`. `AnthropicProvider` is written but has
not made a live API call. Real Google/Apple OAuth needs client IDs and a dev
build; against the emulator the existing buttons mint a test credential.

## Run it

Prerequisites: Node 22+, and **JDK 21+** (the Firestore emulator requires it —
`brew install openjdk@21`).

```bash
npm install
npm --prefix functions install
npm --prefix functions run build

# terminal 1 — backend
npm run emulators

# terminal 2 — seed the 3 skills (once per emulator start)
npm run seed

# terminal 3 — the app
npx expo start        # Expo Go on a device, or press w for web
```

The app auto-detects the emulator and resolves the host from the Expo dev
server, so a phone on the same network works without configuration.

To point at a real project instead, set `EXPO_PUBLIC_FIREBASE_API_KEY` and
friends; the emulator connection switches off automatically.

To use the real Anthropic provider, put the key where the emulator can see it:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > functions/.secret.local   # gitignored
```

## Authoring skills

Skills are authored as files, not code, under `functions/content/<skillId>/`:

| file | half | what it is |
|---|---|---|
| `guide.md` | public | The product. `##` headings become guide sections. |
| `meta.json` | public | Title, promise, tier, emoji, coach name, starters. |
| `coach.md` | **private** | System prompt; model config + safety boundaries in JSON frontmatter. |
| `evals.jsonl` | — | 30 eval questions. |

```bash
npm run content:build    # validate every skill (fails under 1200 guide words)
npm run seed             # write them to the emulator
```

`coach.md` never leaves the server. Two guardrails enforce that: the seed script
refuses to write to a live project without `ALLOW_PRODUCTION_SEED=yes`, and
`npm run e2e` asserts no prompt or guide body reaches an unentitled client.

Guides must stay long enough that the assembled system block clears **4096
tokens** — below that, Haiku 4.5 silently stops caching the prompt and every
turn pays full input price. `content:build` warns when a skill falls under.

## Quality & cost

```bash
npm run check:rules      # self-test the deterministic boundary rules
npm run evals -- --provider echo                        # no API key needed
npm run evals -- --provider ollama --model qwen3.6:35b-a3b   # local model
npm run evals -- --provider anthropic                   # needs ANTHROPIC_API_KEY
npm run economics        # turn eval tokens into cost and daily caps
npm run cost:report      # cost per user (non-negotiable rule #5)
```

The eval harness grades in two layers: deterministic boundary rules, where a
violation is a hard fail, and an LLM judge for quality. `--provider` /
`--model` make it a comparison matrix, which is how a local open-weight model
gets assessed against Haiku. Benchmarking only — Anthropic is the sole
production provider (BLUEPRINT keeps multi-provider routing out of v1).

Caveat: an echo run produces the right *shape* but meaningless *numbers* — its
answers are ~50 tokens where a real one is ~400, and output is priced 5x input.
Pass `ASSUMED_OUTPUT_TOKENS=400` to `economics` until a real model is measured.

## Develop

```bash
npx tsc --noEmit                  # client types
npx expo lint
npm --prefix functions run typecheck
npm run e2e                       # end-to-end against the emulator
```

Server lives under `functions/`; types shared with the client are in
`server-shared/`. Never commit secrets — see `.gitignore`.
