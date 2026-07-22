# IMPLEMENTATION PLAN — Skills Coach

Step-by-step build order for MVP v1. Philosophy (from `CLAUDE.md`): **walking
skeleton before anything proper; freeze the contract before parallel work;
content schema before content; content before polish.**

Scope authority is `docs/BLUEPRINT.md`. Do not build anything in its "Out of
scope" list.

---

## Stack decision (decided — stop revisiting)

| Layer | Choice | Why |
|---|---|---|
| Client | React Native + Expo SDK 54, TypeScript, Expo Router | Same stack as Sudoku → the design system ports 1:1. Targets iOS, Android, and web/PWA from one codebase. |
| Design system | Reused from Sudoku (`constants/theme.ts`, `docs/DESIGN_SYSTEM.md`) | One visual language; no second framework. |
| Server | Firebase Cloud Functions (2nd gen) | Prompt assembly, entitlement, metering, provider abstraction all server-side. |
| DB | Firestore | Skills (public+private), entitlements, per-user usage. |
| Auth | Firebase Auth (email/password) | No OAuth/social in v1. |
| LLM | Anthropic API | Default `claude-haiku-4-5`, model-per-skill in Firestore. |
| Billing | **Open** — RevenueCat (native IAP) vs Stripe (web/PWA) | Blocked on the distribution-surface decision (BLUEPRINT open Q1/Q2). |

### Model & cost (the "cheapest model" answer)

- **Coach runtime model = Haiku 4.5** ($1/M in, $5/M out) — the cheapest current
  Claude model, and what the coach runs on. With **mandatory prompt caching**
  (the system prompt is identical every call, ~90% off cached input), a chat
  turn ≈ **$0.006**.
- Opus is a *dev-time* model (writing this app), **not** the runtime coach.
  Running Opus per user would be ~5× the cost and blow the "<10% of revenue"
  target. Per-skill model config in Firestore lets one skill move to Sonnet 5
  ($3/$15) later without an app release.

---

## Phase 0 — Foundations ✅ (this repo)

Done in this commit:
- Repo + stack decided, `CLAUDE.md`, `.gitignore`, Expo config.
- Design system ported: `constants/theme.ts`, themed primitives, hooks.
- `docs/DESIGN_SYSTEM.md`, `docs/BLUEPRINT.md`, `docs/SKILL_SCHEMA.md`,
  `docs/API_CONTRACT.md`.
- Skill schema types: `server-shared/skillSchema.ts`.

**Verify:** `npm install` resolves; `npx tsc --noEmit` passes; `npm run lint`
clean.

## Phase 1 — Walking skeleton ✅ (emulator)
Goal: **login → list → detail → chat, no payment, no polish.** Proves the whole
path end to end.

Done: Firebase config committed (no secrets); real Firebase Auth behind the
existing Google/Apple UI; `listSkills` / `getSkill` / `chat` / `getEntitlement`
/ `getUsage` per `API_CONTRACT.md`; all 3 skills seeded to Firestore as
`SkillDocument`s with server-only prompts; entitlement checked and tokens
metered on every chat call.

Deviations from the original plan, all deliberate:
- All 3 skills went straight into Firestore rather than one hardcoded skill —
  Phase 2 step 1 pulled forward, so there is no throwaway hardcoded path.
- Runs against the **emulator suite only**. No cloud project, no Anthropic key.
  The `AnthropicProvider` is written and typechecked but has not executed a
  real API call; `EchoProvider` stands in when no key is present.
- Entitlement (Phase 3) landed early because the approved UI already has a
  free tier, a trial, and a usage meter that need a server to be truthful.

**Still open before this is production-real:** create the Firebase project
(Blaze — Functions need outbound HTTP), set `ANTHROPIC_API_KEY` in Secret
Manager, and run the eval sets. Real Google/Apple OAuth needs client IDs, an
Apple Developer account, and a dev build — it will not run in Expo Go.

1. Firebase project + `firebase init` (Functions + Firestore + Auth). → verify:
   emulator boots.
2. Client Firebase config via env/`expo-constants` (no secrets in git). Auth
   screens (register/login/verify/reset) with Firebase Auth SDK. → verify: can
   create a user and sign in.
3. Cloud Functions: `listSkills`, `getSkill`, `chat` per `API_CONTRACT.md`.
   `chat` loads a **hardcoded** skill's private prompt, calls Anthropic through
   a `LLMProvider` interface (one impl), returns a reply. → verify: curl the
   function with a valid ID token, get a coached reply.
4. Client screens: skills list → detail (guide) → chat, wired to the functions.
   Build the `components/ui/*` library first (`DESIGN_SYSTEM.md` §5). → verify:
   on-device, sign in → open skill → send a message → see a reply.

**Exit gate:** the four steps work against the real backend with one seeded
skill. No payment yet.

## Phase 2 — Content, grounding & model independence ✅ (pending real-model evals)

1. ✅ Skills live in Firestore as `SkillDocument`s; `getSkill` projects
   `SkillPublic`. Verified by `npm run e2e` — asserts no prompt or guide body
   reaches an unentitled client.
2. ✅ Authoring pipeline: skills are authored as Markdown + JSON under
   `functions/content/<id>/` and validated by `server-shared/validateSkill.ts`
   (runtime, since the schema types are compile-time only). `npm run
   content:build` gates on a 1200-word minimum guide.
3. ✅ **3 skills authored, content first** — 2714–2983 words each, 9 sections.
4. ✅ **Eval harness with 30 questions/skill** (`npm run evals`). Two layers:
   deterministic boundary rules (a violation is a hard fail, self-tested by
   `npm run check:rules`) and an LLM judge. `--provider` / `--model` turn it
   into a model-comparison matrix.
5. ✅ **Guide grounding instead of RAG.** `assembleSystemPrompt` injects the
   whole guide. One skill per conversation means the corpus already fits in
   context, so retrieval would add machinery that can only lose sections. Side
   effect: the system block clears Haiku's 4096-token cache minimum, so prompt
   caching finally applies (~3x cheaper per turn).
6. ✅ **Caps re-derived from measurement** (`npm run economics`). 500/day was
   authorising ~$39/user/month. Now 5 / 30 / 40.
7. ✅ Cost-per-user query (`npm run cost:report`) — rule #5 satisfied.

**Still open:** the eval numbers were produced with the echo provider, so
quality scores and the Haiku-vs-Sonnet decision per skill are not yet answered.
That needs an `ANTHROPIC_API_KEY` (~$1–2 per full run).

### Model independence (added Phase 2)

`OpenAICompatibleProvider` covers Ollama, LM Studio, vLLM, and hosted
open-weight providers behind the existing `LLMProvider` interface. This is
**benchmarking capability, not live routing** — BLUEPRINT keeps multi-provider
routing out of v1, and Anthropic remains the only production provider.

Local candidates for a 36GB Mac Studio are MoE models (dense 24–27B runs at
~4–5 tok/s on Apple Silicon; MoE reaches ~20–22): Qwen3.6-35B-A3B, Gemma 4
26B-A4B. The decisive metric is **boundary adherence, not fluency** — a coach
that drifts into diagnosis is a liability no throughput number offsets. Note
the Mac Studio is a benchmark box, not a production origin.

## Phase 3 — Entitlement, metering, trial, meter UI
1. Entitlement service + `getEntitlement`; gate `getSkill.guide` and `chat` on
   it (`402` otherwise). → verify: unentitled user gets paywall, entitled gets
   guide+chat.
2. Per-user token metering written to `users/{uid}/usage/{period}` on every
   `chat`; cost-per-user query. → verify: dashboard/query returns cost per user.
3. **7-day trial with hard daily message cap** (`429 cap_reached`). → verify:
   cap enforced server-side.
4. **Always-visible usage meter** in the app (`getUsage` → `UsageMeter`). →
   verify: meter fills as messages are sent.

## Phase 4 — Billing & the one price
Blocked on distribution-surface decision (native vs PWA → RevenueCat vs Stripe).
1. Integrate billing provider; signature-verified webhook → entitlement doc.
2. **ONE monthly price**, set from measured **p90 usage** (needs Phase 2/3
   data). → verify: purchase flow flips entitlement to `active`.
3. **Soft cap: pause + opt-in to continue. Never auto-charge** (`429 soft_cap`).
4. Model TRUE margin after app-store commission before finalizing the price.

## Phase 5 — Hardening & ship
1. R8/ProGuard obfuscation + resource shrinking (Android). Confirm no prompts
   in the binary.
2. Server-side rate limiting + per-account anomaly detection; cost-per-user
   alerting (catch a runaway account in hours).
3. Closed beta with 10 paying users; launch metrics (activation, D7, margin/user).

---

## Guardrails throughout
- Nothing from BLUEPRINT "Out of scope" (personas, connectors, gifting, tiers,
  learning paths, multi-provider) enters v1.
- Every server call: verify token → check entitlement → meter tokens.
- Safety boundaries appended server-side to every coach call; a coach never
  diagnoses or claims qualification.
- Follow `AGENTS`/`DESIGN_SYSTEM` conventions; no ESLint/TS disables.
