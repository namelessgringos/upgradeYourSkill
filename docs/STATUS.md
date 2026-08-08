# STATUS — where the project actually is

Living handoff doc. Read this first in a new session, then `CLAUDE.md` for the
rules and `docs/BLUEPRINT.md` for scope.

Last updated: 2026-08-08.

---

## Current state

| | |
|---|---|
| `main` | PRs #1–#4 merged, the trainer-persona docs, and `feat/ui-paper-mascot` (react-native-paper migration, mascot, EAS dev-build config) merged 2026-08-08 |
| Unmerged | Nothing outstanding |
| Runs against | Firebase **emulator only**. No cloud project, no Anthropic key. |
| LLM in use | `EchoProvider` (a stub). The Anthropic path has **never made a live call**. |

Merged since the last update: **#2** Phase 2 content, **#3** billing seam + real
settings + phone-free UI review (`lib/billing.ts`, `scripts/shots.mjs`), **#4** a
fourth skill (Labour, Birth & the First Weeks).

The app works end to end on a phone or simulator: sign-in → skills from
Firestore → guide gated by a server-side entitlement check → chat through a
Cloud Function that assembles the prompt server-side and meters tokens.

## What exists

**Phase 1** — Firebase Auth behind the approved Google/Apple buttons;
`listSkills` / `getSkill` / `chat` / `getEntitlement` / `getUsage`;
`LLMProvider` abstraction; entitlement checked on every call; per-user token
metering.

**Phase 2** — three real guides (2714–2983 words) authored as files;
runtime validator gating on 1200 words; whole-guide grounding in the system
prompt; eval harness with 30 questions/skill and deterministic boundary rules;
`OpenAICompatibleProvider` for benchmarking local models; caps derived from
measurement; cost-per-user query.

## Facts worth not rediscovering

- **Haiku 4.5's minimum cacheable prefix is 4096 tokens.** Below it, prompt
  caching silently does nothing — no error, `cache_read_input_tokens` just
  stays 0. Phase 1's ~300-token prompts never cached. Injecting the full guide
  took the system block to ~5.2–5.8k tokens, which fixed it.
- **Cost per turn: ~$0.0026 cached, ~$0.0079 uncached.** A typical user
  (~1 turn/day) costs **~$0.08/month, ~0.8% of a $10 price.** Token price is
  not this product's margin risk.
- **The real margin risks are store commission (15–30%) and the daily cap.**
  The old pro cap of 500/day authorised ~$39/user/month. Caps are now 5 / 30 /
  40 (free / trial / active), trial deliberately below active.
- Guides must stay long enough to keep the system block over 4096 tokens.
  `npm run content:build` warns when one falls under.
- The Firestore emulator is **in-memory**: `npm run seed` after every restart
  or the skills list comes back empty.
- The emulator needs **JDK 21+** (`brew install openjdk@21`, keg-only):
  `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=$JAVA_HOME/bin:$PATH npm run emulators`

## Blocked on you, not on code

1. **An Anthropic API key.** ~$1–2 per full eval run. Without it the eval
   harness produces shape but not numbers, so the per-skill Haiku-vs-Sonnet
   decision is unanswered — and that blocks pricing, which blocks launch.
2. **A Firebase project on Blaze** (Functions need outbound HTTP) whenever you
   want to leave the emulator.
3. **Editing the three guides.** They were drafted from general knowledge. For
   something sold as "curated expert knowledge" this is the weakest link in
   v1, and no tooling fixes it.
4. **The single monthly price.** BLUEPRINT says it comes from measured p90
   usage; the measurement now exists but needs a real model behind it.

---

## Next session: start here

In order. Each step unblocks the one after it.

### 1. Get an Anthropic key and run the real evals

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > functions/.secret.local   # gitignored
export ANTHROPIC_API_KEY=sk-ant-...
npm run evals -- --provider anthropic --judge-model claude-sonnet-5
```

Produces the quality baseline and real token percentiles. Then:

```bash
npm run economics          # caps from real numbers, not ASSUMED_OUTPUT_TOKENS
```

Also re-run `npm run e2e` with the key set — it has a prompt-cache assertion
that currently skips, and that is the only real proof caching engaged.

Decide per skill: does Haiku hold, or does one need Sonnet? Set it in the
skill's `coach.md` frontmatter — model choice lives in the DB, never in code
(rule #2).

### 2. Benchmark the local models

Requested in Phase 2, tooling is ready, no API cost.

```bash
ollama pull qwen3.6:35b-a3b       # MoE — ~20-22 tok/s on Apple Silicon
npm run evals -- --provider ollama --model qwen3.6:35b-a3b
```

Compare against the Haiku baseline from step 1. **The decisive metric is
boundary adherence, not fluency** — a coach that drifts into diagnosis is a
liability no throughput number offsets. Dense 24–27B models run at ~4–5 tok/s
on a Mac and are probably too slow; MoE is the category worth testing.

Note the Mac Studio is a benchmark box, not a production origin (residential
uptime, no redundancy, weak concurrent batching on Metal). If a local model
wins, hosting it properly is a separate decision.

### 3. Then pick one

- **Phase 3 remainder** — soft cap: pause and let the user opt in to continue.
  Never auto-charge (rule #6). Small, and the entitlement service is already
  shaped for it.
- **Phase 4 billing** — needs the price from step 2. Distribution is now
  "both", so it means RevenueCat *and* Stripe plus two webhook paths; worth
  justifying before building.
- **Real Google/Apple OAuth** — needs OAuth client IDs, an Apple Developer
  account, and an EAS dev build. It stops running in Expo Go, so expect a day
  of setup friction.

---

## New direction: the live training session dashboard

Specced and **Stage A built** 2026-08-08 →
[spec](./superpowers/specs/2026-08-08-live-session-dashboard-design.md) ·
[plan](./superpowers/plans/2026-08-08-live-session-dashboard.md).

**Stage A is on `feat/live-session-dashboard`** (18 commits): the pure session
engine — elapsed time, interval engine, state machine — plus the exercise
library, an in-memory store behind a `SessionStore` interface, and all three
screens (setup, live, summary) for gym, boxing and HIIT. 80 pure-logic tests,
typecheck and lint clean.

**Nothing in the UI has ever been run.** No simulator was available at any point,
so the screens are verified only by types, lint and pure-logic tests. A device
walkthrough is the first thing to do, and it is tracked in Todoist E17.

**Boxing mode is silent** — there is no audio asset in the repo, so the bell is a
guarded no-op until one is added. Also tracked.

Stage B (Tasks 10-12: native Firebase SDK, security rules, Firestore store)
is blocked on the native config in [`BUREAUCRACY.md`](./BUREAUCRACY.md).

A live session screen inside this app: start a session, timer runs, work through
exercises, and the whole thing is written down when you stop. Works trainer-driven
or solo, on one screen.

Decided: new tab in this app · full log per session to Firestore · gym, boxing
and HIIT in v1 · sessions attach to a client · curated seed exercise library plus
user-added · yoga is post-MVP with its own epic.

It is the first surface in the app that is a tool rather than content, and it is
the closest thing yet to what the trainer interviews actually found — both
trainers count reps in their heads, and session accounting was the only confirmed
pain. See [`trainer-persona/FINDINGS.md`](./trainer-persona/FINDINGS.md).

**Carrying a known debt:** the dashboard is being built ungated, with the
subscription check deferred. Data access is auth-scoped from day one; the
entitlement gate is not. Rule #4 says every server call checks entitlement —
**this must be closed before any public build ships**, and it is tracked as its
own task, not left to memory.

---

## Commands

```bash
npm run emulators        # backend (needs JDK 21 on PATH)
npm run seed             # skills into the emulator — re-run after every restart
npm run content:build    # validate authored skills
npm run check:rules      # self-test the boundary rules
npm run evals -- --provider echo
npm run economics        # ASSUMED_OUTPUT_TOKENS=400 until a real model is measured
npm run cost:report      # cost per user
npm run e2e              # 25 end-to-end assertions
npx expo start
```

## Known loose ends

- `tsconfig.json` was modified outside our work at one point, dropping
  `.expo/types` and `expo-env.d.ts` from `include` (weakens Expo Router's route
  typing). Reverted, but something regenerated it — worth catching if it
  recurs.
- Artifacts (checklists/tables in chat) render in the UI but nothing produces
  them: `chat` returns plain text. Wiring them up is a contract change, so it
  was left out of v1.
- `evals/reports/` is gitignored — reports are regenerated and can carry model
  output.
