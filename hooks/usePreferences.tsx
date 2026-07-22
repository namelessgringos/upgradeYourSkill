/**
 * Device-local preferences. Deliberately small: a setting only exists here if
 * flipping it changes something the user can see. A toggle wired to nothing is
 * worse than no toggle — it teaches people the settings screen lies.
 *
 * Not synced to the server. These are display choices, not entitlement.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type TextSize = 'small' | 'medium' | 'large';

/** Multiplier applied to guide body text. */
export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.2,
};

export interface Preferences {
  /** Haptic feedback on send and on unlock. Ignored on web. */
  haptics: boolean;
  /** Reading size for guide text. */
  textSize: TextSize;
}

const DEFAULTS: Preferences = { haptics: true, textSize: 'medium' };
const KEY = 'prefs.v1';

interface PreferencesValue extends Preferences {
  loaded: boolean;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Fires a light tap when haptics are on and the platform supports them. */
  tap: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
      })
      .catch(() => {
        // A corrupt or unreadable value is not worth surfacing — defaults apply.
      })
      .finally(() => setLoaded(true));
  }, []);

  const set = useCallback<PreferencesValue['set']>((key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      void AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const tap = useCallback(() => {
    if (!prefs.haptics || Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [prefs.haptics]);

  const value = useMemo<PreferencesValue>(
    () => ({ ...prefs, loaded, set, tap }),
    [prefs, loaded, set, tap]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
