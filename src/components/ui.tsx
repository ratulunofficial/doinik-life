import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useMotionValue, useSpring, useTransform, type PanInfo } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { cx } from '../lib/format';
import { settleConfirm, useApp, useL } from '../lib/store';

export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;

export function useMedia(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(q);
    const on = () => setM(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [q]);
  return m;
}
export const useIsDesktop = () => useMedia('(min-width: 1024px)');
export const useIsPhone = () => useMedia('(max-width: 639px)');
const finePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ─────────────────────────── Card ───────────────────────────
export function Card({ children, className, delay = 0, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: RPointerEvent) => {
    if (!finePointer || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
    ref.current.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
  };
  const onLeave = () => {
    ref.current?.style.removeProperty('--mx');
    ref.current?.style.removeProperty('--my');
  };
  return (
    <motion.section
      ref={ref}
      id={id}
      className={cx('glass scroll-mt-4 p-4 sm:p-5', className)}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...softSpring, delay }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.section>
  );
}

// ─────────────────────────── Section label pill ───────────────────────────
/** Card title — plain and calm, like the reference ("Calendar", "My Tasks"). */
export function SecLabel({ children, className }: { icon?: IconName; children: ReactNode; className?: string }) {
  return <h3 className={cx('truncate text-[15.5px] font-semibold tracking-[-0.01em] text-white', className)}>{children}</h3>;
}

// ─────────────────────────── Buttons ───────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'white' | 'danger';
export function Btn({
  variant = 'ghost',
  icon,
  children,
  className,
  size = 'md',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: IconName; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-[11.5px]' : size === 'lg' ? 'px-5 py-3 text-[14px]' : 'px-4 py-2.5 text-[13px]';
  return (
    <button type="button" className={cx('btn', 'btn-' + variant, sz, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} stroke={2} />}
      {children}
    </button>
  );
}
export function IconBtn({ icon, label, size = 34, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('icon-btn', className)} style={{ width: size, height: size }} {...rest}>
      <Icon name={icon} size={Math.round(size * 0.46)} stroke={2} />
    </button>
  );
}

// ─────────────────────────── Segmented control (shared-layout glider) ───────────────────────────
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  tone = 'blue',
  className,
  small
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  tone?: 'blue' | 'white';
  className?: string;
  small?: boolean;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cx('grid gap-1 rounded-full border border-line-2 bg-white/[0.03] p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'relative rounded-full font-semibold transition-colors',
              small ? 'px-2 py-1.5 text-[11px]' : 'px-2 py-2 text-[12.5px]',
              active ? (tone === 'white' ? 'text-white' : 'text-white') : 'text-ink-3 hover:text-ink-2'
            )}
          >
            {active && (
              <motion.span
                layoutId={'seg' + id}
                className={cx(
                  'absolute inset-0 rounded-full',
                  tone === 'white'
                    ? 'bg-[#3a2d6e] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]'
                    : 'bg-gradient-to-b from-[#9466ff] to-[#6d3df5] shadow-[0_8px_20px_-6px_rgba(124,77,255,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]'
                )}
                transition={spring}
              />
            )}
            <span className="relative z-10 block truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────── Animated number ───────────────────────────
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const sp = useSpring(mv, { stiffness: 140, damping: 22 });
  const text = useTransform(sp, (v) => format(v));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

// ─────────────────────────── Modal / bottom sheet ───────────────────────────
export function Modal({
  open,
  onClose,
  children,
  width = 440,
  className,
  sheet = true,
  label
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
  sheet?: boolean;
  label?: string;
}) {
  const phone = useIsPhone();
  const asSheet = sheet && phone;
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 700) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cx('fixed inset-0 z-[60] flex justify-center', asSheet ? 'items-end' : 'items-center p-4')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div className="absolute inset-0 bg-[#050410]/75 backdrop-blur-md" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cx(
              'relative flex max-h-[90dvh] w-full flex-col overflow-hidden border border-line-2',
              'bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,77,255,0.22),transparent_60%),linear-gradient(180deg,rgba(22,17,42,0.97),rgba(10,8,20,0.98))]',
              'shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]',
              asSheet ? 'rounded-t-[28px] pb-[env(safe-area-inset-bottom)]' : 'rounded-[28px]',
              className
            )}
            style={asSheet ? undefined : { maxWidth: width }}
            initial={asSheet ? { y: '100%' } : { opacity: 0, y: 26, scale: 0.92 }}
            animate={asSheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={asSheet ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.95 }}
            transition={asSheet ? { type: 'spring', stiffness: 380, damping: 38 } : { type: 'spring', stiffness: 460, damping: 32 }}
            drag={asSheet ? 'y' : false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            onDragEnd={onDragEnd}
          >
            {asSheet && <SheetHandle onPointerDown={(e) => controls.start(e)} />}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
function SheetHandle({ onPointerDown }: { onPointerDown: (e: RPointerEvent) => void }) {
  return (
    <div className="flex cursor-grab touch-none justify-center pt-2.5 pb-2" onPointerDown={onPointerDown}>
      <span className="h-1 w-10 rounded-full bg-white/25" />
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, icon }: { title: ReactNode; subtitle?: ReactNode; onClose?: () => void; icon?: IconName }) {
  const L = useL();
  return (
    <div className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
      {icon && (
        <span className="ic-disc mt-0.5 h-9 w-9">
          <Icon name={icon} size={17} stroke={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-[21px] font-normal tracking-[-0.025em] text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {onClose && <IconBtn icon="x" label={L('বন্ধ করো', 'Close')} size={32} onClick={onClose} />}
    </div>
  );
}

// ─────────────────────────── Toasts ───────────────────────────
export function ToastHost() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(100px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={spring}
            className="pill max-w-full gap-2.5 bg-[#110e24]/90 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_22px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <span className="dot" />
            <span className="truncate">{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Confirm dialog ───────────────────────────
export function ConfirmHost() {
  const req = useApp((s) => s.confirmReq);
  const L = useL();
  return (
    <Modal open={!!req} onClose={() => settleConfirm(false)} width={400} label={req?.title}>
      {req && (
        <div className="px-6 pt-5 pb-6">
          <h2 className="text-[20px] tracking-[-0.02em] text-white">{req.title}</h2>
          {req.message && <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-3">{req.message}</p>}
          <div className="mt-6 flex gap-2.5">
            <Btn className="flex-1" onClick={() => settleConfirm(false)}>
              {L('বাতিল', 'Cancel')}
            </Btn>
            <Btn variant={req.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => settleConfirm(true)}>
              {req.okText || L('✓ হ্যাঁ', '✓ Yes')}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────── Misc ───────────────────────────
export function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-2 px-4 py-7 text-center text-[12.5px] text-ink-4">
      <span className="ic-disc h-9 w-9 opacity-90">
        <Icon name={icon} size={16} />
      </span>
      {children}
    </div>
  );
}

export function SeeMore({ expanded, hidden, onClick }: { expanded: boolean; hidden: number; onClick: () => void }) {
  const L = useL();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-[12px] font-semibold text-blue-3 transition-colors hover:bg-white/[0.04]"
    >
      {expanded ? L('কম দেখাও', 'Show less') : L(`আরো ${hidden} টা দেখাও`, `Show ${hidden} more`)}
      <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="inline-flex">
        <Icon name="chevD" size={14} />
      </motion.span>
    </button>
  );
}

/** Ripple feedback for every .btn — one global listener. */
export function useRipples() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const on = (e: PointerEvent) => {
      const b = (e.target as HTMLElement)?.closest?.('.btn') as HTMLElement | null;
      if (!b || (b as HTMLButtonElement).disabled) return;
      const r = b.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = e.clientX - r.left - size / 2 + 'px';
      s.style.top = e.clientY - r.top - size / 2 + 'px';
      b.appendChild(s);
      setTimeout(() => s.remove(), 700);
    };
    document.addEventListener('pointerdown', on, { passive: true });
    return () => document.removeEventListener('pointerdown', on);
  }, []);
}
