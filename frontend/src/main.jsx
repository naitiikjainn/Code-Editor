import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AppProvider } from './context/AppContext';
import App from './App.jsx';
import './index.css';

// DEV-ONLY: Log unhandled errors to console (no blocking UI overlays)
if (import.meta.env.DEV) {
  window.onerror = function (msg, url, lineNo, columnNo, error) {
    if (msg.includes("ResizeObserver loop")) return false;
    console.error(`[DEV ERROR] ${msg}\n${url}:${lineNo}:${columnNo}\n`, error);
    return false;
  };
  window.onunhandledrejection = function (event) {
    console.error("[DEV UNHANDLED REJECTION]", event.reason);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
      {/* Only show devtools in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />}
    </QueryClientProvider>
  </React.StrictMode>,
);