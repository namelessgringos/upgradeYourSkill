/**
 * Turns eval token measurements into the numbers that set the daily caps.
 *
 *   npm run economics                       # newest report
 *   npm run economics -- <report.json>      # a specific run
 *
 * The caps in functions/src/entitlement.ts started life as placeholders in the
 * UI prototype. They were never derived from anything. This computes what each
 * cap actually permits a single user to cost, so they can be set from evidence.
 *
 * CLAUDE.md's target: a typical user costs under 10% of subscription revenue.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** USD per million tokens. Mirrors PRICING in functions/src/usage.ts — if you
 *  change one, change both. */
const PRICING = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  local: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

/** Assumed subscription price. No price is set yet — BLUEPRINT says it comes
 *  from measured p90 usage, which is what this script produces. */
const ASSUMED_PRICE_USD = Number(process.env.ASSUMED_PRICE_USD ?? 10);
const TARGET_COST_SHARE = 0.1;

/** What a normal engaged user does in a month. The caps protect against the
 *  tail; this is the middle of the distribution. */
const TYPICAL_TURNS_PER_MONTH = 30;

const REPORT_DIR = resolve(process.cwd(), 'functions/evals/reports');

function newestReport() {
  if (!existsSync(REPORT_DIR)) return null;
  const files = readdirSync(REPORT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  return files.length ? join(REPORT_DIR, files[files.length - 1]) : null;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function costPerTurn(pricing, { input, output, cached }) {
  return (
    (input * pricing.input + output * pricing.output + cached * pricing.cacheRead) /
    1_000_000
  );
}

const path = process.argv[2] ?? newestReport();

if (!path) {
  console.error(
    `No eval report found in ${REPORT_DIR}.\n` +
      'Run the harness first:  npm run evals -- --provider echo\n' +
      '(echo gives you the shape; real numbers need a provider.)'
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8'));
console.log(`Report: ${path}`);
console.log(`Measured on: provider=${report.provider} model=${report.model}\n`);

// Pool every question across skills — the cap is per user, not per skill.
const all = report.reports.flatMap((r) => r.results);
const answered = all.filter((r) => !r.error);

if (!answered.length) {
  console.error('Report contains no successful answers.');
  process.exit(1);
}

const inputs = answered.map((r) => r.usage.inputTokens);
const cached = answered.map((r) => r.usage.cacheReadTokens);
const outputs = answered.map((r) => r.usage.outputTokens);

/**
 * Output length override.
 *
 * The echo provider returns a ~50-token stub, and output is priced 5x input —
 * so a keyless run understates cost badly and would set the caps far too high.
 * Until a real model has been measured, override with a realistic answer
 * length:  ASSUMED_OUTPUT_TOKENS=400 npm run economics
 */
const outputOverride = process.env.ASSUMED_OUTPUT_TOKENS
  ? Number(process.env.ASSUMED_OUTPUT_TOKENS)
  : null;

const profile = {
  p50: {
    input: percentile(inputs, 50),
    cached: percentile(cached, 50),
    output: outputOverride ?? percentile(outputs, 50),
  },
  p90: {
    input: percentile(inputs, 90),
    cached: percentile(cached, 90),
    output: outputOverride ?? percentile(outputs, 90),
  },
};

const outputLooksSynthetic = !outputOverride && percentile(outputs, 90) < 120;

const cacheActive = cached.some((c) => c > 0);

console.log('Measured tokens per turn');
console.log(
  `  p50  input ${profile.p50.input}  cached ${profile.p50.cached}  output ${profile.p50.output}`
);
console.log(
  `  p90  input ${profile.p90.input}  cached ${profile.p90.cached}  output ${profile.p90.output}`
);
if (outputOverride) {
  console.log(`  output overridden to ${outputOverride} tokens/turn via ASSUMED_OUTPUT_TOKENS`);
}
if (!cacheActive) {
  console.log(
    '  NOTE: no cache reads observed. Either the provider does not report them,\n' +
      '        or the system block is under the model minimum (4096 tokens on Haiku 4.5).'
  );
}
if (outputLooksSynthetic) {
  console.log(
    '  WARNING: p90 output is under 120 tokens, which is not a real coach answer.\n' +
      '           This is almost certainly an echo/stub run. Every cost below is\n' +
      '           understated. Re-run with ASSUMED_OUTPUT_TOKENS=400, or against a\n' +
      '           real provider, before setting any cap from these numbers.'
  );
}
console.log();

/**
 * The system block is byte-identical every call, so once it clears the model's
 * minimum cacheable prefix it bills at cache-read rates. Providers that cannot
 * report cache reads (echo, most local servers) make this invisible, so it is
 * modelled explicitly rather than left looking like it does not happen.
 */
const MIN_CACHEABLE_TOKENS = 4096;
const systemTokens = Math.max(
  ...report.reports.map((r) => r.systemTokensEstimate ?? 0)
);
const cacheEligible = systemTokens >= MIN_CACHEABLE_TOKENS;

function projectedCached(pricing, tokens) {
  // System block served from cache; only the conversation delta is fresh.
  const fresh = Math.max(0, tokens.input + tokens.cached - systemTokens);
  return costPerTurn(pricing, { input: fresh, cached: systemTokens, output: tokens.output });
}

console.log(`System block: ~${systemTokens} tokens — ` +
  (cacheEligible
    ? `over the ${MIN_CACHEABLE_TOKENS}-token minimum, so caching applies.`
    : `UNDER the ${MIN_CACHEABLE_TOKENS}-token minimum: caching will not apply.`));
console.log();

console.log(`Cost per turn (assuming $${ASSUMED_PRICE_USD}/mo subscription)\n`);
console.log(
  '  model                p90 uncached   p90 cached   typical user/mo   % of revenue'
);

const rows = [];
for (const [model, pricing] of Object.entries(PRICING)) {
  const p50 = costPerTurn(pricing, profile.p50);
  const p90 = costPerTurn(pricing, profile.p90);
  // Use the cached projection for planning when the block is eligible; that is
  // what production will actually pay after the first call.
  const p90Effective = cacheEligible ? projectedCached(pricing, profile.p90) : p90;
  const p50Effective = cacheEligible ? projectedCached(pricing, profile.p50) : p50;
  const monthly = p50Effective * TYPICAL_TURNS_PER_MONTH;
  const share = (monthly / ASSUMED_PRICE_USD) * 100;
  rows.push({ model, pricing, p50: p50Effective, p90: p90Effective, monthly, share });
  console.log(
    `  ${model.padEnd(20)} $${p90.toFixed(5)}      $${p90Effective.toFixed(5)}    ` +
      `$${monthly.toFixed(3).padStart(7)}          ${share.toFixed(2)}%`
  );
}
console.log(
  cacheEligible
    ? '\n  Planning figures below use the cached column.'
    : '\n  Caching is not active; both columns are the same.'
);
console.log();

// --- what each cap permits ---------------------------------------------------
const CURRENT_CAPS = { free: 5, trial: 50, pro: 500 };

console.log('Worst case: a user who maxes their daily cap every day for a month');
console.log('  (this is what the cap actually authorises, not what people do)\n');
console.log('  plan    cap/day   haiku $/mo   sonnet $/mo   verdict @ $' + ASSUMED_PRICE_USD);

const haiku = rows.find((r) => r.model === 'claude-haiku-4-5');
const sonnet = rows.find((r) => r.model === 'claude-sonnet-5');

for (const [plan, cap] of Object.entries(CURRENT_CAPS)) {
  const haikuMonthly = haiku.p90 * cap * 30;
  const sonnetMonthly = sonnet.p90 * cap * 30;
  const verdict =
    haikuMonthly > ASSUMED_PRICE_USD
      ? 'LOSS-MAKING'
      : haikuMonthly > ASSUMED_PRICE_USD * TARGET_COST_SHARE
        ? 'over 10% target'
        : 'ok';
  console.log(
    `  ${plan.padEnd(8)}${String(cap).padStart(5)}     ` +
      `$${haikuMonthly.toFixed(2).padStart(8)}    $${sonnetMonthly.toFixed(2).padStart(8)}    ${verdict}`
  );
}
console.log();

// --- what the cap should be --------------------------------------------------
const budget = ASSUMED_PRICE_USD * TARGET_COST_SHARE;
console.log(`Cap that keeps a maxing user inside ${TARGET_COST_SHARE * 100}% of revenue:\n`);
for (const row of rows) {
  if (row.model === 'local') continue;
  const capForBudget = Math.floor(budget / (row.p90 * 30));
  console.log(
    `  ${row.model.padEnd(20)} ${capForBudget} messages/day ` +
      `(at p90 ${row.p90.toFixed(5)}/turn)`
  );
}

console.log(
  '\nCaveats: assumes every capped turn is a p90 turn, ignores store commission\n' +
    `(15-30%, which dwarfs token cost), and assumes $${ASSUMED_PRICE_USD} as the price.\n` +
    'Override with ASSUMED_PRICE_USD=... npm run economics'
);
