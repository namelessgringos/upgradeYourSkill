# Live Session Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the live training session screen — start a session, run a timer, log exercises and sets (or boxing/HIIT rounds), review, and save a full session record.

**Architecture:** All session logic is pure functions over plain data — elapsed time, interval state and the session reducer take `(state, now)` and return new state, with no timers, no React and no I/O inside them. The UI is a thin layer that ticks a clock and re-renders. Persistence sits behind a `SessionStore` interface with an in-memory implementation first, so every screen is built and testable before Firebase exists.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, expo-router, react-native-paper, Vitest (new), `@react-native-firebase/firestore` + `/auth` (later stage), expo-audio, expo-keep-awake.

**Spec:** [`../specs/2026-08-08-live-session-dashboard-design.md`](../specs/2026-08-08-live-session-dashboard-design.md)

## Global Constraints

- **Expo SDK 54.** Use `expo-audio`, never `expo-av` — it is deprecated and removed in SDK 55.
- **No prompts, skill content or system instructions in the app binary** (CLAUDE.md rule #1). Nothing in this plan touches skill content.
- **Entitlement is deliberately deferred** (spec → Entitlement). Auth scoping is NOT deferred. Do not add a subscription check in this plan; do not skip ownership checks in security rules.
- **Never accumulate timer ticks.** Elapsed is always derived from `startedAt` and accumulated pause. A session must show correct elapsed time after the phone has been locked for ten minutes.
- **Pure logic files import nothing from `react`, `react-native` or `firebase`.** That constraint is what makes them testable, and it is load-bearing.
- Money values do not appear anywhere in this plan. Weight is kilograms, stored as a number.
- Follow existing conventions: components in `components/`, shared logic in `lib/`, screens in `app/` (expo-router).

## Stages

- **Stage A — Tasks 1-9:** pure logic and full UI, against an in-memory store. Blocked on nothing.
- **Stage B — Tasks 10-12:** real persistence. Blocked on the Firebase native config in `docs/BUREAUCRACY.md`.

Stage A produces a working, demoable dashboard that forgets everything on reload. That is the intended midpoint, not a shortcut.

## File Structure

**Pure logic (no React, no I/O):**
- `lib/session/types.ts` — shared types for the whole feature
- `lib/session/timer.ts` — elapsed time from start/pause bookkeeping
- `lib/session/intervals.ts` — boxing/HIIT round and phase, derived from elapsed
- `lib/session/reducer.ts` — the session state machine

**Data:**
- `lib/session/exercises.seed.ts` — the curated exercise list
- `lib/session/store.ts` — `SessionStore` interface + `InMemorySessionStore`
- `lib/session/firestoreStore.ts` — Stage B implementation

**UI:**
- `app/(tabs)/train.tsx` — tab entry, routes to setup or an active session
- `app/train/setup.tsx`, `app/train/live.tsx`, `app/train/summary.tsx`
- `components/train/ExerciseCard.tsx`, `IntervalClock.tsx`, `ExercisePicker.tsx`, `RestStopwatch.tsx`, `SessionHeader.tsx`
- `lib/session/useSessionClock.ts` — the single `setInterval` in the feature

**Tests:** `lib/session/__tests__/*.test.ts`

---

### Task 1: Test runner

The repo has no unit test runner — only `typecheck`, `lint` and hand-rolled `.mjs` scripts. The pure logic in this plan is worth testing properly, so add Vitest. It runs TypeScript with no Babel or transform config, which is why it fits here better than Jest.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/session/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` and `npm run test:watch`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 2: Add the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the pure logic is unit-tested. Component rendering would need
    // jest-expo and a native mock layer; nothing here requires it.
    include: ['lib/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add the scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `lib/session/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/session/__tests__/smoke.test.ts
git commit -m "test: add vitest for pure session logic"
```

---

### Task 2: Shared types

Every later task refers to these names. Define them once, first.

**Files:**
- Create: `lib/session/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `TrainingStyle`, `SessionStatus`, `TimerState`, `IntervalConfig`, `IntervalPhase`, `IntervalState`, `CompletedSet`, `Exercise`, `SessionState`, `SavedSession`, `Client`

- [ ] **Step 1: Write the types**

Create `lib/session/types.ts`:

```ts
/** Shared vocabulary for the live session feature. Pure data — no imports. */

export type TrainingStyle = 'gym' | 'boxing' | 'hiit';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished';

/**
 * Timer bookkeeping. Elapsed time is always DERIVED from these fields, never
 * accumulated tick by tick: a tick counter drifts, and it stops entirely when
 * the OS backgrounds the app mid-session.
 */
export interface TimerState {
  status: SessionStatus;
  /** Epoch ms when the session started. Null until it does. */
  startedAt: number | null;
  /** Epoch ms of the current pause. Null unless status is 'paused'. */
  pausedAt: number | null;
  /** Total ms spent paused across all completed pauses. */
  accumulatedPauseMs: number;
  /** Epoch ms when the session finished. Null until it does. */
  endedAt: number | null;
}

export interface IntervalConfig {
  workMs: number;
  restMs: number;
  rounds: number;
}

export type IntervalPhase = 'work' | 'rest' | 'done';

export interface IntervalState {
  /** 1-based. Equals `rounds` once done. */
  round: number;
  phase: IntervalPhase;
  /** Ms left in the current phase. Zero when done. */
  remainingMs: number;
}

export interface CompletedSet {
  exerciseId: string;
  /**
   * Snapshot, not a foreign key. Custom exercises get renamed and deleted, and
   * a training history that decays into blank rows is worthless.
   */
  exerciseName: string;
  reps: number;
  /** Kilograms. Zero for bodyweight work. */
  weight: number;
  /** Ms of rest taken before this set. Null when it was not timed. */
  restMs: number | null;
  completedAt: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  isCustom: boolean;
  /** Null for the global seed library. */
  ownerUid: string | null;
}

export interface SessionState {
  timer: TimerState;
  style: TrainingStyle;
  /** Optional on purpose — a session can start before anyone records who it is for. */
  clientId: string | null;
  muscleGroups: string[];
  fatiguedGroups: string[];
  currentExerciseId: string | null;
  currentExerciseName: string | null;
  reps: number;
  weight: number;
  sets: CompletedSet[];
  /** Null for gym sessions. */
  intervals: IntervalConfig | null;
  /** Epoch ms the current rest began. Null when not resting. */
  restStartedAt: number | null;
  /** 1-10, captured on the summary screen. Null until rated. */
  difficulty: number | null;
  notes: string;
}

export interface SavedSession {
  id: string;
  ownerUid: string;
  clientId: string | null;
  style: TrainingStyle;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  muscleGroups: string[];
  fatiguedGroups: string[];
  sets: CompletedSet[];
  intervals: IntervalConfig | null;
  difficulty: number | null;
  notes: string;
}

export interface Client {
  id: string;
  ownerUid: string;
  name: string;
  /** Freeform prose. NOT a schema — see the spec. Do not add structured fields. */
  notes: string;
  /** Set when this client has their own account. Null for local-only records. */
  athleteUid: string | null;
  createdAt: number;
  archived: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/session/types.ts
git commit -m "feat: session feature types"
```

---

### Task 3: Elapsed time

**Files:**
- Create: `lib/session/timer.ts`
- Test: `lib/session/__tests__/timer.test.ts`

**Interfaces:**
- Consumes: `TimerState` from `lib/session/types.ts`
- Produces: `idleTimer(): TimerState`, `elapsedMs(timer: TimerState, now: number): number`, `formatElapsed(ms: number): string`

- [ ] **Step 1: Write the failing tests**

Create `lib/session/__tests__/timer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { elapsedMs, formatElapsed, idleTimer } from '../timer';
import type { TimerState } from '../types';

const T0 = 1_700_000_000_000;

function running(overrides: Partial<TimerState> = {}): TimerState {
  return {
    status: 'running',
    startedAt: T0,
    pausedAt: null,
    accumulatedPauseMs: 0,
    endedAt: null,
    ...overrides,
  };
}

describe('elapsedMs', () => {
  it('is zero before the session starts', () => {
    expect(elapsedMs(idleTimer(), T0 + 5000)).toBe(0);
  });

  it('counts wall-clock time while running', () => {
    expect(elapsedMs(running(), T0 + 5000)).toBe(5000);
  });

  it('excludes completed pauses', () => {
    expect(elapsedMs(running({ accumulatedPauseMs: 2000 }), T0 + 5000)).toBe(3000);
  });

  it('freezes while paused, however long the pause runs', () => {
    const paused = running({ status: 'paused', pausedAt: T0 + 4000 });
    expect(elapsedMs(paused, T0 + 4000)).toBe(4000);
    expect(elapsedMs(paused, T0 + 90_000)).toBe(4000);
  });

  it('freezes once finished', () => {
    const finished = running({ status: 'finished', endedAt: T0 + 7000 });
    expect(elapsedMs(finished, T0 + 999_999)).toBe(7000);
  });

  // The phone was locked for ten minutes. Derived time must still be right.
  it('is correct after a long background gap', () => {
    expect(elapsedMs(running(), T0 + 600_000)).toBe(600_000);
  });

  it('never returns a negative value if the clock jumps backwards', () => {
    expect(elapsedMs(running(), T0 - 5000)).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9000)).toBe('0:09');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('formats an hour and over as h:mm:ss', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- timer`
Expected: FAIL — cannot find module `../timer`.

- [ ] **Step 3: Implement**

Create `lib/session/timer.ts`:

```ts
import type { TimerState } from './types';

export function idleTimer(): TimerState {
  return {
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    accumulatedPauseMs: 0,
    endedAt: null,
  };
}

/**
 * Elapsed session time, derived rather than accumulated.
 *
 * `now` is passed in rather than read from Date.now() so this stays pure and
 * testable without faking timers.
 */
export function elapsedMs(timer: TimerState, now: number): number {
  if (timer.startedAt === null) return 0;
  // Once finished, the end is fixed. While paused, the clock stands still at
  // the moment the pause began.
  const end = timer.endedAt ?? timer.pausedAt ?? now;
  return Math.max(0, end - timer.startedAt - timer.accumulatedPauseMs);
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- timer`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/session/timer.ts lib/session/__tests__/timer.test.ts
git commit -m "feat: derive elapsed session time from start and pause bookkeeping"
```

---

### Task 4: Interval engine

Boxing and HIIT are the same engine with different presets. Round and phase are a pure function of elapsed time, so a backgrounded app recovers to the correct round instead of resuming where it fell asleep.

**Files:**
- Create: `lib/session/intervals.ts`
- Test: `lib/session/__tests__/intervals.test.ts`

**Interfaces:**
- Consumes: `IntervalConfig`, `IntervalState` from `lib/session/types.ts`
- Produces: `BOXING_PRESET: IntervalConfig`, `HIIT_PRESET: IntervalConfig`, `totalDurationMs(config): number`, `intervalAt(config, elapsed): IntervalState`

- [ ] **Step 1: Write the failing tests**

Create `lib/session/__tests__/intervals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BOXING_PRESET, HIIT_PRESET, intervalAt, totalDurationMs } from '../intervals';
import type { IntervalConfig } from '../types';

// Small numbers keep the arithmetic obvious: 10s work, 5s rest, 3 rounds.
const CONFIG: IntervalConfig = { workMs: 10_000, restMs: 5_000, rounds: 3 };

describe('totalDurationMs', () => {
  // 3 rounds of work + only 2 rests: nobody rests after the final bell.
  it('excludes the trailing rest', () => {
    expect(totalDurationMs(CONFIG)).toBe(40_000);
  });

  it('handles a single round', () => {
    expect(totalDurationMs({ workMs: 10_000, restMs: 5_000, rounds: 1 })).toBe(10_000);
  });
});

describe('intervalAt', () => {
  it('starts in round 1, working', () => {
    expect(intervalAt(CONFIG, 0)).toEqual({ round: 1, phase: 'work', remainingMs: 10_000 });
  });

  it('counts down within the work phase', () => {
    expect(intervalAt(CONFIG, 3_000)).toEqual({ round: 1, phase: 'work', remainingMs: 7_000 });
  });

  it('switches to rest exactly on the work boundary', () => {
    expect(intervalAt(CONFIG, 10_000)).toEqual({ round: 1, phase: 'rest', remainingMs: 5_000 });
  });

  it('counts down within the rest phase', () => {
    expect(intervalAt(CONFIG, 12_000)).toEqual({ round: 1, phase: 'rest', remainingMs: 3_000 });
  });

  it('starts the next round exactly on the cycle boundary', () => {
    expect(intervalAt(CONFIG, 15_000)).toEqual({ round: 2, phase: 'work', remainingMs: 10_000 });
  });

  it('reaches the final round', () => {
    expect(intervalAt(CONFIG, 30_000)).toEqual({ round: 3, phase: 'work', remainingMs: 10_000 });
  });

  it('is done exactly at the end', () => {
    expect(intervalAt(CONFIG, 40_000)).toEqual({ round: 3, phase: 'done', remainingMs: 0 });
  });

  // The phone slept through the end of the workout.
  it('stays done long past the end', () => {
    expect(intervalAt(CONFIG, 999_999)).toEqual({ round: 3, phase: 'done', remainingMs: 0 });
  });

  it('treats negative elapsed as the start', () => {
    expect(intervalAt(CONFIG, -1_000)).toEqual({ round: 1, phase: 'work', remainingMs: 10_000 });
  });
});

describe('presets', () => {
  it('boxing is 3 minutes on, 1 off, 12 rounds', () => {
    expect(BOXING_PRESET).toEqual({ workMs: 180_000, restMs: 60_000, rounds: 12 });
  });

  it('HIIT is 30 on, 15 off, 8 rounds', () => {
    expect(HIIT_PRESET).toEqual({ workMs: 30_000, restMs: 15_000, rounds: 8 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- intervals`
Expected: FAIL — cannot find module `../intervals`.

- [ ] **Step 3: Implement**

Create `lib/session/intervals.ts`:

```ts
import type { IntervalConfig, IntervalState } from './types';

export const BOXING_PRESET: IntervalConfig = {
  workMs: 180_000,
  restMs: 60_000,
  rounds: 12,
};

export const HIIT_PRESET: IntervalConfig = {
  workMs: 30_000,
  restMs: 15_000,
  rounds: 8,
};

/** Total work time plus the rests BETWEEN rounds — there is no rest after the last. */
export function totalDurationMs(config: IntervalConfig): number {
  const cycle = config.workMs + config.restMs;
  return config.rounds * cycle - config.restMs;
}

/**
 * Round and phase as a pure function of elapsed time.
 *
 * Deriving rather than stepping means a session that was backgrounded for five
 * minutes resumes at the correct round, not where it fell asleep.
 */
export function intervalAt(config: IntervalConfig, elapsed: number): IntervalState {
  const clamped = Math.max(0, elapsed);
  const total = totalDurationMs(config);

  if (clamped >= total) {
    return { round: config.rounds, phase: 'done', remainingMs: 0 };
  }

  const cycle = config.workMs + config.restMs;
  const round = Math.floor(clamped / cycle) + 1;
  const withinCycle = clamped % cycle;

  if (withinCycle < config.workMs) {
    return { round, phase: 'work', remainingMs: config.workMs - withinCycle };
  }
  return { round, phase: 'rest', remainingMs: cycle - withinCycle };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- intervals`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/session/intervals.ts lib/session/__tests__/intervals.test.ts
git commit -m "feat: interval engine for boxing and HIIT rounds"
```

---

### Task 5: Session reducer

**Files:**
- Create: `lib/session/reducer.ts`
- Test: `lib/session/__tests__/reducer.test.ts`

**Interfaces:**
- Consumes: everything from `lib/session/types.ts`, `idleTimer` from `./timer`
- Produces: `SessionAction` union, `initialSession(style, options): SessionState`, `sessionReducer(state, action): SessionState`

- [ ] **Step 1: Write the failing tests**

Create `lib/session/__tests__/reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialSession, sessionReducer } from '../reducer';
import type { SessionState } from '../types';

const T0 = 1_700_000_000_000;

function started(): SessionState {
  return sessionReducer(initialSession('gym'), { type: 'start', now: T0 });
}

describe('initialSession', () => {
  it('starts idle with no sets', () => {
    const state = initialSession('gym');
    expect(state.timer.status).toBe('idle');
    expect(state.sets).toEqual([]);
    expect(state.clientId).toBeNull();
  });

  it('carries the chosen style and setup options', () => {
    const state = initialSession('boxing', {
      clientId: 'c1',
      muscleGroups: ['arms'],
      fatiguedGroups: ['legs'],
    });
    expect(state.style).toBe('boxing');
    expect(state.clientId).toBe('c1');
    expect(state.muscleGroups).toEqual(['arms']);
    expect(state.fatiguedGroups).toEqual(['legs']);
  });
});

describe('start', () => {
  it('moves to running and records the start time', () => {
    const state = started();
    expect(state.timer.status).toBe('running');
    expect(state.timer.startedAt).toBe(T0);
  });

  it('ignores a second start', () => {
    const state = started();
    const again = sessionReducer(state, { type: 'start', now: T0 + 5000 });
    expect(again.timer.startedAt).toBe(T0);
  });
});

describe('pause and resume', () => {
  it('pauses', () => {
    const state = sessionReducer(started(), { type: 'pause', now: T0 + 3000 });
    expect(state.timer.status).toBe('paused');
    expect(state.timer.pausedAt).toBe(T0 + 3000);
  });

  it('accumulates the pause on resume', () => {
    let state = sessionReducer(started(), { type: 'pause', now: T0 + 3000 });
    state = sessionReducer(state, { type: 'resume', now: T0 + 8000 });
    expect(state.timer.status).toBe('running');
    expect(state.timer.pausedAt).toBeNull();
    expect(state.timer.accumulatedPauseMs).toBe(5000);
  });

  it('accumulates across several pauses', () => {
    let state = sessionReducer(started(), { type: 'pause', now: T0 + 1000 });
    state = sessionReducer(state, { type: 'resume', now: T0 + 3000 });
    state = sessionReducer(state, { type: 'pause', now: T0 + 5000 });
    state = sessionReducer(state, { type: 'resume', now: T0 + 6000 });
    expect(state.timer.accumulatedPauseMs).toBe(3000);
  });

  it('ignores a pause when not running', () => {
    const idle = initialSession('gym');
    expect(sessionReducer(idle, { type: 'pause', now: T0 })).toBe(idle);
  });

  it('ignores a resume when not paused', () => {
    const state = started();
    expect(sessionReducer(state, { type: 'resume', now: T0 + 1000 })).toBe(state);
  });
});

describe('exercise selection', () => {
  it('sets the current exercise and snapshots its name', () => {
    const state = sessionReducer(started(), {
      type: 'selectExercise',
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
    });
    expect(state.currentExerciseId).toBe('squat');
    expect(state.currentExerciseName).toBe('Back Squat');
  });

  it('applies remembered reps and weight when supplied', () => {
    const state = sessionReducer(started(), {
      type: 'selectExercise',
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
      lastReps: 8,
      lastWeight: 60,
    });
    expect(state.reps).toBe(8);
    expect(state.weight).toBe(60);
  });
});

describe('reps and weight', () => {
  it('adjusts reps but never below zero', () => {
    let state = sessionReducer(started(), { type: 'setReps', reps: 3 });
    expect(state.reps).toBe(3);
    state = sessionReducer(state, { type: 'setReps', reps: -5 });
    expect(state.reps).toBe(0);
  });

  it('adjusts weight but never below zero', () => {
    let state = sessionReducer(started(), { type: 'setWeight', weight: 42.5 });
    expect(state.weight).toBe(42.5);
    state = sessionReducer(state, { type: 'setWeight', weight: -1 });
    expect(state.weight).toBe(0);
  });
});

describe('completeSet', () => {
  function readyToLog(): SessionState {
    return sessionReducer(started(), {
      type: 'selectExercise',
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
      lastReps: 5,
      lastWeight: 50,
    });
  }

  it('appends a set with the current numbers', () => {
    const state = sessionReducer(readyToLog(), { type: 'completeSet', now: T0 + 10_000 });
    expect(state.sets).toHaveLength(1);
    expect(state.sets[0]).toEqual({
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
      reps: 5,
      weight: 50,
      restMs: null,
      completedAt: T0 + 10_000,
    });
  });

  it('records the rest that preceded the set and clears the rest clock', () => {
    let state = sessionReducer(readyToLog(), { type: 'startRest', now: T0 + 10_000 });
    state = sessionReducer(state, { type: 'completeSet', now: T0 + 100_000 });
    expect(state.sets[0].restMs).toBe(90_000);
    expect(state.restStartedAt).toBeNull();
  });

  it('is rejected while paused — the clock is not running, so neither is the work', () => {
    const paused = sessionReducer(readyToLog(), { type: 'pause', now: T0 + 5000 });
    expect(sessionReducer(paused, { type: 'completeSet', now: T0 + 6000 })).toBe(paused);
  });

  it('is rejected with no exercise selected', () => {
    const state = started();
    expect(sessionReducer(state, { type: 'completeSet', now: T0 + 1000 })).toBe(state);
  });
});

describe('finish', () => {
  it('records the end time', () => {
    const state = sessionReducer(started(), { type: 'finish', now: T0 + 60_000 });
    expect(state.timer.status).toBe('finished');
    expect(state.timer.endedAt).toBe(T0 + 60_000);
  });

  it('closes an open pause so the paused time is not lost', () => {
    let state = sessionReducer(started(), { type: 'pause', now: T0 + 10_000 });
    state = sessionReducer(state, { type: 'finish', now: T0 + 15_000 });
    expect(state.timer.accumulatedPauseMs).toBe(5000);
    expect(state.timer.pausedAt).toBeNull();
  });

  it('is rejected on an idle session', () => {
    const idle = initialSession('gym');
    expect(sessionReducer(idle, { type: 'finish', now: T0 })).toBe(idle);
  });
});

describe('configure', () => {
  it('applies the setup screen choices to an idle session', () => {
    const state = sessionReducer(initialSession('gym'), {
      type: 'configure',
      style: 'hiit',
      options: { clientId: 'c1', muscleGroups: ['core'], fatiguedGroups: ['legs'] },
    });
    expect(state.style).toBe('hiit');
    expect(state.clientId).toBe('c1');
    expect(state.muscleGroups).toEqual(['core']);
  });

  it('refuses to reconfigure a running session — that would discard logged sets', () => {
    const running = started();
    expect(
      sessionReducer(running, { type: 'configure', style: 'boxing', options: {} }),
    ).toBe(running);
  });
});

describe('summary edits', () => {
  it('attaches a client after the fact', () => {
    const state = sessionReducer(started(), { type: 'setClient', clientId: 'c9' });
    expect(state.clientId).toBe('c9');
  });

  it('rates difficulty, clamped to 1-10', () => {
    expect(sessionReducer(started(), { type: 'setDifficulty', difficulty: 7 }).difficulty).toBe(7);
    expect(sessionReducer(started(), { type: 'setDifficulty', difficulty: 44 }).difficulty).toBe(10);
    expect(sessionReducer(started(), { type: 'setDifficulty', difficulty: 0 }).difficulty).toBe(1);
  });

  it('removes a set logged by mistake', () => {
    let state = sessionReducer(started(), {
      type: 'selectExercise',
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
    });
    state = sessionReducer(state, { type: 'completeSet', now: T0 + 1000 });
    state = sessionReducer(state, { type: 'completeSet', now: T0 + 2000 });
    state = sessionReducer(state, { type: 'removeSet', index: 0 });
    expect(state.sets).toHaveLength(1);
    expect(state.sets[0].completedAt).toBe(T0 + 2000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- reducer`
Expected: FAIL — cannot find module `../reducer`.

- [ ] **Step 3: Implement**

Create `lib/session/reducer.ts`:

```ts
import { idleTimer } from './timer';
import type { SessionState, TrainingStyle } from './types';

export type SessionAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'finish'; now: number }
  | {
      type: 'selectExercise';
      exerciseId: string;
      exerciseName: string;
      lastReps?: number;
      lastWeight?: number;
    }
  | { type: 'setReps'; reps: number }
  | { type: 'setWeight'; weight: number }
  | { type: 'startRest'; now: number }
  | { type: 'completeSet'; now: number }
  | { type: 'removeSet'; index: number }
  | { type: 'setClient'; clientId: string | null }
  | { type: 'setDifficulty'; difficulty: number }
  | { type: 'setNotes'; notes: string }
  | { type: 'configure'; style: TrainingStyle; options: SessionOptions };

export interface SessionOptions {
  clientId?: string | null;
  muscleGroups?: string[];
  fatiguedGroups?: string[];
  intervals?: SessionState['intervals'];
}

export function initialSession(
  style: TrainingStyle,
  options: SessionOptions = {},
): SessionState {
  return {
    timer: idleTimer(),
    style,
    clientId: options.clientId ?? null,
    muscleGroups: options.muscleGroups ?? [],
    fatiguedGroups: options.fatiguedGroups ?? [],
    currentExerciseId: null,
    currentExerciseName: null,
    reps: 0,
    weight: 0,
    sets: [],
    intervals: options.intervals ?? null,
    restStartedAt: null,
    difficulty: null,
    notes: '',
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The session state machine: idle -> running <-> paused -> finished.
 *
 * Actions that make no sense in the current state return the SAME object
 * reference, which both documents the rejection and lets React skip a render.
 */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start': {
      if (state.timer.status !== 'idle') return state;
      return {
        ...state,
        timer: { ...state.timer, status: 'running', startedAt: action.now },
      };
    }

    case 'pause': {
      if (state.timer.status !== 'running') return state;
      return {
        ...state,
        timer: { ...state.timer, status: 'paused', pausedAt: action.now },
      };
    }

    case 'resume': {
      if (state.timer.status !== 'paused' || state.timer.pausedAt === null) return state;
      return {
        ...state,
        timer: {
          ...state.timer,
          status: 'running',
          pausedAt: null,
          accumulatedPauseMs:
            state.timer.accumulatedPauseMs + (action.now - state.timer.pausedAt),
        },
      };
    }

    case 'finish': {
      if (state.timer.status !== 'running' && state.timer.status !== 'paused') return state;
      // An open pause still has to be banked, or its duration silently counts
      // as training time.
      const pauseToBank =
        state.timer.pausedAt === null ? 0 : action.now - state.timer.pausedAt;
      return {
        ...state,
        timer: {
          ...state.timer,
          status: 'finished',
          pausedAt: null,
          accumulatedPauseMs: state.timer.accumulatedPauseMs + pauseToBank,
          endedAt: action.now,
        },
      };
    }

    case 'selectExercise': {
      return {
        ...state,
        currentExerciseId: action.exerciseId,
        currentExerciseName: action.exerciseName,
        reps: action.lastReps ?? state.reps,
        weight: action.lastWeight ?? state.weight,
      };
    }

    case 'setReps':
      return { ...state, reps: Math.max(0, action.reps) };

    case 'setWeight':
      return { ...state, weight: Math.max(0, action.weight) };

    case 'startRest':
      return { ...state, restStartedAt: action.now };

    case 'completeSet': {
      if (state.timer.status !== 'running') return state;
      if (state.currentExerciseId === null || state.currentExerciseName === null) return state;
      return {
        ...state,
        restStartedAt: null,
        sets: [
          ...state.sets,
          {
            exerciseId: state.currentExerciseId,
            exerciseName: state.currentExerciseName,
            reps: state.reps,
            weight: state.weight,
            restMs: state.restStartedAt === null ? null : action.now - state.restStartedAt,
            completedAt: action.now,
          },
        ],
      };
    }

    case 'removeSet':
      return { ...state, sets: state.sets.filter((_, i) => i !== action.index) };

    case 'setClient':
      return { ...state, clientId: action.clientId };

    case 'setDifficulty':
      return { ...state, difficulty: clamp(Math.round(action.difficulty), 1, 10) };

    case 'setNotes':
      return { ...state, notes: action.notes };

    case 'configure': {
      // The setup screen builds the session before it starts. Reconfiguring a
      // session already in progress would silently discard logged sets.
      if (state.timer.status !== 'idle') return state;
      return initialSession(action.style, action.options);
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- reducer`
Expected: PASS, 22 tests.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/session/reducer.ts lib/session/__tests__/reducer.test.ts
git commit -m "feat: session state machine with rejected illegal transitions"
```

---

### Task 6: Exercise seed and store interface

**Files:**
- Create: `lib/session/exercises.seed.ts`
- Create: `lib/session/store.ts`
- Test: `lib/session/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `SavedSession`, `Client`, `SessionState` from `./types`
- Produces: `SEED_EXERCISES: Exercise[]`, `MUSCLE_GROUPS: string[]`, `searchExercises(list, query): Exercise[]`, `SessionStore` interface, `InMemorySessionStore`, `toSavedSession(state, id, ownerUid): SavedSession`

- [ ] **Step 1: Write the seed list**

Create `lib/session/exercises.seed.ts`. Start with the ~40 below; the full 150–250 is a content task tracked separately in Todoist, and the shape is what matters here.

```ts
import type { Exercise } from './types';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full-body',
] as const;

function seed(id: string, name: string, muscleGroups: string[]): Exercise {
  return { id, name, muscleGroups, isCustom: false, ownerUid: null };
}

/** The global library. `ownerUid: null` marks these as readable by everyone. */
export const SEED_EXERCISES: Exercise[] = [
  seed('back-squat', 'Back Squat', ['quads', 'glutes']),
  seed('front-squat', 'Front Squat', ['quads', 'core']),
  seed('goblet-squat', 'Goblet Squat', ['quads', 'glutes']),
  seed('deadlift', 'Deadlift', ['hamstrings', 'back', 'glutes']),
  seed('romanian-deadlift', 'Romanian Deadlift', ['hamstrings', 'glutes']),
  seed('hip-thrust', 'Hip Thrust', ['glutes']),
  seed('leg-press', 'Leg Press', ['quads', 'glutes']),
  seed('lunge', 'Lunge', ['quads', 'glutes']),
  seed('bulgarian-split-squat', 'Bulgarian Split Squat', ['quads', 'glutes']),
  seed('leg-curl', 'Leg Curl', ['hamstrings']),
  seed('leg-extension', 'Leg Extension', ['quads']),
  seed('calf-raise', 'Calf Raise', ['calves']),
  seed('bench-press', 'Bench Press', ['chest', 'triceps']),
  seed('incline-bench-press', 'Incline Bench Press', ['chest', 'shoulders']),
  seed('dumbbell-press', 'Dumbbell Press', ['chest', 'triceps']),
  seed('push-up', 'Push-Up', ['chest', 'triceps']),
  seed('chest-fly', 'Chest Fly', ['chest']),
  seed('dip', 'Dip', ['chest', 'triceps']),
  seed('pull-up', 'Pull-Up', ['back', 'biceps']),
  seed('chin-up', 'Chin-Up', ['back', 'biceps']),
  seed('lat-pulldown', 'Lat Pulldown', ['back', 'biceps']),
  seed('barbell-row', 'Barbell Row', ['back', 'biceps']),
  seed('dumbbell-row', 'Dumbbell Row', ['back', 'biceps']),
  seed('seated-cable-row', 'Seated Cable Row', ['back']),
  seed('face-pull', 'Face Pull', ['shoulders', 'back']),
  seed('overhead-press', 'Overhead Press', ['shoulders', 'triceps']),
  seed('arnold-press', 'Arnold Press', ['shoulders']),
  seed('lateral-raise', 'Lateral Raise', ['shoulders']),
  seed('rear-delt-fly', 'Rear Delt Fly', ['shoulders']),
  seed('barbell-curl', 'Barbell Curl', ['biceps']),
  seed('dumbbell-curl', 'Dumbbell Curl', ['biceps']),
  seed('hammer-curl', 'Hammer Curl', ['biceps']),
  seed('triceps-pushdown', 'Triceps Pushdown', ['triceps']),
  seed('skull-crusher', 'Skull Crusher', ['triceps']),
  seed('plank', 'Plank', ['core']),
  seed('hanging-leg-raise', 'Hanging Leg Raise', ['core']),
  seed('russian-twist', 'Russian Twist', ['core']),
  seed('cable-crunch', 'Cable Crunch', ['core']),
  seed('farmers-carry', "Farmer's Carry", ['core', 'full-body']),
  seed('kettlebell-swing', 'Kettlebell Swing', ['glutes', 'full-body']),
  seed('burpee', 'Burpee', ['full-body']),
  seed('mountain-climber', 'Mountain Climber', ['core', 'full-body']),
];
```

- [ ] **Step 2: Write the failing store tests**

Create `lib/session/__tests__/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../exercises.seed';
import { initialSession, sessionReducer } from '../reducer';
import { InMemorySessionStore, searchExercises, toSavedSession } from '../store';

const T0 = 1_700_000_000_000;

describe('searchExercises', () => {
  it('returns everything for an empty query', () => {
    expect(searchExercises(SEED_EXERCISES, '')).toHaveLength(SEED_EXERCISES.length);
  });

  it('matches on a substring, case-insensitively', () => {
    const results = searchExercises(SEED_EXERCISES, 'squat');
    expect(results.length).toBeGreaterThan(1);
    expect(results.every((e) => e.name.toLowerCase().includes('squat'))).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(searchExercises(SEED_EXERCISES, '  plank  ')).toHaveLength(1);
  });

  it('returns nothing when nothing matches', () => {
    expect(searchExercises(SEED_EXERCISES, 'zzzz')).toEqual([]);
  });
});

describe('toSavedSession', () => {
  it('derives duration from the timer, excluding paused time', () => {
    let state = sessionReducer(initialSession('gym'), { type: 'start', now: T0 });
    state = sessionReducer(state, { type: 'pause', now: T0 + 10_000 });
    state = sessionReducer(state, { type: 'resume', now: T0 + 15_000 });
    state = sessionReducer(state, { type: 'finish', now: T0 + 60_000 });

    const saved = toSavedSession(state, 's1', 'uid1');
    expect(saved.durationMs).toBe(55_000);
    expect(saved.startedAt).toBe(T0);
    expect(saved.endedAt).toBe(T0 + 60_000);
    expect(saved.ownerUid).toBe('uid1');
  });

  it('refuses to save an unfinished session', () => {
    const state = sessionReducer(initialSession('gym'), { type: 'start', now: T0 });
    expect(() => toSavedSession(state, 's1', 'uid1')).toThrow(/not finished/i);
  });
});

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore('uid1');
  });

  it('starts with the seed exercises and no sessions', async () => {
    expect(await store.listExercises()).toHaveLength(SEED_EXERCISES.length);
    expect(await store.listSessions()).toEqual([]);
  });

  it('saves and lists sessions, newest first', async () => {
    const build = (start: number) => {
      let s = sessionReducer(initialSession('gym'), { type: 'start', now: start });
      return sessionReducer(s, { type: 'finish', now: start + 1000 });
    };
    await store.saveSession(build(T0));
    await store.saveSession(build(T0 + 100_000));

    const sessions = await store.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].startedAt).toBe(T0 + 100_000);
  });

  it('adds a custom exercise owned by the current user', async () => {
    const created = await store.addExercise('Zercher Squat', ['quads']);
    expect(created.isCustom).toBe(true);
    expect(created.ownerUid).toBe('uid1');
    expect(await store.listExercises()).toHaveLength(SEED_EXERCISES.length + 1);
  });

  it('creates and lists clients', async () => {
    const client = await store.addClient('Maria');
    expect(client.name).toBe('Maria');
    expect(client.ownerUid).toBe('uid1');
    expect(await store.listClients()).toHaveLength(1);
  });

  it('remembers the last numbers used for an exercise', async () => {
    let s = sessionReducer(initialSession('gym'), { type: 'start', now: T0 });
    s = sessionReducer(s, {
      type: 'selectExercise',
      exerciseId: 'back-squat',
      exerciseName: 'Back Squat',
    });
    s = sessionReducer(s, { type: 'setReps', reps: 5 });
    s = sessionReducer(s, { type: 'setWeight', weight: 80 });
    s = sessionReducer(s, { type: 'completeSet', now: T0 + 1000 });
    s = sessionReducer(s, { type: 'finish', now: T0 + 2000 });
    await store.saveSession(s);

    expect(await store.lastPerformance('back-squat')).toEqual({ reps: 5, weight: 80 });
  });

  it('returns null when an exercise has never been done', async () => {
    expect(await store.lastPerformance('deadlift')).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- store`
Expected: FAIL — cannot find module `../store`.

- [ ] **Step 4: Implement**

Create `lib/session/store.ts`:

```ts
import { SEED_EXERCISES } from './exercises.seed';
import { elapsedMs } from './timer';
import type { Client, Exercise, SavedSession, SessionState } from './types';

export interface LastPerformance {
  reps: number;
  weight: number;
}

/**
 * Everything the session UI needs from storage.
 *
 * The in-memory implementation ships first so the screens can be built and
 * demoed before any Firebase project exists; `FirestoreSessionStore` arrives in
 * Stage B behind the same interface.
 */
export interface SessionStore {
  listExercises(): Promise<Exercise[]>;
  addExercise(name: string, muscleGroups: string[]): Promise<Exercise>;
  listClients(): Promise<Client[]>;
  addClient(name: string, notes?: string): Promise<Client>;
  listSessions(): Promise<SavedSession[]>;
  saveSession(state: SessionState): Promise<SavedSession>;
  /** The numbers this user last used for an exercise, so they are not retyped weekly. */
  lastPerformance(exerciseId: string): Promise<LastPerformance | null>;
}

export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return exercises;
  return exercises.filter((exercise) => exercise.name.toLowerCase().includes(needle));
}

/** Convert finished session state into the record that gets stored. */
export function toSavedSession(
  state: SessionState,
  id: string,
  ownerUid: string,
): SavedSession {
  const { startedAt, endedAt } = state.timer;
  if (state.timer.status !== 'finished' || startedAt === null || endedAt === null) {
    throw new Error('Session is not finished — refusing to save a partial record.');
  }
  return {
    id,
    ownerUid,
    clientId: state.clientId,
    style: state.style,
    startedAt,
    endedAt,
    // Derived, so paused time is excluded exactly as the on-screen clock showed it.
    durationMs: elapsedMs(state.timer, endedAt),
    muscleGroups: state.muscleGroups,
    fatiguedGroups: state.fatiguedGroups,
    sets: state.sets,
    intervals: state.intervals,
    difficulty: state.difficulty,
    notes: state.notes,
  };
}

let counter = 0;
function localId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export class InMemorySessionStore implements SessionStore {
  private exercises: Exercise[] = [...SEED_EXERCISES];
  private clients: Client[] = [];
  private sessions: SavedSession[] = [];

  constructor(private readonly ownerUid: string) {}

  async listExercises(): Promise<Exercise[]> {
    return [...this.exercises];
  }

  async addExercise(name: string, muscleGroups: string[]): Promise<Exercise> {
    const exercise: Exercise = {
      id: localId('custom'),
      name,
      muscleGroups,
      isCustom: true,
      ownerUid: this.ownerUid,
    };
    this.exercises.push(exercise);
    return exercise;
  }

  async listClients(): Promise<Client[]> {
    return this.clients.filter((client) => !client.archived);
  }

  async addClient(name: string, notes = ''): Promise<Client> {
    const client: Client = {
      id: localId('client'),
      ownerUid: this.ownerUid,
      name,
      notes,
      athleteUid: null,
      createdAt: Date.now(),
      archived: false,
    };
    this.clients.push(client);
    return client;
  }

  async listSessions(): Promise<SavedSession[]> {
    return [...this.sessions].sort((a, b) => b.startedAt - a.startedAt);
  }

  async saveSession(state: SessionState): Promise<SavedSession> {
    const saved = toSavedSession(state, localId('session'), this.ownerUid);
    this.sessions.push(saved);
    return saved;
  }

  async lastPerformance(exerciseId: string): Promise<LastPerformance | null> {
    const sessions = await this.listSessions();
    for (const session of sessions) {
      // Within a session the last set is the most recent, so walk backwards.
      for (let i = session.sets.length - 1; i >= 0; i -= 1) {
        const set = session.sets[i];
        if (set.exerciseId === exerciseId) {
          return { reps: set.reps, weight: set.weight };
        }
      }
    }
    return null;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- store`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/session/exercises.seed.ts lib/session/store.ts lib/session/__tests__/store.test.ts
git commit -m "feat: exercise seed library and in-memory session store"
```

---

### Task 7: Session clock hook and provider

The single `setInterval` in the whole feature. Everything else derives from it.

**Files:**
- Create: `lib/session/useSessionClock.ts`
- Create: `lib/session/SessionProvider.tsx`

**Interfaces:**
- Consumes: `sessionReducer`, `initialSession`, `SessionAction` from `./reducer`; `SessionStore`, `InMemorySessionStore` from `./store`
- Produces: `useSessionClock(active: boolean): number`, `SessionProvider`, `useSession(): { state, dispatch, store }`

- [ ] **Step 1: Write the clock hook**

Create `lib/session/useSessionClock.ts`:

```ts
import { useEffect, useState } from 'react';

/**
 * Ticks once a second while `active`, purely to trigger re-renders.
 *
 * The returned value is the current wall-clock time, which every derived
 * calculation takes as input. Nothing accumulates here: if the app is
 * backgrounded and the interval stops firing, the next tick still returns the
 * true current time and every derived value is immediately correct again.
 */
export function useSessionClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  return now;
}
```

- [ ] **Step 2: Write the provider**

Create `lib/session/SessionProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { initialSession, sessionReducer, type SessionAction } from './reducer';
import { InMemorySessionStore, type SessionStore } from './store';
import type { SessionState } from './types';

interface SessionContextValue {
  state: SessionState;
  dispatch: (action: SessionAction) => void;
  store: SessionStore;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  store,
}: {
  children: ReactNode;
  /** Swapped for FirestoreSessionStore in Stage B; the UI never knows which. */
  store?: SessionStore;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession('gym'));
  const resolvedStore = useMemo(
    () => store ?? new InMemorySessionStore('local-user'),
    [store],
  );

  const value = useMemo(
    () => ({ state, dispatch, store: resolvedStore }),
    [state, resolvedStore],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return value;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/session/useSessionClock.ts lib/session/SessionProvider.tsx
git commit -m "feat: session clock hook and context provider"
```

---

### Task 8: Setup screen and the Train tab

**Files:**
- Create: `app/train/_layout.tsx`, `app/train/setup.tsx`
- Modify: `app/(tabs)/_layout.tsx` — add the Train tab
- Create: `app/(tabs)/train.tsx`

**Interfaces:**
- Consumes: `useSession` from `lib/session/SessionProvider`, `MUSCLE_GROUPS` from `lib/session/exercises.seed`, `BOXING_PRESET`/`HIIT_PRESET` from `lib/session/intervals`
- Produces: routes `/train/setup`, `/train/live`, `/train/summary`

- [ ] **Step 1: Read the existing tab layout**

Read `app/(tabs)/_layout.tsx` and match its `Tabs.Screen` conventions exactly — icon family, title casing, and any i18n helper already in use. Do not invent a new pattern.

- [ ] **Step 2: Add the Train tab**

Add a `Tabs.Screen` for `train` following the file's existing conventions, with a dumbbell icon from `@expo/vector-icons` (already a dependency).

- [ ] **Step 3: Write the setup screen**

Create `app/train/setup.tsx`. Requirements, using `react-native-paper` components and the existing `components/ui/Screen` wrapper:

- A style selector: Gym, Boxing, HIIT (Paper `SegmentedButtons`).
- A client row: pick from `store.listClients()`, plus **Skip** — starting must never be blocked by bookkeeping.
- Muscle-group chips from `MUSCLE_GROUPS`, multi-select, plus a second "already tired" selection.
- For boxing and HIIT, show the preset (`BOXING_PRESET` / `HIIT_PRESET`) with editable work, rest and round count.
- A **Start** button that dispatches `{ type: 'configure', style, options }` with the chosen client, muscle groups, fatigued groups and intervals, then `{ type: 'start', now: Date.now() }`, then routes to `/train/live`. Configure before start — the reducer rejects `configure` once a session is running.

- [ ] **Step 4: Verify on a device**

Run: `npx expo start`
Expected: the Train tab appears, styles select, Start routes to a live screen (blank until Task 9).

- [ ] **Step 5: Commit**

```bash
git add app/train app/\(tabs\)
git commit -m "feat: train tab and session setup screen"
```

---

### Task 9: Live screen and summary

**Files:**
- Create: `components/train/SessionHeader.tsx`, `ExerciseCard.tsx`, `ExercisePicker.tsx`, `RestStopwatch.tsx`, `IntervalClock.tsx`
- Create: `app/train/live.tsx`, `app/train/summary.tsx`

**Interfaces:**
- Consumes: `useSession`, `useSessionClock`, `elapsedMs`, `formatElapsed`, `intervalAt`, `searchExercises`
- Produces: the working dashboard

- [ ] **Step 1: Install the session-only dependencies**

```bash
npx expo install expo-keep-awake expo-audio
```

- [ ] **Step 2: Build `SessionHeader`**

Elapsed time via `formatElapsed(elapsedMs(state.timer, now))`, a pause/resume button, the client name and the style. Shared by every style — the shell never changes.

- [ ] **Step 3: Build `ExerciseCard` and `RestStopwatch`**

`ExerciseCard`: current exercise name, set counter, reps ± and weight ± steppers, **Complete set** and **Next exercise**. On selecting an exercise, call `store.lastPerformance(id)` and pass the result as `lastReps`/`lastWeight` — re-entering the same numbers weekly is what makes people stop logging.

`RestStopwatch`: starts on `{ type: 'startRest' }`, counts up from `state.restStartedAt` using the shared clock, clears when the next set is completed.

- [ ] **Step 4: Build `ExercisePicker`**

A Paper bottom sheet or modal: search field filtered through `searchExercises`, sections for Favourites, Recent and All, and an **Add custom** row calling `store.addExercise`.

- [ ] **Step 5: Build `IntervalClock`**

For boxing and HIIT. Derive with `intervalAt(state.intervals, elapsed)`. Show round N of M, the phase, and `remainingMs`. Play the bell with `expo-audio` on each phase change — trigger off the *derived* phase changing, never off a countdown reaching zero, so a backgrounded app does not fire a burst of stale bells on resume. Include a full-screen clock toggle.

- [ ] **Step 6: Assemble `live.tsx`**

`SessionHeader` always; `ExerciseCard` + `RestStopwatch` for gym; `IntervalClock` for boxing and HIIT. Call `useKeepAwake()` from `expo-keep-awake` so the phone does not lock between sets. A **Finish** button dispatches `{ type: 'finish', now: Date.now() }` and routes to `/train/summary`.

- [ ] **Step 7: Build `summary.tsx`**

List every set with a delete affordance (`removeSet`), a 1–10 difficulty selector (`setDifficulty`), a notes field (`setNotes`), a client attach/change control (`setClient`) — this is where a session started without a client gets one — and **Save**, which calls `store.saveSession(state)` and returns to the tab.

- [ ] **Step 8: Verify the full flow on a device**

Run: `npx expo start`

Walk it end to end: start a gym session, log three sets, pause, wait, resume, finish, delete a set, rate it, save. Then a boxing session: confirm rounds advance, the bell fires on each phase change, and full-screen mode works. Lock the phone for two minutes mid-session and confirm the elapsed time is still correct on unlock.

- [ ] **Step 9: Full check and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

```bash
git add components/train app/train package.json package-lock.json
git commit -m "feat: live session dashboard with gym, boxing and HIIT modes"
```

---

## Stage B — persistence

**Blocked on `docs/BUREAUCRACY.md` → Firebase → Native SDK config.** Do not start these until `google-services.json` and `GoogleService-Info.plist` are in the repo.

### Task 10: Migrate Firebase to the native SDK

The Firebase JS SDK cannot persist offline in React Native — its cache is IndexedDB-backed and there is no IndexedDB on a phone. Offline is non-negotiable for a gym app, so Firestore moves to `@react-native-firebase`.

**Auth must move with it.** Security rules check `request.auth.uid`, which comes from whichever SDK holds the session. Leaving auth on the JS SDK means every Firestore write arrives unauthenticated and the rules correctly reject it.

**Files:**
- Modify: `lib/firebase.ts`, `app/login.tsx`, `lib/api.ts`
- Modify: `app.json` (config plugins)

- [ ] **Step 1: Install**

```bash
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

- [ ] **Step 2: Add the config plugins to `app.json`**, and the native config files at the paths the plugins expect.

- [ ] **Step 3: Move auth**, keeping the exported `auth` surface in `lib/firebase.ts` shaped the same so callers change as little as possible. Point it at the emulator when `useEmulators` is true.

- [ ] **Step 4: Rebuild the dev client** — this no longer runs in Expo Go.

```bash
eas build --profile development --platform ios
```

- [ ] **Step 5: Verify** sign-in, the skills list and chat all still work against the emulator. This task changes working code; regressions here are the risk, not the new feature.

- [ ] **Step 6: Commit**

```bash
git commit -am "refactor: move Firebase auth and Firestore to the native SDK"
```

---

### Task 11: Security rules

**Files:**
- Modify: `firestore.rules`
- Create: `scripts/check-session-rules.mjs`

Current rules deny everything by design — the client has never touched Firestore. This opens exactly three collections to their owners, and nothing else. Skill documents stay denied: rule #1 is untouched.

- [ ] **Step 1: Write the rules**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner() {
      return request.auth != null && request.auth.uid == resource.data.ownerUid;
    }
    function creatingAsSelf() {
      return request.auth != null && request.auth.uid == request.resource.data.ownerUid;
    }

    // The global exercise library: readable by any signed-in user, writable by
    // no one from the client. Custom exercises belong to their owner.
    match /exercises/{exerciseId} {
      allow read: if request.auth != null;
      allow create: if creatingAsSelf() && request.resource.data.isCustom == true;
      allow update, delete: if isOwner() && resource.data.isCustom == true;
    }

    match /clients/{clientId} {
      allow read, update, delete: if isOwner();
      allow create: if creatingAsSelf();
    }

    match /sessions/{sessionId} {
      allow read, update, delete: if isOwner();
      allow create: if creatingAsSelf();
    }

    // Everything else — skill documents above all — stays closed.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Write rules tests** in `scripts/check-session-rules.mjs`, following the shape of the existing `scripts/check-rules.mjs`. Assert at minimum: a user can read their own session; a user **cannot** read another user's session; a user cannot create a session with someone else's `ownerUid`; nobody can read a skill document. "A coach cannot read a client they do not own" is an assertion, not an assumption.

- [ ] **Step 3: Run against the emulator**

Run: `npm run emulators` then `node scripts/check-session-rules.mjs`
Expected: all assertions pass.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules scripts/check-session-rules.mjs package.json
git commit -m "feat: owner-scoped security rules for sessions, clients and exercises"
```

---

### Task 12: Firestore store

**Files:**
- Create: `lib/session/firestoreStore.ts`
- Modify: `lib/session/SessionProvider.tsx` — default to the Firestore store
- Modify: `functions/src/seed/run.ts` — seed the exercise library

- [ ] **Step 1: Implement `FirestoreSessionStore`** against the **same `SessionStore` interface** from Task 6. No screen changes — if any screen needs editing, the interface was wrong and that is the bug to fix.

- [ ] **Step 2: Enable offline persistence.** It is on by default in `@react-native-firebase/firestore`; assert it explicitly rather than relying on the default silently holding.

- [ ] **Step 3: Add the seed exercises** to the existing seed script so `npm run seed` loads the library with `ownerUid: null`.

- [ ] **Step 4: Test offline for real.** Start a session, put the phone in airplane mode, log five sets, finish, save. Confirm the save succeeds. Re-enable the network and confirm it syncs. **This is the acceptance test for the entire feature** — a coach losing an hour of a client's work to thick walls is the failure this design exists to prevent.

- [ ] **Step 5: Full check and commit**

Run: `npm test && npm run typecheck && npm run lint`

```bash
git add lib/session/firestoreStore.ts lib/session/SessionProvider.tsx functions/src/seed
git commit -m "feat: persist sessions to Firestore with offline support"
```

---

## Deliberately not in this plan

Each is its own spec section and its own plan:

- **Athlete/coach modes and QR linking** — needs a `users.role` model and a `links` collection.
- **The shareable recap** — card rendering, share sheet, in-app delivery.
- **Progress graphs** — body weight, lifted weight, difficulty, duration. **Load the `dataviz` skill before writing any chart code.**
- **The entitlement gate** — deferred by decision; tracked as a launch blocker in Todoist.
- **Yoga** — E18.
