export interface BillingCheckoutResult {
  checkoutUrl: string;
  /**
   * `local_dev` means this is the local/non-production provider.
   * Real payment providers (e.g. Stripe) will return `production`.
   * Admin and frontend must surface this to operators clearly.
   */
  providerEnvironment: "local_dev" | "production";
  provider: string;
  providerRef: string;
}

export interface BillingProvider {
  startLocalCheckout(input: { planSlug: string; userId: string }): Promise<BillingCheckoutResult>;
}
