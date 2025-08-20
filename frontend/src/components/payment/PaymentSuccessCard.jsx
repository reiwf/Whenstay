import React from 'react';
import { CheckCircle, Receipt, Download, Calendar, Users, Building } from 'lucide-react';

const PaymentSuccessCard = ({ paymentStatus, serviceDescriptor }) => {
  if (!paymentStatus) return null;

  const {
    amount,
    currency = 'JPY',
    payment_method,
    created_at,
    stripe_payment_intent_id,
    metadata = {}
  } = paymentStatus;

  // Format currency for display
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error, 'dateString:', dateString);
      return 'N/A';
    }
  };

  // Format payment method for display
  const getPaymentMethodDisplay = (type) => {
    if (!type) return 'Card Payment';
    
    switch (type) {
      case 'card':
        return 'Credit/Debit Card';
      case 'konbini':
        return 'Convenience Store';
      case 'bank_transfer':
        return 'Bank Transfer';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="card border-green-200 bg-green-50">
      {/* Success Header */}
      <div className="flex items-center mb-6">
        <div className="bg-green-500 rounded-full p-2 mr-3">
          <CheckCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-900">
            Payment Successful!
          </h3>
          <p className="text-green-700 text-sm">
            Your accommodation tax has been paid
          </p>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center mb-3">
          <Receipt className="w-4 h-4 text-green-600 mr-2" />
          <h4 className="font-medium text-gray-900">Payment Summary</h4>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Service:</span>
            <span className="font-medium text-gray-900">
              {serviceDescriptor?.title || 'Accommodation Tax'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-bold text-green-600">{formatAmount(amount)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Method:</span>
            <span className="font-medium text-gray-900">
              {getPaymentMethodDisplay(payment_method)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span className="font-medium text-gray-900">
              {formatDate(created_at)}
            </span>
          </div>
          
          {stripe_payment_intent_id && (
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-mono text-xs text-gray-700">
                {stripe_payment_intent_id.slice(-8)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stay Details */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-3">
            <Building className="w-4 h-4 text-green-600 mr-2" />
            <h4 className="font-medium text-gray-900">Stay Details</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {metadata.propertyName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Property:</span>
                <span className="font-medium text-gray-900">{metadata.propertyName}</span>
              </div>
            )}
            
            {metadata.nights && (
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Nights:
                </span>
                <span className="font-medium text-gray-900">{metadata.nights}</span>
              </div>
            )}
            
            {metadata.guests && (
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  Guests:
                </span>
                <span className="font-medium text-gray-900">{metadata.guests}</span>
              </div>
            )}
            
            {metadata.checkInDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium text-gray-900">
                  {new Date(metadata.checkInDate).toLocaleDateString('ja-JP')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Actions */}
      <div className="space-y-3">
        <div className="bg-white border border-green-200 rounded-lg p-3">
          <p className="text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Your payment receipt will be sent to your email address.
          </p>
        </div>

        <button className="w-full bg-white border border-green-300 text-green-700 font-medium py-2 px-4 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center">
          <Download className="w-4 h-4 mr-2" />
          Download Receipt
        </button>
      </div>

      {/* Next Steps */}
      <div className="mt-4 pt-4 border-t border-green-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-800 text-sm">
            <strong>Next Steps:</strong> Your accommodation tax payment is complete. 
            You can now proceed with your check-in process or contact the property if you need assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessCard;
