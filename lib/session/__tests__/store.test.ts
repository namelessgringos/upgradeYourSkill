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
