import { useEffect, useState } from 'react';
import { useApp, useL, type ModalReq } from '../../lib/store';
import { Btn, Modal, ModalHeader } from '../../components/ui';

const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'help', 'api', 'null', 'undefined', 'www', 'mail', 'ftp', 'smtp', 'pop', 'staff', 'mod', 'moderator', 'doinik', 'dailylife', 'dashboard', 'app', 'official', 'owner', 'test', 'demo']);

export function UsernameModal({ open, req }: { open: boolean; req?: Extract<ModalReq, { type: 'username' }> }) {
  const L = useL();
  const [v, setV] = useState('');
  const [state, setState] = useState<'' | 'checking' | 'free' | 'taken' | 'invalid'>('');
  useEffect(() => {
    if (open) setV(req?.suggested || '');
  }, [open, req]);

  const clean = v.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const valid = clean.length >= 3 && clean.length <= 24 && !RESERVED.has(clean) && clean === v.toLowerCase().trim();

  useEffect(() => {
    if (!open || !v) return setState('');
    if (!valid) return setState('invalid');
    setState('checking');
    const t = setTimeout(async () => {
      const fb = await import('../../lib/firebase');
      setState((await fb.checkUsernameFree(clean)) ? 'free' : 'taken');
    }, 350);
    return () => clearTimeout(t);
  }, [v, open, valid, clean]);

  const submit = () => {
    if (!valid || !req) return;
    useApp.setState({ modal: null });
    req.resolve(clean);
  };

  const hint =
    state === 'invalid'
      ? L('⚠️ ৩–২৪ অক্ষর, শুধু a-z, 0-9, _', '⚠️ 3–24 characters: a-z, 0-9, _ only')
      : state === 'checking'
        ? L('চেক করছি…', 'Checking…')
        : state === 'free'
          ? L('✓ এই username পাওয়া যাবে', '✓ Available')
          : state === 'taken'
            ? L('✗ আগে থেকেই নেওয়া — আগে এই নামে account থাকলে এটাই দাও', '✗ Taken — if it was yours before, keep it and continue')
            : '';

  return (
    <Modal open={open} onClose={() => {}} width={420} label="Username">
      <ModalHeader
        icon="user"
        title={L('Username choose করো', 'Choose a username')}
        subtitle={L('এটা তোমার stable identifier — email বদলালেও এটা একই থাকবে। আগে account থাকলে পুরনো username দাও।', 'Your stable ID — it stays the same even if your email changes. Had an account before? Enter your old username.')}
      />
      <div className="px-6 pb-6">
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} autoCapitalize="off" spellCheck={false} placeholder="ratul123" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <div className="mt-2 min-h-[18px] text-[12px] text-ink-3">{hint}</div>
        <Btn variant="primary" className="mt-4 w-full" disabled={!valid} onClick={submit}>
          ✓ Save
        </Btn>
      </div>
    </Modal>
  );
}
