import { describe, expect, it } from 'vitest';
import { elapsedMs, formatElapsed, idleTimer } from '../timer';
import type { TimerState } from '../types';

const T0 = 1_700_000_000_000;

function running(overrides: Partial<TimerState> = {}): TimerState {
  return {
    status: 'running',
    startedAt: T0,
    pausedAt: null,
    accumulatedPauseMs: 0,
    endedAt: null,
    ...overrides,
  };
}

describe('elapsedMs', () => {
  it('is zero before the session starts', () => {
    expect(elapsedMs(idleTimer(), T0 + 5000)).toBe(0);
  });

  it('counts wall-clock time while running', () => {
    expect(elapsedMs(running(), T0 + 5000)).toBe(5000);
  });

  it('excludes completed pauses', () => {
    expect(elapsedMs(running({ accumulatedPauseMs: 2000 }), T0 + 5000)).toBe(3000);
  });

  it('freezes while paused, however long the pause runs', () => {
    const paused = running({ status: 'paused', pausedAt: T0 + 4000 });
    expect(elapsedMs(paused, T0 + 4000)).toBe(4000);
    expect(elapsedMs(paused, T0 + 90_000)).toBe(4000);
  });

  it('freezes once finished', () => {
    const finished = running({ status: 'finished', endedAt: T0 + 7000 });
    expect(elapsedMs(finished, T0 + 999_999)).toBe(7000);
  });

  // The phone was locked for ten minutes. Derived time must still be right.
  it('is correct after a long background gap', () => {
    expect(elapsedMs(running(), T0 + 600_000)).toBe(600_000);
  });

  it('never returns a negative value if the clock jumps backwards', () => {
    expect(elapsedMs(running(), T0 - 5000)).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9000)).toBe('0:09');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('formats an hour and over as h:mm:ss', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });
});
