/**
 * Legal pages the stores require to be linked from inside the app, and that a
 * subscription checkout has to link to before it can take money.
 *
 * These are placeholders. Publishing the real pages is a bureaucracy item, not
 * a code one — see docs/BUREAUCRACY.md. The screens link to them already so
 * that swapping the URLs is the only change needed later.
 */
export const LEGAL_URLS = {
  privacy: 'https://example.com/upgrade-your-skill/privacy',
  terms: 'https://example.com/upgrade-your-skill/terms',
} as const;

/** True once the placeholders above are replaced with published pages. */
export const LEGAL_PAGES_PUBLISHED = false;
