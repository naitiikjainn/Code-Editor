import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AppProvider } from './context/AppContext';
import App from './App.jsx';
import './index.css';

// GLOBAL ERROR TRAP
window.onerror = function (msg, url, lineNo, columnNo, error) {
  if (msg.includes("ResizeObserver loop")) return false; // Ignore benign resize errors
  const div = document.createElement("div");
  div.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:red; z-index:99999; padding:20px; font-family:monospace; white-space:pre-wrap; overflow:auto;";
  div.innerHTML = `<h1>CRITICAL ERROR TRAPPED</h1><h3>${msg}</h3><p>${url}:${lineNo}:${columnNo}</p><pre>${error?.stack || "No stack"}</pre>`;
  document.body.appendChild(div);
  return false;
};
window.onunhandledrejection = function (event) {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:orange; z-index:99999; padding:20px; font-family:monospace; white-space:pre-wrap; overflow:auto;";
    div.innerHTML = `<h1>UNHANDLED PROMISE REJECTION</h1><pre>${event.reason?.stack || event.reason}</pre>`;
    document.body.appendChild(div);
};

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