# BLUEPRINT — Skills Coach

The scope authority. Assembled from the project brief (`CLAUDE.md`) and the
Todoist project **"Skills Distribution & Monetization" → section "MVP v1 · SHIP
THIS ONLY"**. If a feature is not in **In scope (MVP v1)** below, it does not
ship in v1 — no matter how easy it looks.

---

## Product

A mobile app selling **skills**: curated expert knowledge packaged as a written
guide plus an AI coach that teaches and applies it. The subscription pays for
**the information**; the AI is the delivery layer, not the product.

User loop: subscribe → see a flat list of skills → open a skill → read the
static guide → chat with a coach constrained to that skill's domain.

---

## In scope (MVP v1)

Exactly these. Source: the MVP v1 section of the Todoist project.

### Product surface
- ~~**Email register + login.**~~ **Amended 2026-07-21: Google / Apple
  sign-in.** The approved UI prototype ships social sign-in and that is the
  UX being built. Firebase Auth still owns identity. Still no personas. See
  `docs/API_CONTRACT.md` → Amendment.
- **Free tier** (amended 2026-07-21): one skill chosen at onboarding, hard
  daily message cap. Present in the approved prototype; enforced server-side.
- **Flat list of skills.** A scrollable list — title, one-line promise, price
  tier. No catalog UI, no search, no categories.
- **Skill detail page + written guide.** The actual product: curated,
  well-written, static content. Zero LLM cost to serve.
- **Chat with the selected skill.** One model (Haiku 4.5), one endpoint. Prompt
  lives on the server, never in the app.
- **Visible usage meter** in the app before any overage exists.

### Commerce
- **ONE subscription price, monthly only.** No complexity tiers, no
  1/2/3/5-month options, no gifting.
- **7-day trial with a hard message cap.** Full access to all skills, but
  capped messages/day. (Uncapped trial is the fastest way to lose money.)
- **Payment + entitlement check on every server call.**
- **Soft cap on overage: pause + user opts in to buy more. Never auto-charge.**

### Backend / platform (non-negotiables realized)
- **Thin client.** No skill content or prompt ships inside the APK.
- **Prompts assembled server-side**, behind auth, on every call.
- **Provider abstraction layer** — ship one provider (Anthropic) behind an
  interface.
- **Per-skill model config in the database**, not in code.
- **Per-user token metering + monthly cost dashboard** — cost per user visible
  from day one, not just aggregate.
- **R8 / ProGuard obfuscation on** (Android) — a speed bump, not the protection;
  the real protection is that nothing valuable is in the binary.

### Content & quality
- **Author 3 skills end-to-end, content first, before any code path depends on
  them.** If the written guides are not obviously worth paying for on their own,
  the app will not save them.
- **Eval set: 30 real questions per skill**, check Haiku quality per skill.
  Decide per skill whether Haiku is good enough or that one skill needs Sonnet —
  before pricing.

### Foundations (build once, write down, stop revisiting)
- Choose stack + set up repo, CI, environments. *(Decided: see
  `IMPLEMENTATION_PLAN.md`.)*
- Extract design system from the Sudoku project → `constants/theme.ts`,
  `docs/DESIGN_SYSTEM.md`.
- Define design tokens + core component library: button, card, list row, text
  input, chat bubble, usage meter, paywall sheet, empty state, loading, error.
- Define the **skill content schema** before writing any skill →
  `docs/SKILL_SCHEMA.md`.
- Define the **API contract** between app and server, and freeze it before
  parallel work → `docs/API_CONTRACT.md`.
- Build the skill authoring pipeline (how a skill gets from a doc into the app).
- **Walking skeleton:** login → list → detail → chat, one hardcoded skill, no
  payment, no polish. Proves the whole path before building anything properly.

---

## Out of scope (POST-MVP backlog — do not build yet)

Parked in Todoist epics E1–E15. Named here so "it's easy, let's just add it"
gets a clear no:

- Helper personas, persona switching, persona memory (E10).
- MCP connectors / one-tap OAuth to third-party services (E12).
- Gifting flow, redeem codes (E11).
- Flexible N-month terms; complexity-based pricing tiers (E11, E3).
- Learning paths / progression beyond a single skill (E9).
- Security badge/trust page, formal certification (SOC 2, ISO) (E13).
- Skill-vs-Agent distinction in the catalog (E9).
- Multi-provider routing, escalation rules, fallback routing (E14) — the
  *interface* ships in MVP; multiple live providers do not.
- Usage tiers/thresholds beyond the single soft cap; overage top-up storefront
  (E15).
- Certificate pinning, root/anti-tamper detection, Play Integrity / App Attest
  attestation (E13) — desirable, but not a v1 blocker.
- Native app-store IAP optimization, PWA-vs-native fallback decision (E4) — see
  Open questions.

---

## Pricing & economics (targets, not yet numbers)

- One monthly price. The number is set from **measured p90 usage**, not guessed
  — so it is deliberately left blank until the eval + metering data exists.
- Target: a typical user costs **under 10% of subscription revenue**.
- Levers: prompt caching (mandatory), model tiering per skill, serving static
  guide content instead of generating it.
- App-store commission (15–30%) materially changes real margin — model TRUE
  margin after commission before promising any overage economics.

---

## Safety boundaries

Skills cover domains like fitness and biomechanics. Every skill declares
explicit boundaries in its schema (`docs/SKILL_SCHEMA.md`). A coach must not
drift into diagnosis, medical/legal/financial advice, or any claim of
professional qualification. **Enforced server-side in prompt assembly**, not
left to the model's discretion.

---

## Open questions (resolve before the relevant milestone)

1. **Billing provider.** Firebase has no billing. Options: RevenueCat (wraps
   App Store / Play IAP, needed if we ship native to the stores) vs Stripe (if
   we ship PWA/web and take payment directly, avoiding store commission).
   Blocks: trial-with-cap, entitlement webhook, the subscription price itself.
2. **Distribution surface.** Native (App/Play Store, pays commission, best
   install trust) vs PWA/web (no commission, weaker mobile install story). The
   Expo codebase can target both; the decision drives the billing choice above.
3. **The single monthly price** — blocked on the eval + p90 metering data.
4. **Which 3 skills** to author first, and which one is the single
   highest-value skill for the walking skeleton.
