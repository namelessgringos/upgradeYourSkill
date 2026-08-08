import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { initialSession, sessionReducer, type SessionAction } from './reducer';
import { InMemorySessionStore, type SessionStore } from './store';
import type { SessionState } from './types';

interface SessionContextValue {
  state: SessionState;
  dispatch: (action: SessionAction) => void;
  store: SessionStore;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  store,
}: {
  children: ReactNode;
  /** Swapped for FirestoreSessionStore in Stage B; the UI never knows which. */
  store?: SessionStore;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession('gym'));
  const resolvedStore = useMemo(
    () => store ?? new InMemorySessionStore('local-user'),
    [store],
  );

  const value = useMemo(
    () => ({ state, dispatch, store: resolvedStore }),
    [state, resolvedStore],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return value;
}
