import { elapsedMs, idleTimer, restElapsedMs } from './timer';
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
  | { type: 'stopRest' }
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
      // Stored as a session-elapsed offset, not the epoch timestamp — see
      // the `restStartedAt` doc comment in types.ts.
      return { ...state, restStartedAt: elapsedMs(state.timer, action.now) };

    case 'stopRest':
      // Idempotent on purpose: the button is reachable from a state where no
      // rest is running, and a no-op reads better there than a guard.
      if (state.restStartedAt === null) return state;
      return { ...state, restStartedAt: null };

    case 'completeSet': {
      if (state.timer.status !== 'running') return state;
      if (state.currentExerciseId === null || state.currentExerciseName === null) return state;
      return {
        ...state,
        // Rest begins the instant a set ends. Nobody reaches for a second
        // button with a barbell still in their hands, and the rest that
        // matters is the one *between* sets — which is exactly this one.
        restStartedAt: elapsedMs(state.timer, action.now),
        sets: [
          ...state.sets,
          {
            exerciseId: state.currentExerciseId,
            exerciseName: state.currentExerciseName,
            reps: state.reps,
            weight: state.weight,
            restMs:
              state.restStartedAt === null
                ? null
                : restElapsedMs(state.timer, state.restStartedAt, action.now),
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
