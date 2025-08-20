import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, X, AlertCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';

const StripePaymentForm = ({ 
  guestToken, 
  onSuccess, 
  onCancel, 
  loading: externalLoading = false 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLoading = isSubmitting || externalLoading;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe not loaded');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/guest/checkin`,
        },
        redirect: 'if_required'
      });

      if (error) {
        // Payment failed
        const errorMsg = error.message || 'Payment failed. Please check your payment details and try again.';
        setErrorMessage(errorMsg);
        toast.error(`Payment failed: ${errorMsg}`);
      } else if (paymentIntent) {
        // Payment succeeded
        if (paymentIntent.status === 'succeeded') {
          // Payment completed immediately
          toast.success('Payment completed successfully!');
          onSuccess?.(paymentIntent);
        } else if (paymentIntent.status === 'processing') {
          // Payment is being processed (e.g., bank transfers)
          toast.success('Payment is being processed!');
          onSuccess?.(paymentIntent);
        } else if (paymentIntent.status === 'requires_action') {
          // 3D Secure or other authentication required
          // This should be handled by Stripe automatically
          console.log('Payment requires additional authentication');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      const errorMsg = 'An unexpected error occurred. Please try again.';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <CreditCard className="w-5 h-5 text-primary-600 mr-2" />
          <h4 className="text-lg font-semibold text-gray-900">Payment Details</h4>
        </div>
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Stripe Payment Element */}
        <div className="min-h-[60px]">
          <PaymentElement 
            options={{
              layout: 'tabs',
              defaultValues: {
                billingDetails: {
                  // Could be populated from guest info if available
                }
              }
            }}
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-red-800 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Security Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center text-sm text-gray-600">
            <Shield className="w-4 h-4 mr-2 text-green-600" />
            <span>Secure payment powered by Stripe. Your payment information is encrypted and safe.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={!stripe || !elements || isLoading}
            className="flex-1 bg-primary-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay Now
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 sm:flex-none bg-white border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Payment Methods Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          We accept Visa, Mastercard, American Express, and other local payment methods.
        </p>
      </div>
    </div>
  );
};

export default StripePaymentForm;
