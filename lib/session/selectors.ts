import type { CompletedSet } from './types';

/** One exercise as it appears in the live session log, with its sets in order. */
export interface ExerciseGroup {
  exerciseId: string;
  /**
   * The name from the group's FIRST set. `exerciseName` is a per-set snapshot
   * (see the spec's note on denormalization), so a mid-session rename would
   * otherwise make one exercise appear twice under two names.
   */
  exerciseName: string;
  sets: CompletedSet[];
}

/**
 * Collapse a flat set list into one entry per exercise, ordered by when each
 * exercise was first performed.
 *
 * First-appearance order rather than most-recent-first: a coach reads the log
 * as the story of the session so far, and rows that reshuffle themselves under
 * a thumb are hard to hit.
 */
export function groupSetsByExercise(sets: CompletedSet[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const byId = new Map<string, ExerciseGroup>();

  for (const set of sets) {
    const existing = byId.get(set.exerciseId);
    if (existing) {
      existing.sets.push(set);
      continue;
    }
    const group: ExerciseGroup = {
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      sets: [set],
    };
    byId.set(set.exerciseId, group);
    groups.push(group);
  }

  return groups;
}

/** "10 × 60kg · 10 × 60kg · 8 × 62.5kg" — the group's sets on one line. */
export function formatGroupSets(group: ExerciseGroup): string {
  return group.sets.map((set) => `${set.reps} × ${set.weight}kg`).join(' · ');
}
