// Web stub for @stripe/stripe-react-native so Expo web can bundle for screenshots.
// Used only via tools/screenshots metro overlay — not shipped in the app.

const React = require('react');
const { View, Text } = require('react-native');

function Stub(props) {
  return React.createElement(
    View,
    props,
    React.createElement(Text, null, 'Stripe native UI unavailable on web'),
  );
}

module.exports = {
  StripeProvider: ({ children }) => children || null,
  CardField: Stub,
  CardForm: Stub,
  AuBECSDebitForm: Stub,
  useStripe: () => ({
    createPaymentMethod: async () => ({ error: { message: 'web-stub' } }),
    confirmPayment: async () => ({ error: { message: 'web-stub' } }),
    handleNextAction: async () => ({ error: { message: 'web-stub' } }),
  }),
  useConfirmPayment: () => [{}, { loading: false }],
  usePaymentSheet: () => ({
    initPaymentSheet: async () => ({ error: null }),
    presentPaymentSheet: async () => ({ error: { message: 'web-stub' } }),
  }),
  initStripe: async () => {},
  isPlatformPaySupported: async () => false,
  presentApplePay: async () => {},
  presentGooglePay: async () => {},
  createToken: async () => ({ error: { message: 'web-stub' } }),
};
