import { create } from 'zustand';
import type { AppUser, Lang, SyncStatus } from './types';
import { dateKey, startOfToday } from './dates';

export type Tab = 'cal' | 'tasks' | 'track' | 'orders' | 'expense' | 'bazar';

export interface Toast {
  id: number;
  msg: string;
}

export interface ConfirmReq {
  title: string;
  message?: string;
  okText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export type ModalReq =
  | { type: 'perm' }
  | { type: 'note'; id?: string; edit?: boolean }
  | { type: 'temp'; id?: string }
  | { type: 'emailFilter' }
  | { type: 'account' }
  | { type: 'settle'; loanId: number }
  | { type: 'addMore'; loanId: number }
  | { type: 'order'; index: number }
  | { type: 'username'; suggested: string; resolve: (name: string) => void };

interface AppState {
  // ── session ──
  lang: Lang;
  user: AppUser | null;
  /** username known from cache before Firebase confirms the session */
  cachedUsername: string;
  authChecked: boolean;
  status: SyncStatus;
  ordersEnabled: boolean;
  demo: boolean;

  // ── data (mirror of users/<username>) ──
  raw: Record<string, string>;
  /** true once the first remote snapshot has been merged */
  remoteLoaded: boolean;

  // ── ui ──
  todayKey: string;
  selectedKey: string;
  calY: number;
  calM: number;
  tab: Tab;
  tabDir: number;
  desktopOrders: boolean;
  toasts: Toast[];
  modal: ModalReq | null;
  confirmReq: ConfirmReq | null;
}

const today = startOfToday();
const savedLang = (() => {
  try {
    return (localStorage.getItem('app_lang') as Lang) || 'en'; // same default as the original app
  } catch {
    return 'en' as Lang;
  }
})();

export const useApp = create<AppState>(() => ({
  lang: savedLang === 'bn' ? 'bn' : 'en',
  user: null,
  cachedUsername: '',
  authChecked: false,
  status: 'offline',
  ordersEnabled: (() => {
    try {
      return localStorage.getItem('dl2_orders_enabled') !== '0';
    } catch {
      return true;
    }
  })(),
  demo: false,
  raw: {},
  remoteLoaded: false,
  todayKey: dateKey(today),
  selectedKey: dateKey(today),
  calY: today.getFullYear(),
  calM: today.getMonth(),
  tab: 'cal',
  tabDir: 0,
  desktopOrders: false,
  toasts: [],
  modal: null,
  confirmReq: null
}));

const set = useApp.setState;
const get = useApp.getState;

// ── language ──
export function setLang(lang: Lang) {
  try {
    localStorage.setItem('app_lang', lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
  set({ lang });
}
export const useLang = () => useApp((s) => s.lang);
/** Bilingual text helper: L('বাংলা', 'English'). */
export function useL() {
  const lang = useLang();
  return (bn: string, en: string) => (lang === 'en' ? en : bn);
}
export const L = (bn: string, en: string) => (get().lang === 'en' ? en : bn);

// ── toasts ──
let toastSeq = 0;
export function toast(msg: string, ms = 2400) {
  const id = ++toastSeq;
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, msg }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

// ── modals ──
export const openModal = (m: ModalReq) => set({ modal: m });
export const closeModal = () => set({ modal: null });
export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => set({ confirmReq: { ...opts, resolve } }));
}
export function settleConfirm(ok: boolean) {
  const r = get().confirmReq;
  set({ confirmReq: null });
  r?.resolve(ok);
}

// ── navigation ──
const TAB_ORDER: Tab[] = ['cal', 'tasks', 'track', 'orders', 'expense', 'bazar'];
export function setTab(tab: Tab) {
  const cur = get().tab;
  if (cur === tab) return;
  set({ tab, tabDir: TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(cur) ? 1 : -1 });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
export function stepTab(dir: 1 | -1) {
  const s = get();
  const order = TAB_ORDER.filter((t) => t !== 'orders' || s.ordersEnabled);
  const i = order.indexOf(s.tab);
  const next = order[i + dir];
  if (next) setTab(next);
}
export function selectDay(key: string) {
  set({ selectedKey: key });
}
export function shiftMonth(dir: number) {
  const s = get();
  const d = new Date(s.calY, s.calM + dir, 1);
  set({ calY: d.getFullYear(), calM: d.getMonth() });
}

// Roll "today" over at midnight while the app stays open.
export function refreshToday() {
  const k = dateKey(startOfToday());
  const s = get();
  if (k !== s.todayKey) {
    const wasOnToday = s.selectedKey === s.todayKey;
    set({ todayKey: k, ...(wasOnToday ? { selectedKey: k } : {}) });
  }
}
