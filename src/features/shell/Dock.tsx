import { AnimatePresence, motion } from 'motion/react';
import { setTab, useApp, useL, type Tab } from '../../lib/store';
import { useBazar } from '../../lib/data';
import { Icon, type IconName } from '../../components/Icon';
import { cx, haptic } from '../../lib/format';
import { spring } from '../../components/ui';

export function Dock() {
  const L = useL();
  const tab = useApp((s) => s.tab);
  const ordersEnabled = useApp((s) => s.ordersEnabled);
  const pending = useBazar().filter((b) => !b.done).length;
  const items: { tab: Tab; icon: IconName; label: string }[] = [
    { tab: 'cal', icon: 'home', label: L('হোম', 'Home') },
    { tab: 'tasks', icon: 'check', label: 'Tasks' },
    { tab: 'track', icon: 'droplet', label: L('ট্র্যাকার', 'Track') },
    ...(ordersEnabled ? [{ tab: 'orders' as Tab, icon: 'trend' as IconName, label: 'Orders' }] : []),
    { tab: 'expense', icon: 'wallet', label: L('খরচ', 'Expense') },
    { tab: 'bazar', icon: 'cart', label: L('বাজার', 'Bazar') }
  ];
  return (
    <nav
      className="fixed inset-x-2.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-50 grid rounded-[26px] border border-line-2 bg-[#0d0b1e]/80 p-1.5 shadow-[0_22px_50px_-10px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl sm:inset-x-auto sm:left-1/2 sm:w-[520px] sm:-translate-x-1/2"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      aria-label="Sections"
    >
      {items.map((it) => {
        const active = it.tab === tab;
        return (
          <button
            key={it.tab}
            type="button"
            onClick={() => {
              haptic();
              setTab(it.tab);
            }}
            className={cx('relative flex flex-col items-center gap-1 rounded-[18px] pt-1.5 pb-1 text-[10px] font-medium transition-colors', active ? 'text-white' : 'text-ink-4')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative grid h-7 w-11 place-items-center">
              {active && (
                <motion.span
                  layoutId="dock-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-b from-[#9466ff] to-[#6d3df5] shadow-[0_8px_20px_-6px_rgba(124,77,255,0.9),inset_0_1px_0_rgba(255,255,255,0.35)]"
                  transition={spring}
                />
              )}
              <motion.span className="relative" animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={spring}>
                <Icon name={it.icon} size={20} stroke={1.8} />
              </motion.span>
              {it.tab === 'bazar' && pending > 0 && (
                <span className="absolute -top-1 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#7c4dff] px-1 text-[9px] font-bold text-white">{pending}</span>
              )}
            </span>
            <span className="max-w-full truncate px-0.5">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Slim reminder on mobile when bazar items are pending (replaces the old banner). */
export function BazarBanner() {
  const L = useL();
  const tab = useApp((s) => s.tab);
  const pending = useBazar().filter((b) => !b.done).length;
  const show = pending > 0 && tab !== 'bazar';
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.button
          type="button"
          onClick={() => setTab('bazar')}
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={spring}
          className="tint-glass flex w-full items-center gap-2.5 overflow-hidden px-3.5 py-2.5 text-left"
        >
          <span className="ic-disc h-7 w-7">
            <Icon name="cart" size={14} stroke={2} />
          </span>
          <span className="flex-1 text-[12.5px] font-medium text-ink-2">
            {L(pending === 1 ? 'একটা বাজার বাকি আছে' : `${pending}টা বাজার বাকি আছে`, `${pending} bazar item${pending > 1 ? 's' : ''} pending`)}
          </span>
          <span className="pill px-2.5 py-1 text-[11px] font-semibold text-white">
            {L('দেখুন', 'View')} <Icon name="chevR" size={12} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
