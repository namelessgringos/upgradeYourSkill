/**
 * The mascot's brain, behind an interface so the character on screen does not
 * change when the answers behind it get smarter.
 *
 * v1 is a hand-written help set: zero cost, no stored data, in MVP scope. A
 * later v2 that answers with a model call and reads across a user's own chats
 * is a separate feature — it needs conversation history to be stored, a
 * privacy-policy change, and per-message metering, none of which exist yet.
 * Whatever ships there implements this same interface.
 */
export interface MascotAnswer {
  question: string;
  answer: string;
}

export interface MascotBrain {
  /** The greeting line shown when the sheet opens. */
  greeting: string;
  /** Tappable prompts. v1 returns a fixed set; v2 could rank by context. */
  suggestions(): MascotAnswer[];
}

/**
 * Hand-written answers about how the app works. Kept short and honest — this
 * is the "how do I use this" helper, not the coach and not a support agent.
 */
export const staticBrain: MascotBrain = {
  greeting: "Hi, I'm here if the app itself is confusing. Ask me how something works.",
  suggestions: () => [
    {
      question: 'What is a skill?',
      answer:
        'A skill is a written guide by someone who knows the subject, plus a coach you can chat with about it. The guide is the thing you are paying for; the coach helps you apply it.',
    },
    {
      question: 'Why is there a daily message limit?',
      answer:
        'Each plan includes a set number of coach messages a day. When you reach it the coach pauses until tomorrow — you are never charged for going over. The guide stays readable regardless.',
    },
    {
      question: 'What does the free trial include?',
      answer:
        'Seven days with every skill unlocked and a higher daily message limit. No charge during the trial, and you can cancel any time before it ends.',
    },
    {
      question: 'Can the coach give medical or legal advice?',
      answer:
        'No. Each coach stays inside its subject and hands you to a qualified professional for anything clinical, legal, or financial. That boundary is enforced on our side, not left to the coach.',
    },
    {
      question: 'Where do I manage my subscription?',
      answer:
        'Settings → Subscription. You can review your plan, restore a purchase, or cancel from there. Cancelling keeps your access until the month you paid for runs out.',
    },
  ],
};
