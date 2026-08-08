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

  // --- Encapsulation: no internal reference should ever escape the store. ---

  const finishedSquatSession = (start: number) => {
    let s = sessionReducer(
      initialSession('gym', { muscleGroups: ['legs'], fatiguedGroups: ['back'] }),
      { type: 'start', now: start },
    );
    s = sessionReducer(s, {
      type: 'selectExercise',
      exerciseId: 'back-squat',
      exerciseName: 'Back Squat',
    });
    s = sessionReducer(s, { type: 'setReps', reps: 5 });
    s = sessionReducer(s, { type: 'setWeight', weight: 80 });
    s = sessionReducer(s, { type: 'completeSet', now: start + 1000 });
    return sessionReducer(s, { type: 'finish', now: start + 2000 });
  };

  it('defect 1: mutating objects returned by addExercise/addClient/saveSession does not affect the store', async () => {
    const exercise = await store.addExercise('Zercher Squat', ['quads']);
    exercise.name = 'Hijacked';

    const client = await store.addClient('Maria', 'original notes');
    client.name = 'Hijacked';

    const saved = await store.saveSession(finishedSquatSession(T0));
    saved.notes = 'Hijacked';

    const storedExercise = (await store.listExercises()).find((e) => e.id === exercise.id);
    const storedClient = (await store.listClients()).find((c) => c.id === client.id);
    const storedSession = (await store.listSessions()).find((s) => s.id === saved.id);

    expect(storedExercise?.name).toBe('Zercher Squat');
    expect(storedClient?.name).toBe('Maria');
    expect(storedSession?.notes).toBe('');
  });

  it('defect 2: mutating objects returned by listExercises/listClients does not affect the store', async () => {
    await store.addExercise('Zercher Squat', ['quads']);
    await store.addClient('Maria', 'original notes');

    const exerciseBefore = (await store.listExercises()).find((e) => e.name === 'Zercher Squat')!;
    exerciseBefore.muscleGroups.push('glutes');

    const clientBefore = (await store.listClients()).find((c) => c.name === 'Maria')!;
    clientBefore.notes = 'Hijacked';

    const exerciseAfter = (await store.listExercises()).find((e) => e.name === 'Zercher Squat')!;
    const clientAfter = (await store.listClients()).find((c) => c.name === 'Maria')!;

    expect(exerciseAfter.muscleGroups).toEqual(['quads']);
    expect(clientAfter.notes).toBe('original notes');
  });

  it('defect 3: mutating arrays on a saved session does not corrupt stored training history', async () => {
    const saved = await store.saveSession(finishedSquatSession(T0));

    saved.sets.push({
      exerciseId: 'deadlift',
      exerciseName: 'Deadlift',
      reps: 999,
      weight: 999,
      restMs: null,
      completedAt: T0,
    });
    saved.sets[0].reps = 999;
    saved.muscleGroups.push('fake');
    saved.fatiguedGroups.push('fake');

    expect(await store.lastPerformance('deadlift')).toBeNull();
    expect(await store.lastPerformance('back-squat')).toEqual({ reps: 5, weight: 80 });

    const stored = (await store.listSessions())[0];
    expect(stored.sets).toHaveLength(1);
    expect(stored.muscleGroups).toEqual(['legs']);
    expect(stored.fatiguedGroups).toEqual(['back']);
  });

  it('defect 4: mutating a session returned by listSessions does not affect the store', async () => {
    await store.saveSession(finishedSquatSession(T0));

    const before = (await store.listSessions())[0];
    before.sets.push({
      exerciseId: 'deadlift',
      exerciseName: 'Deadlift',
      reps: 999,
      weight: 999,
      restMs: null,
      completedAt: T0,
    });
    before.notes = 'Hijacked';

    const after = (await store.listSessions())[0];
    expect(after.sets).toHaveLength(1);
    expect(after.notes).toBe('');
    expect(await store.lastPerformance('deadlift')).toBeNull();
  });
});
