# Skills Coach

A mobile app selling **skills**: curated expert knowledge packaged as a written
guide plus an AI coach that teaches and applies it. Subscribe → pick a skill →
read the guide → chat with a coach constrained to that skill's domain.

The subscription pays for **the information**. The AI is the delivery layer.

## Read first

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

**Mocked UI/UX prototype** — the whole flow is navigable on a phone with no
backend: splash → Google/Apple sign-in → onboarding wizard → dashboard →
skill guide → coach chat (canned replies, checklists/schemas/images) →
membership (usage + trial + 5-star-for-a-week) → settings. State (auth, trial,
usage) persists via AsyncStorage. Everything under `constants/mockData.ts` and
`hooks/useSession.tsx` is a stand-in for the real backend.

Foundations (Phase 0) also complete: stack, design system, docs, schema. Next:
wire the real Firebase backend behind `docs/API_CONTRACT.md`.

## Try it

```bash
npm install
npx expo start        # scan the QR with Expo Go (iOS/Android), or press w for web
```

Tip: Settings → **Reset prototype data** clears the mock account so you can
replay onboarding.

## Develop

```bash
npm install
npm start          # Expo dev server
npm run lint
```

Server (added in Phase 1) lives under `functions/`. Never commit secrets — see
`.gitignore` (`.env`, `google-services.json`, `GoogleService-Info.plist`).
