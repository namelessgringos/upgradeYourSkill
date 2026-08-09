import type { IntervalConfig, IntervalState } from './types';

export const BOXING_PRESET: IntervalConfig = {
  workMs: 180_000,
  restMs: 60_000,
  rounds: 12,
};

export const HIIT_PRESET: IntervalConfig = {
  workMs: 30_000,
  restMs: 15_000,
  rounds: 8,
};

/** Total work time plus the rests BETWEEN rounds — there is no rest after the last. */
export function totalDurationMs(config: IntervalConfig): number {
  const cycle = config.workMs + config.restMs;
  return config.rounds * cycle - config.restMs;
}

/**
 * Round and phase as a pure function of elapsed time.
 *
 * Deriving rather than stepping means a session that was backgrounded for five
 * minutes resumes at the correct round, not where it fell asleep.
 */
export function intervalAt(config: IntervalConfig, elapsed: number): IntervalState {
  const clamped = Math.max(0, elapsed);
  const total = totalDurationMs(config);

  if (clamped >= total) {
    return { round: config.rounds, phase: 'done', remainingMs: 0 };
  }

  const cycle = config.workMs + config.restMs;
  const round = Math.floor(clamped / cycle) + 1;
  const withinCycle = clamped % cycle;

  if (withinCycle < config.workMs) {
    return { round, phase: 'work', remainingMs: config.workMs - withinCycle };
  }
  return { round, phase: 'rest', remainingMs: cycle - withinCycle };
}
