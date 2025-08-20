import React from 'react';
import { Calculator, Calendar, Users, Building } from 'lucide-react';

const PaymentBreakdown = ({ serviceDescriptor }) => {
  if (!serviceDescriptor) return null;

  const { 
    amount, 
    currency = 'JPY', 
    breakdown = [], 
    totalAmount,
    taxRate,
    metadata = {} 
  } = serviceDescriptor;

  // Format currency for display
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Service Details Card */}
      {metadata && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Building className="w-4 h-4 text-gray-600 mr-2" />
            <h4 className="font-medium text-gray-900">Stay Details</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
            
            {metadata.roomRate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Room Rate:</span>
                <span className="font-medium text-gray-900">{formatAmount(metadata.roomRate)}/night</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tax Calculation Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Calculator className="w-4 h-4 text-primary-600 mr-2" />
          <h4 className="font-medium text-gray-900">Tax Calculation</h4>
        </div>

        <div className="space-y-2">
          {breakdown.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{item.label}</span>
              <span className="font-medium text-gray-900">
                {item.amount ? formatAmount(item.amount) : item.value || '—'}
              </span>
            </div>
          ))}
          
          {taxRate && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Tax Rate (per person/night):</span>
              <span className="font-medium text-gray-900">{formatAmount(taxRate)}</span>
            </div>
          )}
          
          {breakdown.length > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total Tax Due:</span>
                <span className="font-bold text-lg text-primary-600">
                  {formatAmount(totalAmount || amount)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tax Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-blue-800 text-xs">
          <strong>About Accommodation Tax:</strong> This tax is collected by the local government 
          and helps fund tourism infrastructure and services in the area.
        </p>
      </div>
    </div>
  );
};

export default PaymentBreakdown;
