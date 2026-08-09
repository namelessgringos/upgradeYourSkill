import { describe, expect, it } from 'vitest';
import { formatGroupSets, formatSetReps, groupSetsByExercise, topWeight } from '../selectors';
import type { CompletedSet } from '../types';

/** `weights` is one entry per rep, so a ramp is expressed directly. */
function set(
  exerciseId: string,
  exerciseName: string,
  weights: number[],
  completedAt: number,
): CompletedSet {
  return {
    exerciseId,
    exerciseName,
    reps: weights.map((weight) => ({ weight, durationMs: 3000 })),
    restMs: null,
    completedAt,
  };
}

describe('groupSetsByExercise', () => {
  it('returns nothing for an empty session', () => {
    expect(groupSetsByExercise([])).toEqual([]);
  });

  it('collapses repeated sets of one exercise into a single group', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 1),
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 2),
      set('bench', 'Bench press', [62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5], 3),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].exerciseId).toBe('bench');
    expect(groups[0].sets.map((s) => s.reps.length)).toEqual([10, 10, 8]);
  });

  it('orders groups by when each exercise was first performed', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 1),
      set('squat', 'Squat', [80, 80, 80, 80, 80, 80, 80, 80], 2),
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 3),
    ]);

    expect(groups.map((g) => g.exerciseId)).toEqual(['bench', 'squat']);
  });

  it('keeps interleaved sets in the group they belong to, in order', () => {
    const groups = groupSetsByExercise([
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 1),
      set('squat', 'Squat', [80, 80, 80, 80, 80, 80, 80, 80], 2),
      set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60], 3),
      set('squat', 'Squat', [85, 85, 85, 85, 85, 85, 85, 85], 4),
    ]);

    expect(groups[0].sets.map((s) => s.completedAt)).toEqual([1, 3]);
    expect(groups[1].sets.map((s) => s.completedAt)).toEqual([2, 4]);
  });

  it('groups by id, not by name, so a renamed exercise stays one row', () => {
    const groups = groupSetsByExercise([
      set('custom-1', 'Db press', [20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 1),
      set('custom-1', 'Dumbbell press', [20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 2),
    ]);

    expect(groups).toHaveLength(1);
    // The first snapshot wins — see the ExerciseGroup doc comment.
    expect(groups[0].exerciseName).toBe('Db press');
  });

  it('keeps two exercises that share a name but not an id apart', () => {
    const groups = groupSetsByExercise([
      set('seed-press', 'Press', [40, 40, 40, 40, 40, 40, 40, 40, 40, 40], 1),
      set('custom-press', 'Press', [40, 40, 40, 40, 40, 40, 40, 40, 40, 40], 2),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('does not mutate the array it was given', () => {
    const sets = [set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 1)];
    const groups = groupSetsByExercise(sets);
    groups[0].sets.push(set('bench', 'Bench press', [60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 2));

    expect(sets).toHaveLength(1);
  });
});

describe('formatSetReps', () => {
  it('collapses a set where every rep was the same weight', () => {
    expect(formatSetReps(set('bench', 'Bench press', [60, 60, 60], 1))).toBe('3 × 60kg');
  });

  it('spells out a ramp instead of pretending it was one weight', () => {
    expect(formatSetReps(set('squat', 'Front Squat', [40, 42.5, 45], 1))).toBe('40/42.5/45kg');
  });

  it('renders bodyweight work without inventing a number', () => {
    expect(formatSetReps(set('pullup', 'Pull-up', [0, 0, 0], 1))).toBe('3 × 0kg');
  });

  it('has something to show for a set with no reps', () => {
    const empty: CompletedSet = {
      exerciseId: 'x',
      exerciseName: 'X',
      reps: [],
      restMs: null,
      completedAt: 1,
    };
    expect(formatSetReps(empty)).toBe('—');
  });
});

describe('formatGroupSets', () => {
  it('renders one set', () => {
    const [group] = groupSetsByExercise([set('bench', 'Bench press', [60, 60, 60], 1)]);
    expect(formatGroupSets(group)).toBe('3 × 60kg');
  });

  it('joins several sets with a middle dot, ramps spelled out', () => {
    const [group] = groupSetsByExercise([
      set('bench', 'Bench press', [60, 60], 1),
      set('bench', 'Bench press', [62.5, 65], 2),
    ]);
    expect(formatGroupSets(group)).toBe('2 × 60kg · 62.5/65kg');
  });
});

describe('topWeight', () => {
  it('is the heaviest rep, not the last', () => {
    expect(
      topWeight([
        { weight: 40, durationMs: 1 },
        { weight: 50, durationMs: 1 },
        { weight: 45, durationMs: 1 },
      ]),
    ).toBe(50);
  });

  it('is zero for bodyweight work', () => {
    expect(topWeight([{ weight: 0, durationMs: 1 }])).toBe(0);
  });
});
