# Live Session Dashboard — design

Status: **approved.** Revised 2026-08-08 after the trainer-first decision.
Next step is an implementation plan.
Context: [`docs/trainer-persona/FINDINGS.md`](../../trainer-persona/FINDINGS.md).

## What this is

A live training screen and the progress record behind it. A coach starts a
session, a timer runs, they work through exercises, and when they stop the
session is saved, turned into a shareable recap for the student, and folded into
that student's progress history.

**Trainer-first.** Professionals buy tools; consumers buy apps. The screen is
designed for the person coaching, and the solo athlete is a supported second
case, not the target. If this eventually justifies its own app, that decision is
made later — nothing here should make the split harder.

## Why this, and not the CRM

The trainer interviews (n=2) found one confirmed pain: session accounting.
Trainer A wired Claude to Google Calendar to count sessions per client and still
cross-checks it against a paper notebook. Both trainers count reps in their
heads. Neither wanted spreadsheets, templates, or a backup product.

A session log that produces an accurate per-client history as a *by-product of
running the session* answers that pain without asking anyone to maintain a second
system. That is the bet.

## Decisions

| Decision | Choice |
|---|---|
| Primary user | The coach. Solo athlete supported, not targeted. |
| Where it lives | Inside this app, as a new tab. Separate app stays open as a later option. |
| Account modes | Athlete mode and coach mode. |
| Coach ↔ student link | QR code or ID. |
| What persists | Full log per session, to Firestore. |
| Styles in v1 | Gym, boxing, HIIT. |
| Yoga | Post-MVP, its own epic (E18) — a content and licensing project. |
| Client attachment | Optional at start, attachable after the session ends. |
| Exercise library | Curated seed (~150–250) plus user-added. |
| Post-session | Shareable recap, coach → student. |
| Progress | Graphs: body weight, lifted weight, session difficulty, duration. |
| Subscription | **Deferred until the feature set is built.** See Entitlement. |
| Open questions | Logged, not blocking. |

## Modes and linking

Two modes on one account model, chosen at onboarding and changeable later:

- **Athlete mode** — trains, sees their own history and progress, receives
  recaps from their coach.
- **Coach mode** — runs sessions for other people, keeps a client list, sends
  recaps.

**Linking** is by QR code or short ID. The coach shows a code, the athlete
scans it, the link is created after the athlete accepts. Nobody gets added to
somebody else's roster without agreeing to it.

**Not every client will install the app, and the design must not assume they
do.** Both interviewed trainers coach people who would never download anything.
So a client record comes in two kinds:

- **Linked** — backed by a real athlete account, `athleteUid` set. Can receive
  in-app recaps and see their own progress.
- **Local** — a name and freeform notes owned by the coach, no account. Full
  session logging and progress graphs still work; recaps go out through the
  share sheet instead.

A local client can be upgraded to linked later without losing history. That
upgrade path is the reason `clientId` is the join key everywhere, not
`athleteUid`.

## Screens

**1. Setup.** Pick style. Pick a client from the list — or skip it and start
immediately, attaching the client afterwards. Starting must never be blocked by
bookkeeping; a coach whose client is already warming up will not stop to create
a record.

Pick today's muscle groups and mark which are already tired.

**2. Live session.** The dashboard. Below.

**3. Summary.** Everything that happened, editable before saving. Rate the
session difficulty. Attach or change the client. Then save and share.

## The live screen

**Shell, all styles.** Elapsed timer, pause/resume, client name, style. The
shell never changes; the body does.

**Gym body.** Current exercise card: name, set counter, reps ±, weight ±.
Primary actions are *complete set* and *next exercise*. A work/rest stopwatch
runs alongside — start a rest after a set, see it count, and the rest length is
recorded rather than guessed at.

The exercise picker is a bottom sheet: search, favourites, recent, all, and
*add custom*.

Reps and weight default to what this client did last time on this exercise.
Re-entering the same numbers every week is exactly the friction that stops
people logging.

**Boxing and HIIT body.** The exercise card is replaced by the interval engine:
round N of M, work/rest countdown, bell audio, and a full-screen clock toggle
for a phone propped across the room. One engine, two presets — boxing
180s/60s × 12, HIIT 30s/15s × 8. Both editable.

## Timer and session state

One reducer. `idle → running ⇄ paused → finished`.

**Store `startedAt` plus accumulated pause; derive elapsed at render.** Do not
accumulate ticks. A tick counter drifts, and it stops entirely when the OS
backgrounds the app — which it will, mid-session, on a locked phone. Elapsed
must be correct after the screen has been off for ten minutes.

The interval engine derives its state the same way: given elapsed and the
interval config, the current round and phase are a pure function. Unit-testable
without faking timers, and a backgrounded app recovers to the right round
instead of resuming where it fell asleep.

`expo-keep-awake` holds the screen on while a session runs. Without it the phone
locks between sets and the coach unlocks it forty times an hour.

## Data model

```
users/{uid}
  role: 'athlete' | 'coach', displayName, createdAt

links/{linkId}
  coachUid, athleteUid, status: 'pending' | 'accepted', code, createdAt

clients/{clientId}
  ownerUid, name, notes (freeform text), athleteUid?, createdAt, archived

exercises/{exerciseId}
  name, muscleGroups[], isCustom, ownerUid        // seed docs: ownerUid = null

sessions/{sessionId}
  ownerUid, clientId?, style, startedAt, endedAt, durationMs,
  muscleGroups[], fatiguedGroups[], sets[], intervals?, difficulty?, notes

measurements/{measurementId}
  ownerUid, clientId, takenAt, bodyWeight?, notes

recaps/{recapId}
  sessionId, coachUid, clientId, athleteUid?, sentAt, payload
```

`sets[]` entries carry `exerciseId` **and** `exerciseName`, plus reps, weight,
restMs and completedAt. The denormalization is deliberate: custom exercises get
renamed and deleted, and a training history that decays into blank rows is
worthless. The name is a snapshot of what was done, not a foreign key.

`difficulty` is a 1–10 rating of how hard the session was, captured once on the
summary screen. It is the "general score" the graphs plot.

`clients.notes` is freeform text, **not a schema**. Both interviewed trainers
keep client information as prose in Notes or a chat thread, and both abandoned
spreadsheets because their method has no fixed template. A structured intake
form loses to Apple Notes. Do not build one.

## The recap

When a session is saved, it becomes a recap: what was trained, the numbers,
duration, difficulty, and any note the coach adds.

Delivery, in order of preference:

1. **In-app**, when the client is linked — the recap is a document the athlete
   reads in their own app. This is not a messaging system, and must not grow
   into one: one document per session, written once.
2. **Share sheet**, always available — a rendered card the coach sends through
   whatever messenger they already use. Both interviewed trainers live in chat
   threads with their clients; meeting them there beats moving them.

The card is generated on-device. Nothing about the recap requires the client to
have installed anything.

## Progress

Per client: **body weight** over time, **lifted weight** for a chosen exercise,
**session difficulty**, and **duration**. Plus session count, which is the
number the interviews said actually carries money.

Body weight comes from `measurements`; lifted weight is derived from `sets[]`.
Supporting both is deliberate — the interviewed trainers set a body-weight
number on day one *and* tracked strength results, and neither alone tells the
story.

**When these graphs get built, load the `dataviz` skill before writing chart
code.** Four different measures on one client screen is exactly the case where
inconsistent chart styling looks amateurish.

## Offline

Not optional. Gyms are basements.

Firestore offline persistence, local-first writes. A session must start, run to
completion and save with no network, syncing when signal returns. The failure
mode to design against is not a spinner — it is a coach losing an hour of a
client's work because the building has thick walls.

## Exercise library

A curated seed of ~150–250 common exercises with muscle-group tags, as Firestore
documents with `ownerUid = null`, loaded by the existing `npm run seed` path.
Users add their own from inside the picker, without leaving the session.

Seed exercises are global and read-only. Custom exercises are scoped to their
owner. Favourites and recents are per-user and cover both.

## Entitlement — deferred by decision

`CLAUDE.md` rule #4: every server call checks entitlement, no exceptions. The
decision (2026-08-08) is to build the whole feature set first and set
subscription rules afterwards.

Recorded plainly, because this is a rule being deferred rather than changed:

- **Auth scoping is not deferred.** Firestore security rules enforce that a
  user only reads and writes their own data from day one. A coach reaches a
  client's sessions only through an ownership or accepted-link check. Getting
  this wrong leaks one person's training data to another, which is a different
  and worse category of mistake than leaking revenue.
- **The subscription check is what waits.** During development the dashboard is
  reachable without an active entitlement.
- **This must be closed before any public build ships**, and is tracked as its
  own task. A tool that is free during development and free at launch by
  accident is a pricing decision made through neglect.

## Reuse

Firebase Auth, Firestore, the Paper design system and theme
(`constants/paperTheme.ts`), and the existing entitlement service when the gate
goes in. `feat/ui-paper-mascot` was merged to `main` before this work started so
these screens are built once, on the design system they ship with.

New dependencies: `expo-audio` for the bell (SDK 54 — `expo-av` is deprecated
and removed in SDK 55, so do not reach for it), `expo-keep-awake`, `expo-camera`
for QR scanning, and a share/capture path for the recap card.

## Testing

The valuable tests are pure functions, and the design exists partly to make them
possible:

- Elapsed time across arbitrary pause/resume sequences.
- Interval state: given elapsed and config, the correct round and phase —
  including boundary ticks and elapsed values far past the end of the session.
- The session reducer: every transition, and every transition that must be
  rejected (completing a set while paused, finishing an idle session).
- Progress aggregation: series derived from sessions and measurements, including
  empty and single-point series, which is what every new client has.

Security rules get their own tests. "A coach cannot read a client they are not
linked to" is an assertion, not an assumption.

## Out of scope for v1

- **Yoga** — E18. Pose library, images or animations, licensing, curated daily
  lists. A content project that would set the ship date for everything else.
- **Watch integration** — Garmin and Apple Watch are the stated ambition.
  Neither is v1; neither should shape the v1 data model beyond not actively
  preventing them.
- **Messaging.** The recap is one document per session. Threads, replies and
  read receipts are a different product.
- **Group and class mode.** Neither interviewed trainer has group clients.
- **Program templates and routine builders.** Explicitly contradicted by both
  interviews — both trainers compose sessions on the fly.

## Logged questions

Not blockers. Answer them when evidence arrives, not by guessing now.

1. Is the dashboard tab visible to everyone, or only in coach mode?
2. What is the session count actually for? If it ties to packages and payment it
   needs an audit trail, which is a materially different feature.
3. Does a coach ever run two sessions at once? Small-group work would break the
   single-active-session assumption.
4. Does the athlete ever log their own session and have it appear on the coach's
   side? Trainer B's clients already film themselves and send it unprompted.
5. Does this eventually become its own app? Nothing here should make that split
   harder, but nothing here assumes it either.
