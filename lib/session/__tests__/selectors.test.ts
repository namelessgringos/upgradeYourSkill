import { describe, expect, it } from 'vitest';
import { formatGroupSets, groupSetsByExercise } from '../selectors';
import type { CompletedSet } from '../types';

function set(
  exerciseId: string,
  exerciseName: string,
  reps: number,
  weight: number,
  completedAt: number,
): CompletedSet {
  return { exerciseId, exerciseName, reps, weight, restMs: null, completedAt };
}

describe('groupSetsByExercise', () => {
  it('returns nothing for an empty session', () => {
    expect(groupSetsByExercise([])).toEqual([]);
  });

  it('collapses repeated sets of one exercise into a single group', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', 10, 60, 1),
      set('bench', 'Bench press', 10, 60, 2),
      set('bench', 'Bench press', 8, 62.5, 3),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].exerciseId).toBe('bench');
    expect(groups[0].sets.map((s) => s.reps)).toEqual([10, 10, 8]);
  });

  it('orders groups by when each exercise was first performed', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', 10, 60, 1),
      set('squat', 'Squat', 8, 80, 2),
      set('bench', 'Bench press', 10, 60, 3),
    ]);

    expect(groups.map((g) => g.exerciseId)).toEqual(['bench', 'squat']);
  });

  it('keeps interleaved sets in the group they belong to, in order', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', 10, 60, 1),
      set('squat', 'Squat', 8, 80, 2),
      set('bench', 'Bench press', 9, 60, 3),
      set('squat', 'Squat', 8, 85, 4),
    ]);

    expect(groups[0].sets.map((s) => s.completedAt)).toEqual([1, 3]);
    expect(groups[1].sets.map((s) => s.completedAt)).toEqual([2, 4]);
  });

  it('groups by id, not by name, so a renamed exercise stays one row', () => {
    const groups = groupSetsByExercise([
      set('custom-1', 'Db press', 10, 20, 1),
      set('custom-1', 'Dumbbell press', 10, 20, 2),
    ]);

    expect(groups).toHaveLength(1);
    // The first snapshot wins — see the ExerciseGroup doc comment.
    expect(groups[0].exerciseName).toBe('Db press');
  });

  it('keeps two exercises that share a name but not an id apart', () => {
    const groups = groupSetsByExercise([
      set('seed-press', 'Press', 10, 40, 1),
      set('custom-press', 'Press', 10, 40, 2),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('does not mutate the array it was given', () => {
    const sets = [set('bench', 'Bench press', 10, 60, 1)];
    const groups = groupSetsByExercise(sets);
    groups[0].sets.push(set('bench', 'Bench press', 10, 60, 2));

    expect(sets).toHaveLength(1);
  });
});

describe('formatGroupSets', () => {
  it('renders one set', () => {
    const [group] = groupSetsByExercise([set('bench', 'Bench press', 10, 60, 1)]);
    expect(formatGroupSets(group)).toBe('10 × 60kg');
  });

  it('joins several sets with a middle dot', () => {
    const [group] = groupSetsByExercise([
      set('bench', 'Bench press', 10, 60, 1),
      set('bench', 'Bench press', 8, 62.5, 2),
    ]);
    expect(formatGroupSets(group)).toBe('10 × 60kg · 8 × 62.5kg');
  });

  it('renders bodyweight sets without inventing a number', () => {
    const [group] = groupSetsByExercise([set('pullup', 'Pull-up', 12, 0, 1)]);
    expect(formatGroupSets(group)).toBe('12 × 0kg');
  });
});
