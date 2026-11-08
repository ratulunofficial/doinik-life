import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './index.css';
import App from './App';
import { boot } from './lib/boot';

document.documentElement.lang = localStorage.getItem('app_lang') === 'bn' ? 'bn' : 'en';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
);

void boot();

// The installable web app (PWA) uses a service worker. The desktop (Electron) and Android
// (Capacitor) apps already ship their files locally, so they skip it to avoid stale caches.
const isNativeShell = /Electron/i.test(navigator.userAgent) || !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
if (import.meta.env.PROD && !isNativeShell) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
