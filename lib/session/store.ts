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
  /**
   * Most recently logged exercises, most recent first. Backed by a bounded
   * query against Firestore (Stage B) — callers must not fall back to
   * `listSessions()` to derive this themselves.
   */
  recentExercises(limit: number): Promise<Exercise[]>;
  /** Most frequently logged exercises, most frequent first. Same constraint as `recentExercises`. */
  favouriteExercises(limit: number): Promise<Exercise[]>;
}

export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return exercises;
  return exercises.filter((exercise) => exercise.name.toLowerCase().includes(needle));
}

/**
 * Most recently logged exercise ids, most recent first.
 *
 * `sessions` must already be newest-session-first (as `listSessions()`
 * returns). Within a session, sets are walked newest-first too — otherwise
 * the earliest exercise of the newest session would sort ahead of exercises
 * logged later in an older session.
 */
function deriveRecentIds(sessions: SavedSession[], limit: number): string[] {
  const recent: string[] = [];
  for (const session of sessions) {
    for (let i = session.sets.length - 1; i >= 0; i -= 1) {
      const id = session.sets[i].exerciseId;
      if (!recent.includes(id)) recent.push(id);
      if (recent.length >= limit) return recent;
    }
  }
  return recent;
}

/** Most frequently logged exercise ids, most frequent first. */
function deriveFavouriteIds(sessions: SavedSession[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const set of session.sets) {
      counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
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
    muscleGroups: [...state.muscleGroups],
    fatiguedGroups: [...state.fatiguedGroups],
    sets: state.sets.map((set) => ({ ...set })),
    intervals: state.intervals === null ? null : { ...state.intervals },
    difficulty: state.difficulty,
    notes: state.notes,
  };
}

/** Copy every mutable field, so a caller can never reach the store's own record. */
function cloneSavedSession(session: SavedSession): SavedSession {
  return {
    ...session,
    muscleGroups: [...session.muscleGroups],
    fatiguedGroups: [...session.fatiguedGroups],
    sets: session.sets.map((set) => ({ ...set })),
    intervals: session.intervals === null ? null : { ...session.intervals },
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
    return this.exercises.map((exercise) => ({ ...exercise, muscleGroups: [...exercise.muscleGroups] }));
  }

  async addExercise(name: string, muscleGroups: string[]): Promise<Exercise> {
    const exercise: Exercise = {
      id: localId('custom'),
      name,
      muscleGroups: [...muscleGroups],
      isCustom: true,
      ownerUid: this.ownerUid,
    };
    this.exercises.push(exercise);
    return { ...exercise, muscleGroups: [...exercise.muscleGroups] };
  }

  async listClients(): Promise<Client[]> {
    return this.clients.filter((client) => !client.archived).map((client) => ({ ...client }));
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
    return { ...client };
  }

  async listSessions(): Promise<SavedSession[]> {
    return [...this.sessions]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((session) => cloneSavedSession(session));
  }

  async saveSession(state: SessionState): Promise<SavedSession> {
    const saved = toSavedSession(state, localId('session'), this.ownerUid);
    this.sessions.push(saved);
    return cloneSavedSession(saved);
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

  async recentExercises(limit: number): Promise<Exercise[]> {
    const sessions = await this.listSessions();
    return this.hydrateExercises(deriveRecentIds(sessions, limit));
  }

  async favouriteExercises(limit: number): Promise<Exercise[]> {
    const sessions = await this.listSessions();
    return this.hydrateExercises(deriveFavouriteIds(sessions, limit));
  }

  /** Resolve ids to full Exercise records, cloned so no internal reference escapes. */
  private hydrateExercises(ids: string[]): Exercise[] {
    const byId = new Map(this.exercises.map((exercise) => [exercise.id, exercise]));
    return ids
      .map((id) => byId.get(id))
      .filter((exercise): exercise is Exercise => exercise !== undefined)
      .map((exercise) => ({ ...exercise, muscleGroups: [...exercise.muscleGroups] }));
  }
}
