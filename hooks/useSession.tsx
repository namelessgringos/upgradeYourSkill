/**
 * Session + subscription state for the UI prototype. Mock only — no real auth,
 * no backend. State is persisted to AsyncStorage so the flow survives reloads
 * while you smoke-test on a phone.
 *
 * Plans:
 *   free  → 1 chosen skill, a few messages/day
 *   trial → all skills, 7 days, generous daily cap
 *   pro   → all skills, high daily cap (post-purchase; mocked)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SKILLS } from '@/constants/mockData';

const STORAGE_KEY = 'skillscoach:session:v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export type Plan = 'free' | 'trial' | 'pro';
export type AuthProvider = 'google' | 'apple';

export interface MockUser {
  name: string;
  email: string;
  provider: AuthProvider;
}

interface PersistedState {
  user: MockUser | null;
  onboarded: boolean;
  plan: Plan;
  trialEndsAt: number | null;
  freeSkillId: string | null;
  usageByDay: Record<string, number>;
  reviewBonusClaimed: boolean;
}

const DAILY_LIMIT: Record<Plan, number> = {
  free: 5,
  trial: 50,
  pro: 500,
};

const INITIAL: PersistedState = {
  user: null,
  onboarded: false,
  plan: 'free',
  trialEndsAt: null,
  freeSkillId: null,
  usageByDay: {},
  reviewBonusClaimed: false,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SessionValue extends PersistedState {
  loading: boolean;
  // derived
  dailyLimit: number;
  usedToday: number;
  messagesLeftToday: number;
  trialActive: boolean;
  trialDaysLeft: number;
  unlockedSkillIds: string[];
  isSkillUnlocked: (id: string) => boolean;
  // actions
  signIn: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (freeSkillId: string) => Promise<void>;
  activateTrial: () => Promise<void>;
  claimReviewBonus: () => Promise<void>;
  recordMessage: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(INITIAL);
  const [loading, setLoading] = useState(true);

  // Load persisted state once.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && raw) {
          setState({ ...INITIAL, ...(JSON.parse(raw) as PersistedState) });
        }
      } catch {
        // ignore corrupt state in the prototype
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist on every change (after initial load).
  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loading]);

  const patch = useCallback((next: Partial<PersistedState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const signIn = useCallback(
    async (provider: AuthProvider) => {
      const name = provider === 'google' ? 'Alex Rivera' : 'Sam Carter';
      patch({
        user: {
          name,
          email: provider === 'google' ? 'alex@gmail.com' : 'sam@icloud.com',
          provider,
        },
      });
    },
    [patch]
  );

  const signOut = useCallback(async () => {
    setState(INITIAL);
  }, []);

  const completeOnboarding = useCallback(
    async (freeSkillId: string) => {
      patch({ onboarded: true, freeSkillId });
    },
    [patch]
  );

  const activateTrial = useCallback(async () => {
    patch({ plan: 'trial', trialEndsAt: Date.now() + 7 * DAY_MS });
  }, [patch]);

  const claimReviewBonus = useCallback(async () => {
    setState((prev) => {
      if (prev.reviewBonusClaimed) return prev;
      const base =
        prev.trialEndsAt && prev.trialEndsAt > Date.now()
          ? prev.trialEndsAt
          : Date.now();
      return {
        ...prev,
        reviewBonusClaimed: true,
        plan: prev.plan === 'free' ? 'trial' : prev.plan,
        trialEndsAt: base + 7 * DAY_MS,
      };
    });
  }, []);

  const recordMessage = useCallback(async () => {
    setState((prev) => {
      const key = todayKey();
      return {
        ...prev,
        usageByDay: { ...prev.usageByDay, [key]: (prev.usageByDay[key] ?? 0) + 1 },
      };
    });
  }, []);

  const resetAll = useCallback(async () => {
    setState(INITIAL);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<SessionValue>(() => {
    const now = Date.now();
    const trialActive =
      state.plan === 'trial' && !!state.trialEndsAt && state.trialEndsAt > now;
    const effectivePlan: Plan =
      state.plan === 'trial' && !trialActive ? 'free' : state.plan;
    const dailyLimit = DAILY_LIMIT[effectivePlan];
    const usedToday = state.usageByDay[todayKey()] ?? 0;
    const unlockedSkillIds =
      effectivePlan === 'free'
        ? state.freeSkillId
          ? [state.freeSkillId]
          : []
        : SKILLS.map((s) => s.id);
    const trialDaysLeft =
      trialActive && state.trialEndsAt
        ? Math.max(0, Math.ceil((state.trialEndsAt - now) / DAY_MS))
        : 0;

    return {
      ...state,
      plan: effectivePlan,
      loading,
      dailyLimit,
      usedToday,
      messagesLeftToday: Math.max(0, dailyLimit - usedToday),
      trialActive,
      trialDaysLeft,
      unlockedSkillIds,
      isSkillUnlocked: (id: string) => unlockedSkillIds.includes(id),
      signIn,
      signOut,
      completeOnboarding,
      activateTrial,
      claimReviewBonus,
      recordMessage,
      resetAll,
    };
  }, [
    state,
    loading,
    signIn,
    signOut,
    completeOnboarding,
    activateTrial,
    claimReviewBonus,
    recordMessage,
    resetAll,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
