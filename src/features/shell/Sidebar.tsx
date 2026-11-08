import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { confirmDialog, openModal, setLang, useApp, useL, useLang } from '../../lib/store';
import { Icon, type IconName } from '../../components/Icon';
import { cx } from '../../lib/format';
import { spring } from '../../components/ui';

type Item = { id: string; icon: IconName; label: string };

/** Scroll to a dashboard section (switching back from the orders sheet first if needed). */
export function goToSection(id: string) {
  const go = () => {
    if (id === 'sec-home') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (useApp.getState().desktopOrders) {
    useApp.setState({ desktopOrders: false });
    setTimeout(go, 120);
  } else go();
}

function useScrollSpy(ids: string[], enabled: boolean) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      if (window.scrollY < 80) return setActive(ids[0]);
      let best = ids[0];
      for (const id of ids.slice(1)) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) best = id;
      }
      setActive(best);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ids, enabled]);
  return active;
}

function Tip({ show, children }: { show: boolean; children: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line-2 bg-[#16122e] px-2.5 py-1 text-[12px] font-medium text-white shadow-xl"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function RailButton({ icon, label, active, onClick, badge }: { icon: IconName; label: string; active?: boolean; onClick: () => void; badge?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cx('relative grid h-11 w-11 place-items-center rounded-[14px] transition-colors', active ? 'text-white' : 'text-ink-3 hover:bg-white/[0.06] hover:text-white')}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          transition={spring}
          className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[#9b6bff] to-[#6d3df5] shadow-[0_8px_24px_-6px_rgba(124,77,255,0.9),inset_0_1px_0_rgba(255,255,255,0.3)]"
        />
      )}
      <span className="relative">
        <Icon name={icon} size={20} stroke={1.8} />
      </span>
      {badge && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#7c4dff] px-1 text-[9px] font-bold text-white ring-2 ring-[#120f26]">{badge}</span>}
      <Tip show={hover}>{label}</Tip>
    </button>
  );
}

export function Sidebar() {
  const L = useL();
  const lang = useLang();
  const desktopOrders = useApp((s) => s.desktopOrders);
  const ordersEnabled = useApp((s) => s.ordersEnabled);
  const items: Item[] = [
    { id: 'sec-home', icon: 'home', label: L('হোম', 'Home') },
    { id: 'sec-calendar', icon: 'calendar', label: L('ক্যালেন্ডার', 'Calendar') },
    { id: 'sec-tasks', icon: 'check', label: 'Tasks' },
    { id: 'sec-expense', icon: 'wallet', label: L('খরচ', 'Expense') },
    { id: 'sec-notes', icon: 'note', label: 'Notes' },
    { id: 'sec-bazar', icon: 'cart', label: L('বাজার', 'Bazar') }
  ];
  const active = useScrollSpy(
    items.map((i) => i.id),
    !desktopOrders
  );
  const logout = async () => {
    if (!(await confirmDialog({ title: L('লগ আউট করতে চাও?', 'Log out?'), okText: L('লগ আউট', 'Log out'), danger: true }))) return;
    if (useApp.getState().demo) return void (location.href = location.pathname);
    (await import('../../lib/firebase')).logout();
  };

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring}
        aria-label="Sections"
        className="fixed left-4 top-5 bottom-5 z-40 flex w-[64px] flex-col items-center gap-2 rounded-[22px] border border-white/[0.08] bg-[#141128]/80 py-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
      >
        {items.map((it) => (
          <RailButton key={it.id} icon={it.icon} label={it.label} active={!desktopOrders && active === it.id} onClick={() => goToSection(it.id)} />
        ))}
        {ordersEnabled && <RailButton icon="trend" label="Orders" active={desktopOrders} onClick={() => useApp.setState({ desktopOrders: !desktopOrders })} />}
        <RailButton icon="user" label={L('অ্যাকাউন্ট ও সেটিংস', 'Account & settings')} onClick={() => openModal({ type: 'account' })} />
        <div className="mt-auto flex flex-col items-center gap-2">
          <RailButton icon="globe" label={lang === 'en' ? 'বাংলায় দেখো' : 'Switch to English'} onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} badge={lang === 'en' ? 'EN' : 'বা'} />
          <RailButton icon="power" label={L('লগ আউট', 'Log out')} onClick={logout} />
        </div>
      </motion.nav>
    </>
  );
}
