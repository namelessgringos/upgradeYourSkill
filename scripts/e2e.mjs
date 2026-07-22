/**
 * End-to-end checks against the emulator suite.
 *
 *   npm run emulators      # terminal 1
 *   npm run seed           # terminal 2
 *   npm run e2e            # terminal 2
 *
 * Covers the things that are expensive to get wrong: entitlement gating, the
 * daily cap, trial upgrade, metering, and — most importantly — that no system
 * prompt or guide body reaches an unentitled client. The guide *is* the
 * product, so a leak here is a business problem, not just a bug.
 *
 * Each run signs in as a fresh uid so it is idempotent; re-running does not
 * trip over the previous run's message counts.
 */
const HOST = process.env.EMULATOR_HOST ?? '127.0.0.1';
const PROJECT = process.env.GCLOUD_PROJECT ?? 'upgrade-your-skill-dev';
const AUTH = `http://${HOST}:9099/identitytoolkit.googleapis.com/v1`;
const FN = `http://${HOST}:5001/${PROJECT}/us-central1`;

let passed = 0;
let failed = 0;

function ok(label, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`);
  }
}

async function signIn() {
  // Unique subject per run => fresh entitlement and usage counters.
  const claims = JSON.stringify({
    sub: `e2e-${Date.now()}`,
    email: `e2e-${Date.now()}@example.com`,
    email_verified: true,
    name: 'E2E Runner',
  });
  const r = await fetch(`${AUTH}/accounts:signInWithIdp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(claims)}&providerId=google.com`,
      requestUri: 'http://localhost',
      returnSecureToken: true,
    }),
  });
  const body = await r.json();
  if (!body.idToken) {
    throw new Error(
      `sign-in failed: ${JSON.stringify(body)}\nIs the emulator suite running?`
    );
  }
  return body.idToken;
}

async function callable(token, name, data) {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: data ?? null }),
  });
  const body = await r.json();
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function chat(token, skillId, messages) {
  const r = await fetch(`${FN}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ skillId, messages }),
  });
  return { status: r.status, body: await r.json() };
}

const token = await signIn();
ok('sign-in via Google credential yields an ID token', !!token);

// --- auth -------------------------------------------------------------------
const anon = await fetch(`${FN}/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    skillId: 'strength',
    messages: [{ role: 'user', content: 'hi' }],
  }),
});
ok('chat without a token is 401', anon.status === 401);

// --- metadata ---------------------------------------------------------------
const { skills } = await callable(token, 'listSkills');
ok('listSkills returns skills', skills.length > 0, `${skills.length} found`);

const listPayload = JSON.stringify(skills);
ok(
  'listSkills leaks no private fields',
  !/systemPrompt|safetyBoundaries|HARD BOUNDARIES/i.test(listPayload)
);
ok(
  'listSkills leaks no guide body',
  !/"guide"/.test(listPayload),
  'the guide is the paid product and must not appear in the list'
);

const firstSkill = skills[0].id;

// --- entitlement gating -----------------------------------------------------
let ent = await callable(token, 'getEntitlement');
ok(
  'new user starts on free with nothing unlocked',
  ent.status === 'free' && ent.unlockedSkillIds.length === 0
);

let detail = await callable(token, 'getSkill', { skillId: firstSkill });
ok(
  'unentitled getSkill withholds the guide',
  detail.guide === null && detail.entitled === false
);
ok(
  'unentitled getSkill leaks no prompt',
  !/systemPrompt|HARD BOUNDARIES/i.test(JSON.stringify(detail))
);

let blocked = await chat(token, firstSkill, [{ role: 'user', content: 'hi' }]);
ok('unentitled chat is 402', blocked.status === 402, blocked.body?.error?.code);

// --- onboarding unlocks exactly one skill ----------------------------------
ent = await callable(token, 'setOnboardingChoice', { freeSkillId: firstSkill });
ok(
  'free plan unlocks exactly the chosen skill',
  ent.unlockedSkillIds.length === 1 && ent.unlockedSkillIds[0] === firstSkill
);

detail = await callable(token, 'getSkill', { skillId: firstSkill });
ok(
  'entitled getSkill returns the guide',
  Array.isArray(detail.guide) && detail.guide.length > 0,
  `${detail.guide?.length ?? 0} sections`
);

const locked = skills.find((s) => s.id !== firstSkill);
if (locked) {
  const other = await callable(token, 'getSkill', { skillId: locked.id });
  ok('non-chosen skill stays locked on free', other.guide === null);
  const otherChat = await chat(token, locked.id, [{ role: 'user', content: 'hi' }]);
  ok('chat on a locked skill is 402', otherChat.status === 402);
}

// --- chat + metering --------------------------------------------------------
const first = await chat(token, firstSkill, [
  { role: 'user', content: 'How should I start?' },
]);
ok(
  'chat succeeds on an entitled skill',
  first.status === 200,
  first.body?.error?.code ?? ''
);
ok('chat returns a reply', typeof first.body.reply === 'string' && first.body.reply.length > 0);
ok(
  'chat response carries no system prompt',
  !/HARD BOUNDARIES|THE GUIDE —/i.test(JSON.stringify(first.body))
);
ok('meter incremented to 1', first.body.meter?.used === 1, JSON.stringify(first.body.meter));
ok('token usage reported', first.body.usage?.inputTokens > 0);

const meter = await callable(token, 'getUsage');
ok('getUsage agrees with the chat meter', meter.used === 1);
ok('lifetime counters advanced', meter.lifetimeMessages === 1 && meter.activeDays === 1);

// --- prompt caching ---------------------------------------------------------
// Only meaningful against a real provider; EchoProvider never reports cache
// reads. Reported rather than asserted so the harness stays runnable keyless.
const second = await chat(token, firstSkill, [
  { role: 'user', content: 'How should I start?' },
  { role: 'assistant', content: first.body.reply },
  { role: 'user', content: 'And if I only have two days a week?' },
]);
if (process.env.ANTHROPIC_API_KEY) {
  ok(
    'prompt cache is active on turn 2',
    (second.body?.usage?.cacheReadTokens ?? 0) > 0,
    'system block may be under the 4096-token minimum'
  );
} else {
  console.log('SKIP  prompt cache check (no ANTHROPIC_API_KEY; echo provider)');
}

// --- daily cap --------------------------------------------------------------
const cap = ent.messageCapPerDay;
let capped = null;
for (let i = 0; i < cap + 2; i++) {
  capped = await chat(token, firstSkill, [{ role: 'user', content: `msg ${i}` }]);
  if (capped.status === 429) break;
}
ok(
  `free daily cap of ${cap} is enforced`,
  capped?.status === 429 && capped.body.error.code === 'cap_reached'
);

// --- trial ------------------------------------------------------------------
ent = await callable(token, 'activateTrial');
ok(
  'trial unlocks all skills',
  ent.status === 'trial' && ent.unlockedSkillIds.length === skills.length
);
ok('trial raises the daily cap', ent.messageCapPerDay > cap);

if (locked) {
  const afterTrial = await chat(token, locked.id, [{ role: 'user', content: 'hello' }]);
  ok('previously locked skill now chats', afterTrial.status === 200);
}

// --- validation -------------------------------------------------------------
const tooLong = await chat(token, firstSkill, [
  { role: 'user', content: 'x'.repeat(5000) },
]);
ok('over-long message rejected', tooLong.status === 400);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
