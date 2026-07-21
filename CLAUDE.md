# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

A mobile app selling **skills**: curated expert knowledge packaged as a written
guide plus an AI coach that teaches and applies it. Users subscribe, pick a
skill from a list, read the guide, and chat with a coach constrained to that
skill's domain.

The subscription pays for **the information**. The AI is the delivery layer,
not the product.

## Current phase

MVP v1. Nothing in `docs/BLUEPRINT.md` marked "Out of scope" gets built yet,
no matter how easy it looks.

## Stack

Decided (see `docs/IMPLEMENTATION_PLAN.md` for the full rationale):

- **Client:** React Native + Expo (SDK 54), TypeScript, Expo Router — the same
  stack as the Sudoku app, so the design system ports directly.
- **Design system:** reused from the Sudoku app. Tokens live in
  `constants/theme.ts`; the guide is `docs/DESIGN_SYSTEM.md`. Do not introduce a
  second design language or a second framework.
- **Server:** Firebase — Cloud Functions (prompt assembly, entitlement,
  metering, provider abstraction) + Firestore (skills, entitlements, usage) +
  Firebase Auth (email/password). The client is a thin shell.
- **LLM:** Anthropic API, default model Haiku 4.5, model-per-skill in Firestore.

## Non-negotiable rules

These are architectural decisions already made. Do not relitigate them in code.

1. **No prompts, skill content, or system instructions ship inside the app
   binary.** Ever. The client is a thin shell. All prompt assembly happens
   server-side. Obfuscation is not protection; anything in the APK is
   recoverable.

2. **Model choice per skill lives in the database, not in code.** Moving a
   skill from Haiku to Sonnet must not require an app release.

3. **All LLM calls go through a provider abstraction layer.** One provider
   ships in v1, but the interface exists from day one.

4. **Every server call checks entitlement.** No exceptions, no "internal"
   endpoints that skip it.

5. **Token usage is metered per user on every call** and written to durable
   storage. Cost-per-user must be queryable from day one.

6. **Never auto-charge for overage.** Soft cap, pause, user opts in.

7. **No dependency on reselling anyone's consumer AI subscription.** We pay
   API costs directly.

## Economics that constrain design

- Default model: Haiku 4.5 ($1/M input, $5/M output).
- Skill instructions are identical every call, so **prompt caching is
  mandatory** (up to 90% off cached input). A chat turn costs roughly $0.006.
- Target: a typical user costs under 10% of subscription revenue.
- Static guide content costs $0 to serve. Prefer serving content over
  generating it wherever the answer is the same for everyone.

## Safety boundaries

Skills cover domains like fitness and biomechanics. Every skill declares
explicit boundaries in its schema. A coach persona must not drift into
diagnosis, medical advice, or any claim of professional qualification. This is
enforced server-side in prompt assembly, not left to the model's discretion.

## Working style

- Build the walking skeleton before building anything properly.
- Freeze the API contract before parallel work starts.
- Content schema before content. Content before polish.
- When scope creep appears, check it against "Out of scope" and say no.
