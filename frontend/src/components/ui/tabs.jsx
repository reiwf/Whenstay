import React, { createContext, useContext, useState } from 'react';

// Tabs Context
const TabsContext = createContext();

// Tabs Root Component
export const Tabs = ({ children, defaultValue, value, onValueChange, className = '', ...props }) => {
  const [activeTab, setActiveTab] = useState(value || defaultValue || '');

  const handleValueChange = (newValue) => {
    setActiveTab(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const currentValue = value !== undefined ? value : activeTab;

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={`w-full ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// Tabs List Component
export const TabsList = ({ children, className = '', ...props }) => (
  <div 
    className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 ${className}`} 
    {...props}
  >
    {children}
  </div>
);

// Tabs Trigger Component
export const TabsTrigger = ({ children, value, className = '', ...props }) => {
  const { value: currentValue, onValueChange } = useContext(TabsContext);
  const isActive = currentValue === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 
        text-sm font-medium ring-offset-background transition-all 
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
        focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
        ${isActive 
          ? 'bg-white text-gray-950 shadow-sm' 
          : 'hover:bg-gray-200 hover:text-gray-900'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

// Tabs Content Component
export const TabsContent = ({ children, value, className = '', ...props }) => {
  const { value: currentValue } = useContext(TabsContext);
  
  if (currentValue !== value) {
    return null;
  }

  return (
    <div 
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
