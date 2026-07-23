/**
 * A one-value bridge between the scrolling screens and the floating mascot,
 * which live in different parts of the tree (screens render inside the tab
 * navigator; the mascot is mounted beside it). While the user scrolls, the
 * mascot fades and tucks down so it never sits on a button being reached for;
 * it returns shortly after scrolling stops.
 *
 * `mascotHidden` (0 visible → 1 hidden) drives the animation on the UI thread.
 * The listener side lets the mascot also drop its touch target while hidden,
 * so a quick tap during a scroll reaches the content beneath it.
 */
import { makeMutable, withTiming } from 'react-native-reanimated';

export const mascotHidden = makeMutable(0);

type Listener = (hidden: boolean) => void;
const listeners = new Set<Listener>();

let shown = true;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Call on every scroll event. Cheap to call at frame rate. */
export function notifyScroll(): void {
  if (shown) {
    shown = false;
    mascotHidden.value = withTiming(1, { duration: 150 });
    listeners.forEach((l) => l(true));
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    shown = true;
    mascotHidden.value = withTiming(0, { duration: 260 });
    listeners.forEach((l) => l(false));
  }, 900);
}

export function subscribeScroll(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
