/** Shared payment clarity copy — trainers get 90%, platform keeps 10%. */

export const TRAINER_PAYOUT_SHARE = 0.9;
export const PLATFORM_FEE_RATE = 0.1;

export function trainerGetsFromAmount(amountDollars) {
  const n = Number(amountDollars);
  if (!Number.isFinite(n)) return 0;
  return n * TRAINER_PAYOUT_SHARE;
}

export function platformFeeFromAmount(amountDollars) {
  const n = Number(amountDollars);
  if (!Number.isFinite(n)) return 0;
  return n * PLATFORM_FEE_RATE;
}

export function formatPaymentDollars(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

export const HOW_PAYMENTS_WORK = [
  'Clients pay you in the app (secure Stripe checkout)',
  'You keep 90% of each payment ($90 per $100)',
  'Coach Connect keeps 10% to run the platform ($10 per $100)',
  'Money deposits to your bank in 2–5 business days',
  'Every payment shows in your Earnings & payouts dashboard',
];

export const VENMO_VS_COACHCONNECT = {
  venmo: [
    'You get: $100 (full amount, but you track everything yourself)',
    'Payouts: Manual transfer to your bank',
    'Records: Scattered in Venmo threads',
    'Taxes: You export and reconcile manually',
  ],
  coachConnect: [
    'You get: $90 per $100 (automatic, tracked)',
    'Payouts: Automatic bank deposits via Stripe',
    'Records: Dashboard history — always there',
    'Taxes: Clear export-friendly history for your accountant',
  ],
};

export const TRAINER_CLIENT_PAYMENT_FAQ = {
  question: 'Should I tell clients to pay via Venmo or Coach Connect?',
  answer:
    'Use Coach Connect. It is easier for clients, clearer for you, and every payment is saved for taxes and disputes.',
};

export const TRAINER_CLIENT_MESSAGE_RECOMMENDED =
  'Pay me through Coach Connect for secure, instant tracking. Tap Pay on my profile or in the app — your receipt is saved automatically.';

export const TRAINER_CLIENT_MESSAGE_VENMO_WARNING =
  'Venmo payments will not appear in Coach Connect. You will miss earnings history, automatic payouts, and professional records.';

export const PAYMENTS_FAQ_ITEMS = [
  {
    question: 'Why not just use Venmo?',
    answer:
      'You can, but Coach Connect offers automatic bank deposits, clear payment history for taxes, professional records, and client accountability — so payments do not get lost or forgotten.',
  },
  {
    question: 'Do I have to use Coach Connect payments?',
    answer:
      'No, but you lose automatic payouts and clear records that make running a coaching business easier.',
  },
  {
    question: 'Can clients pay extra to use Venmo?',
    answer:
      'They can ask, but we recommend in-app payments for both of you — less confusion and better records.',
  },
  {
    question: 'How much do trainers earn per payment?',
    answer:
      'You receive 90% of each in-app payment. Coach Connect keeps a 10% platform fee. Payouts typically reach your bank in 2–5 business days after Stripe processes them.',
  },
  {
    question: 'Is a one-time payment different from my Pro subscription?',
    answer:
      'Yes. Client coaching payments are one-time charges from clients to you. Coach Connect Pro is a separate monthly subscription for trainer platform features — not the same as client pay.',
  },
];

export const EARNINGS_MOCK = {
  pendingLabel: '$450 pending',
  nextPayout: 'Monday',
  transactions: [
    { date: 'Oct 22', name: 'Sarah M.', amount: 100, status: 'Completed' },
    { date: 'Oct 18', name: 'Mike T.', amount: 150, status: 'Completed' },
    { date: 'Oct 15', name: 'Alex R.', amount: 100, status: 'Pending' },
  ],
};
