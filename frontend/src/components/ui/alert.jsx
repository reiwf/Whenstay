import React from 'react';

// Alert Root Component
export const Alert = ({ children, variant = 'default', className = '', ...props }) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return 'border-red-200 bg-red-50 text-red-900';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-900';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-900';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-900';
    }
  };

  return (
    <div 
      className={`
        relative w-full rounded-lg border p-4 
        ${getVariantClasses()}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

// Alert Description Component
export const AlertDescription = ({ children, className = '', ...props }) => (
  <div className={`text-sm ${className}`} {...props}>
    {children}
  </div>
);

// Alert Title Component
export const AlertTitle = ({ children, className = '', ...props }) => (
  <h5 className={`mb-1 font-medium leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h5>
);
