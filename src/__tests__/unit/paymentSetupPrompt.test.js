const { shouldShowPaymentSetupPopup } = require('../../shared/payments/paymentSetupPrompt');

describe('shouldShowPaymentSetupPopup', () => {
  it('shows when no stripe account and not dismissed', () => {
    expect(shouldShowPaymentSetupPopup({})).toBe(true);
    expect(shouldShowPaymentSetupPopup({ paymentPromptDismissed: false })).toBe(true);
  });

  it('hides when stripe account exists or is active', () => {
    expect(shouldShowPaymentSetupPopup({ stripeAccountId: 'acct_123' })).toBe(false);
    expect(shouldShowPaymentSetupPopup({ stripeStatus: 'active' })).toBe(false);
  });

  it('hides when dismissed recently', () => {
    expect(
      shouldShowPaymentSetupPopup({
        paymentPromptDismissed: true,
        paymentPromptDismissedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('shows again when dismissed more than 30 days ago', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      shouldShowPaymentSetupPopup({
        paymentPromptDismissed: true,
        paymentPromptDismissedAt: old,
      }),
    ).toBe(true);
  });
});
