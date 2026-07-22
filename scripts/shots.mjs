/**
 * Screenshots every screen at phone size, so the UI can be reviewed without a
 * device in hand — the dev loop when working from a phone.
 *
 * Runs against Expo web with MOCK_API on, so no emulator and no backend are
 * needed. Each shot seeds a named state via `?mock=` (see lib/mockApi.ts),
 * because mock state is in-memory and a page load resets it.
 *
 *   npm run web        # terminal 1
 *   npm run shots      # terminal 2  → .shots/*.png
 *
 * Filter: npm run shots -- membership settings
 */
import { chromium, devices } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const BASE = process.env.SHOTS_BASE_URL ?? 'http://localhost:8081';
const OUT = '.shots';

/**
 * Optional interaction run before the screenshot. Doubles as a smoke test:
 * a step that cannot find its target fails the shot rather than quietly
 * capturing the wrong screen.
 */
const FLOWS = {
  async purchase(page) {
    await page.getByText(/Subscribe · \$/).click();
    await page.waitForTimeout(2500);
    const plan = await page.getByText('Your plan').locator('..').innerText();
    if (!plan.includes('Full access')) {
      throw new Error(`purchase did not flip entitlement — plan card still reads: ${plan}`);
    }
  },
};

/** [name, route, mock preset, flow?] */
const SHOTS = [
  ['login', '/login', 'new'],
  ['onboarding', '/onboarding', 'new'],
  ['home-free', '/(tabs)', 'free'],
  ['home-pro', '/(tabs)', 'pro'],
  ['membership-free', '/(tabs)/membership', 'free'],
  ['membership-trial', '/(tabs)/membership', 'trial'],
  ['membership-pro', '/(tabs)/membership', 'pro'],
  ['membership-purchased', '/(tabs)/membership', 'free', 'purchase'],
  ['settings-free', '/(tabs)/settings', 'free'],
  ['settings-pro', '/(tabs)/settings', 'pro'],
  ['skill-unlocked', '/skill/strength', 'free'],
  ['skill-locked', '/skill/negotiation', 'free'],
  ['chat', '/chat/strength', 'free'],
  ['chat-capped', '/chat/strength', 'capped'],
  ['how-to', '/how-to', 'free'],
];

/**
 * A journey is one continuous session: the page is loaded once and every step
 * screenshots after acting on the state the previous step left behind. That is
 * the only way to see screens that exist mid-conversation — a chat with
 * messages in it, the cap-reached banner — because mock state is in memory and
 * a page load resets it.
 *
 * It doubles as an end-to-end test of the UI. A step whose control is missing
 * throws, and the run fails.
 *
 *   npm run shots -- --journey       → .shots/journey/NN-name.png
 */
const JOURNEYS = {
  'first-run': {
    start: '/login?mock=new',
    steps: [
      ['login', null],
      ['welcome', (p) => p.getByText('Continue with Google').click()],
      ['how-it-works', (p) => p.getByText('Continue', { exact: true }).click()],
      ['pick-skill', (p) => p.getByText('Continue', { exact: true }).click()],
      ['skill-picked', (p) => p.getByText('Labour, Birth & the First Weeks').click()],
      ['trial-offer', (p) => p.getByText('Continue', { exact: true }).click()],
      ['home', (p) => p.getByText('Maybe later — continue free').click()],
      ['guide', (p) => p.getByText('Labour, Birth & the First Weeks').click()],
      ['chat-empty', (p) => p.getByText(/Start chatting with/).click()],
      ['chat-reply', (p) => sendMessage(p, 'Contractions started an hour ago — is this it?')],
      ['chat-at-cap', (p) => exhaustDailyCap(p)],
      // Chat is a stack screen, so there is no tab bar here — the only way out
      // is the cap screen's own CTA, which is the path a real user takes.
      ['paywall', (p) => p.getByText('Get more with a free trial').click()],
    ],
  },
};

async function sendMessage(page, text) {
  await page.getByPlaceholder(/^Message /).fill(text);
  await page.getByText('↑').click();
  await page.waitForTimeout(1400);
}

/** Sends until the coach refuses with the daily cap, so the banner is real. */
async function exhaustDailyCap(page) {
  for (let i = 0; i < 12; i += 1) {
    if (await page.getByText(/hit today’s message limit/).count()) return;
    await sendMessage(page, `Message ${i + 2}`);
  }
  throw new Error('never reached the daily cap — is the mock enforcing it?');
}

async function runJourney(context, name) {
  const journey = JOURNEYS[name];
  const dir = `${OUT}/journey`;
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.goto(`${BASE}${journey.start}`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(1200);

  let step = 0;
  for (const [label, action] of journey.steps) {
    step += 1;
    const file = `${dir}/${String(step).padStart(2, '0')}-${label}.png`;
    try {
      if (action) {
        await action(page);
        await page.waitForTimeout(900);
      }
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${step}. ${label}`);
    } catch (err) {
      console.error(`✗ ${step}. ${label} — ${err.message.split('\n')[0]}`);
      await page.screenshot({ path: `${dir}/FAILED-${label}.png`, fullPage: true }).catch(() => {});
      await page.close();
      return false;
    }
  }
  await page.close();
  return true;
}

const args = process.argv.slice(2);
const journeyMode = args.includes('--journey');
const filters = args.filter((a) => !a.startsWith('--'));
const wanted = filters.length
  ? SHOTS.filter(([name]) => filters.some((f) => name.includes(f)))
  : SHOTS;

if (!journeyMode && !wanted.length) {
  console.error(`No shot matches ${filters.join(', ')}`);
  process.exit(1);
}

const res = await fetch(BASE).catch(() => null);
if (!res?.ok) {
  console.error(`Expo web is not answering at ${BASE}. Run \`npm run web\` first.`);
  process.exit(1);
}

// Only a full run clears the directory — a filtered run must not delete the
// shots it was not asked to retake.
if (!filters.length && !journeyMode) await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 14 Pro'],
  isMobile: false, // Expo web needs desktop-style events for pressables
});

if (journeyMode) {
  const names = filters.length ? filters : Object.keys(JOURNEYS);
  let ok = true;
  for (const name of names) {
    if (!JOURNEYS[name]) {
      console.error(`Unknown journey: ${name}`);
      ok = false;
      continue;
    }
    console.log(`journey: ${name}`);
    ok = (await runJourney(context, name)) && ok;
  }
  await browser.close();
  console.log(`\n→ ${OUT}/journey/`);
  process.exit(ok ? 0 : 1);
}

let failed = 0;
for (const [name, route, preset, flow] of wanted) {
  const page = await context.newPage();
  const url = `${BASE}${route}?mock=${preset}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    // Screens fetch their data on mount behind a 250ms mock delay.
    await page.waitForTimeout(1200);
    if (flow) await FLOWS[flow](page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name} — ${err.message.split('\n')[0]}`);
  }
  await page.close();
}

await browser.close();
console.log(`\n${wanted.length - failed}/${wanted.length} → ${OUT}/`);
process.exit(failed ? 1 : 0);
