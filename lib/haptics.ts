/**
 * Haptics behind a seam, so the implementation is a decision we can change
 * without touching a screen — the same reason LLM calls and billing are.
 *
 * `expo-haptics` is the default because it runs in Expo Go, which is how the
 * app is tested from a phone today. Software Mansion's Pulsar is the richer
 * target (147 presets, Reanimated-worklet friendly) but it is a native module
 * and needs an EAS dev build, so it drops in here once that build exists —
 * nothing else changes.
 *
 * Named by intent, not by pattern, so the call sites read the same whichever
 * engine is behind them: tap(), pulse(), success().
 */
import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

export interface HapticsEngine {
  /** A light tick for a deliberate tap — selecting, sending, toggling. */
  tap(): void;
  /** A soft double beat: the mascot noticing you, a gentle nudge. */
  pulse(): void;
  /** A rising confirmation — purchase, unlock, trial started. */
  success(): void;
}

const noop: HapticsEngine = { tap() {}, pulse() {}, success() {} };

const expo: HapticsEngine = {
  tap() {
    void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
  },
  pulse() {
    void ExpoHaptics.selectionAsync();
  },
  success() {
    void ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
  },
};

/**
 * Web has no haptic hardware and expo-haptics throws there, so the engine is
 * a no-op off native. When Pulsar lands, swap this one line for the Pulsar
 * engine and gate it the same way.
 */
export const haptics: HapticsEngine = Platform.OS === 'web' ? noop : expo;
