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
  mandatory** (up to 90% off cached input).
- Target: a typical user costs under 10% of subscription revenue.
- Static guide content costs $0 to serve. Prefer serving content over
  generating it wherever the answer is the same for everyone.

### Measured, Phase 2 (`npm run economics`)

The caching rule needed aiming, not relitigating. **Haiku 4.5 has a
4096-token minimum cacheable prefix**: a system block below it silently does
not cache — no error, `cache_read_input_tokens` just stays 0. Phase 1's
prompts were ~300 tokens, so caching was wired correctly and doing nothing.

Injecting the full guide into the system block (see `assembleSystemPrompt`)
takes it to ~5.2–5.8k tokens, which clears the minimum and makes caching
actually pay:

- ~$0.0026 per turn cached, versus ~$0.0079 uncached — roughly 3x.
- A typical user (~1 turn/day) costs **~$0.08/month, about 0.8% of a $10
  price**. Token cost is not where this product's margin is won.
- Store commission (15–30%) and an uncalibrated daily cap both dominate token
  cost by more than an order of magnitude. Caps are derived in
  `functions/src/entitlement.ts`; re-derive them when the price is set.

Guides must therefore stay long enough to keep the system block over 4096
tokens. `npm run content:build` warns when a skill falls under.

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
