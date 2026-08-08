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
  /**
   * Session-elapsed ms (as returned by `elapsedMs`, excluding paused time) at
   * which the current rest began — NOT an epoch timestamp. Storing an offset
   * on the same derived timeline as everything else means a pause during the
   * rest is automatically excluded when the rest duration is later computed.
   * Null when not resting.
   */
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
