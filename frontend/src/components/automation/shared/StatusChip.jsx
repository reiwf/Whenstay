import React from 'react';

const statusStyles = {
  enabled: 'bg-green-100 text-green-800 border-green-200',
  disabled: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  processing: 'bg-purple-100 text-purple-800 border-purple-200',
  canceled: 'bg-gray-100 text-gray-800 border-gray-200',
  skipped: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function StatusChip({ status, className = '' }) {
  const styles = statusStyles[status] || statusStyles.disabled;
  
  return (
    <span 
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold 
        border ${styles} ${className}
      `}
    >
      {status}
    </span>
  );
}
