import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import { brand } from './tokens';

const Desktop = lazy(() => import('./DesktopPrototype'));
const Mobile = lazy(() => import('./MobilePrototype'));
const params = new URLSearchParams(location.search);
const variant = params.get('variant') === 'b' ? 'b' : 'a';
const view = params.get('view') || 'dashboard';
document.documentElement.style.fontSize = params.get('font') === '150' ? '24px' : '16px';
document.documentElement.dataset.variant = variant;
for (const [name, value] of Object.entries(brand)) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="evergreen" data-variant={variant}>
      <Suspense
        fallback={
          <p role="status" className="preview-loading">
            正在打开绿色工作台…
          </p>
        }
      >
        {view === 'requests' || view === 'conflict' ? (
          <Mobile view={view} />
        ) : (
          <Desktop variant={variant} />
        )}
      </Suspense>
    </div>
  </React.StrictMode>,
);
