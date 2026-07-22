/**
 * Billing behind an interface, for the same reason LLM calls are (rule #3):
 * the provider is a decision we should be able to change without touching a
 * screen. RevenueCat is the intended production implementation — App Store,
 * Play, and web checkout under one entitlement model — but nothing external is
 * wired yet. See docs/BUREAUCRACY.md.
 *
 * Entitlement is never granted here. The real provider's webhook tells the
 * server, the server re-checks on every call, and the client only displays
 * what it is told. A mock that flips local state is a preview, not a grant.
 */
import type { EntitlementState } from '@/server-shared/api';
import * as mock from './mockApi';

/** One monthly price (BLUEPRINT: ONE subscription price, monthly only). */
export interface Offering {
  id: string;
  title: string;
  priceLabel: string;
  period: 'month';
  /** One line under the price. Plain language, no marketing verbs. */
  description: string;
  perks: string[];
}

export type PurchaseOutcome =
  | { status: 'purchased'; entitlement: EntitlementState }
  | { status: 'restored'; entitlement: EntitlementState }
  | { status: 'cancelled' }
  | { status: 'nothing_to_restore' }
  | { status: 'unavailable'; reason: string };

export interface BillingProvider {
  getOfferings(): Promise<Offering[]>;
  purchase(offeringId: string): Promise<PurchaseOutcome>;
  restore(): Promise<PurchaseOutcome>;
  /**
   * Where the user cancels. The stores require this to be reachable from the
   * app; on web it is the billing portal.
   */
  manageSubscriptionUrl(): string | null;
}

export const MONTHLY: Offering = {
  id: 'monthly',
  title: 'Full access',
  priceLabel: '$9.99',
  period: 'month',
  description: 'Every skill, every guide, 40 coach messages a day. Cancel anytime.',
  perks: [
    'Every skill and its full written guide',
    '40 coach messages a day',
    'New skills included as they land',
  ],
};

/**
 * Development provider. Shaped exactly like the real one — same latency, same
 * cancellable purchase, same restore semantics — so screens built against it
 * do not change when RevenueCat is wired in.
 */
export class MockBillingProvider implements BillingProvider {
  /** Set false to preview the cancelled-purchase path. */
  constructor(private readonly autoApprove = true) {}

  async getOfferings(): Promise<Offering[]> {
    await pause(300);
    return [MONTHLY];
  }

  async purchase(offeringId: string): Promise<PurchaseOutcome> {
    await pause(900);
    if (offeringId !== MONTHLY.id) {
      return { status: 'unavailable', reason: `Unknown offering: ${offeringId}` };
    }
    if (!this.autoApprove) return { status: 'cancelled' };
    return { status: 'purchased', entitlement: mock.mockGrantSubscription() };
  }

  async restore(): Promise<PurchaseOutcome> {
    await pause(700);
    const existing = mock.mockActiveSubscription();
    return existing
      ? { status: 'restored', entitlement: existing }
      : { status: 'nothing_to_restore' };
  }

  manageSubscriptionUrl(): string | null {
    return null;
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const billing: BillingProvider = new MockBillingProvider();
