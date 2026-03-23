import React, { createContext, useContext, useState } from 'react';

// Create the context
const SiderContext = createContext();

// Context provider component
export const SiderProvider = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [siderWidth, setSiderWidth] = useState(200);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const value = {
    collapsed,
    setCollapsed,
    siderWidth,
    setSiderWidth,
    toggleCollapsed,
  };

  return (
    <SiderContext.Provider value={value}>
      {children}
    </SiderContext.Provider>
  );
};

// Custom hook to use the context
export const useSider = () => {
  const context = useContext(SiderContext);
  if (!context) {
    throw new Error('useSider must be used within a SiderProvider');
  }
  return context;
};

// Export the context for direct use if needed
export { SiderContext };
