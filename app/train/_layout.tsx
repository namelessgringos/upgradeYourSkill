import { Stack } from 'expo-router';
import { SessionProvider } from '@/lib/session/SessionProvider';

/**
 * Wraps the Train routes so useSession() works inside setup/live/summary.
 * Scoped here rather than the app root — the training session is a
 * self-contained flow, not app-wide state.
 */
export default function TrainLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="setup" />
        <Stack.Screen name="live" />
      </Stack>
    </SessionProvider>
  );
}
