// Data shapes — identical to the original single-file app so both versions can
// read/write the same Firebase account (users/<username>/<key> = JSON string).

export type Lang = 'bn' | 'en';
export type TaskCat = 'work' | 'health' | 'personal';

export interface Task {
  id: number;
  text: string;
  cat: TaskCat | string;
  done: boolean;
  perm?: boolean;
  [k: string]: unknown;
}

export interface Expense {
  id: number | string;
  name: string;
  amt: number;
  fromBazar?: boolean;
  bazarItemId?: number;
  [k: string]: unknown;
}

export interface DayData {
  tasks: Task[];
  water: number;
  expenses: Expense[];
  [k: string]: unknown;
}

export interface Loan {
  id: number;
  type: 'gave' | 'took';
  name: string;
  amt: number;
  paid: number;
  date: string;
  settled: boolean;
  [k: string]: unknown;
}

export type MoodData = Record<string, { level: number; emoji: string }>;

export interface PermTask {
  id: number;
  text: string;
  cat: TaskCat | string;
}

export interface BazarItem {
  id: number;
  name: string;
  cat: string;
  qty: number | null;
  unit: string | null;
  price: number;
  done: boolean;
  addedAt: number;
  doneAt?: number;
  expenseDateKey?: string;
  [k: string]: unknown;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  temporary?: boolean;
  expiresAt?: number;
  [k: string]: unknown;
}

export interface Order {
  username: string;
  date: string;
  items: string;
  validity: number;
  status: string;
  amount: number;
  cost: number;
  orderStatus: string;
  account: string;
  password: string;
  orderId?: string | number;
  [k: string]: unknown;
}

export type SyncStatus = 'offline' | 'syncing' | 'online' | 'error';

export interface AppUser {
  uid: string;
  email: string;
  username: string;
  providerId: string;
  isPasswordProvider: boolean;
  creationTime?: string;
}

// The only keys the original app syncs. Writing anything else under
// users/<username> would be wiped by the old app's full-node set().
export const SYNC_KEYS = ['waterGoal', 'loans_data', 'mood_data', 'bazar_data', 'permanent_tasks', 'notes_data', 'orders_data'] as const;
export const isSyncKey = (k: string) => k.startsWith('day_') || (SYNC_KEYS as readonly string[]).includes(k);
