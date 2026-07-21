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

## Phase 1 — Walking skeleton
Goal: **login → list → detail → chat, one hardcoded skill, no payment, no
polish.** Proves the whole path end to end.

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

## Phase 2 — Freeze the contract & schema, seed real content
1. Move the hardcoded skill into Firestore as a `SkillDocument`; `getSkill`
   projects `SkillPublic`. → verify: prompt never appears in any client payload
   (inspect network).
2. Skill authoring/upload script (Firebase Admin, validates against
   `skillSchema.ts`). → verify: upload a skill from a JSON doc.
3. **Author 3 skills, content first** (guides must stand on their own).
4. **Eval set: 30 questions/skill**, check Haiku quality; flag any skill needing
   Sonnet (set in its Firestore `model` field). → verify: eval harness runs,
   quality logged per skill.

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
