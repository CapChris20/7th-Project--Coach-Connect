/** Shared Stripe SDK instance for Connect + client charges. */
const Stripe = require('stripe');

let stripeInstance = null;

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  }
  return stripeInstance;
}

function stripeNotConfiguredError() {
  const err = new Error('Stripe is not cloudConnectionured on the server');
  err.code = 'stripe_not_cloudConnectionured';
  return err;
}

module.exports = { getStripe, stripeNotConfiguredError };
