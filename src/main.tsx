import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';
import './styles/responsive.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-toast-bg)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-hover)',
              borderRadius: 12,
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 13.5,
              boxShadow: 'var(--eb-shadow)',
              backdropFilter: 'blur(12px)',
            },
            success: { iconTheme: { primary: 'var(--color-gold-primary)', secondary: 'var(--color-bg-overlay)' } },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
