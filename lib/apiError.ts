/**
 * Lives in its own module so the mock API can throw the same error type the
 * real client does without importing lib/api.ts, which imports the mock.
 *
 * Screens branch on `code` — `cap_reached`, `not_entitled` — so a mock that
 * throws anything else would let a screen path go untested.
 */
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
