/**
 * The mascot's brain, behind an interface so the character on screen does not
 * change when the answers behind it get smarter.
 *
 * v1 is a hand-written help set, authored in two languages: English and the
 * languages we support for the device. Zero cost, no stored data, in MVP
 * scope. A later v2 that answers with a model call and reads across a user's
 * own chats is a separate feature — it needs stored conversation history, a
 * privacy-policy change and metering, none of which exist yet. Whatever ships
 * there implements this same interface.
 */
import { getLocales } from 'expo-localization';

/** Languages the mascot help is translated into. English is always present. */
export const MASCOT_LOCALES = ['en', 'uk'] as const;
export type MascotLocale = (typeof MASCOT_LOCALES)[number];

export interface MascotAnswer {
  question: string;
  answer: string;
}

export interface MascotContent {
  /** Native-language name of this language, for the toggle label. */
  label: string;
  /** The greeting line shown when the sheet opens. */
  greeting: string;
  /** Tappable prompts with their answers. */
  suggestions: MascotAnswer[];
}

export interface MascotBrain {
  content(locale: MascotLocale): MascotContent;
}

const EN: MascotContent = {
  label: 'English',
  greeting: "Hi, I'm here if the app itself is confusing. Ask me how something works.",
  suggestions: [
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

const UK: MascotContent = {
  label: 'Українська',
  greeting: 'Привіт! Я тут, якщо сам застосунок заплутує. Спитай, як щось працює.',
  suggestions: [
    {
      question: 'Що таке скіл?',
      answer:
        'Скіл — це письмовий гайд від людини, яка знається на темі, плюс коуч, з яким можна це обговорити. Ти платиш саме за гайд; коуч допомагає його застосувати.',
    },
    {
      question: 'Навіщо денний ліміт повідомлень?',
      answer:
        'Кожен план має певну кількість повідомлень коучу на день. Коли ліміт вичерпано, коуч ставиться на паузу до завтра — за перевищення з тебе ніколи не беруть грошей. Гайд лишається доступним завжди.',
    },
    {
      question: 'Що входить у безкоштовний пробний період?',
      answer:
        'Сім днів з усіма розблокованими скілами та вищим денним лімітом. Під час пробного періоду оплати немає, і скасувати можна будь-коли до його завершення.',
    },
    {
      question: 'Чи може коуч давати медичні чи юридичні поради?',
      answer:
        'Ні. Кожен коуч лишається в межах своєї теми й скеровує тебе до кваліфікованого фахівця з усього медичного, юридичного чи фінансового. Ця межа забезпечується на нашому боці, а не залишається на розсуд коуча.',
    },
    {
      question: 'Де керувати підпискою?',
      answer:
        'Налаштування → Підписка. Там можна переглянути план, відновити покупку чи скасувати. Після скасування доступ лишається до кінця оплаченого місяця.',
    },
  ],
};

const CONTENT: Record<MascotLocale, MascotContent> = { en: EN, uk: UK };

export const staticBrain: MascotBrain = {
  content: (locale) => CONTENT[locale],
};

/**
 * The device's language, but only if the mascot is translated into it and it
 * is not English. Returns null otherwise — meaning English is the only choice
 * and the language toggle should not appear.
 */
export function deviceMascotLocale(): MascotLocale | null {
  const code = getLocales()[0]?.languageCode;
  const supported = MASCOT_LOCALES.find((l) => l === code && l !== 'en');
  return supported ?? null;
}
