// Domain logic — a faithful port of the original app's rules, operating on the
// shared raw store. Every mutation goes through writeRaw() → granular sync.

import { useApp, toast, L } from './store';
import { writeRaw } from './sync';
import { addDays, dateKey, keyToDate } from './dates';
import type { BazarItem, DayData, Expense, Loan, MoodData, Note, Order, PermTask, Task } from './types';

// ─────────────────────────── parsing with identity cache ───────────────────────────
const cache = new Map<string, { src: string; val: unknown }>();
const EMPTY: unknown[] = [];
const EMPTY_OBJ = {};

function parseRaw<T>(raw: Record<string, string>, key: string, fallback: T): T {
  const src = raw[key];
  if (src == null) return fallback;
  const hit = cache.get(key);
  if (hit && hit.src === src) return hit.val as T;
  let val: unknown;
  try {
    val = JSON.parse(src);
  } catch {
    val = fallback;
  }
  if (val == null) val = fallback;
  cache.set(key, { src, val });
  return val as T;
}
const R = () => useApp.getState().raw;
const w = (key: string, v: unknown) => writeRaw(key, JSON.stringify(v));

export const getDay = (key: string, raw = R()) => parseRaw<DayData | null>(raw, 'day_' + key, null);
export const getLoans = (raw = R()) => parseRaw<Loan[]>(raw, 'loans_data', EMPTY as Loan[]);
export const getMood = (raw = R()) => parseRaw<MoodData>(raw, 'mood_data', EMPTY_OBJ as MoodData);
export const getBazar = (raw = R()) => parseRaw<BazarItem[]>(raw, 'bazar_data', EMPTY as BazarItem[]);
export const getPerm = (raw = R()) => {
  const v = parseRaw<PermTask[]>(raw, 'permanent_tasks', EMPTY as PermTask[]);
  return Array.isArray(v) ? v : (EMPTY as PermTask[]);
};
export const getNotes = (raw = R()) => parseRaw<Note[]>(raw, 'notes_data', EMPTY as Note[]);
export const getOrders = (raw = R()) => {
  const v = parseRaw<Order[]>(raw, 'orders_data', EMPTY as Order[]);
  return Array.isArray(v) ? v : (EMPTY as Order[]);
};
export const getWaterGoal = (raw = R()) => {
  const n = parseInt(raw.waterGoal ?? '8', 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
};

// ── hooks (re-render only when that key's string changes) ──
export const useDay = (key: string) => useApp((s) => getDay(key, s.raw));
export const useLoans = () => useApp((s) => getLoans(s.raw));
export const useMood = () => useApp((s) => getMood(s.raw));
export const useBazar = () => useApp((s) => getBazar(s.raw));
export const usePerm = () => useApp((s) => getPerm(s.raw));
export const useNotes = () => useApp((s) => getNotes(s.raw));
export const useOrders = () => useApp((s) => getOrders(s.raw));
export const useWaterGoal = () => useApp((s) => getWaterGoal(s.raw));

const emptyDay = (): DayData => ({ tasks: [], water: 0, expenses: [] });
const cloneDay = (key: string): DayData => {
  const d = getDay(key);
  return d ? { ...d, tasks: [...(d.tasks || [])], expenses: [...(d.expenses || [])], water: d.water || 0 } : emptyDay();
};
const setDay = (key: string, d: DayData) => w('day_' + key, d);
const nextId = (arr: { id?: unknown }[]) => (arr.length ? Math.max(...arr.map((t) => Number(t.id) || 0)) + 1 : 1);

// ─────────────────────────── today bootstrap ───────────────────────────
function buildAutoTasksForToday(todayKey: string): Task[] {
  const yKey = dateKey(addDays(keyToDate(todayKey), -1));
  const yTasks = getDay(yKey)?.tasks || [];
  const carried = yTasks.filter((t) => !t.done).map((t) => ({ text: t.text, cat: t.cat || 'personal', perm: !!t.perm }));
  const perm = getPerm().map((p) => ({ text: p.text, cat: p.cat || 'personal', perm: true }));
  const seen = new Set<string>();
  const merged: { text: string; cat: string; perm: boolean }[] = [];
  [...perm, ...carried].forEach((t) => {
    const k = (t.text || '').trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    merged.push(t);
  });
  if (!merged.length) {
    merged.push(
      { text: 'সকাল ৭টায় উঠুন', cat: 'health', perm: false },
      { text: '৩০ মিনিট ব্যায়াম', cat: 'health', perm: false },
      { text: 'After Effects practice', cat: 'work', perm: false },
      { text: 'রাতে বই পড়া', cat: 'personal', perm: false }
    );
  }
  return merged.map((t, i) => ({ id: i + 1, text: t.text, cat: t.cat, done: false, ...(t.perm ? { perm: true } : {}) }));
}

/** Runs after the first remote snapshot (never from a stale cache). */
export function ensureToday() {
  const s = useApp.getState();
  if (!s.remoteLoaded && !s.demo) return;
  const u = s.user?.username || 'demo';
  const tk = s.todayKey;
  const flag = `dl2_today_init:${u}:${tk}`;
  if (!getDay(tk)) {
    let done = false;
    try {
      done = !!localStorage.getItem(flag);
    } catch {
      /* ignore */
    }
    if (!done) {
      setDay(tk, { tasks: buildAutoTasksForToday(tk), water: 0, expenses: [] });
      try {
        localStorage.setItem(flag, '1');
      } catch {
        /* ignore */
      }
    }
  }
  syncPermIntoToday();
}

export function syncPermIntoToday() {
  const perm = getPerm();
  if (!perm.length) return;
  const tk = useApp.getState().todayKey;
  const d = cloneDay(tk);
  const existing = new Set(d.tasks.map((t) => (t.text || '').trim().toLowerCase()));
  let id = nextId(d.tasks);
  let changed = false;
  perm.forEach((p) => {
    const k = (p.text || '').trim().toLowerCase();
    if (!k || existing.has(k)) return;
    d.tasks.push({ id: id++, text: p.text, cat: p.cat || 'personal', done: false, perm: true });
    existing.add(k);
    changed = true;
  });
  if (changed) setDay(tk, d);
}

// ─────────────────────────── tasks ───────────────────────────
export function toggleTask(key: string, id: number) {
  const d = cloneDay(key);
  d.tasks = d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  setDay(key, d);
}
export function deleteTask(key: string, id: number) {
  const d = cloneDay(key);
  d.tasks = d.tasks.filter((t) => t.id !== id);
  setDay(key, d);
}
export function addTask(key: string, text: string, cat: string) {
  text = text.trim();
  if (!text) return false;
  const d = cloneDay(key);
  d.tasks.push({ id: nextId(d.tasks), text, cat, done: false });
  setDay(key, d);
  toast(L('✅ Task যোগ হয়েছে', '✅ Task added'));
  return true;
}

export function addPermTask(text: string, cat: string) {
  text = text.trim();
  if (!text) {
    toast(L('❌ task লিখো', '❌ Write a task'));
    return false;
  }
  const items = getPerm();
  if (items.some((p) => (p.text || '').trim().toLowerCase() === text.toLowerCase())) {
    toast(L('⚠️ এই task আগে থেকেই আছে', '⚠️ That task already exists'));
    return false;
  }
  w('permanent_tasks', [...items, { id: nextId(items), text, cat: cat || 'personal' }]);
  syncPermIntoToday();
  toast(L('📌 Permanent task যোগ হয়েছে', '📌 Permanent task added'));
  return true;
}
export function removePermTask(id: number) {
  const items = getPerm();
  const removed = items.find((p) => p.id === id);
  if (!removed) return;
  w('permanent_tasks', items.filter((p) => p.id !== id));
  const tk = useApp.getState().todayKey;
  const d = getDay(tk);
  if (d && Array.isArray(d.tasks)) {
    const mk = (removed.text || '').trim().toLowerCase();
    const tasks = d.tasks
      .filter((t) => !(t.perm && (t.text || '').trim().toLowerCase() === mk && !t.done))
      .map((t) => {
        if (t.perm && (t.text || '').trim().toLowerCase() === mk) {
          const { perm: _p, ...rest } = t;
          return rest as Task;
        }
        return t;
      });
    setDay(tk, { ...d, tasks });
  }
  toast(L('🗑️ Permanent task মুছে দেওয়া হয়েছে', '🗑️ Permanent task removed'));
}

// ─────────────────────────── water ───────────────────────────
export function setWater(key: string, n: number) {
  const d = cloneDay(key);
  d.water = n;
  setDay(key, d);
}
export function setWaterGoal(n: number) {
  writeRaw('waterGoal', String(Math.max(1, Math.min(30, Math.round(n) || 8))));
}

// ─────────────────────────── mood ───────────────────────────
export function setMood(level: number, emoji: string) {
  const tk = useApp.getState().todayKey;
  w('mood_data', { ...getMood(), [tk]: { level, emoji } });
  toast(L('মন রেকর্ড হয়েছে ', 'Mood saved ') + emoji);
}

// ─────────────────────────── expenses ───────────────────────────
export function addExpense(key: string, name: string, amt: number) {
  if (!(amt > 0)) {
    toast(L('❌ টাকার পরিমাণ দাও', '❌ Enter an amount'));
    return false;
  }
  const d = cloneDay(key);
  d.expenses.push({ id: Date.now(), name: name.trim(), amt });
  setDay(key, d);
  toast(L('✅ Expense যোগ হয়েছে', '✅ Expense added'));
  return true;
}
export function deleteExpense(key: string, e: Expense) {
  const d = cloneDay(key);
  d.expenses = d.expenses.filter((x) => x.id !== e.id);
  setDay(key, d);
  if (e.fromBazar && e.bazarItemId) {
    const items = getBazar().map((b) => {
      if (b.id !== e.bazarItemId) return b;
      const { expenseDateKey: _x, ...rest } = b;
      return { ...rest, price: 0 } as BazarItem;
    });
    w('bazar_data', items);
  }
}

// ─────────────────────────── loans ───────────────────────────
export const loanRemaining = (l: Loan) => Math.max(0, (l.amt || 0) - (l.paid || 0));
export function addLoan(type: 'gave' | 'took', name: string, amt: number, date: string) {
  name = name.trim();
  if (!name) {
    toast(L('❌ নাম দাও', '❌ Enter a name'));
    return false;
  }
  if (!(amt > 0)) {
    toast(L('❌ টাকার পরিমাণ দাও', '❌ Enter an amount'));
    return false;
  }
  w('loans_data', [...getLoans(), { id: Date.now(), type, name, amt, paid: 0, date: date || useApp.getState().todayKey, settled: false }]);
  toast(L('📤 ধার রেকর্ড হয়েছে', '📤 Loan recorded'));
  return true;
}
export function settleLoan(id: number, pay: number) {
  const loans = [...getLoans()];
  const i = loans.findIndex((l) => l.id === id);
  if (i < 0) return false;
  const loan = { ...loans[i] };
  if (!(pay > 0)) {
    toast(L('❌ সঠিক পরিমাণ দাও', '❌ Enter a valid amount'));
    return false;
  }
  if (pay > loanRemaining(loan)) {
    toast(L('❌ বাকির চেয়ে বেশি দেওয়া যাবে না', '❌ More than what is due'));
    return false;
  }
  loan.paid = (loan.paid || 0) + pay;
  if (loan.paid >= loan.amt) {
    loans.splice(i, 1);
    toast(L('🎉 পুরোপুরি পরিশোধ!', '🎉 Fully settled!'));
  } else {
    loans[i] = loan;
    toast(L('✅ ৳' + pay.toLocaleString() + ' পরিশোধ', '✅ ৳' + pay.toLocaleString() + ' paid'));
  }
  w('loans_data', loans);
  return true;
}
export function addMoreLoan(id: number, add: number) {
  if (!(add > 0)) {
    toast(L('❌ সঠিক পরিমাণ দাও', '❌ Enter a valid amount'));
    return false;
  }
  w('loans_data', getLoans().map((l) => (l.id === id ? { ...l, amt: (l.amt || 0) + add } : l)));
  toast('➕ ৳' + add.toLocaleString() + L(' যোগ হলো', ' added'));
  return true;
}

// ─────────────────────────── notes ───────────────────────────
export function saveNote(n: Partial<Note> & { title: string; content: string; color: string; pinned: boolean }, id?: string) {
  const notes = [...getNotes()];
  if (id) {
    const i = notes.findIndex((x) => x.id === id);
    if (i >= 0) notes[i] = { ...notes[i], title: n.title, content: n.content, color: n.color, pinned: n.pinned, updatedAt: Date.now() };
    toast(L('✏️ Note আপডেট হয়েছে', '✏️ Note updated'));
  } else {
    notes.unshift({
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: n.title,
      content: n.content,
      color: n.color,
      pinned: n.pinned,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    toast(L('📝 Note সংরক্ষিত', '📝 Note saved'));
  }
  w('notes_data', notes);
}
export function deleteNote(id: string) {
  w('notes_data', getNotes().filter((n) => n.id !== id));
  toast(L('🗑️ Note মুছে দেওয়া হয়েছে', '🗑️ Note deleted'));
}
export function toggleNotePin(id: string) {
  w('notes_data', getNotes().map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n)));
}
/** Create or update a 24h temporary note. Returns its id. */
export function saveTempNote(content: string, id: string | null): string | null {
  content = content.trim();
  if (!content) return id;
  const notes = [...getNotes()];
  const title = content.split('\n')[0].slice(0, 50) || 'Temporary Note';
  if (id) {
    const i = notes.findIndex((n) => n.id === id);
    if (i >= 0) {
      notes[i] = { ...notes[i], title, content, updatedAt: Date.now() };
      w('notes_data', notes);
      return id;
    }
  }
  const nid = 'tnote_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  notes.unshift({ id: nid, title, content, color: 'yellow', pinned: false, temporary: true, expiresAt: Date.now() + 864e5, createdAt: Date.now(), updatedAt: Date.now() });
  w('notes_data', notes);
  return nid;
}
export function purgeExpiredTempNotes() {
  const notes = getNotes();
  const now = Date.now();
  const kept = notes.filter((n) => !(n.temporary && n.expiresAt && n.expiresAt <= now));
  if (kept.length < notes.length) {
    w('notes_data', kept);
    toast(L('🗑️ মেয়াদোত্তীর্ণ temporary note মুছে দেওয়া হয়েছে', '🗑️ Expired temporary notes removed'));
  }
}

// ─────────────────────────── bazar ───────────────────────────
export const BAZAR_CATS: Record<string, { emoji: string; bn: string; en: string; hue: number }> = {
  grocery: { emoji: '🛒', bn: 'মুদি', en: 'Grocery', hue: 220 },
  fruit: { emoji: '🍎', bn: 'ফল', en: 'Fruit', hue: 350 },
  veg: { emoji: '🥬', bn: 'সবজি', en: 'Vegetable', hue: 140 },
  meat: { emoji: '🍗', bn: 'মাংস', en: 'Meat', hue: 20 },
  fish: { emoji: '🐟', bn: 'মাছ', en: 'Fish', hue: 195 },
  dairy: { emoji: '🥛', bn: 'দুধ', en: 'Dairy', hue: 45 },
  medicine: { emoji: '💊', bn: 'ওষুধ', en: 'Medicine', hue: 280 },
  other: { emoji: '📦', bn: 'অন্যান্য', en: 'Other', hue: 230 }
};
export const catInfo = (c: string) => BAZAR_CATS[c] || BAZAR_CATS.other;
export const UNITS: Record<string, [string, string]> = {
  kg: ['কেজি', 'kg'],
  g: ['গ্রাম', 'g'],
  l: ['লিটার', 'L'],
  ml: ['মিলি', 'ml'],
  dozen: ['ডজন', 'dozen'],
  pcs: ['পিস', 'pcs'],
  packet: ['প্যাকেট', 'packet'],
  bundle: ['আঁটি', 'bundle']
};
export function formatQty(item: BazarItem, en: boolean) {
  const q = item.qty != null && (item.qty as unknown) !== '' ? parseFloat(String(item.qty)) : NaN;
  const hasQ = !isNaN(q) && q > 0;
  const u = item.unit ? (UNITS[item.unit] ? UNITS[item.unit][en ? 1 : 0] : item.unit) : '';
  if (hasQ && u) return q + ' ' + u;
  if (hasQ) return String(q);
  return u;
}
const bazarExpenseName = (it: BazarItem) => {
  const q = formatQty(it, useApp.getState().lang === 'en');
  return catInfo(it.cat).emoji + ' ' + it.name + (q ? ' (' + q + ')' : '');
};

export function addBazarItem(name: string, cat: string, qty: number | null, unit: string | null) {
  name = name.trim();
  if (!name) {
    toast(L('❌ পণ্যের নাম দাও', '❌ Enter an item name'));
    return false;
  }
  w('bazar_data', [...getBazar(), { id: Date.now(), name, cat, qty, unit, price: 0, done: false, addedAt: Date.now() }]);
  toast('🛒 ' + name + L(' যোগ হয়েছে', ' added'));
  return true;
}
export function toggleBazarItem(id: number) {
  const tk = useApp.getState().todayKey;
  const items = getBazar().map((x) => ({ ...x }));
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.done = !it.done;
  const expId = 'bazar_' + it.id;
  if (it.done) {
    it.doneAt = Date.now();
    if (it.price > 0) {
      const d = cloneDay(tk);
      if (!d.expenses.find((e) => e.id === expId)) {
        d.expenses.push({ id: expId, name: bazarExpenseName(it), amt: it.price, fromBazar: true, bazarItemId: it.id });
        setDay(tk, d);
        it.expenseDateKey = tk;
        toast(L('✅ কেনা হয়েছে · ৳' + it.price + ' খরচে যোগ', '✅ Bought · ৳' + it.price + ' added to expenses'));
      }
    } else toast('✅ ' + it.name + L(' কেনা হয়েছে', ' bought'));
  } else {
    delete it.doneAt;
    if (it.expenseDateKey) {
      const d = getDay(it.expenseDateKey);
      if (d?.expenses?.some((e) => e.id === expId)) {
        setDay(it.expenseDateKey, { ...d, expenses: d.expenses.filter((e) => e.id !== expId) });
        toast(L('↩️ খরচ থেকে সরানো হয়েছে', '↩️ Removed from expenses'));
      }
      delete it.expenseDateKey;
    }
  }
  w('bazar_data', items);
}
export function setBazarPrice(id: number, price: number) {
  const items = getBazar().map((x) => ({ ...x }));
  const it = items.find((x) => x.id === id);
  if (!it) return;
  price = price > 0 ? price : 0;
  if (price === (it.price || 0)) return;
  it.price = price;
  if (it.done && it.expenseDateKey) {
    const expId = 'bazar_' + it.id;
    const d = getDay(it.expenseDateKey);
    if (d) {
      const exps = [...(d.expenses || [])];
      const i = exps.findIndex((e) => e.id === expId);
      if (price > 0) {
        if (i >= 0) exps[i] = { ...exps[i], amt: price };
        else exps.push({ id: expId, name: bazarExpenseName(it), amt: price, fromBazar: true, bazarItemId: it.id });
      } else if (i >= 0) exps.splice(i, 1);
      setDay(it.expenseDateKey, { ...d, expenses: exps });
    }
  }
  w('bazar_data', items);
}
export function deleteBazarItem(id: number) {
  const items = getBazar();
  const it = items.find((x) => x.id === id);
  if (it?.done && it.expenseDateKey) {
    const d = getDay(it.expenseDateKey);
    if (d) setDay(it.expenseDateKey, { ...d, expenses: (d.expenses || []).filter((e) => e.id !== 'bazar_' + it.id) });
  }
  w('bazar_data', items.filter((x) => x.id !== id));
  toast(L('🗑️ মুছে দেওয়া হয়েছে', '🗑️ Deleted'));
}
export const clearBazarDone = () => w('bazar_data', getBazar().filter((x) => !x.done));
export const clearBazarAll = () => w('bazar_data', []);

// ─────────────────────────── orders (with undo / redo) ───────────────────────────
const undoStack: string[] = [];
const redoStack: string[] = [];
const notifyHistory = () => useApp.setState({}); // force subscribers that read canUndo/canRedo
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export function setOrders(next: Order[], recordUndo = true) {
  if (recordUndo) {
    undoStack.push(JSON.stringify(getOrders()));
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  w('orders_data', next);
  notifyHistory();
}
export function undoOrders() {
  const prev = undoStack.pop();
  if (!prev) {
    toast(L('↶ Undo করার কিছু নেই', '↶ Nothing to undo'));
    return;
  }
  redoStack.push(JSON.stringify(getOrders()));
  writeRaw('orders_data', prev);
  toast(L('↶ Undo হয়েছে', '↶ Undone'));
  notifyHistory();
}
export function redoOrders() {
  const next = redoStack.pop();
  if (!next) {
    toast(L('↷ Redo করার কিছু নেই', '↷ Nothing to redo'));
    return;
  }
  undoStack.push(JSON.stringify(getOrders()));
  writeRaw('orders_data', next);
  toast(L('↷ Redo হয়েছে', '↷ Redone'));
  notifyHistory();
}
export function calcExpiry(date: string, validity: number | string) {
  if (!date || !validity) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + parseInt(String(validity), 10) * 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function calcDayLeft(expiry: string) {
  if (!expiry) return 0;
  const e = new Date(expiry);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.ceil((e.getTime() - n.getTime()) / 864e5);
}
export function fmtDMY(s: string) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
