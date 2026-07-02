import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './app/router';
import './index.css';
import { db } from './lib/db';
import { repos } from './services';

// Dev/e2e handle for seeding the local store and inspecting sync state
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__clinicos = { db, repos };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
