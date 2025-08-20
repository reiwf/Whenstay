import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export const useAccommodationTaxPayment = (guestToken) => {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [serviceDescriptor, setServiceDescriptor] = useState(null);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  // Fetch service descriptor (accommodation tax details)
  const fetchServiceDescriptor = useCallback(async () => {
    if (!guestToken) {
      setError('Guest token is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/upsell/service-descriptor?service=accommodation_tax&token=${guestToken}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch service descriptor');
      }

      setServiceDescriptor(data.data);
      return data.data;

    } catch (err) {
      console.error('Error fetching service descriptor:', err);
      setError(err.message);
      toast.error(`Failed to load tax information: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [guestToken]);

  // Fetch payment status
  const fetchPaymentStatus = useCallback(async () => {
    if (!guestToken) {
      setError('Guest token is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/upsell/status?service=accommodation_tax&token=${guestToken}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payment status');
      }

      setPaymentStatus(data.data);
      return data.data;

    } catch (err) {
      console.error('Error fetching payment status:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [guestToken]);

  // Create Stripe hosted checkout session
  const createCheckoutSession = useCallback(async () => {
    if (!guestToken) {
      setError('Guest token is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/upsell/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'accommodation_tax',
          token: guestToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.code === 'ALREADY_PAID') {
          toast.success('Tax already paid!');
          await fetchPaymentStatus(); // Refresh status
          return null;
        }
        if (data.code === 'PAYMENT_NOT_REQUIRED') {
          toast.info('Tax payment not required (exempted)');
          return null;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      return data.data;

    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err.message);
      toast.error(`Payment setup failed: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [guestToken, fetchPaymentStatus]);

  // Create payment intent (legacy method for compatibility)
  const createPaymentIntent = useCallback(async () => {
    if (!guestToken) {
      setError('Guest token is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/upsell/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'accommodation_tax',
          token: guestToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.code === 'ALREADY_PAID') {
          toast.success('Tax already paid!');
          await fetchPaymentStatus(); // Refresh status
          return null;
        }
        if (data.code === 'PAYMENT_NOT_REQUIRED') {
          toast.info('Tax payment not required (exempted)');
          return null;
        }
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setClientSecret(data.data.clientSecret);
      return data.data;

    } catch (err) {
      console.error('Error creating payment intent:', err);
      setError(err.message);
      toast.error(`Payment setup failed: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [guestToken, fetchPaymentStatus]);


  // Force refresh payment status with retry logic
  const forceRefreshStatus = useCallback(async (maxRetries = 3, initialDelay = 1000) => {
    if (!guestToken) {
      setError('Guest token is required');
      return false;
    }

    const attemptRefresh = async (attempt = 1) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/upsell/status?service=accommodation_tax&token=${guestToken}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch payment status');
        }

        setPaymentStatus(data.data);

        // If payment is successful, return true to stop retries
        if (data.data?.status === 'paid') {
          return true;
        }

        // If not paid and we have retries left, wait and retry
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return await attemptRefresh(attempt + 1);
        }

        return false; // Max retries reached without success

      } catch (err) {
        console.error(`Payment status refresh attempt ${attempt}:`, err);
        
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await attemptRefresh(attempt + 1);
        }
        
        setError(`Failed to refresh status: ${err.message}`);
        return false;
      } finally {
        if (attempt === maxRetries) {
          setLoading(false);
        }
      }
    };

    return await attemptRefresh();
  }, [guestToken]);

  // Reset payment state
  const resetPayment = useCallback(() => {
    setError(null);
    setClientSecret(null);
    setPaymentStatus(null);
  }, []);

  return {
    // State
    loading,
    error,
    serviceDescriptor,
    paymentStatus,
    clientSecret,
    
    // Actions
    fetchServiceDescriptor,
    fetchPaymentStatus,
    forceRefreshStatus,
    createCheckoutSession,
    createPaymentIntent,
    resetPayment,
    
    // Computed
    isPaymentRequired: serviceDescriptor?.status === 'pending' && serviceDescriptor?.amount > 0,
    isExempted: serviceDescriptor?.status === 'exempted',
    isPaid: paymentStatus?.status === 'paid',
  };
};

export default useAccommodationTaxPayment;
