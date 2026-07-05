import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './app/router';
import { ErrorBoundary } from './app/ErrorBoundary';
import { installGlobalErrorReporting } from './lib/errorReporting';
import './index.css';
import { db } from './lib/db';
import { repos } from './services';

installGlobalErrorReporting();

// Dev/e2e handle for seeding the local store and inspecting sync state
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__clinicos = { db, repos };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>
);
