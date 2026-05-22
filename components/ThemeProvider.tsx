// components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'neo', setTheme: (t: string) => {} });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState('neo');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'neo';
    setThemeState(savedTheme);
  }, []);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.remove('dark', 'neo');
    document.documentElement.classList.add(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);