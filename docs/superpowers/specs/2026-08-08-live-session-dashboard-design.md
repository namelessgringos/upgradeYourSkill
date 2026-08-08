# Live Session Dashboard — design

Status: **approved, not yet planned.** Next step is an implementation plan.
Raised 2026-08-08. Context: [`docs/trainer-persona/FINDINGS.md`](../../trainer-persona/FINDINGS.md).

## What this is

A live training screen inside upgradeYourSkill. You start a session, a timer
runs, you work through exercises, and when you stop, the whole session is
written down. It works whether a trainer is driving it for a client or a person
is training alone.

This is the first surface in the app that is a *tool* rather than *content*. The
subscription so far sells curated knowledge; this sells doing the thing. That
tension is real and is called out under Entitlement below.

## Why this, and not the CRM

The trainer interviews (n=2) found one confirmed pain: session accounting.
Trainer A wired Claude to Google Calendar to count sessions per client and still
cross-checks it against a paper notebook. Both trainers count reps in their
heads. Neither wanted spreadsheets, templates, or a backup product.

A session log that produces an accurate per-client session count as a *by-product
of running the session* answers that pain without asking anyone to keep a second
system up to date. That is the bet.

## Decisions

Locked in conversation on 2026-08-08:

| Decision | Choice |
|---|---|
| Who holds the phone | Both — one screen, trainer-driven or solo |
| Where it lives | Inside this app, as a new tab |
| What persists | Full log per session, to Firestore |
| Styles in v1 | Gym, boxing, HIIT |
| Yoga | Post-MVP, its own epic — it is a content project, not a feature |
| Client attachment | Yes — trainer picks a client, session logs against them |
| Exercise library | Curated seed (~150–250) plus user-added |
| Entitlement | Build ungated, gate later (see below) |

## Screens

**1. Setup.** Pick style. Pick client, skippable when training solo. Pick the
muscle groups for today and mark which are already tired. Start.

**2. Live session.** The dashboard. Detailed below.

**3. Summary.** Everything that happened, editable before it saves. This is
where a mis-tapped rep count gets fixed, and it is the difference between a log
people trust and one they abandon.

## The live screen

**Shell, all styles.** Elapsed timer, pause/resume, client name, style. The
shell never changes; the body does.

**Gym body.** Current exercise card: name, set counter, reps ±, weight ±.
Primary actions are *complete set* and *next exercise*. The exercise picker is a
bottom sheet — search, favourites, recent, all, and *add custom*.

Reps and weight default to what the same exercise used last time, for this
client. Re-entering the same numbers every week is exactly the friction that
makes people stop logging.

**Boxing and HIIT body.** The exercise card is replaced by the interval engine:
round N of M, work/rest countdown, bell audio, and a full-screen clock toggle
for when the phone is propped up across the room. One engine, two presets —
boxing 180s work / 60s rest × 12, HIIT 30s / 15s × 8. Both editable.

## Timer and session state

One reducer. `idle → running ⇄ paused → finished`.

**Store `startedAt` plus accumulated pause; derive elapsed at render.** Do not
accumulate ticks. A tick counter drifts, and it stops entirely when the OS
backgrounds the app — which it will, mid-session, on a locked phone. Elapsed
must be correct after the screen has been off for ten minutes.

The interval engine derives its state the same way: given elapsed time and the
interval config, the current round and phase are a pure function. That makes the
whole thing unit-testable without faking timers, and makes a backgrounded app
recover to the right round instead of resuming where it fell asleep.

`expo-keep-awake` holds the screen on while a session is running. Without it the
phone locks between sets and the trainer is unlocking it forty times an hour.

## Data model

```
clients/{clientId}
  ownerUid, name, notes (freeform text), createdAt, archived

exercises/{exerciseId}
  name, muscleGroups[], isCustom, ownerUid    // seed docs: ownerUid = null

sessions/{sessionId}
  ownerUid, clientId?, style, startedAt, endedAt, durationMs,
  muscleGroups[], fatiguedGroups[], sets[], intervals?, notes
```

`sets[]` entries carry `exerciseId` **and** `exerciseName`. The denormalization
is deliberate: custom exercises get renamed and deleted, and a training history
that decays into blank rows is worthless. The name is a snapshot of what was
done, not a foreign key.

`clients.notes` is freeform text, not a schema. Both trainers keep client
information as prose in Notes or a chat thread, and both abandoned spreadsheets
because their method has no fixed template. A structured intake form loses to
Apple Notes; do not build one.

## Offline

Not optional. Gyms are basements.

Firestore offline persistence, local-first writes. A session must start, run to
completion, and save with no network — syncing when signal returns. The failure
mode to design against is not a spinner, it is a trainer losing an hour of a
client's work because the building has thick walls.

## Exercise library

Ship a curated seed of ~150–250 common exercises with muscle-group tags, as
Firestore documents with `ownerUid = null`, loaded by the existing `npm run seed`
path. Users add their own at the point of need, from inside the picker, without
leaving the session.

Seed exercises are global and read-only. Custom exercises are scoped to their
owner. Favourites and recents are per-user and cover both.

## Entitlement — a deliberate, temporary deviation

`CLAUDE.md` rule #4: every server call checks entitlement, no exceptions. The
decision here is to build the dashboard ungated and gate it later.

Recorded plainly, because it is a rule being deferred rather than a rule being
changed:

- Session, client and exercise access is **auth-scoped from day one** via
  Firestore security rules. A user can only ever read and write their own data.
  This part is not deferred and must not be.
- What is deferred is the **subscription check**. During development the
  dashboard is reachable without an active entitlement.
- **This must be closed before any public build ships.** It is tracked as its
  own task. A tool that is free during development and free at launch by
  accident is a pricing decision made through neglect.

## Reuse

Firebase Auth, Firestore, the Paper design system and theme (`constants/paperTheme.ts`),
and the existing entitlement service when the gate goes in. The
`feat/ui-paper-mascot` branch was merged into `main` before this work started
specifically so these screens are built once, on the design system they ship with.

New dependencies: `expo-audio` for the bell (SDK 54 — `expo-av` is deprecated and
goes away in SDK 55, so do not reach for it) and `expo-keep-awake` for the
screen lock.

## Testing

The valuable tests here are pure functions, and the design exists partly to make
them possible:

- Elapsed time across arbitrary pause/resume sequences.
- Interval state: given elapsed and config, the correct round and phase —
  including the boundary ticks, and including elapsed values far beyond the end
  of the session.
- The session reducer: every transition, and every transition that must be
  rejected (completing a set while paused, finishing an idle session).

The UI on top of these is thin by design.

## Out of scope for v1

- **Yoga.** Pose library, images or animations, licensing, curated daily lists.
  A content project with its own epic, post-MVP.
- **Watch integration.** Garmin and Apple Watch are the stated ambition. Neither
  is v1, and neither should shape the v1 data model beyond not actively
  preventing them.
- **Group and class mode.** Neither interviewed trainer has group clients.
- **Program templates and routine builders.** Explicitly contradicted by both
  interviews — both trainers compose sessions on the fly and rejected templates.
- **Sharing a session with the client's own phone.** Wanted eventually; a
  different product surface.

## Open questions

1. **Is the tab visible to everyone, or only to users who identify as trainers?**
   A solo athlete does not need a client picker, and showing one makes the app
   look like it is for somebody else. An onboarding question could branch this,
   but that is another decision to justify.
2. **What is the session count actually for?** The interviews implied it ties to
   packages and payment. If it does, the number needs an audit trail — and that
   is a materially different feature from a workout log.
3. **Does a trainer ever need to run two sessions at once?** Small group work
   would break the single-active-session assumption in the state machine.
