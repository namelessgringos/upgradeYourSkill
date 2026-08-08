import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { paperTheme } from '@/constants/paperTheme';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { SessionProvider } from '@/hooks/useSession';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <PreferencesProvider>
            <SessionProvider>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F0E8' } }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="how-to" options={{ presentation: 'modal' }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="skill/[id]" />
                <Stack.Screen name="chat/[id]" />
              </Stack>
              <StatusBar style="dark" />
            </SessionProvider>
          </PreferencesProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
