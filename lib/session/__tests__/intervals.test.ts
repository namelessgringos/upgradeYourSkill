import { describe, expect, it } from 'vitest';
import { BOXING_PRESET, HIIT_PRESET, intervalAt, totalDurationMs } from '../intervals';
import type { IntervalConfig } from '../types';

// Small numbers keep the arithmetic obvious: 10s work, 5s rest, 3 rounds.
const CONFIG: IntervalConfig = { workMs: 10_000, restMs: 5_000, rounds: 3 };

describe('totalDurationMs', () => {
  // 3 rounds of work + only 2 rests: nobody rests after the final bell.
  it('excludes the trailing rest', () => {
    expect(totalDurationMs(CONFIG)).toBe(40_000);
  });

  it('handles a single round', () => {
    expect(totalDurationMs({ workMs: 10_000, restMs: 5_000, rounds: 1 })).toBe(10_000);
  });
});

describe('intervalAt', () => {
  it('starts in round 1, working', () => {
    expect(intervalAt(CONFIG, 0)).toEqual({ round: 1, phase: 'work', remainingMs: 10_000 });
  });

  it('counts down within the work phase', () => {
    expect(intervalAt(CONFIG, 3_000)).toEqual({ round: 1, phase: 'work', remainingMs: 7_000 });
  });

  it('switches to rest exactly on the work boundary', () => {
    expect(intervalAt(CONFIG, 10_000)).toEqual({ round: 1, phase: 'rest', remainingMs: 5_000 });
  });

  it('counts down within the rest phase', () => {
    expect(intervalAt(CONFIG, 12_000)).toEqual({ round: 1, phase: 'rest', remainingMs: 3_000 });
  });

  it('starts the next round exactly on the cycle boundary', () => {
    expect(intervalAt(CONFIG, 15_000)).toEqual({ round: 2, phase: 'work', remainingMs: 10_000 });
  });

  it('reaches the final round', () => {
    expect(intervalAt(CONFIG, 30_000)).toEqual({ round: 3, phase: 'work', remainingMs: 10_000 });
  });

  it('is done exactly at the end', () => {
    expect(intervalAt(CONFIG, 40_000)).toEqual({ round: 3, phase: 'done', remainingMs: 0 });
  });

  // The phone slept through the end of the workout.
  it('stays done long past the end', () => {
    expect(intervalAt(CONFIG, 999_999)).toEqual({ round: 3, phase: 'done', remainingMs: 0 });
  });

  it('treats negative elapsed as the start', () => {
    expect(intervalAt(CONFIG, -1_000)).toEqual({ round: 1, phase: 'work', remainingMs: 10_000 });
  });
});

describe('intervalAt with a single round', () => {
  // rounds: 1 is directly user-reachable — setup.tsx clamps the rounds input
  // to a minimum of 1. totalDurationMs at rounds:1 equals workMs exactly (no
  // trailing rest), so the rest phase of the only round is never entered.
  const SINGLE_ROUND: IntervalConfig = { workMs: 10_000, restMs: 5_000, rounds: 1 };

  it('starts in round 1, working, at elapsed 0', () => {
    expect(intervalAt(SINGLE_ROUND, 0)).toEqual({ round: 1, phase: 'work', remainingMs: 10_000 });
  });

  it('counts down mid-work', () => {
    expect(intervalAt(SINGLE_ROUND, 4_000)).toEqual({ round: 1, phase: 'work', remainingMs: 6_000 });
  });

  it('is done exactly at the total duration, without ever entering a rest phase', () => {
    expect(intervalAt(SINGLE_ROUND, 10_000)).toEqual({ round: 1, phase: 'done', remainingMs: 0 });
  });

  it('stays done past the total duration', () => {
    expect(intervalAt(SINGLE_ROUND, 20_000)).toEqual({ round: 1, phase: 'done', remainingMs: 0 });
  });
});

describe('presets', () => {
  it('boxing is 3 minutes on, 1 off, 12 rounds', () => {
    expect(BOXING_PRESET).toEqual({ workMs: 180_000, restMs: 60_000, rounds: 12 });
  });

  it('HIIT is 30 on, 15 off, 8 rounds', () => {
    expect(HIIT_PRESET).toEqual({ workMs: 30_000, restMs: 15_000, rounds: 8 });
  });
});
