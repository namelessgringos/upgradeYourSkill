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
