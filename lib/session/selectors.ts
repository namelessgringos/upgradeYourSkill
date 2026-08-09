import type { CompletedSet, RepEntry } from './types';

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

/** Trailing zeros make a weight column noisy: 42.5 stays, 40.0 becomes 40. */
function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(2)));
}

/**
 * "4 × 42.5kg" when every rep was at the same weight, "40/42.5/42.5/45kg"
 * when it was a ramp.
 *
 * The two forms exist because collapsing a ramp to one number is a lie, and
 * spelling out four identical numbers is noise.
 */
export function formatSetReps(set: CompletedSet): string {
  if (set.reps.length === 0) return '—';
  const weights = set.reps.map((rep) => rep.weight);
  const uniform = weights.every((weight) => weight === weights[0]);
  return uniform
    ? `${set.reps.length} × ${formatWeight(weights[0])}kg`
    : `${weights.map(formatWeight).join('/')}kg`;
}

/** Every set of a group on one line, sets separated by a middle dot. */
export function formatGroupSets(group: ExerciseGroup): string {
  return group.sets.map(formatSetReps).join(' · ');
}

/** The heaviest rep in a set — what "how much did they lift" usually means. */
export function topWeight(reps: RepEntry[]): number {
  return reps.reduce((max, rep) => Math.max(max, rep.weight), 0);
}
