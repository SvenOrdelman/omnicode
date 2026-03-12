import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './globals.css';

try {
  const persisted = window.localStorage.getItem('omnicode-ui-store');
  if (persisted) {
    const parsed = JSON.parse(persisted);
    const theme = parsed?.state?.theme;
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
} catch {
  document.documentElement.setAttribute('data-theme', 'dark');
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
