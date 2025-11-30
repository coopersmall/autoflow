/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { App } from '@web/components/App.tsx';
import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

function getRootElement(): HTMLElement {
  const elem = document.getElementById('root');
  if (!elem) {
    // biome-ignore lint: React entry point requires throwing for missing root element
    throw new Error('Root element not found');
  }
  return elem;
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const elem = getRootElement();
  if (!import.meta.hot.data.root) {
    // biome-ignore lint: Object assignment is intentional here
    import.meta.hot.data.root = createRoot(elem);
  }
  // biome-ignore lint: The hot module reloading API is typed as `any`
  const root = import.meta.hot.data.root as Root;
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  const elem = getRootElement();
  createRoot(elem).render(app);
}
