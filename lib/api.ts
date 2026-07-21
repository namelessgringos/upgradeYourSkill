/**
 * Typed client for the server contract (docs/API_CONTRACT.md).
 *
 * The client is a thin shell: it sends the conversation and renders what comes
 * back. It never holds a prompt, a model name, or a skill's private config.
 */
import { httpsCallable } from 'firebase/functions';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import type {
  ChatResponse,
  EntitlementState,
  GetSkillResponse,
  ListSkillsResponse,
  MeterState,
  SkillListItem,
} from '@/server-shared/api';
import { auth, functions, httpsFunctionUrl, useEmulators } from './firebase';

export type AuthProvider = 'google' | 'apple';

/** Server-signalled failure the UI reacts to specifically (paywall, cap). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ------------------------------------------------------------------- auth

/**
 * The approved UX keeps Google/Apple buttons. Real OAuth needs per-platform
 * client IDs and an Apple Developer account, neither of which exists yet, so
 * against the emulator we mint an unsigned credential — the Auth emulator
 * accepts JSON claims in place of a signed token. This produces a genuine
 * Firebase uid and a genuine ID token, so every server path is exercised for
 * real. Swapping in expo-auth-session later replaces only this function body.
 */
export async function signIn(provider: AuthProvider): Promise<void> {
  if (!useEmulators) {
    throw new ApiError(
      'oauth_not_configured',
      'Real Google/Apple sign-in is not wired up yet.',
      501
    );
  }

  const profile =
    provider === 'google'
      ? { sub: 'dev-google-user', email: 'alex@gmail.com', name: 'Alex Rivera' }
      : { sub: 'dev-apple-user', email: 'sam@icloud.com', name: 'Sam Carter' };

  const claims = JSON.stringify({ ...profile, email_verified: true });
  const credential =
    provider === 'google'
      ? GoogleAuthProvider.credential(claims)
      : new OAuthProvider('apple.com').credential({ idToken: claims });

  await signInWithCredential(auth, credential);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// ------------------------------------------------------------- callables

const call = <Req, Res>(name: string) => {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data?: Req): Promise<Res> => (await fn(data)).data;
};

export const listSkills = call<void, ListSkillsResponse>('listSkills');
export const getSkill = call<{ skillId: string }, GetSkillResponse>('getSkill');
export const getEntitlement = call<void, EntitlementState>('getEntitlement');
export const getUsage = call<void, MeterState>('getUsage');
export const setOnboardingChoice = call<{ freeSkillId: string }, EntitlementState>(
  'setOnboardingChoice'
);
export const activateTrial = call<void, EntitlementState>('activateTrial');
export const redeemReviewBonus = call<void, EntitlementState>('redeemReviewBonus');

// ------------------------------------------------------------------- chat

/**
 * `chat` is an HTTPS function rather than a callable so it can stream later
 * without a contract change, which means the ID token is attached by hand.
 */
export async function sendChat(
  skillId: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<ChatResponse> {
  const user: User | null = auth.currentUser;
  if (!user) throw new ApiError('unauthenticated', 'Sign in required.', 401);

  const token = await user.getIdToken();
  const response = await fetch(httpsFunctionUrl('chat'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ skillId, messages }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? 'Something went wrong.',
      response.status
    );
  }

  return (await response.json()) as ChatResponse;
}

export type { SkillListItem };
