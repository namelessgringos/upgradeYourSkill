# API CONTRACT — app ⇄ server

Frozen before parallel work starts. Client and Cloud Functions both code
against this. Changes here are a deliberate, announced event, not a silent edit.

## Transport & auth

- **Auth** is Firebase Auth (email/password). Register, login, email
  verification, and password reset are done client-side with the Firebase Auth
  SDK — there are **no custom auth endpoints**.
- Every server call sends the Firebase **ID token**; the function verifies it.
  An unverified or missing token → `401`.
- **Entitlement is checked on every call** (non-negotiable rule #4). The check
  always runs; its *result* decides how much is returned:
  - List/metadata calls succeed for anyone signed in (needed to sell).
  - Guide body and chat require an active entitlement (trial or paid) → `402`
    with a paywall payload otherwise.
- Endpoints are Firebase Cloud Functions. Metadata calls are **callable**
  functions; `chat` is an **HTTPS** function so it can stream (SSE) later. v1
  walking skeleton may use plain request/response for `chat`.

## Errors

| Code | Meaning | Client action |
|---|---|---|
| 401 | No/invalid ID token | Route to login |
| 402 | Signed in, not entitled | Show paywall sheet |
| 429 `cap_reached` | Trial daily message cap hit | Show cap message + upgrade |
| 429 `soft_cap` | Paid soft cap hit, paused | Show opt-in-to-continue (never auto-charge) |
| 500 | Server error | Retry / error state |

Error body: `{ "error": { "code": string, "message": string } }`.

---

## Endpoints

### `listSkills()` → callable
Returns published skills, metadata only (no guide body, no prompts).
```
Response: { skills: SkillListItem[] }
SkillListItem = { id, title, promise, tier, coachName }
```

### `getSkill({ skillId })` → callable
```
Response: {
  meta: SkillListItem & { summary, coachTagline },
  guide: GuideSection[] | null,   // null when not entitled
  entitled: boolean
}
```
`guide` is populated only when the caller is entitled. Prompts/model config are
never in the response.

### `chat({ skillId, messages })` → HTTPS (SSE-capable)
Requires entitlement. Enforces trial message cap and paid soft cap. Meters
tokens.
```
Request:  { skillId: string, messages: { role: 'user'|'assistant', content: string }[] }
Response (non-stream v1): { reply: string, usage: { inputTokens, outputTokens }, meter: MeterState }
Response (streaming, later): SSE — text deltas, then a final `usage` + `meter` event
```
Server behavior: verify token → check entitlement → load `SkillPrivate`
(system prompt + safetyBoundaries + model config) → assemble call via the
provider abstraction (prompt caching on) → write per-user token usage to
Firestore → return reply + updated meter. **The client sends only the
conversation; it never sends or receives the system prompt.**

### `getEntitlement()` → callable
```
Response: {
  status: 'none' | 'trial' | 'active' | 'paused',
  trialEndsAt?: ISO8601,
  messageCapPerDay?: number,      // trial
  softCapReached?: boolean        // paid
}
```

### `getUsage()` → callable
Drives the always-visible usage meter.
```
Response: MeterState
MeterState = { periodStart: ISO8601, used: number, limit: number, unit: 'messages' | 'usd_cost' }
```

### Billing webhook (server-to-server, NOT a client call)
Billing provider (RevenueCat or Stripe — see BLUEPRINT open question) POSTs
subscription events to a signature-verified HTTPS function that updates the
user's entitlement document. Client never writes entitlement.

---

## Firestore collections (server-owned)

- `skills/{skillId}` — `SkillDocument` (public + private halves).
- `users/{uid}/entitlement` — status, plan, trial end, soft-cap state.
- `users/{uid}/usage/{period}` — metered token counts + derived cost, per user
  per period. Source for the cost-per-user dashboard (rule #5).
- `evalSets/{skillId}` — the 30-question eval set.

Client has **no direct Firestore write access** to entitlement or usage; all
writes go through entitlement-checked functions.
