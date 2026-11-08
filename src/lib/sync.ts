// Write queue + local cache. Kept free of Firebase imports so the UI bundle
// stays small; firebase.ts plugs in the real writer once it has loaded.

import { useApp } from './store';

type Writer = (updates: Record<string, string | null>) => Promise<void>;

/** Edits not yet confirmed by the server (key → JSON string, or null = delete). */
export const pending = new Map<string, string | null>();
let writer: Writer | null = null;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let cacheTimer: ReturnType<typeof setTimeout> | undefined;

const CACHE_PREFIX = 'dl2_cache_v1:';
const PENDING_PREFIX = 'dl2_pending_v1:';

const username = () => useApp.getState().user?.username || useApp.getState().cachedUsername;

export function setWriter(w: Writer | null) {
  writer = w;
  if (w && pending.size) scheduleFlush(50);
}

function scheduleFlush(ms = 350) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

async function flush() {
  if (!writer || !pending.size) return;
  const updates: Record<string, string | null> = {};
  pending.forEach((v, k) => (updates[k] = v));
  useApp.setState({ status: 'syncing' });
  try {
    await writer(updates);
    // Only clear entries that were not edited again while we were writing.
    for (const [k, v] of Object.entries(updates)) if (pending.get(k) === v) pending.delete(k);
    useApp.setState({ status: 'online' });
  } catch (e) {
    console.warn('sync write failed', e);
    useApp.setState({ status: 'error' });
    scheduleFlush(4000);
  }
  persistPending();
}

function persistPending() {
  const u = username();
  if (!u) return;
  try {
    if (pending.size) localStorage.setItem(PENDING_PREFIX + u, JSON.stringify([...pending]));
    else localStorage.removeItem(PENDING_PREFIX + u);
  } catch {
    /* quota — ignore */
  }
}

/** Set one synced key (value already JSON-stringified) and queue it for upload. */
export function writeRaw(key: string, value: string | null) {
  const s = useApp.getState();
  const raw = { ...s.raw };
  if (value === null) delete raw[key];
  else raw[key] = value;
  useApp.setState({ raw });
  if (s.demo) return;
  pending.set(key, value);
  persistPending();
  scheduleFlush();
  scheduleCache();
}

function scheduleCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    const u = username();
    if (u) cacheSave(u, useApp.getState().raw);
  }, 900);
}

export function cacheSave(u: string, raw: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_PREFIX + u, JSON.stringify(raw));
  } catch {
    /* quota — ignore, Firebase still has everything */
  }
}

export function cacheLoad(u: string): Record<string, string> | null {
  try {
    const s = localStorage.getItem(CACHE_PREFIX + u);
    const p = localStorage.getItem(PENDING_PREFIX + u);
    if (p) {
      for (const [k, v] of JSON.parse(p) as [string, string | null][]) pending.set(k, v);
    }
    if (!s) return null;
    const raw = JSON.parse(s) as Record<string, string>;
    pending.forEach((v, k) => {
      if (v === null) delete raw[k];
      else raw[k] = v;
    });
    return raw;
  } catch {
    return null;
  }
}

export function clearLocal(u: string) {
  try {
    localStorage.removeItem(CACHE_PREFIX + u);
    localStorage.removeItem(PENDING_PREFIX + u);
  } catch {
    /* ignore */
  }
  pending.clear();
}

// Keep the cache warm when remote changes arrive.
useApp.subscribe((s, prev) => {
  if (s.raw !== prev.raw && s.remoteLoaded && !s.demo) scheduleCache();
});

// Try to push anything left over when the tab is hidden / closed.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending.size) void flush();
  });
}
