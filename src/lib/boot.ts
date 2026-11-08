import { refreshToday, useApp } from './store';
import { cacheLoad } from './sync';
import { ensureToday, purgeExpiredTempNotes, syncPermIntoToday } from './data';
import { initNative } from './native';

/**
 * Optimistic start: if this device has signed in before, paint the dashboard
 * from the local cache immediately, then let Firebase confirm the session and
 * stream in fresh data. No spinner on a normal open.
 */
export async function boot() {
  void initNative();
  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV && params.has('demo')) {
    const { startDemo } = await import('./demo');
    startDemo();
  } else {
    try {
      const u = localStorage.getItem('dl2_username');
      if (u) {
        const c = cacheLoad(u);
        useApp.setState({ cachedUsername: u, ...(c ? { raw: c } : {}) });
      }
    } catch {
      /* ignore */
    }
    const fb = await import('./firebase');
    fb.initAuth();
  }

  // Today's auto tasks + permanent tasks once real data is in.
  useApp.subscribe((s, prev) => {
    if ((s.remoteLoaded && !prev.remoteLoaded) || s.todayKey !== prev.todayKey) ensureToday();
    else if (s.remoteLoaded && s.raw.permanent_tasks !== prev.raw.permanent_tasks) syncPermIntoToday();
  });
  if (useApp.getState().remoteLoaded) ensureToday();

  setInterval(refreshToday, 30_000);
  setInterval(() => {
    if (useApp.getState().remoteLoaded || useApp.getState().demo) purgeExpiredTempNotes();
  }, 60_000);
}
