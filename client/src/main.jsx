import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { App } from './App.jsx';
import { missingConfig } from './lib/config.js';
import './styles.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function MissingConfig() {
  return (
    <main className="page config-error">
      <h1>Stash needs configuration</h1>
      <p>Set these variables in <code>client/.env</code>, then restart <code>npm run dev</code>:</p>
      <ul>{missingConfig.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
      <p>See the README for where to find each value in Auth0.</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {missingConfig.length ? (
      <MissingConfig />
    ) : (
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>
);
