import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

// Case A Google Maps Demo Key Quota Exhaustion Listeners
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new Event('gmp-quota-exceeded'));
  };

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args
      .map((a) => (typeof a === 'string' ? a : ''))
      .join(' ');
    if (/OverQuotaMapError|QuotaExceededError|You have exceeded your request quota/i.test(msg)) {
      window.dispatchEvent(new Event('gmp-quota-exceeded'));
    }
    originalConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
