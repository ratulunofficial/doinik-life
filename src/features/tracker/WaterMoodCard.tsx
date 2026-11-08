import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useApp, useL, useLang } from '../../lib/store';
import { setMood, setWater, setWaterGoal, useDay, useMood, useWaterGoal } from '../../lib/data';
import { addDays, dateKey, dateLabel, days, isFuture, isLocked, keyToDate } from '../../lib/dates';
import { Card, IconBtn, SecLabel, spring } from '../../components/ui';
import { cx, haptic } from '../../lib/format';

const MOODS: [number, string][] = [
  [5, '😄'],
  [4, '🙂'],
  [3, '😐'],
  [2, '😔'],
  [1, '😞']
];
const MOOD_LBL: Record<number, [string, string]> = { 5: ['দারুণ', 'Great'], 4: ['ভালো', 'Good'], 3: ['মোটামুটি', 'OK'], 2: ['একটু খারাপ', 'A bit off'], 1: ['খুব খারাপ', 'Very bad'] };

function Drop({ filled, i, onClick, disabled }: { filled: boolean; i: number; onClick: () => void; disabled: boolean }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.8 }}
      whileHover={disabled ? undefined : { y: -2 }}
      initial={false}
      animate={{ scale: filled ? 1 : 0.94 }}
      transition={{ ...spring, delay: i * 0.02 }}
      className="relative h-11 w-9"
      aria-label={`Glass ${i + 1}`}
    >
      <svg viewBox="0 0 24 30" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`dg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9caff" />
            <stop offset="1" stopColor="#6d3df5" />
          </linearGradient>
        </defs>
        <path d="M12 2.5s8.5 9.2 8.5 15.3A8.5 8.5 0 0 1 3.5 17.8C3.5 11.7 12 2.5 12 2.5z" fill="rgba(255,255,255,0.04)" stroke={filled ? 'rgba(205,184,255,0.9)' : 'rgba(255,255,255,0.18)'} strokeWidth="1.4" />
        <motion.path
          d="M12 2.5s8.5 9.2 8.5 15.3A8.5 8.5 0 0 1 3.5 17.8C3.5 11.7 12 2.5 12 2.5z"
          fill={`url(#dg${i})`}
          initial={false}
          animate={{ opacity: filled ? 1 : 0, scale: filled ? 1 : 0.4 }}
          style={{ transformOrigin: '12px 22px', filter: filled ? 'drop-shadow(0 0 6px rgba(167,139,250,0.7))' : 'none' }}
          transition={spring}
        />
      </svg>
    </motion.button>
  );
}

export const WaterMoodCard = memo(function WaterMoodCard({ delay = 0 }: { delay?: number }) {
  const L = useL();
  const lang = useLang();
  const key = useApp((s) => s.selectedKey);
  const todayKey = useApp((s) => s.todayKey);
  const day = useDay(key);
  const goal = useWaterGoal();
  const mood = useMood();
  const water = day?.water || 0;
  const locked = isLocked(key, todayKey);
  const fut = isFuture(key, todayKey);
  const isToday = key === todayKey;
  const [g, setG] = useState(String(goal));
  useEffect(() => setG(String(goal)), [goal]);
  const todayMood = mood[todayKey];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(keyToDate(todayKey), i - 6);
    return { d, m: mood[dateKey(d)], isToday: i === 6 };
  });

  return (
    <Card delay={delay}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SecLabel icon="droplet">{L('পানি ও মন', 'Water & Mood')}</SecLabel>
        <span className={cx('pill ml-auto px-2.5 py-1 text-[11px] font-medium', isToday ? 'text-blue-3' : 'text-ink-3')}>
          {isToday ? L('আজকে — ', 'Today — ') : locked ? '🔒 ' : fut ? '📅 ' : '✏️ '}
          {dateLabel(key, lang)}
        </span>
      </div>

      {fut ? (
        <div className="py-4 text-[13px] text-ink-3">{L('📅 ভবিষ্যতের দিন।', '📅 A future day.')}</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: goal }, (_, i) => (
              <Drop
                key={i}
                i={i}
                filled={i < water}
                disabled={locked}
                onClick={() => {
                  haptic();
                  setWater(key, i < water ? i : i + 1);
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[12.5px] text-ink-3">
              <span className="num text-[20px] text-white">{water}</span>/{goal} {L('গ্লাস', 'glasses')} —{' '}
              {water >= goal ? L('লক্ষ্য পূরণ! 🎉', 'Goal reached! 🎉') : L(`আরো ${goal - water} গ্লাস বাকি`, `${goal - water} to go`)}
            </div>
            {isToday && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-ink-4">{L('লক্ষ্য', 'Goal')}</span>
                <IconBtn icon="chevL" label="-" size={26} onClick={() => setWaterGoal(goal - 1)} />
                <input
                  className="field w-12 px-1 py-1 text-center text-[13px]"
                  inputMode="numeric"
                  value={g}
                  onChange={(e) => setG(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setWaterGoal(parseInt(g, 10) || 8)}
                />
                <IconBtn icon="chevR" label="+" size={26} onClick={() => setWaterGoal(goal + 1)} />
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2.5 flex items-center gap-2 text-[12.5px] text-ink-3">
          {todayMood ? (
            <>
              {L('আজকে', 'Today')}: <span className="text-[18px]">{todayMood.emoji}</span>
              <span className="font-semibold text-blue-3">{MOOD_LBL[todayMood.level]?.[lang === 'en' ? 1 : 0]}</span>
            </>
          ) : (
            L('আজকের mood বেছে নাও', "How's today feeling?")
          )}
        </div>
        <div className="flex gap-2">
          {MOODS.map(([lv, em]) => {
            const sel = todayMood?.level === lv;
            return (
              <motion.button
                key={lv}
                type="button"
                whileTap={{ scale: 0.85 }}
                whileHover={{ y: -3 }}
                onClick={() => {
                  haptic();
                  setMood(lv, em);
                }}
                className={cx(
                  'grid h-11 w-11 place-items-center rounded-full border text-[22px] transition-colors',
                  sel ? 'border-[#9b7bff] bg-white/15 shadow-[0_0_0_4px_rgba(255,255,255,0.08),0_0_22px_rgba(255,255,255,0.25)]' : 'border-line-2 bg-white/[0.04]'
                )}
              >
                {em}
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4 text-[11px] text-ink-4">{L('গত ৭ দিন', 'Last 7 days')}</div>
        <div className="mt-2 flex h-[72px] items-end gap-1.5">
          {last7.map(({ d, m, isToday: t }, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[12px] leading-none">{m ? m.emoji : '·'}</span>
              <motion.div
                className={cx('w-full rounded-md', m ? 'bg-gradient-to-t from-[#6d3df5] to-[#cdb8ff]' : 'bg-white/10')}
                initial={{ height: 0 }}
                animate={{ height: m ? m.level * 7 : 4 }}
                transition={{ ...spring, delay: i * 0.04 }}
              />
              <span className={cx('text-[9.5px]', t ? 'font-semibold text-white' : 'text-ink-4')}>{t ? L('আজ', 'Today') : days(lang)[d.getDay()]}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});
