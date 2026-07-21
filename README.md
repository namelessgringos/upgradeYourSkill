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

Phase 0 (foundations) complete: repo, stack, design system, docs, schema. Next:
Phase 1 walking skeleton (login → list → detail → chat, one hardcoded skill).
See the implementation plan.

## Develop

```bash
npm install
npm start          # Expo dev server
npm run lint
```

Server (added in Phase 1) lives under `functions/`. Never commit secrets — see
`.gitignore` (`.env`, `google-services.json`, `GoogleService-Info.plist`).
