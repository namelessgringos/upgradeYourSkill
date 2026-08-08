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
