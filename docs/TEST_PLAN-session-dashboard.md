# Device walkthrough — live session dashboard (Stage A)

The engine has 80 pure-logic tests. **None of the UI has ever been rendered.**
This is the list of things a test suite cannot tell us, in the order that finds
breakage fastest.

Tracked in Todoist E17. Fill in the result column as you go — a blank is not a
pass.

Last updated: 2026-08-09.

---

## Before you start

**No backend needed.** `lib/api.ts` has `MOCK_API = true`, so sign-in and the
skills list are served from `lib/mockApi.ts`. Do **not** start the emulator —
over a tunnel the phone cannot reach it anyway, and it is not required for
anything in this walkthrough.

**Storage is in-memory.** `InMemorySessionStore` is wired up, so clients,
exercises and saved sessions **disappear when the app reloads**. That is Stage A
by design, not a bug. Only file a defect if data vanishes *within* one run.

Open the app with the tunnel URL / QR from `npx expo start --tunnel`. Expo Go is
fine — there are no custom native modules.

Reach the dashboard: sign in (any provider button — mocked), finish onboarding,
then the **Train** tab (dumbbell icon, fourth position).

---

## 1. Getting in and out — the highest-risk area

This is where the branch's one Critical defect lived. Navigation between the
`(tabs)` stack and the `train` stack is the thing most likely to still be wrong.

| # | Do this | Expect | Result |
|---|---|---|---|
| 1.1 | Tap **Train** tab | Setup screen ("New session"), not a blank screen | |
| 1.2 | Tap the back arrow on Setup | Returns to the tabs, tab bar visible | |
| 1.3 | Tap **Train** again | Setup screen again — **not** a blank or stuck screen | |
| 1.4 | Go Train → Start → Finish → Save | Lands on the tabs with the tab bar, not on a blank Train screen | |
| 1.5 | Switch to another tab and back to Train, five times | Same screen every time, no accumulating headers, no flicker | |
| 1.6 | On the **live** screen, swipe back from the left edge (iOS) / press Android back | Note what happens — **there is no guard on this yet.** Record whether it abandons the running session silently | |

1.6 is a known open item, not a regression. Record the behaviour so we can
decide what the guard should do.

## 2. Setup screen

| # | Do this | Expect | Result |
|---|---|---|---|
| 2.1 | Look at the three style buttons | Gym / Boxing / HIIT, Gym selected | |
| 2.2 | Tap **Boxing** | An "Intervals" card appears with Work 180, Rest 60, Rounds 12 | |
| 2.3 | Tap **HIIT** | Same card reads 30 / 15 / 8 | |
| 2.4 | Tap **Gym** | The Intervals card disappears entirely | |
| 2.5 | Type a name in **Add client**, tap **Add** | A chip with that name appears and is selected; the text field clears | |
| 2.6 | Tap **Skip — start without a client** | The button fills (contained), the client chip deselects | |
| 2.7 | Tap the client chip again | Chip selects, Skip button goes back to outlined | |
| 2.8 | Tap several **Muscle groups** chips | They toggle independently, both on and off | |
| 2.9 | Tap chips under **Already tired** | Toggle independently of the Muscle groups selection above | |
| 2.10 | With the keyboard open on Add client, scroll the page | The page scrolls; the Start button is reachable; nothing is trapped under the keyboard | |
| 2.11 | Boxing → clear the **Rounds** field entirely | Note what the field shows. Empty string → `Number('')` is `0` → clamped to 1. Record whether that reads as broken | |
| 2.12 | Boxing → type letters into **Work (s)** | The value should not change (non-finite input is rejected) | |

## 3. Gym session

Start a Gym session with a client selected.

| # | Do this | Expect | Result |
|---|---|---|---|
| 3.1 | Look at the header | Time counting up from 00:00, "Gym · <client name>" | |
| 3.2 | Card body | "No exercise selected", no set counter, **Complete set** disabled | |
| 3.3 | Tap **Next exercise** | Bottom-sheet picker opens with a search field | |
| 3.4 | Type into search | List filters as you type | |
| 3.5 | Pick an exercise | Sheet closes, name appears on the card, "Set 1" | |
| 3.6 | Tap reps **+** / **−**, weight **+** / **−** | Reps step by 1, weight by 2.5 | |
| 3.7 | Push reps **down** past 0 | Record what happens — negative reps should not be loggable | |
| 3.8 | Tap **Complete set** | Counter becomes "Set 2"; reps/weight keep their values | |
| 3.9 | Tap **Start rest** | Rest counts up from 00:00, button reads "Resting…" and is disabled | |
| 3.10 | While resting, tap **Complete set** | The rest display clears back to "—" | |
| 3.11 | Tap **pause** (header) | Elapsed time freezes. **Complete set** becomes disabled | |
| 3.12 | While paused, tap **Start rest** | Should be disabled | |
| 3.13 | Tap **play** | Time resumes from where it froze — it does **not** jump forward | |
| 3.14 | Log sets on a second exercise, then reselect the first | The set counter for the first exercise remembers its own count | |
| 3.15 | Reselect an exercise you already logged | Reps and weight prefill to what you last did on it | |
| 3.16 | Open the picker and add a **custom exercise** | It appears in the list and is selectable | |

## 4. The background test — the whole reason the timer is built this way

Elapsed time is derived from `startedAt`, never accumulated from ticks.
**This is the single most important check in the document.** If it fails, the
design's central claim is false.

| # | Do this | Expect | Result |
|---|---|---|---|
| 4.1 | Start a session, note the elapsed time, **lock the phone**, wait 2 real minutes, unlock | Elapsed has advanced by ~2 minutes. It has **not** frozen at the lock time | |
| 4.2 | Same again but leave it locked ~10 minutes | Still correct. No drift beyond a second or two | |
| 4.3 | Start a session, **pause**, lock for 2 minutes, unlock, **resume** | The paused 2 minutes are **excluded** from elapsed | |
| 4.4 | Start a session and just leave the screen on for 3 minutes | The screen does **not** auto-lock (`useKeepAwake`) | |
| 4.5 | Leave the Train tab entirely (go to Home tab), wait 1 minute, come back | Elapsed kept advancing | |
| 4.6 | Boxing: start, lock the phone through 2+ full rounds, unlock | Lands on the correct round and phase — **not** where it fell asleep. Note whether more than one bell would have fired (bell is silent, see §6) | |

## 5. Boxing / HIIT

Start a Boxing session. Drop rounds to 2 and work to 10s first so this takes a
minute rather than 40.

| # | Do this | Expect | Result |
|---|---|---|---|
| 5.1 | Live screen | Round 1 / 2, "Work", counting **down** | |
| 5.2 | No exercise card or rest stopwatch is present | Correct — interval styles replace the gym body | |
| 5.3 | Let work run out | Flips to "Rest", countdown restarts | |
| 5.4 | Let the whole thing run out | Phase reads "Done" | |
| 5.5 | Tap **Full screen** | Fills the screen, big clock, readable from across a room | |
| 5.6 | Rotate the phone in full screen | App is portrait-locked (`app.json`). Confirm it stays readable | |
| 5.7 | Tap **Exit full screen** | Returns to the card, timer unaffected | |
| 5.8 | Android only: hardware back while in full screen | Closes the modal, does not exit the session | |
| 5.9 | Pause during a Boxing session | Countdown freezes; resume continues from the same point in the round | |

## 6. Known-silent: the bell

`IntervalClock.tsx` has `BELL_SOURCE = null` — **no audio asset ships in the
repo**, so `playBell` is a deliberate no-op.

| # | Do this | Expect | Result |
|---|---|---|---|
| 6.1 | Run a Boxing round to the phase change | **No sound.** Confirm no crash and no console error from `useAudioPlayer(null)` | |

Do not file "no bell sound" as a defect. Do file anything that throws.

## 7. Summary and save

| # | Do this | Expect | Result |
|---|---|---|---|
| 7.1 | Tap **Finish** | Summary screen, "Sets (N)" matching what you logged | |
| 7.2 | Check the set rows | Correct exercise name, reps and kg for each | |
| 7.3 | Tap a trash icon | That row disappears, the count decrements | |
| 7.4 | Tap a **Difficulty** chip 1–10 | Selects; tapping another moves the selection | |
| 7.5 | Type into **Notes** | Text persists while you scroll away and back | |
| 7.6 | Change the client here | Selection updates | |
| 7.7 | Tap **Save** | Button shows a spinner briefly, then lands on the tabs | |
| 7.8 | Tap **Train** again after saving | Fresh Setup screen — **no leftover state from the session you just saved** | |
| 7.9 | Finish a session with **zero** sets logged | "No sets logged." — saving still works | |

## 8. Look and feel

Not defects unless something is unusable, but worth capturing while you have the
device in hand.

| # | Check | Result |
|---|---|---|
| 8.1 | Does it read as this app, or as stock Material? (`constants/paperTheme.ts` is the paper-and-ink skin) | |
| 8.2 | Is the elapsed time readable at arm's length, phone on a bench? | |
| 8.3 | Are **Complete set** and **Start rest** hittable without looking? | |
| 8.4 | Does the mascot ever cover a button on the Train screens? | |
| 8.5 | Setup screen: how much scrolling before you can hit Start? | |
| 8.6 | Safe-area: anything under the notch or the home indicator? | |

---

## Filing what you find

For each failure write: the row number, what you did, what happened, what you
expected. Screenshot if it is visual.

Sort into three buckets before any fixing starts:

- **Broken** — crashes, wrong numbers, unreachable screens. Fix on this branch.
- **Wrong by design** — it does what the code says and the code is wrong about
  what a coach needs. Spec change, not a patch.
- **Known** — already in this document (§1.6 back gesture, §6 silent bell,
  in-memory storage). Confirm, do not re-file.
