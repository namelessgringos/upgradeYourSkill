import type { TimerState } from './types';

export function idleTimer(): TimerState {
  return {
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    accumulatedPauseMs: 0,
    endedAt: null,
  };
}

/**
 * Elapsed session time, derived rather than accumulated.
 *
 * `now` is passed in rather than read from Date.now() so this stays pure and
 * testable without faking timers.
 */
export function elapsedMs(timer: TimerState, now: number): number {
  if (timer.startedAt === null) return 0;
  // Once finished, the end is fixed. While paused, the clock stands still at
  // the moment the pause began.
  const end = timer.endedAt ?? timer.pausedAt ?? now;
  return Math.max(0, end - timer.startedAt - timer.accumulatedPauseMs);
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}
