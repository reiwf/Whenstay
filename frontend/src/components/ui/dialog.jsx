import React, { createContext, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Dialog Context
const DialogContext = createContext();

// Dialog Root Component
export const Dialog = ({ children, open, onOpenChange, ...props }) => {
  const [isOpen, setIsOpen] = useState(open || false);

  useEffect(() => {
    setIsOpen(open || false);
  }, [open]);

  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  return (
    <DialogContext.Provider value={{ isOpen, onOpenChange: handleOpenChange }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => handleOpenChange(false)}
          />
          {/* Content Container */}
          <div className="relative z-50">
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

// Dialog Trigger Component
export const DialogTrigger = ({ children, ...props }) => {
  const { onOpenChange } = useContext(DialogContext);
  
  return (
    <div onClick={() => onOpenChange(true)} {...props}>
      {children}
    </div>
  );
};

// Dialog Content Component
export const DialogContent = ({ children, className = '', ...props }) => {
  const { isOpen, onOpenChange } = useContext(DialogContext);

  if (!isOpen) return null;

  return (
    <div 
      className={`
        relative bg-white rounded-lg shadow-xl border border-gray-200 
        max-w-md w-full mx-4 p-6 animate-in fade-in-50 
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <button
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
      {children}
    </div>
  );
};

// Dialog Header Component
export const DialogHeader = ({ children, className = '', ...props }) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props}>
    {children}
  </div>
);

// Dialog Title Component
export const DialogTitle = ({ children, className = '', ...props }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

// Dialog Description Component
export const DialogDescription = ({ children, className = '', ...props }) => (
  <p className={`text-sm text-gray-600 ${className}`} {...props}>
    {children}
  </p>
);

// Dialog Footer Component
export const DialogFooter = ({ children, className = '', ...props }) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`} {...props}>
    {children}
  </div>
);
