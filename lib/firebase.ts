/**
 * Firebase client setup.
 *
 * Phase 1 runs entirely against the local emulator suite — no cloud project,
 * no secrets in the repo. Point it at a real project by setting the
 * EXPO_PUBLIC_FIREBASE_* variables; the emulator connection then switches off
 * automatically (see `useEmulators`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'upgrade-your-skill-dev';

/** With no real project configured we are talking to the emulator, which
 *  accepts any well-formed config. */
export const useEmulators = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'emulator-local-key',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:0:web:0',
};

/**
 * A phone on the LAN cannot reach the dev machine on `localhost`. Expo already
 * knows the host it served the bundle from, so reuse it.
 */
function emulatorHost(): string {
  const explicit = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  if (explicit) return explicit;
  if (Platform.OS === 'web') return '127.0.0.1';
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  return hostUri?.split(':')[0] ?? '127.0.0.1';
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * `getReactNativePersistence` exists only in firebase/auth's React Native
 * bundle; the published typings describe the web bundle, so it has to be read
 * off the module at runtime. On web it is absent and browser persistence is
 * the right choice anyway.
 */
function nativePersistence(): Persistence | undefined {
  const factory = (
    firebaseAuth as unknown as {
      getReactNativePersistence?: (storage: unknown) => Persistence;
    }
  ).getReactNativePersistence;
  return factory ? factory(AsyncStorage) : undefined;
}

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return initializeAuth(app, { persistence: browserLocalPersistence });
  }
  const persistence = nativePersistence();
  return persistence ? initializeAuth(app, { persistence }) : getAuth(app);
}

let authInstance: Auth;
try {
  authInstance = createAuth();
} catch {
  // initializeAuth throws if it already ran (Fast Refresh re-executes modules).
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const functions = getFunctions(app);

if (useEmulators) {
  const host = emulatorHost();
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFunctionsEmulator(functions, host, 5001);
}

/** Base URL for HTTPS (non-callable) functions — currently just `chat`. */
export function httpsFunctionUrl(name: string): string {
  const region = 'us-central1';
  return useEmulators
    ? `http://${emulatorHost()}:5001/${PROJECT_ID}/${region}/${name}`
    : `https://${region}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}
