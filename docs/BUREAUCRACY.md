# BUREAUCRACY — external things that must exist before we can take money

Everything here is an account, a credential, a legal page or a form. None of it
is code, none of it blocks building against mocks, and none of it should be
done mid-build (CLAUDE.md → Mock-First Build Order, step 3).

Order matters only where marked. Owner is you unless stated.

Last updated: 2026-07-22.

---

## Decided

- **Billing provider: RevenueCat**, with Stripe as the payment processor and
  **merchant of record**. Reason: one entitlement model across web now and the
  App Store later, free under $2,500/month tracked revenue, and it keeps EU VAT
  off our books — selling digital subscriptions from Spain to EU consumers as
  our own merchant of record would mean OSS registration and quarterly filings
  from the first euro.
- **Price: $9.99/month.** One price, monthly only (BLUEPRINT). Changeable later
  on both surfaces.
- **Web checkout ships first**, store IAP second. Live payments in days instead
  of weeks.

**Verify before committing the account:** RevenueCat's docs say Stripe Managed
Payments (the merchant-of-record mode) rides the *Stripe Billing* integration
rather than RevenueCat's own Billing product, and native tax handling in
RevenueCat Billing was still listed as coming soon. Confirm which combination
gives merchant-of-record coverage today.

---

## Web checkout (do first — unblocks live payment)

- [ ] Stripe account, business details, bank account for payouts.
- [ ] Enable Stripe Managed Payments (merchant of record) — confirms who remits
      EU VAT. If unavailable, the fallback is Paddle or Lemon Squeezy at ~5%.
- [ ] RevenueCat account, project, Stripe integration connected.
- [ ] One product + one monthly price at $9.99 in Stripe.
- [ ] RevenueCat entitlement `full_access` mapped to that product.
- [ ] Webhook endpoint URL registered in RevenueCat → points at the deployed
      Cloud Function (needs the Firebase item below).
- [ ] Webhook signing secret stored in Secret Manager, never in git.

## Firebase (blocks the webhook)

- [ ] Firebase project on the **Blaze** plan — Cloud Functions need outbound
      HTTP, and a webhook needs a public URL. The emulator cannot receive store
      or Stripe callbacks.
- [ ] `ANTHROPIC_API_KEY` in Secret Manager.
- [ ] Deploy functions; note the webhook URL.

## Legal pages (blocks any checkout, both surfaces)

- [ ] Privacy policy published at a stable URL. Must cover: what we send to
      Anthropic (the conversation), what we store (usage counts, entitlement),
      auth provider data, and deletion.
- [ ] Terms of use / EULA published. Apple accepts its standard EULA if you do
      not supply your own; a subscription still needs terms describing renewal
      and cancellation.
- [ ] Swap both URLs into `constants/legal.ts` and set
      `LEGAL_PAGES_PUBLISHED = true`.
- [ ] Support contact address that a real person reads — App Review checks it.

## App Store (you already have the Apple Developer Program)

- [ ] App record in App Store Connect, bundle ID matching `app.json`.
- [ ] Paid Applications agreement signed; banking and tax forms completed —
      **no in-app purchase can exist until this clears**, and it is the item
      most likely to add days.
- [ ] Auto-renewable subscription product, one group, $9.99 tier.
- [ ] Subscription display name, description and review screenshot.
- [ ] App privacy questionnaire (data collection disclosure).
- [ ] EAS build profile + dev build — **IAP does not run in Expo Go.**
- [ ] TestFlight build for sandbox purchase testing.

## Google Play (not started — no account yet)

- [ ] Play Console account, $25 one-off.
- [ ] **New personal developer accounts must run a closed test with 12 testers
      for 14 continuous days before production access.** This is the long pole
      on Android; start it early or plan to launch iOS + web first.
- [ ] Merchant account for payouts.
- [ ] Subscription product mirroring the App Store one.

---

## Code that must exist before submission (not bureaucracy — tracked so it is not forgotten)

- [ ] **Account deletion endpoint.** App Store guideline 5.1.1(v) requires an
      account created in-app to be deletable in-app. The Settings entry point
      exists and currently explains it is not wired.
- [ ] **Webhook receiver** — verify signature, map RevenueCat entitlement to
      the `users/{uid}` entitlement document, ignore replays.
- [ ] **Real `BillingProvider`** implementation replacing `MockBillingProvider`
      in `lib/billing.ts`. The interface is already the seam.
- [ ] **Soft cap** — pause and let the user opt in. Never auto-charge
      (non-negotiable rule #6).
- [ ] Restore-purchases path against the real provider.
