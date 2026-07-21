/**
 * Cloud Functions entrypoints — see docs/API_CONTRACT.md.
 *
 * Every handler follows the same spine (non-negotiable rules #4 and #5):
 *   verify token → check entitlement → do the work → meter what it cost.
 *
 * Metadata calls succeed for anyone signed in (we have to be able to sell).
 * Guide bodies and chat require an entitlement.
 */
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type {
  ChatRequest,
  ChatResponse,
  EntitlementState,
  GetSkillResponse,
  ListSkillsResponse,
  MeterState,
} from '../../server-shared/api';
import { toSkillListItem, toSkillMeta } from '../../server-shared/api';
import './admin';
import {
  claimReviewBonus,
  completeOnboarding,
  isSkillUnlocked,
  loadEntitlement,
  startTrial,
} from './entitlement';
import { AnthropicProvider } from './llm/anthropic';
import { EchoProvider } from './llm/echo';
import type { LLMProvider } from './llm/provider';
import { assembleSystemPrompt, listPublishedSkills, loadSkill } from './skills';
import { getMeter, messagesUsedToday, recordUsage } from './usage';

const anthropicKey = defineSecret('ANTHROPIC_API_KEY');

const MAX_TURNS = 40;
const MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 1024;

/** One provider ships (rule #3); the echo stub only appears when no key is
 *  configured, so the emulator runs before an Anthropic account exists. */
function resolveProvider(): LLMProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new AnthropicProvider(key) : new EchoProvider();
}

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return auth.uid;
}

// ---------------------------------------------------------------- metadata

export const listSkills = onCall(async (request): Promise<ListSkillsResponse> => {
  const uid = requireUid(request.auth);
  // Entitlement is loaded even though the list is public to signed-in users:
  // the check always runs, its result only decides how much we return.
  await loadEntitlement(uid);
  const skills = await listPublishedSkills();
  return { skills: skills.map(toSkillListItem) };
});

export const getSkill = onCall(async (request): Promise<GetSkillResponse> => {
  const uid = requireUid(request.auth);
  const skillId = String(request.data?.skillId ?? '');
  if (!skillId) throw new HttpsError('invalid-argument', 'skillId is required.');

  const skill = await loadSkill(skillId);
  if (!skill) throw new HttpsError('not-found', 'No such skill.');

  const entitlement = await loadEntitlement(uid);
  const entitled = isSkillUnlocked(entitlement, skillId);

  return {
    meta: toSkillMeta(skill),
    guide: entitled ? skill.guide : null,
    entitled,
  };
});

export const getEntitlement = onCall(async (request): Promise<EntitlementState> =>
  loadEntitlement(requireUid(request.auth))
);

export const getUsage = onCall(async (request): Promise<MeterState> => {
  const uid = requireUid(request.auth);
  const entitlement = await loadEntitlement(uid);
  return getMeter(uid, entitlement.messageCapPerDay);
});

// ------------------------------------------------------------- onboarding

export const setOnboardingChoice = onCall(
  async (request): Promise<EntitlementState> => {
    const uid = requireUid(request.auth);
    const skillId = String(request.data?.freeSkillId ?? '');
    if (!skillId) throw new HttpsError('invalid-argument', 'freeSkillId is required.');
    if (!(await loadSkill(skillId))) {
      throw new HttpsError('not-found', 'No such skill.');
    }
    return completeOnboarding(uid, skillId);
  }
);

export const activateTrial = onCall(async (request): Promise<EntitlementState> =>
  startTrial(requireUid(request.auth))
);

export const redeemReviewBonus = onCall(
  async (request): Promise<EntitlementState> =>
    claimReviewBonus(requireUid(request.auth))
);

// ------------------------------------------------------------------- chat

/**
 * HTTPS rather than callable so this can become SSE without a contract change
 * (API_CONTRACT.md). v1 is plain request/response.
 *
 * The client sends only the conversation. The system prompt is loaded and
 * assembled here and never appears in either direction of the payload.
 */
export const chat = onRequest(
  { cors: true, secrets: [anthropicKey] },
  async (req, res) => {
    const fail = (status: number, code: string, message: string) => {
      res.status(status).json({ error: { code, message } });
    };

    if (req.method !== 'POST') {
      fail(405, 'method_not_allowed', 'Use POST.');
      return;
    }

    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      fail(401, 'unauthenticated', 'Missing ID token.');
      return;
    }

    let uid: string;
    try {
      uid = (await getAuth().verifyIdToken(token)).uid;
    } catch {
      fail(401, 'unauthenticated', 'Invalid ID token.');
      return;
    }

    const body = req.body as ChatRequest;
    const skillId = String(body?.skillId ?? '');
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (!skillId || messages.length === 0) {
      fail(400, 'invalid_argument', 'skillId and messages are required.');
      return;
    }
    if (messages.length > MAX_TURNS) {
      fail(400, 'invalid_argument', `Conversation exceeds ${MAX_TURNS} turns.`);
      return;
    }
    if (
      messages.some(
        (m) =>
          (m.role !== 'user' && m.role !== 'assistant') ||
          typeof m.content !== 'string' ||
          m.content.length > MAX_MESSAGE_CHARS
      )
    ) {
      fail(400, 'invalid_argument', 'Malformed message in conversation.');
      return;
    }

    const entitlement = await loadEntitlement(uid);
    if (!isSkillUnlocked(entitlement, skillId)) {
      fail(402, 'not_entitled', 'This skill is locked on your plan.');
      return;
    }

    const used = await messagesUsedToday(uid);
    if (used >= entitlement.messageCapPerDay) {
      // Soft cap / paid overage is Phase 4. v1 pauses; it never auto-charges
      // (non-negotiable rule #6).
      fail(429, 'cap_reached', "You've hit today's message limit.");
      return;
    }

    const skill = await loadSkill(skillId);
    if (!skill) {
      fail(404, 'not_found', 'No such skill.');
      return;
    }

    const provider = resolveProvider();
    const model = skill.model?.model ?? DEFAULT_MODEL;

    try {
      const result = await provider.complete({
        model,
        maxTokens: skill.model?.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: assembleSystemPrompt(skill),
        promptCaching: skill.model?.promptCaching ?? true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      await recordUsage(uid, skillId, model, result.usage);

      // Cache hits are the whole economic model — log them so a silent
      // caching regression is visible rather than just expensive.
      logger.info('chat.completed', {
        uid,
        skillId,
        model,
        provider: provider.name,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
      });

      const response: ChatResponse = {
        reply: result.text,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
        meter: await getMeter(uid, entitlement.messageCapPerDay),
      };
      res.json(response);
    } catch (error) {
      logger.error('chat.failed', { uid, skillId, model, error });
      fail(500, 'provider_error', 'The coach is unavailable right now.');
    }
  }
);
