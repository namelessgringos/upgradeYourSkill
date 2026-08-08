import { useEffect, useState } from 'react';

/**
 * Ticks once a second while `active`, purely to trigger re-renders.
 *
 * The returned value is the current wall-clock time, which every derived
 * calculation takes as input. Nothing accumulates here: if the app is
 * backgrounded and the interval stops firing, the next tick still returns the
 * true current time and every derived value is immediately correct again.
 */
export function useSessionClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  return now;
}
