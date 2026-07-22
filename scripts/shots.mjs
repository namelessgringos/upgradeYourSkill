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

const filters = process.argv.slice(2);
const wanted = filters.length
  ? SHOTS.filter(([name]) => filters.some((f) => name.includes(f)))
  : SHOTS;

if (!wanted.length) {
  console.error(`No shot matches ${filters.join(', ')}`);
  process.exit(1);
}

const res = await fetch(BASE).catch(() => null);
if (!res?.ok) {
  console.error(`Expo web is not answering at ${BASE}. Run \`npm run web\` first.`);
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 14 Pro'],
  isMobile: false, // Expo web needs desktop-style events for pressables
});

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
