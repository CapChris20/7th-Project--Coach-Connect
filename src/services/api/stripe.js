import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

// Stripe configuration
const publishableKey = Constants.expoConfig?.extra?.stripePublishableKey || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Initialize Stripe
export const initializeStripe = () => {
  try {
    if (!publishableKey) {
      throw new Error('Stripe publishable key is required');
    }
    
    console.log('Stripe initialized successfully');
    return publishableKey;
  } catch (error) {
    console.error('Stripe initialization error:', error);
    throw new Error('Failed to initialize Stripe');
  }
};

// Create payment intent
export const createPaymentIntent = async (amount, currency = 'usd') => {
  try {
    console.log('Creating payment intent for amount:', amount);
    
    // This would typically call your backend API
    const response = await fetch('https://your-backend.com/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to cents
        currency: currency,
      }),
    });
    
    const { clientSecret } = await response.json();
    console.log('Payment intent created successfully');
    
    return { success: true, clientSecret };
  } catch (error) {
    console.error('Create payment intent error:', error);
    return { success: false, error: error.message };
  }
};

// Process payment
export const processPayment = async (paymentIntentId) => {
  try {
    console.log('Processing payment for intent:', paymentIntentId);
    
    const response = await fetch('https://your-backend.com/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId,
      }),
    });
    
    const result = await response.json();
    console.log('Payment processed successfully');
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Process payment error:', error);
    return { success: false, error: error.message };
  }
};

// Create subscription
export const createSubscription = async (priceId, customerId) => {
  try {
    console.log('Creating subscription for price:', priceId);
    
    const response = await fetch('https://your-backend.com/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: priceId,
        customerId: customerId,
      }),
    });
    
    const { subscriptionId, clientSecret } = await response.json();
    console.log('Subscription created successfully');
    
    return { success: true, subscriptionId, clientSecret };
  } catch (error) {
    console.error('Create subscription error:', error);
    return { success: false, error: error.message };
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    console.log('Cancelling subscription:', subscriptionId);
    
    const response = await fetch('https://your-backend.com/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: subscriptionId,
      }),
    });
    
    const result = await response.json();
    console.log('Subscription cancelled successfully');
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return { success: false, error: error.message };
  }
};

// Get subscription status
export const getSubscriptionStatus = async (customerId) => {
  try {
    console.log('Getting subscription status for customer:', customerId);
    
    const response = await fetch(`https://your-backend.com/subscription-status/${customerId}`);
    const result = await response.json();
    
    console.log('Subscription status retrieved');
    return { success: true, data: result };
  } catch (error) {
    console.error('Get subscription status error:', error);
    return { success: false, error: error.message };
  }
};


