const { shouldShowPaymentSetupPopup } = require('../../shared/payments/paymentSetupPrompt');

describe('shouldShowPaymentSetupPopup', () => {
  it('hides when no account timestamps (avoid login spam)', () => {
    expect(shouldShowPaymentSetupPopup({})).toBe(false);
    expect(shouldShowPaymentSetupPopup({ paymentPromptDismissed: false })).toBe(false);
  });

  it('shows for recent onboarded trainers without Stripe', () => {
    expect(
      shouldShowPaymentSetupPopup({
        onboardingCompletedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('hides when stripe account exists or is active', () => {
    expect(
      shouldShowPaymentSetupPopup({
        onboardingCompletedAt: new Date().toISOString(),
        stripeAccountId: 'acct_123',
      }),
    ).toBe(false);
    expect(
      shouldShowPaymentSetupPopup({
        onboardingCompletedAt: new Date().toISOString(),
        stripeStatus: 'active',
      }),
    ).toBe(false);
  });

  it('hides when dismissed recently', () => {
    expect(
      shouldShowPaymentSetupPopup({
        onboardingCompletedAt: new Date().toISOString(),
        paymentPromptDismissed: true,
        paymentPromptDismissedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('shows again when dismissed more than 30 days ago', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      shouldShowPaymentSetupPopup({
        onboardingCompletedAt: new Date().toISOString(),
        paymentPromptDismissed: true,
        paymentPromptDismissedAt: old,
      }),
    ).toBe(true);
  });

  it('hides for accounts older than 7 days that never dismissed', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldShowPaymentSetupPopup({ createdAt: old })).toBe(false);
  });
});
