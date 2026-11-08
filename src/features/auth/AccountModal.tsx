import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { confirmDialog, setLang, toast, useApp, useL, useLang } from '../../lib/store';
import { Btn, IconBtn, Modal, ModalHeader, Segmented, spring } from '../../components/ui';
import { getHijriOffset, setHijriOffset } from '../../lib/hijri';
import type { Lang } from '../../lib/types';

function Row({ label, value, action, children }: { label: string; value?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-line py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-4">{label}</div>
          {value != null && <div className="mt-0.5 truncate text-[13.5px] text-white">{value}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const user = useApp((s) => s.user);
  const demo = useApp((s) => s.demo);
  const ordersEnabled = useApp((s) => s.ordersEnabled);
  const [meta, setMeta] = useState<{ createdAt?: number; lastLogin?: number; role?: string } | null>(null);
  const [edit, setEdit] = useState<'' | 'email' | 'password'>('');
  const [f, setF] = useState({ cur: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [hijri, setHijri] = useState(getHijriOffset());

  useEffect(() => {
    if (!open) return;
    setEdit('');
    setNote(null);
    if (user && !demo) import('../../lib/firebase').then((fb) => fb.loadUserMeta(user.username)).then(setMeta);
  }, [open, user, demo]);

  const startEdit = (k: 'email' | 'password') => {
    setEdit(edit === k ? '' : k);
    setF({ cur: '', next: '', confirm: '' });
    setNote(null);
  };

  const submit = async () => {
    if (demo) return toast(L('Demo তে বদলানো যায় না', 'Not available in demo'));
    setBusy(true);
    setNote(null);
    const fb = await import('../../lib/firebase');
    let err: string | null;
    if (edit === 'email') err = await fb.changeEmail(f.cur, f.next);
    else {
      if (f.next !== f.confirm) err = L('নতুন password দুটো মেলেনি', 'The new passwords do not match');
      else err = await fb.changePassword(f.cur, f.next);
    }
    setBusy(false);
    if (err) setNote({ ok: false, text: err });
    else {
      setNote({
        ok: true,
        text:
          edit === 'email'
            ? L('✉️ নতুন email এ confirmation link পাঠানো হয়েছে। link এ ক্লিক করলে বদলে যাবে।', '✉️ A confirmation link was sent to the new email. Click it to finish.')
            : L('✅ Password বদলানো হয়েছে', '✅ Password changed')
      });
      setF({ cur: '', next: '', confirm: '' });
    }
  };

  const toggleOrders = async () => {
    const next = !ordersEnabled;
    if (demo) useApp.setState({ ordersEnabled: next });
    else (await import('../../lib/firebase')).setOrdersEnabled(next);
    if (!next && useApp.getState().tab === 'orders') useApp.setState({ tab: 'cal' });
    if (!next) useApp.setState({ desktopOrders: false });
    toast(next ? L('✅ Orders option চালু', '✅ Orders enabled') : L('🚫 Orders option বন্ধ', '🚫 Orders disabled'));
  };

  const changeHijri = (d: number) => {
    const v = hijri + d;
    setHijri(v);
    setHijriOffset(v);
    window.dispatchEvent(new Event('hijri-offset'));
  };

  const logout = async () => {
    if (!(await confirmDialog({ title: L('লগ আউট করতে চাও?', 'Log out?'), okText: L('লগ আউট', 'Log out'), danger: true }))) return;
    onClose();
    if (demo) {
      location.href = location.pathname;
      return;
    }
    (await import('../../lib/firebase')).logout();
  };

  const name = user?.username || '';
  const role = meta?.role && meta.role !== 'user' ? meta.role : L('ইউজার', 'User');

  return (
    <Modal open={open} onClose={onClose} width={460} label="Account">
      <ModalHeader icon="user" title={L('অ্যাকাউন্ট', 'Account')} subtitle={L('তোমার অ্যাকাউন্টের সব তথ্য', 'Everything about your account')} onClose={onClose} />
      <div className="scroll-thin overflow-y-auto px-5 pb-6 sm:px-6">
        <div className="tint-glass mb-3 flex items-center gap-3.5 p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#cdb8ff] via-[#6d3df5] to-[#1c1240] text-[22px] font-light text-white shadow-[0_0_24px_rgba(167,139,250,0.45)]">
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[18px] font-normal tracking-[-0.02em] text-white">{name || '—'}</span>
              <span className="badge badge-work capitalize">{role}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-4">
              {fmt(meta?.createdAt) && <span>📅 {L('যোগদান: ', 'Joined: ')}{fmt(meta?.createdAt)}</span>}
              {fmt(meta?.lastLogin) && <span>⏱️ {L('শেষ লগইন: ', 'Last login: ')}{fmt(meta?.lastLogin)}</span>}
            </div>
          </div>
        </div>

        <div className="sub-glass px-4">
          <Row label="Username" value={name} />
          <Row label="Email" value={user?.email || '—'} action={user?.isPasswordProvider && <Btn size="sm" onClick={() => startEdit('email')}>{edit === 'email' ? L('বাতিল', 'Cancel') : L('পরিবর্তন', 'Change')}</Btn>}>
            <EditPanel show={edit === 'email'}>
              <input className="field mb-2" type="password" autoComplete="current-password" placeholder={L('বর্তমান password', 'Current password')} value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} />
              <input className="field mb-2" type="email" placeholder={L('নতুন email', 'New email')} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
            </EditPanel>
          </Row>
          <Row label="Password" value="••••••••" action={user?.isPasswordProvider && <Btn size="sm" onClick={() => startEdit('password')}>{edit === 'password' ? L('বাতিল', 'Cancel') : L('পরিবর্তন', 'Change')}</Btn>}>
            <EditPanel show={edit === 'password'}>
              <input className="field mb-2" type="password" autoComplete="current-password" placeholder={L('পুরনো password', 'Current password')} value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} />
              <input className="field mb-2" type="password" autoComplete="new-password" placeholder={L('নতুন password (কমপক্ষে ৬)', 'New password (6+)')} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
              <input className="field mb-2" type="password" autoComplete="new-password" placeholder={L('নতুন password আবার', 'Repeat new password')} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
            </EditPanel>
          </Row>
          <AnimatePresence>
            {edit && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-3">
                {note && <div className={`mb-2 rounded-xl px-3 py-2 text-[12px] ${note.ok ? 'bg-good/10 text-[#c8f5e2]' : 'bg-bad/10 text-[#ffd0d0]'}`}>{note.text}</div>}
                <Btn variant="primary" className="w-full" disabled={busy || !f.cur || !f.next} onClick={submit}>
                  {busy ? L('অপেক্ষা করো…', 'Please wait…') : L('✓ পরিবর্তন করো', '✓ Save change')}
                </Btn>
              </motion.div>
            )}
          </AnimatePresence>
          <Row label={L('Sign-in method', 'Sign-in method')} value={user?.providerId === 'password' ? 'Email & password' : user?.providerId} />
        </div>

        <div className="sub-glass mt-3 px-4">
          <Row label={L('ভাষা', 'Language')} value={<span className="text-[12px] text-ink-3">{L('পুরো ড্যাশবোর্ডের ভাষা', 'Language for the whole dashboard')}</span>}>
            <Segmented<Lang>
              className="mt-2.5"
              value={lang}
              onChange={setLang}
              options={[
                { value: 'bn', label: 'বাংলা' },
                { value: 'en', label: 'English' }
              ]}
            />
          </Row>
          <Row
            label="📊 Orders section"
            value={ordersEnabled ? L('✓ চালু আছে', '✓ Enabled') : L('🚫 বন্ধ আছে', '🚫 Disabled')}
            action={<Btn size="sm" onClick={toggleOrders}>{ordersEnabled ? L('বন্ধ করো', 'Disable') : L('চালু করো', 'Enable')}</Btn>}
          />
          <Row
            label={L('হিজরি তারিখ সমন্বয়', 'Hijri date offset')}
            value={<span className="text-[12px] text-ink-3">{L('চাঁদ দেখার সাথে মেলাতে ± দিন', 'Shift ± days to match moon sighting')}</span>}
            action={
              <div className="flex items-center gap-2">
                <IconBtn icon="chevL" label="-1" size={30} onClick={() => changeHijri(-1)} />
                <span className="num w-8 text-center text-[16px]">{hijri > 0 ? '+' + hijri : hijri}</span>
                <IconBtn icon="chevR" label="+1" size={30} onClick={() => changeHijri(1)} />
              </div>
            }
          />
        </div>

        <Btn variant="danger" icon="power" className="mt-4 w-full" onClick={logout}>
          {L('লগ আউট', 'Log out')}
        </Btn>
      </div>
    </Modal>
  );
}

function EditPanel({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
