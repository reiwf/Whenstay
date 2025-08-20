import React, { createContext, useContext, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const PaymentContext = createContext();

// Initialize Stripe only if publishable key is available
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

// Log warning if Stripe key is missing
if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('⚠️ Stripe publishable key is missing. Add VITE_STRIPE_PUBLISHABLE_KEY to your environment variables.');
}

export const PaymentProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const value = {
    stripePromise,
    loading,
    setLoading,
    error,
    setError,
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export default PaymentContext;
