import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { openModal, useApp, useL, useLang } from '../../lib/store';
import { DAYS_LONG_BN, DAYS_LONG_EN, MONTHS_BN, MONTHS_EN, bnDigits } from '../../lib/dates';
import { formatHijri, getHijri, type Hijri } from '../../lib/hijri';
import { cx } from '../../lib/format';
import { softSpring } from '../../components/ui';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-good shadow-[0_0_10px_rgba(111,224,180,0.8)]',
  syncing: 'bg-blue-2 animate-pulse',
  offline: 'bg-ink-4',
  error: 'bg-bad'
};

/** "Good Morning, ratul 👋" on the left, a big clock on the right (reference header). */
export function Greeting() {
  const L = useL();
  const lang = useLang();
  const now = useNow();
  const name = useApp((s) => s.user?.username || s.cachedUsername);
  const status = useApp((s) => s.status);
  const [h, setH] = useState<Hijri | null>(null);
  const [rev, setRev] = useState(0);
  const dayKey = now.toDateString();
  useEffect(() => {
    let alive = true;
    getHijri(now).then((x) => alive && setH(x));
    const on = () => setRev((r) => r + 1);
    window.addEventListener('hijri-offset', on);
    return () => {
      alive = false;
      window.removeEventListener('hijri-offset', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, rev]);

  const hr = now.getHours();
  const greet = hr >= 5 && hr < 12 ? L('শুভ সকাল', 'Good Morning') : hr < 17 && hr >= 12 ? L('শুভ দুপুর', 'Good Afternoon') : hr >= 17 && hr < 20 ? L('শুভ সন্ধ্যা', 'Good Evening') : L('শুভ রাত্রি', 'Good Night');
  const h12 = hr % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  const clock = lang === 'bn' ? `${bnDigits(String(h12).padStart(2, '0'))}:${bnDigits(mm)}` : `${String(h12).padStart(2, '0')}:${mm}`;
  const ampm = hr < 12 ? 'AM' : 'PM';
  const date = lang === 'en' ? `${DAYS_LONG_EN[now.getDay()]}, ${MONTHS_EN[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}` : `${DAYS_LONG_BN[now.getDay()]}, ${now.getDate()} ${MONTHS_BN[now.getMonth()]} ${now.getFullYear()}`;
  const statusText = status === 'online' ? L('Synced', 'Synced') : status === 'syncing' ? L('Sync হচ্ছে…', 'Syncing…') : status === 'error' ? L('Sync সমস্যা', 'Sync error') : 'Offline';

  return (
    <motion.section
      id="sec-home"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={softSpring}
      className="flex items-start justify-between gap-4 px-1 pt-1 pb-2 lg:pb-3"
    >
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-white lg:text-[40px]">{greet},</h1>
        <div className="mt-1 flex items-center gap-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] lg:text-[42px]">
          <span className="truncate bg-gradient-to-r from-[#a78bfa] via-[#9b6bff] to-[#c084fc] bg-clip-text text-transparent">{name || 'Friend'}</span>
          <motion.span className="inline-block origin-[70%_70%]" animate={{ rotate: [0, 16, -8, 14, -4, 10, 0] }} transition={{ duration: 1.8, delay: 0.6, repeat: Infinity, repeatDelay: 6 }}>
            👋
          </motion.span>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3 lg:text-[14px]">
          {(lang === 'en' ? ['Focus', 'Plan', 'Execute', 'Succeed'] : ['ফোকাস', 'প্ল্যান', 'কাজ', 'সাফল্য']).map((w, i) => (
            <span key={w}>
              {i > 0 && <span className="mx-1.5 text-blue-2/70">•</span>}
              {w}
            </span>
          ))}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-start justify-end gap-1.5">
          <span className="text-[40px] font-extralight leading-none tracking-[-0.04em] text-white tabular-nums lg:text-[76px]">{clock}</span>
          <span className="mt-1 text-[12px] font-semibold text-blue-2 lg:mt-3 lg:text-[15px]">{ampm}</span>
        </div>
        <div className="mt-1.5 text-[11.5px] text-ink-3 lg:mt-2 lg:text-[14.5px]">{date}</div>
        {h && <div className="hidden text-[12px] text-ink-4 lg:block">{formatHijri(h, lang, false)}</div>}
        <button
          type="button"
          onClick={() => openModal({ type: 'account' })}
          className="mt-2.5 hidden items-center gap-2 rounded-full border border-line-2 bg-white/[0.04] px-3 py-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:text-white lg:inline-flex"
          title={L('অ্যাকাউন্ট ডিটেইলস', 'Account details')}
        >
          <span className={cx('h-[7px] w-[7px] rounded-full', STATUS_DOT[status])} />
          {statusText} · {name}
        </button>
      </div>
    </motion.section>
  );
}
