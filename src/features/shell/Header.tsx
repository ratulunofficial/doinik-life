import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { confirmDialog, openModal, setLang, useApp, useL, useLang } from '../../lib/store';
import { Btn, IconBtn, useIsDesktop, useIsPhone } from '../../components/ui';
import { DAYS_LONG_BN, DAYS_LONG_EN, DAYS_EN, MONTHS_BN, MONTHS_EN, MON_SHORT_EN, keyToDate } from '../../lib/dates';
import { formatHijri, getHijri, type Hijri } from '../../lib/hijri';
import { cx } from '../../lib/format';

/** The app icon (public/icon.svg — same file used for the favicon, PWA and native apps). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return <img src="./icon.svg" width={size} height={size} alt="" draggable={false} className="shrink-0 select-none drop-shadow-[0_6px_18px_rgba(124,77,255,0.45)]" />;
}

export function useHeaderDate() {
  const lang = useLang();
  const todayKey = useApp((s) => s.todayKey);
  const phone = useIsPhone();
  const [h, setH] = useState<Hijri | null>(null);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let alive = true;
    getHijri(keyToDate(todayKey)).then((x) => alive && setH(x));
    const on = () => setRev((r) => r + 1);
    window.addEventListener('hijri-offset', on);
    return () => {
      alive = false;
      window.removeEventListener('hijri-offset', on);
    };
  }, [todayKey, rev]);
  const d = keyToDate(todayKey);
  const greg =
    lang === 'en'
      ? phone
        ? `${DAYS_EN[d.getDay()]}, ${MON_SHORT_EN[d.getMonth()]} ${d.getDate()}`
        : `${DAYS_LONG_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
      : phone
        ? `${DAYS_LONG_BN[d.getDay()]}, ${d.getDate()} ${MONTHS_BN[d.getMonth()]}`
        : `${DAYS_LONG_BN[d.getDay()]}, ${d.getDate()} ${MONTHS_BN[d.getMonth()]} ${d.getFullYear()}`;
  return h ? `${greg} • ${formatHijri(h, lang, phone)}` : greg;
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-[#7c4dff] shadow-[0_0_0_3px_rgba(255,255,255,0.1),0_0_12px_rgba(255,255,255,0.85)]',
  syncing: 'bg-blue-2 shadow-[0_0_12px_rgba(167,139,250,0.9)] animate-pulse',
  offline: 'bg-ink-4',
  error: 'bg-bad shadow-[0_0_10px_rgba(255,138,138,0.8)]'
};

export function Header() {
  const L = useL();
  const lang = useLang();
  const desktop = useIsDesktop();
  const user = useApp((s) => s.user);
  const cached = useApp((s) => s.cachedUsername);
  const status = useApp((s) => s.status);
  const ordersEnabled = useApp((s) => s.ordersEnabled);
  const desktopOrders = useApp((s) => s.desktopOrders);
  const dateText = useHeaderDate();
  const name = user?.username || cached;

  const statusText =
    status === 'online' ? name || 'Synced' : status === 'syncing' ? L('Sync হচ্ছে…', 'Syncing…') : status === 'error' ? L('Sync সমস্যা', 'Sync error') : L('Offline', 'Offline');

  const doLogout = async () => {
    if (await confirmDialog({ title: L('লগ আউট করতে চাও?', 'Log out?'), okText: L('লগ আউট', 'Log out'), danger: true })) {
      if (useApp.getState().demo) {
        location.href = location.pathname;
        return;
      }
      const fb = await import('../../lib/firebase');
      await fb.logout();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-gradient-to-b from-[#07060f]/90 to-[#07060f]/60 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 lg:gap-3 lg:px-6 lg:py-3">
        <LogoMark size={desktop ? 36 : 32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 text-[18px] font-medium tracking-[-0.025em] text-white">
            Doinik <span className="grad-text-x font-light">Life</span>
          </div>
          <div className="truncate text-[11px] text-ink-4">{dateText}</div>
        </div>
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          className="pill h-8 px-3 text-[11.5px] font-semibold text-ink-2 transition-colors hover:text-white"
          title={L('Switch to English', 'বাংলায় দেখো')}
        >
          <motion.span key={lang} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {lang === 'en' ? 'EN' : 'বাং'}
          </motion.span>
        </button>
        {desktop && ordersEnabled && (
          <Btn size="sm" icon={desktopOrders ? 'home' : 'trend'} onClick={() => useApp.setState({ desktopOrders: !desktopOrders })} className="h-8">
            {desktopOrders ? L('ড্যাশবোর্ড', 'Dashboard') : 'Orders'}
          </Btn>
        )}
        <button
          type="button"
          onClick={() => openModal({ type: 'account' })}
          className="pill h-8 max-w-[150px] px-3 text-[11.5px] font-medium text-ink-2 transition-colors hover:text-white"
          title={L('অ্যাকাউন্ট ডিটেইলস', 'Account details')}
        >
          <span className={cx('h-[7px] w-[7px] shrink-0 rounded-full', STATUS_DOT[status])} />
          <span className="hidden truncate min-[400px]:inline">{statusText}</span>
        </button>
        <IconBtn icon="power" label={L('লগ আউট', 'Log out')} size={32} onClick={doLogout} />
      </div>
      <div className="pointer-events-none absolute inset-x-[28%] -bottom-px h-px bg-gradient-to-r from-transparent via-blue-2/80 to-transparent" />
    </header>
  );
}
