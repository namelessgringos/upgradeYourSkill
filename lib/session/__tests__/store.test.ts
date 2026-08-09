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
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 85, durationMs: 3000 });
    s = sessionReducer(s, { type: 'completeSet', now: T0 + 1000 });
    s = sessionReducer(s, { type: 'finish', now: T0 + 2000 });
    await store.saveSession(s);

    // Three reps, heaviest 85 — the count seeds the rep target and the top
    // weight is the number worth starting from again.
    expect(await store.lastPerformance('back-squat')).toEqual({ reps: 3, weight: 85 });
  });

  it('returns null when an exercise has never been done', async () => {
    expect(await store.lastPerformance('deadlift')).toBeNull();
  });

  describe('recentExercises', () => {
    const finishedSession = (start: number, exerciseIds: string[]) => {
      let s = sessionReducer(initialSession('gym'), { type: 'start', now: start });
      exerciseIds.forEach((exerciseId, i) => {
        s = sessionReducer(s, {
          type: 'selectExercise',
          exerciseId,
          exerciseName: exerciseId,
        });
        // A set needs at least one rep in it to be bankable.
        s = sessionReducer(s, { type: 'logRep', weight: 40, durationMs: 3000 });
        s = sessionReducer(s, { type: 'completeSet', now: start + i + 1 });
      });
      return sessionReducer(s, { type: 'finish', now: start + exerciseIds.length + 10 });
    };

    it('is empty for a brand-new user', async () => {
      expect(await store.recentExercises(5)).toEqual([]);
    });

    it('returns the most recently logged exercises, most recent first', async () => {
      await store.saveSession(finishedSession(T0, ['back-squat', 'bench-press']));
      await store.saveSession(finishedSession(T0 + 100_000, ['deadlift']));

      const recent = await store.recentExercises(5);
      expect(recent.map((e) => e.id)).toEqual(['deadlift', 'bench-press', 'back-squat']);
    });

    it('orders by true recency across sessions, not just newest-session-first', async () => {
      // Older session logs squat then bench (bench is the most recent set in
      // that session). Newest session logs only deadlift. True recency order
      // must be: deadlift (newest session), bench (last set of the older
      // session), squat (first set of the older session) — NOT squat sorting
      // ahead of bench just because it was walked oldest-set-first.
      await store.saveSession(finishedSession(T0, ['back-squat', 'bench-press']));
      await store.saveSession(finishedSession(T0 + 100_000, ['deadlift']));

      const recent = await store.recentExercises(5);
      expect(recent.map((e) => e.id)).toEqual(['deadlift', 'bench-press', 'back-squat']);
    });

    it('respects the limit', async () => {
      await store.saveSession(finishedSession(T0, ['back-squat', 'bench-press', 'deadlift']));
      expect(await store.recentExercises(2)).toHaveLength(2);
    });

    it('does not duplicate an exercise logged more than once', async () => {
      await store.saveSession(finishedSession(T0, ['back-squat', 'back-squat', 'bench-press']));
      const recent = await store.recentExercises(5);
      expect(recent.map((e) => e.id)).toEqual(['bench-press', 'back-squat']);
    });
  });

  describe('favouriteExercises', () => {
    const finishedSession = (start: number, exerciseIds: string[]) => {
      let s = sessionReducer(initialSession('gym'), { type: 'start', now: start });
      exerciseIds.forEach((exerciseId, i) => {
        s = sessionReducer(s, {
          type: 'selectExercise',
          exerciseId,
          exerciseName: exerciseId,
        });
        // A set needs at least one rep in it to be bankable.
        s = sessionReducer(s, { type: 'logRep', weight: 40, durationMs: 3000 });
        s = sessionReducer(s, { type: 'completeSet', now: start + i + 1 });
      });
      return sessionReducer(s, { type: 'finish', now: start + exerciseIds.length + 10 });
    };

    it('is empty for a brand-new user', async () => {
      expect(await store.favouriteExercises(5)).toEqual([]);
    });

    it('returns the most frequently logged exercises, most frequent first', async () => {
      await store.saveSession(
        finishedSession(T0, ['back-squat', 'back-squat', 'back-squat', 'bench-press']),
      );
      await store.saveSession(finishedSession(T0 + 100_000, ['bench-press', 'deadlift']));

      const favourites = await store.favouriteExercises(5);
      expect(favourites.map((e) => e.id)).toEqual(['back-squat', 'bench-press', 'deadlift']);
    });

    it('respects the limit', async () => {
      await store.saveSession(finishedSession(T0, ['back-squat', 'bench-press', 'deadlift']));
      expect(await store.favouriteExercises(1)).toHaveLength(1);
    });
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
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
    s = sessionReducer(s, { type: 'logRep', weight: 80, durationMs: 3000 });
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
      reps: [{ weight: 999, durationMs: 999 }],
      restMs: null,
      completedAt: T0,
    });
    saved.sets[0].reps = [{ weight: 999, durationMs: 999 }];
    // The rep array itself is the newer hazard: a shallow set copy would hand
    // out the store's own array, and this push would rewrite stored history.
    saved.sets[0].reps.push({ weight: 999, durationMs: 999 });
    saved.muscleGroups.push('fake');
    saved.fatiguedGroups.push('fake');

    expect(await store.lastPerformance('deadlift')).toBeNull();
    expect(await store.lastPerformance('back-squat')).toEqual({ reps: 5, weight: 80 });

    const stored = (await store.listSessions())[0];
    expect(stored.sets).toHaveLength(1);
    expect(stored.muscleGroups).toEqual(['legs']);
    expect(stored.fatiguedGroups).toEqual(['back']);
  });

  it('mutating a rep inside a set returned by listSessions does not rewrite history', async () => {
    await store.saveSession(finishedSquatSession(T0));

    const before = (await store.listSessions())[0];
    before.sets[0].reps[0].weight = 999;
    before.sets[0].reps.push({ weight: 999, durationMs: 999 });

    const after = (await store.listSessions())[0];
    expect(after.sets[0].reps).toHaveLength(5);
    expect(after.sets[0].reps.every((rep) => rep.weight === 80)).toBe(true);
  });

  it('defect 4: mutating a session returned by listSessions does not affect the store', async () => {
    await store.saveSession(finishedSquatSession(T0));

    const before = (await store.listSessions())[0];
    before.sets.push({
      exerciseId: 'deadlift',
      exerciseName: 'Deadlift',
      reps: [{ weight: 999, durationMs: 999 }],
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
