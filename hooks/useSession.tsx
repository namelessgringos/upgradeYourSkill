/**
 * Session + entitlement state, backed by Firebase Auth and the Cloud
 * Functions in docs/API_CONTRACT.md.
 *
 * The interface is deliberately the same shape the mocked prototype exposed,
 * so the screens did not have to be redesigned around the backend. What
 * changed is where the truth lives: plan, caps, and unlocked skills are now
 * decided server-side and merely displayed here. Nothing in this file may be
 * trusted for access control — the server re-checks every call.
 */
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as api from '@/lib/api';
import { auth } from '@/lib/firebase';
import type {
  EntitlementState,
  MeterState,
  SkillListItem,
} from '@/server-shared/api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Display-side plan label. `pro` is what the UI calls the server's `active`. */
export type Plan = 'free' | 'trial' | 'pro';
export type AuthProvider = api.AuthProvider;

export interface SessionUser {
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface SessionValue {
  loading: boolean;
  /** True while a server round-trip is in flight after the first load. */
  syncing: boolean;
  error: string | null;

  user: SessionUser | null;
  skills: SkillListItem[];

  plan: Plan;
  onboarded: boolean;
  freeSkillId: string | null;
  reviewBonusClaimed: boolean;
  trialActive: boolean;
  trialDaysLeft: number;

  dailyLimit: number;
  usedToday: number;
  messagesLeftToday: number;
  lifetimeMessages: number;
  activeDays: number;

  unlockedSkillIds: string[];
  isSkillUnlocked: (id: string) => boolean;

  signIn: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (freeSkillId: string) => Promise<void>;
  activateTrial: () => Promise<void>;
  claimReviewBonus: () => Promise<void>;
  /** Apply the meter returned by a chat call — avoids a second round-trip. */
  applyMeter: (meter: MeterState) => void;
  refresh: () => Promise<void>;
  resetAll: () => Promise<void>;
}

function planOf(status: EntitlementState['status']): Plan {
  if (status === 'active') return 'pro';
  if (status === 'trial') return 'trial';
  return 'free';
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [meter, setMeter] = useState<MeterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Guards against a slow response for a signed-out user overwriting state. */
  const currentUid = useRef<string | null>(null);

  const loadServerState = useCallback(async (uid: string) => {
    setSyncing(true);
    try {
      const [entitlementState, skillList, meterState] = await Promise.all([
        api.getEntitlement(),
        api.listSkills(),
        api.getUsage(),
      ]);
      if (currentUid.current !== uid) return;
      setEntitlement(entitlementState);
      setSkills(skillList.skills);
      setMeter(meterState);
      setError(null);
    } catch (e) {
      if (currentUid.current !== uid) return;
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    } finally {
      if (currentUid.current === uid) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      currentUid.current = firebaseUser?.uid ?? null;

      if (!firebaseUser) {
        setUser(null);
        setEntitlement(null);
        setMeter(null);
        setSkills([]);
        setLoading(false);
        return;
      }

      const providerId = firebaseUser.providerData[0]?.providerId ?? '';
      setUser({
        name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'there',
        email: firebaseUser.email ?? '',
        provider: providerId.startsWith('apple') ? 'apple' : 'google',
      });
      await loadServerState(firebaseUser.uid);
      setLoading(false);
    });
  }, [loadServerState]);

  const applyEntitlement = useCallback((next: EntitlementState) => {
    setEntitlement(next);
  }, []);

  const signIn = useCallback(async (provider: AuthProvider) => {
    setError(null);
    await api.signIn(provider);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
  }, []);

  const completeOnboarding = useCallback(
    async (freeSkillId: string) => {
      applyEntitlement(await api.setOnboardingChoice({ freeSkillId }));
    },
    [applyEntitlement]
  );

  const activateTrial = useCallback(async () => {
    applyEntitlement(await api.activateTrial());
    setMeter(await api.getUsage());
  }, [applyEntitlement]);

  const claimReviewBonus = useCallback(async () => {
    applyEntitlement(await api.redeemReviewBonus());
    setMeter(await api.getUsage());
  }, [applyEntitlement]);

  const refresh = useCallback(async () => {
    const uid = currentUid.current;
    if (uid) await loadServerState(uid);
  }, [loadServerState]);

  const resetAll = useCallback(async () => {
    // Entitlement is server-owned; the client can only drop its session.
    await api.signOut();
  }, []);

  const value = useMemo<SessionValue>(() => {
    const status = entitlement?.status ?? 'free';
    const plan = planOf(status);
    const trialEndsAt = entitlement?.trialEndsAt
      ? Date.parse(entitlement.trialEndsAt)
      : null;
    const trialActive = status === 'trial' && !!trialEndsAt && trialEndsAt > Date.now();
    const dailyLimit = entitlement?.messageCapPerDay ?? 0;
    const usedToday = meter?.used ?? 0;
    const unlockedSkillIds = entitlement?.unlockedSkillIds ?? [];

    return {
      loading,
      syncing,
      error,
      user,
      skills,
      plan,
      onboarded: entitlement?.onboarded ?? false,
      freeSkillId: entitlement?.freeSkillId ?? null,
      reviewBonusClaimed: entitlement?.reviewBonusClaimed ?? false,
      trialActive,
      trialDaysLeft:
        trialActive && trialEndsAt
          ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / DAY_MS))
          : 0,
      dailyLimit,
      usedToday,
      messagesLeftToday: Math.max(0, dailyLimit - usedToday),
      lifetimeMessages: meter?.lifetimeMessages ?? 0,
      activeDays: meter?.activeDays ?? 0,
      unlockedSkillIds,
      isSkillUnlocked: (id: string) => unlockedSkillIds.includes(id),
      signIn,
      signOut,
      completeOnboarding,
      activateTrial,
      claimReviewBonus,
      applyMeter: setMeter,
      refresh,
      resetAll,
    };
  }, [
    loading,
    syncing,
    error,
    user,
    skills,
    entitlement,
    meter,
    signIn,
    signOut,
    completeOnboarding,
    activateTrial,
    claimReviewBonus,
    refresh,
    resetAll,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
