import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import './styles/responsive.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(28,17,50,0.96)',
            color: '#f0e6d3',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 12,
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 13.5,
            boxShadow: '0 12px 36px rgba(15,10,30,0.6)',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#d4af37', secondary: '#1c1132' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
