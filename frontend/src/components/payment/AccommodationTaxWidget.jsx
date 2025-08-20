import React, { useState, useEffect } from 'react';
import useAccommodationTaxPayment from '../../hooks/usePayment';
import LoadingSpinner from '../LoadingSpinner';
import PaymentBreakdown from './PaymentBreakdown';
import PaymentSuccessCard from './PaymentSuccessCard';
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Banknote,
  ExternalLink
} from 'lucide-react';

const AccommodationTaxWidget = ({ guestToken, refreshTrigger }) => {
  const {
    loading,
    error,
    serviceDescriptor,
    paymentStatus,
    fetchServiceDescriptor,
    fetchPaymentStatus,
    forceRefreshStatus,
    createCheckoutSession,
    isPaymentRequired,
    isExempted,
    isPaid
  } = useAccommodationTaxPayment(guestToken);

  // Load initial data
  useEffect(() => {
    if (guestToken) {
      fetchServiceDescriptor();
      fetchPaymentStatus();
    }
  }, [guestToken, fetchServiceDescriptor, fetchPaymentStatus]);

  // Handle external refresh triggers (e.g., from payment return)
  useEffect(() => {
    if (refreshTrigger && guestToken) {
      const handleRefresh = async () => {
        // Force refresh status with retry logic
        const success = await forceRefreshStatus();
        if (success) {
          // Also refresh service descriptor to ensure consistency
          fetchServiceDescriptor();
        }
      };
      handleRefresh();
    }
  }, [refreshTrigger, guestToken, forceRefreshStatus, fetchServiceDescriptor]);

  // Handle start payment - redirect to Stripe hosted checkout
  const handleStartPayment = async () => {
    try {
      const checkoutSession = await createCheckoutSession();
      if (checkoutSession && checkoutSession.checkoutUrl) {
        // Redirect to Stripe's hosted checkout page
        window.location.href = checkoutSession.checkoutUrl;
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err);
    }
  };

  // Loading state
  if (loading && !serviceDescriptor) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !serviceDescriptor) {
    return (
      <div className="card border-red-200 bg-red-50">
        <div className="flex items-center mb-4">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-lg font-semibold text-red-900">Error Loading Tax Information</h3>
        </div>
        <p className="text-red-800 mb-4">{error}</p>
        <button 
          onClick={() => {
            fetchServiceDescriptor();
            fetchPaymentStatus();
          }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No service descriptor (shouldn't happen after loading)
  if (!serviceDescriptor) {
    return (
      <div className="card">
        <div className="flex items-center">
          <Info className="w-5 h-5 text-gray-400 mr-2" />
          <p className="text-gray-600">No tax information available</p>
        </div>
      </div>
    );
  }

  // Payment already completed - check both serviceDescriptor status and paymentStatus
  if (isPaid || serviceDescriptor?.status === 'paid') {
    console.log('AccommodationTaxWidget: Tax is paid, showing success card', { 
      isPaid, 
      serviceDescriptorStatus: serviceDescriptor?.status,
      paymentStatusStatus: paymentStatus?.status 
    });
    return <PaymentSuccessCard paymentStatus={paymentStatus} serviceDescriptor={serviceDescriptor} />;
  }

  // Tax exempt
  if (isExempted) {
    return (
      <div className="card border-green-200 bg-green-50">
        <div className="flex items-center mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-green-900">
            {serviceDescriptor.title}
          </h3>
        </div>
        
        <div className="space-y-3">
          <div className="bg-white border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">✅ Tax Exempt</p>
            <p className="text-green-700 text-sm mt-1">
              {serviceDescriptor.breakdown?.[0]?.label || 'No accommodation tax required'}
            </p>
            {serviceDescriptor.exemptReason && (
              <p className="text-green-600 text-sm mt-2">
                {serviceDescriptor.exemptReason}
              </p>
            )}
          </div>

          <div className="bg-white border border-green-200 rounded-lg p-3">
            <p className="text-green-800 text-sm">
              <Info className="w-4 h-4 inline mr-1" />
              {serviceDescriptor.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Payment required - show payment form or payment button
  return (
    <div className="card">
      <div className="flex items-center mb-4">
        <Banknote className="w-5 h-5 text-primary-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">
          {serviceDescriptor.title}
        </h3>
      </div>

      {/* Payment breakdown */}
      <PaymentBreakdown serviceDescriptor={serviceDescriptor} />

      {/* Stripe Hosted Checkout */}
      <div className="mt-6 space-y-4">
        {/* Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <Info className="w-4 h-4 inline mr-1" />
            {serviceDescriptor.description}
          </p>
          {serviceDescriptor.rateInfo && (
            <p className="text-blue-700 text-sm mt-2">
              {serviceDescriptor.rateInfo}
            </p>
          )}
        </div>

        {/* Secure Payment Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-gray-700 text-sm flex items-center">
            <ExternalLink className="w-4 h-4 mr-2 text-gray-500" />
            You will be redirected to Stripe's secure payment page to complete your transaction.
          </p>
        </div>

        {/* Payment button */}
        <button 
          onClick={handleStartPayment}
          disabled={loading}
          className="w-full bg-primary-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {loading ? (
            <LoadingSpinner size="small" className="mr-2" />
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              <ExternalLink className="w-4 h-4 ml-2" />
            </>
          )}
          {loading ? 'Creating checkout session...' : `Pay ¥${serviceDescriptor.amount.toLocaleString()}`}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccommodationTaxWidget;
