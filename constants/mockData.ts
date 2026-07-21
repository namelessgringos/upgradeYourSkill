/**
 * MOCK DATA — UI/UX prototype only. No backend, no LLM. Everything here is
 * canned so the whole flow can be smoke-tested on a phone. When the backend
 * lands, skills come from Firestore and coach replies come from the server
 * (see docs/API_CONTRACT.md). Nothing here ships to production as-is.
 */
import { JournalColors } from './theme';

export type SkillTier = 'standard' | 'pro';

export interface GuideSection {
  heading: string;
  body: string;
}

/** An "artifact" the coach can surface in-thread (image / schema / checklist),
 *  to demo the Claude-coworker-style chat + output experience. */
export type Artifact =
  | { kind: 'checklist'; title: string; items: string[] }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] }
  | { kind: 'image'; title: string; caption: string; swatch: string };

export interface CannedReply {
  text: string;
  artifact?: Artifact;
}

export interface Skill {
  id: string;
  title: string;
  /** One-line promise for the flat list. */
  promise: string;
  tier: SkillTier;
  emoji: string;
  summary: string;
  coachName: string;
  coachTagline: string;
  /** Static written guide — the product. */
  guide: GuideSection[];
  /** Suggested first prompts shown in an empty chat. */
  starters: string[];
  /** Canned responder: keyword-matched, else a default. Mock only. */
  reply: (userText: string) => CannedReply;
}

function makeReply(
  defaultReply: CannedReply,
  rules: { match: RegExp; reply: CannedReply }[]
) {
  return (userText: string): CannedReply => {
    const found = rules.find((r) => r.match.test(userText.toLowerCase()));
    return found ? found.reply : defaultReply;
  };
}

export const SKILLS: Skill[] = [
  {
    id: 'strength',
    title: 'Strength Programming',
    promise: 'Build a training plan that actually progresses.',
    tier: 'standard',
    emoji: '🏋️',
    summary:
      'Turn "I lift sometimes" into a structured program with progressive overload, sensible volume, and deloads — tailored to your schedule and goals.',
    coachName: 'Coach Vera',
    coachTagline: 'Strength & programming • not a medical professional',
    guide: [
      {
        heading: 'The one principle that matters',
        body: 'Progressive overload: do a little more over time — more weight, more reps, or better form. Everything else is detail. If the graph of your work trends up across weeks, you are training. If it is flat, you are exercising.',
      },
      {
        heading: 'How much volume?',
        body: 'For most people, 10–20 hard sets per muscle group per week drives growth. Start at the low end. Add a set or two when recovery is comfortable. More is not better once you stop recovering between sessions.',
      },
      {
        heading: 'Structuring a week',
        body: 'Full-body 3x/week is the highest-leverage template for busy people: every muscle gets 3 stimulating sessions, and missing one day barely dents the week. Upper/lower 4x/week is the next step up once 3 days feels easy.',
      },
      {
        heading: 'Deload before you need it',
        body: 'Every 4–8 weeks, cut volume ~40% for a week. You will come back stronger. Fatigue masks fitness; a deload unmasks it.',
      },
    ],
    starters: [
      'Build me a 3-day full-body plan',
      'How many sets for chest per week?',
      'I keep missing workouts — help',
    ],
    reply: makeReply(
      {
        text: 'Good question. The honest answer: pick the smallest sustainable version, do it for 4 weeks, and add a little each week. Want me to sketch a concrete week for you?',
      },
      [
        {
          match: /plan|program|routine|3.?day|week/,
          reply: {
            text: 'Here is a simple, effective 3-day full-body week. Do each session with 1–2 reps left in the tank, and add a small amount of weight when you hit the top of the rep range.',
            artifact: {
              kind: 'table',
              title: '3-Day Full-Body Week',
              columns: ['Day', 'Focus', 'Key lifts'],
              rows: [
                ['Mon', 'Full body A', 'Squat, Bench, Row'],
                ['Wed', 'Full body B', 'Deadlift, OHP, Pulldown'],
                ['Fri', 'Full body C', 'Front squat, Incline, Row'],
              ],
            },
          },
        },
        {
          match: /set|volume|how many/,
          reply: {
            text: 'Start at 10 hard sets per muscle per week and build from there. Here is a quick reference to anchor it.',
            artifact: {
              kind: 'checklist',
              title: 'Weekly set targets',
              items: [
                'Beginner: 8–10 hard sets / muscle',
                'Intermediate: 12–16',
                'Add ~2 sets only when recovery is easy',
                'Deload every 4–8 weeks',
              ],
            },
          },
        },
        {
          match: /miss|motivation|consistent|skip/,
          reply: {
            text: 'Consistency beats intensity. Shrink the plan until you cannot fail it — even 2 sessions a week that you always do will out-progress a 5-day plan you abandon. What days are realistic for you?',
          },
        },
      ]
    ),
  },
  {
    id: 'negotiation',
    title: 'Negotiation & Deals',
    promise: 'Ask for more, and get it, without the sweaty palms.',
    tier: 'pro',
    emoji: '🤝',
    summary:
      'A practical playbook for salary talks, contracts, and everyday asks: how to anchor, when to be silent, and how to trade concessions instead of giving them away.',
    coachName: 'Marcus',
    coachTagline: 'Deals & negotiation • practice partner, not your lawyer',
    guide: [
      {
        heading: 'Never negotiate against yourself',
        body: 'Make your ask, then stop talking. The silence after a number feels unbearable to you and completely normal to them. Whoever speaks first to fill it usually concedes.',
      },
      {
        heading: 'Anchor first, anchor high (but defensible)',
        body: 'The first number shapes the whole conversation. Anchor at the top of a range you can justify with a reason. A high anchor with a rationale beats a "fair" number with none.',
      },
      {
        heading: 'Trade, do not give',
        body: 'Every concession should buy something. "I can do that timeline if we adjust scope." Free concessions teach the other side to keep pushing.',
      },
    ],
    starters: [
      'Help me ask for a raise',
      'They lowballed my offer — what now?',
      'Roleplay a tough client with me',
    ],
    reply: makeReply(
      {
        text: 'Tell me the specific ask and the other side’s likely position, and I’ll give you the exact words plus your walk-away line.',
      },
      [
        {
          match: /raise|salary|promotion/,
          reply: {
            text: 'Here is the structure for a raise conversation. Lead with impact, anchor high, then go quiet.',
            artifact: {
              kind: 'checklist',
              title: 'Raise conversation script',
              items: [
                'Open: "I want to talk about my compensation."',
                'Evidence: 2–3 concrete wins with numbers',
                'The ask: a specific figure, top of your range',
                'Then: stop talking. Let the silence work.',
              ],
            },
          },
        },
        {
          match: /lowball|offer|counter/,
          reply: {
            text: 'A lowball is an invitation, not an insult. Counter above your target with a one-line rationale, and never justify more than once.',
          },
        },
        {
          match: /roleplay|practice|simulate/,
          reply: {
            text: 'Great — I’ll play a skeptical client. "Your price is 30% over budget and a competitor quoted less. Why should we pick you?" Your move.',
          },
        },
      ]
    ),
  },
  {
    id: 'finance',
    title: 'Personal Finance Foundations',
    promise: 'Get your money organized in a weekend.',
    tier: 'standard',
    emoji: '💰',
    summary:
      'A calm, no-jargon system for budgeting, emergency funds, and getting out of debt — built around a few habits that do 90% of the work.',
    coachName: 'Nadia',
    coachTagline: 'Money habits • education only, not financial advice',
    guide: [
      {
        heading: 'Pay yourself first',
        body: 'Automate a transfer to savings the day you get paid, before you can spend it. Budgeting on willpower fails; budgeting on automation works while you sleep.',
      },
      {
        heading: 'The order of operations',
        body: '1) Tiny emergency fund. 2) Any employer match — it is free money. 3) Kill high-interest debt. 4) Bigger emergency fund. 5) Invest the rest. Do them roughly in order.',
      },
      {
        heading: 'Track for two weeks, then relax',
        body: 'You do not need to track forever. Track everything for two weeks to see where money actually goes, fix the two biggest leaks, and then let automation carry it.',
      },
    ],
    starters: [
      'Help me build a simple budget',
      'Emergency fund or pay debt first?',
      'Where is my money going?',
    ],
    reply: makeReply(
      {
        text: 'Let’s keep it simple. Tell me your monthly take-home and your biggest recurring expenses, and I’ll suggest a split you can automate.',
      },
      [
        {
          match: /budget|split|50.?30.?20/,
          reply: {
            text: 'A good starting split is 50/30/20 — needs, wants, and savings/debt. Adjust to your reality, but automate the 20% first.',
            artifact: {
              kind: 'table',
              title: 'The 50 / 30 / 20 split',
              columns: ['Bucket', 'Share', 'Examples'],
              rows: [
                ['Needs', '50%', 'Rent, food, bills'],
                ['Wants', '30%', 'Dining, fun, subs'],
                ['Save/Debt', '20%', 'Emergency fund, loans'],
              ],
            },
          },
        },
        {
          match: /debt|emergency|fund|first/,
          reply: {
            text: 'Build a small buffer first (about one month of essentials), then throw everything at high-interest debt. A tiny cushion stops one bad week from putting the debt right back on a card.',
          },
        },
        {
          match: /where|track|spending|leak/,
          reply: {
            text: 'Track every expense for two weeks — no judgment. Then we find your two biggest leaks and plug them. That usually beats a dozen tiny cutbacks.',
            artifact: {
              kind: 'checklist',
              title: 'Two-week money audit',
              items: [
                'Log every purchase (app or notes)',
                'Group into needs / wants',
                'Circle the 2 biggest wants',
                'Automate savings before you can spend',
              ],
            },
          },
        },
      ]
    ),
  },
];

export function getSkill(id: string | undefined): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

/** Tier pill color (single-accent system). */
export function tierColor(tier: SkillTier): string {
  return tier === 'pro' ? JournalColors.accent : JournalColors.selectedBorder;
}
