import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { selectDay, shiftMonth, useApp, useL, useLang } from '../../lib/store';
import { getDay } from '../../lib/data';
import { bdHoliday, dateKey, dateLabel, days, isFuture, isLocked, keyToDate, months } from '../../lib/dates';
import { Card, SecLabel, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { cx, money } from '../../lib/format';

export const CalendarCard = memo(function CalendarCard({ delay = 0, id, panel = true }: { delay?: number; id?: string; panel?: boolean }) {
  const L = useL();
  const lang = useLang();
  const calY = useApp((s) => s.calY);
  const calM = useApp((s) => s.calM);
  const todayKey = useApp((s) => s.todayKey);
  const selected = useApp((s) => s.selectedKey);
  const raw = useApp((s) => s.raw);

  const cells = useMemo(() => {
    const first = new Date(calY, calM, 1).getDay();
    const n = new Date(calY, calM + 1, 0).getDate();
    const out: { key: string; d: number; other?: boolean }[] = [];
    const prevN = new Date(calY, calM, 0).getDate();
    for (let i = 0; i < first; i++) out.push({ key: 'p' + i, d: prevN - first + 1 + i, other: true });
    for (let d = 1; d <= n; d++) out.push({ key: `${calY}-${calM + 1}-${d}`, d });
    return out;
  }, [calY, calM]);

  return (
    <Card delay={delay} id={id}>
      <div className="mb-3 flex items-center justify-between">
        <SecLabel>{L('ক্যালেন্ডার', 'Calendar')}</SecLabel>
        {(calY !== keyToDate(todayKey).getFullYear() || calM !== keyToDate(todayKey).getMonth() || selected !== todayKey) && (
          <button
            type="button"
            className="rounded-full border border-line-2 px-3 py-1 text-[11px] font-semibold text-blue-3 hover:text-white"
            onClick={() => {
              const t = keyToDate(todayKey);
              useApp.setState({ calY: t.getFullYear(), calM: t.getMonth(), selectedKey: todayKey });
            }}
          >
            {L('আজ', 'Today')}
          </button>
        )}
      </div>
      <div className="mb-2 flex items-center justify-between px-1">
        <button type="button" aria-label={L('আগের মাস', 'Previous month')} onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-white">
          <Icon name="chevL" size={16} />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={calY + '-' + calM} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="text-[13.5px] font-medium text-ink-2">
            {months(lang)[calM]} {calY}
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label={L('পরের মাস', 'Next month')} onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-white">
          <Icon name="chevR" size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {days(lang).map((d) => (
          <div key={d} className="pb-1.5 text-[11px] font-semibold text-ink-3">
            {lang === 'en' ? d.charAt(0) : d}
          </div>
        ))}
        {cells.map((c) => {
          if (c.other) return <div key={c.key} className="grid h-10 place-items-center text-[12.5px] text-white/20 lg:h-9">{c.d}</div>;
          const date = keyToDate(c.key);
          const isToday = c.key === todayKey;
          const isSel = c.key === selected;
          const dd = getDay(c.key, raw);
          const has = !!dd && ((dd.tasks?.length ?? 0) > 0 || (dd.expenses?.length ?? 0) > 0 || dd.water > 0);
          const fut = isFuture(c.key, todayKey);
          const locked = isLocked(c.key, todayKey);
          const hol = bdHoliday(date, lang);
          return (
            <motion.button
              key={c.key}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => selectDay(c.key)}
              title={hol || undefined}
              className={cx(
                'relative grid h-10 place-items-center text-[13px] transition-colors lg:h-9',
                isToday ? 'font-semibold text-white' : isSel ? 'text-white' : hol ? 'text-[#ff9b9b]' : locked ? 'text-ink-3' : 'text-ink-2'
              )}
            >
              <span className={cx('absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors lg:h-[32px] lg:w-[32px]', !isToday && !isSel && 'hover:bg-white/[0.07]')} />
              {isToday && (
                <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#9b6bff] to-[#6d3df5] shadow-[0_6px_18px_-4px_rgba(124,77,255,0.9)] lg:h-[32px] lg:w-[32px]" />
              )}
              {isSel && !isToday && (
                <motion.span layoutId="cal-sel" transition={spring} className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[inset_0_0_0_1.5px_rgba(167,139,250,0.85)] lg:h-[32px] lg:w-[32px]" />
              )}
              <span className="pointer-events-none relative">{c.d}</span>
              {has && <span className={cx('absolute bottom-0 h-1 w-1 rounded-full', isToday ? 'bg-white' : fut ? 'bg-warn' : 'bg-blue-2')} />}
              {hol && <span className="absolute right-0.5 top-0.5 text-[7px] leading-none">🇧🇩</span>}
            </motion.button>
          );
        })}
      </div>
      {panel && <DayPanel />}
    </Card>
  );
});

function DayPanel() {
  const L = useL();
  const lang = useLang();
  const key = useApp((s) => s.selectedKey);
  const todayKey = useApp((s) => s.todayKey);
  const day = useApp((s) => getDay(key, s.raw));
  const hol = bdHoliday(keyToDate(key), lang);
  const locked = isLocked(key, todayKey);
  const fut = isFuture(key, todayKey);
  const total = (day?.expenses || []).reduce((s, e) => s + (Number(e.amt) || 0), 0);
  const empty = !day || (!day.tasks?.length && !day.expenses?.length && !day.water);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-4 border-t border-line pt-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-blue-3">
          <Icon name={locked ? 'lock' : 'calendar'} size={14} />
          {key === todayKey ? L('আজ — ', 'Today — ') : fut ? L('ভবিষ্যৎ — ', 'Upcoming — ') : ''}
          {dateLabel(key, lang)}
        </div>
        {hol && <div className="mb-2 rounded-xl border border-[#ff9b9b]/25 bg-[#ff9b9b]/[0.06] px-3 py-2 text-[12px] text-[#ffc4c4]">🇧🇩 {hol}</div>}
        {locked && <div className="mb-2 text-[11.5px] text-ink-4">{L('🔒 এই দিন lock হয়ে গেছে', '🔒 This day is locked')}</div>}
        {fut && <div className="mb-2 text-[11.5px] text-blue-3">{L('📅 ভবিষ্যতের দিন — task plan করতে পারো', '📅 A future day — you can plan tasks')}</div>}
        {empty ? (
          <div className="text-[12.5px] text-ink-4">{L('এই দিনের কোনো data নেই।', 'Nothing recorded for this day.')}</div>
        ) : (
          <div className="space-y-1.5 text-[12.5px]">
            {!!day?.tasks?.length && (
              <>
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-ink-4">Tasks ({day.tasks.length})</div>
                {day.tasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className={cx('h-3.5 w-3.5 shrink-0 rounded-[5px] border', t.done ? 'border-blue bg-blue' : 'border-line-3')} />
                    <span className={cx('truncate', t.done ? 'text-ink-4 line-through' : 'text-ink-2')}>{t.text}</span>
                  </div>
                ))}
                {day.tasks.length > 6 && <div className="text-ink-4">+{day.tasks.length - 6}</div>}
              </>
            )}
            {!!day?.expenses?.length && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-ink-3">{L('খরচ', 'Spent')} · {day.expenses.length}</span>
                <span className="font-medium text-white">{money(total)}</span>
              </div>
            )}
            {(day?.water || 0) > 0 && <div className="text-ink-3">💧 {day!.water} {L('গ্লাস', 'glasses')}</div>}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function useTodayKey() {
  return useApp((s) => s.todayKey);
}
export { dateKey };
