// Firebase layer — loaded lazily (dynamic import) so the dashboard can paint
// from the local cache before the SDK arrives.
//
// Compatibility contract with the original single-file app:
//   • same project config, same paths:  users/<username>/<key>,
//     usernames/<u> → uid, usernameEmails/<u> → email, userMeta/<u>
//   • every value is stored as a JSON *string* (exactly what the old app writes)
//   • only the whitelisted keys are touched (see isSyncKey)
// Difference: we write only the keys that changed (update), never the whole node.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
  type User
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set as dbSet,
  update,
  runTransaction,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue
} from 'firebase/database';
import { useApp, toast, L } from './store';
import { isSyncKey, type AppUser } from './types';
import { cacheLoad, cacheSave, pending, setWriter } from './sync';

const FB_CONFIG = {
  apiKey: 'AIzaSyCIVlYu0apClF9D4Yle2qifIeCUTStQRII',
  authDomain: 'daily-dashboard-ratul.firebaseapp.com',
  databaseURL: 'https://daily-dashboard-ratul-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'daily-dashboard-ratul',
  appId: '1:384932244617:web:dff7e4045ad4b016eaaa58'
};

const app = getApps()[0] ?? initializeApp(FB_CONFIG);
export const auth = getAuth(app);
const db = getDatabase(app);

const USERNAME_KEY = 'dl2_username';
const clean = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

// ─────────────────────────── username ownership (ported) ───────────────────────────
async function isUsernameOccupiedByOther(username: string, uid: string, ourEmail: string, ourDn: string) {
  if (!username) return false;
  try {
    const owner = await get(ref(db, 'usernames/' + username));
    if (owner.exists()) {
      const v = owner.val();
      if (v === uid) return false;
      if (v) return true;
    }
    const em = await get(ref(db, 'usernameEmails/' + username));
    if (em.exists()) {
      const mapped = String(em.val() || '').toLowerCase();
      if (mapped) return !(ourEmail && mapped === ourEmail.toLowerCase());
    }
    const data = await get(ref(db, 'users/' + username));
    if (data.exists()) {
      const v = data.val();
      const hasData = !!v && (typeof v !== 'object' || Object.keys(v).length > 0);
      if (hasData) return !(ourDn && ourDn === username);
    }
    return false;
  } catch (e) {
    console.warn('occupied check failed', e);
    return true; // fail-safe, same as the original
  }
}

async function claimUsername(username: string, user: User) {
  if (!username || !user) return false;
  try {
    if (await isUsernameOccupiedByOther(username, user.uid, user.email || '', clean(user.displayName || ''))) return false;
    const res = await runTransaction(ref(db, 'usernames/' + username), (cur) => {
      if (cur === null || cur === user.uid) return user.uid;
      return undefined; // abort
    });
    return !!res.committed;
  } catch (e) {
    console.warn('claim failed', e);
    return false;
  }
}

async function saveUsernameEmail(username: string, email: string) {
  if (!username || !email || email.endsWith('@dailydashboard.app')) return;
  try {
    await dbSet(ref(db, 'usernameEmails/' + username), email.toLowerCase());
  } catch (e) {
    console.warn('saveUsernameEmail failed', e);
  }
}

async function lookupUsernameEmail(username: string) {
  try {
    const s = await get(ref(db, 'usernameEmails/' + username));
    return s.exists() ? String(s.val()).toLowerCase() : null;
  } catch {
    return null;
  }
}

async function persistDisplayName(user: User, username: string) {
  if ((user.displayName || '').toLowerCase() === username.toLowerCase()) return;
  try {
    await updateProfile(user, { displayName: username });
  } catch {
    /* non-fatal */
  }
}

function askUsername(suggested: string): Promise<string> {
  return new Promise((resolve) => useApp.setState({ modal: { type: 'username', suggested, resolve } }));
}

/** Same priority as the original app: displayName → legacy email → local → prompt. */
async function resolveUsername(user: User): Promise<string> {
  const email = (user.email || '').trim().toLowerCase();
  const tryClaim = async (cand: string) => {
    if (!cand || cand.length < 2) return false;
    const ok = await claimUsername(cand, user);
    if (ok) await saveUsernameEmail(cand, email);
    return ok;
  };
  if (user.displayName) {
    const dn = clean(user.displayName);
    if (await tryClaim(dn)) return dn;
  }
  if (email.endsWith('@dailydashboard.app')) {
    const u = clean(email.split('@')[0]);
    if (await tryClaim(u)) {
      await persistDisplayName(user, u);
      return u;
    }
  }
  const stored = clean(localStorage.getItem(USERNAME_KEY) || '');
  if (await tryClaim(stored)) {
    await persistDisplayName(user, stored);
    return stored;
  }
  // Ask the user, retrying until we get a name we can claim.
  let suggested = email ? clean(email.split('@')[0]) : '';
  for (;;) {
    const chosen = clean(await askUsername(suggested));
    if (chosen.length >= 3 && (await claimUsername(chosen, user))) {
      await persistDisplayName(user, chosen);
      await saveUsernameEmail(chosen, email);
      return chosen;
    }
    toast(L('✗ এই username নেওয়া হয়ে গেছে — আরেকটা দাও', '✗ That username is taken — try another'));
    suggested = chosen;
  }
}

export async function checkUsernameFree(username: string) {
  return !(await isUsernameOccupiedByOther(username, '__check__', '', ''));
}

// ─────────────────────────── meta ───────────────────────────
async function recordLoginMeta(username: string, user: User) {
  try {
    const r = ref(db, 'userMeta/' + username);
    const snap = await get(r);
    const ex = snap.exists() ? snap.val() || {} : null;
    const now = Date.now();
    const upd: Record<string, unknown> = { lastLogin: now };
    if (!ex || !ex.createdAt) {
      const ct = Date.parse(user.metadata?.creationTime || '');
      upd.createdAt = isNaN(ct) ? now : ct;
    }
    if (!ex || !ex.role) upd.role = 'user';
    await update(r, upd);
  } catch (e) {
    console.warn('meta failed', e);
  }
}

export async function loadUserMeta(username: string): Promise<{ createdAt?: number; lastLogin?: number; role?: string; ordersEnabled?: boolean } | null> {
  try {
    const s = await get(ref(db, 'userMeta/' + username));
    return s.exists() ? s.val() : null;
  } catch {
    return null;
  }
}

export async function setOrdersEnabled(enabled: boolean) {
  const u = useApp.getState().user?.username;
  useApp.setState({ ordersEnabled: enabled });
  try {
    localStorage.setItem('dl2_orders_enabled', enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (u) {
    try {
      await update(ref(db, 'userMeta/' + u), { ordersEnabled: enabled });
    } catch {
      /* ignore */
    }
  }
}

// ─────────────────────────── data sync ───────────────────────────
let unsubs: (() => void)[] = [];
let batch = new Map<string, string | null>();
let batchQueued = false;
let syncPath = '';

const asString = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

function applyBatch() {
  batchQueued = false;
  if (!batch.size) return;
  const raw = useApp.getState().raw;
  let next: Record<string, string> | null = null;
  batch.forEach((val, key) => {
    if (pending.has(key)) return; // our unsent edit wins until it is written
    if (val === null) {
      if (key in raw) {
        next ??= { ...raw };
        delete next[key];
      }
    } else if (raw[key] !== val) {
      next ??= { ...raw };
      next[key] = val;
    }
  });
  batch = new Map();
  if (next) useApp.setState({ raw: next });
}
function queueRemote(key: string, val: unknown) {
  if (!isSyncKey(key)) return;
  batch.set(key, val === null ? null : key === 'waterGoal' ? String(val) : asString(val));
  if (!batchQueued) {
    batchQueued = true;
    queueMicrotask(applyBatch);
  }
}

function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  setWriter(null);
}

async function startSync(username: string) {
  stopSync();
  syncPath = 'users/' + username;
  const s = useApp.getState();
  // Paint immediately from the local cache (if any).
  if (!Object.keys(s.raw).length) {
    const c = cacheLoad(username);
    if (c) useApp.setState({ raw: c });
  }
  useApp.setState({ status: 'syncing' });

  setWriter(async (updates) => {
    await update(ref(db, syncPath), updates);
  });

  try {
    const snap = await get(ref(db, syncPath));
    const remote = (snap.val() || {}) as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(remote)) {
      if (isSyncKey(k) && v != null) next[k] = k === 'waterGoal' ? String(v) : asString(v);
    }
    pending.forEach((v, k) => {
      if (v === null) delete next[k];
      else next[k] = v;
    });
    useApp.setState({ raw: next, remoteLoaded: true, status: 'online' });
    cacheSave(username, next);
  } catch (e) {
    console.error(e);
    useApp.setState({ status: 'error', remoteLoaded: false });
    toast(L('❌ Firebase connect হয়নি — offline data দেখাচ্ছে', '❌ Could not reach Firebase — showing offline data'));
  }

  const r = ref(db, syncPath);
  unsubs.push(onChildAdded(r, (c) => queueRemote(c.key!, c.val())));
  unsubs.push(onChildChanged(r, (c) => queueRemote(c.key!, c.val())));
  unsubs.push(onChildRemoved(r, (c) => queueRemote(c.key!, null)));
  unsubs.push(
    onValue(ref(db, '.info/connected'), (c) => {
      const st = useApp.getState();
      if (c.val() === true) {
        if (st.status !== 'syncing') useApp.setState({ status: 'online' });
        if (!st.remoteLoaded) void startSync(username); // came back online after a failed first load
      } else {
        useApp.setState({ status: 'offline' });
      }
    })
  );
}

// ─────────────────────────── auth ───────────────────────────
function toAppUser(user: User, username: string): AppUser {
  return {
    uid: user.uid,
    email: user.email || '',
    username,
    providerId: user.providerData[0]?.providerId || 'password',
    isPasswordProvider: user.providerData.some((p) => p.providerId === 'password'),
    creationTime: user.metadata?.creationTime
  };
}

let resolving = false;
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopSync();
      useApp.setState({ user: null, authChecked: true, status: 'offline', remoteLoaded: false });
      return;
    }
    if (resolving) return;
    resolving = true;
    let username = '';
    try {
      username = await resolveUsername(user);
    } finally {
      resolving = false;
    }
    if (!username) return;
    const prev = localStorage.getItem(USERNAME_KEY);
    if (prev && prev !== username) useApp.setState({ raw: {} });
    localStorage.setItem(USERNAME_KEY, username);
    useApp.setState({ user: toAppUser(user, username), authChecked: true, cachedUsername: username });
    void recordLoginMeta(username, user);
    loadUserMeta(username).then((m) => {
      const enabled = !m || m.ordersEnabled !== false;
      useApp.setState({ ordersEnabled: enabled });
      try {
        localStorage.setItem('dl2_orders_enabled', enabled ? '1' : '0');
      } catch {
        /* ignore */
      }
    });
    await startSync(username);
  });
}

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function authErrorText(code: string) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return L('ভুল email বা password! আবার চেষ্টা করো অথবা নতুন অ্যাকাউন্ট তৈরি করো।', 'Wrong email or password. Try again or create an account.');
    case 'auth/wrong-password':
      return L('ভুল password! আবার চেষ্টা করো।', 'Wrong password. Try again.');
    case 'auth/email-already-in-use':
      return L('এই email আগে থেকেই account আছে। লগইন করো।', 'This email already has an account. Please log in.');
    case 'auth/weak-password':
      return L('পাসওয়ার্ড আরো শক্তিশালী করো (কমপক্ষে ৬ অক্ষর)।', 'Use a stronger password (at least 6 characters).');
    case 'auth/too-many-requests':
      return L('অনেক বার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করো।', 'Too many attempts. Please wait a bit and try again.');
    case 'auth/network-request-failed':
      return L('ইন্টারনেট সংযোগ নেই। চেক করো।', 'No internet connection.');
    case 'auth/invalid-email':
      return L('Email format ঠিক নেই।', 'That email format looks wrong.');
    case 'auth/requires-recent-login':
      return L('নিরাপত্তার জন্য আবার লগইন করে চেষ্টা করো।', 'Please log in again and retry.');
    default:
      return L('কিছু ভুল হয়েছে। আবার চেষ্টা করো।', 'Something went wrong. Please try again.');
  }
}

/** Returns an error message, or null on success (onAuthStateChanged takes over). */
export async function login(rawId: string, password: string): Promise<string | null> {
  rawId = rawId.trim();
  if (!rawId) return L('Email দাও', 'Please enter your email');
  if (!password || password.length < 6) return L('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters');
  let email = '';
  if (rawId.includes('@')) {
    if (!isValidEmail(rawId)) return L('সঠিক email দাও', 'Please enter a valid email');
    email = rawId.toLowerCase();
  } else {
    // Legacy username-only accounts.
    const u = clean(rawId);
    if (!u) return L('সঠিক email দাও', 'Please enter a valid email');
    email = (await lookupUsernameEmail(u)) || u + '@dailydashboard.app';
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return null;
  } catch (e) {
    return authErrorText((e as { code?: string }).code || '');
  }
}

export async function register(emailRaw: string, password: string, wantsOrders: boolean): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!isValidEmail(email)) return L('Sign-up এর জন্য একটা valid email দাও', 'Please enter a valid email to sign up');
  if (!password || password.length < 6) return L('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters');
  let username = clean(email.split('@')[0]) || 'user';
  if (username.length < 3) username = (username + '_user').slice(0, 24);
  username = username.slice(0, 24);
  if (await isUsernameOccupiedByOther(username, '__signup_pending__', email, '')) {
    // Let resolveUsername() prompt for a different name after sign-up.
    username = '';
  }
  try {
    if (username) localStorage.setItem(USERNAME_KEY, username);
    else localStorage.removeItem(USERNAME_KEY);
    await createUserWithEmailAndPassword(auth, email, password);
    useApp.setState({ ordersEnabled: wantsOrders });
    localStorage.setItem('dl2_orders_enabled', wantsOrders ? '1' : '0');
    // userMeta is written once the username is resolved.
    const wait = setInterval(() => {
      const u = useApp.getState().user;
      if (u) {
        clearInterval(wait);
        void update(ref(db, 'userMeta/' + u.username), { ordersEnabled: wantsOrders });
      }
    }, 500);
    setTimeout(() => clearInterval(wait), 30000);
    return null;
  } catch (e) {
    return authErrorText((e as { code?: string }).code || '');
  }
}

export async function logout() {
  stopSync();
  try {
    await signOut(auth);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    /* ignore */
  }
  useApp.setState({ user: null, raw: {}, remoteLoaded: false, status: 'offline', cachedUsername: '' });
}

export async function resetPassword(email: string): Promise<string | null> {
  email = email.trim().toLowerCase();
  if (!isValidEmail(email)) return L('সঠিক email দাও', 'Please enter a valid email');
  try {
    await sendPasswordResetEmail(auth, email);
    return null;
  } catch (e) {
    return authErrorText((e as { code?: string }).code || '');
  }
}

async function reauth(currentPw: string) {
  const u = auth.currentUser;
  if (!u || !u.email) throw Object.assign(new Error('no user'), { code: 'auth/requires-recent-login' });
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
  return u;
}

export async function changeEmail(currentPw: string, newEmail: string): Promise<string | null> {
  newEmail = newEmail.trim().toLowerCase();
  if (!isValidEmail(newEmail)) return L('সঠিক email দাও', 'Please enter a valid email');
  try {
    const u = await reauth(currentPw);
    await verifyBeforeUpdateEmail(u, newEmail);
    return null;
  } catch (e) {
    return authErrorText((e as { code?: string }).code || '');
  }
}

export async function changePassword(currentPw: string, newPw: string): Promise<string | null> {
  if (newPw.length < 6) return L('নতুন password কমপক্ষে ৬ অক্ষর', 'New password must be at least 6 characters');
  try {
    const u = await reauth(currentPw);
    await updatePassword(u, newPw);
    return null;
  } catch (e) {
    return authErrorText((e as { code?: string }).code || '');
  }
}
