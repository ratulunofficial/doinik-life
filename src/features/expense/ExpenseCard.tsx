import { memo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, useL, useLang } from '../../lib/store';
import { addExpense, deleteExpense, getDay, useDay } from '../../lib/data';
import { dateLabel, isFuture, isLocked, months } from '../../lib/dates';
import { AnimatedNumber, Btn, Card, IconBtn, SecLabel, SeeMore, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { money } from '../../lib/format';
import { Analytics } from './Analytics';

export const ExpenseCard = memo(function ExpenseCard({ delay = 0, id }: { delay?: number; id?: string }) {
  const L = useL();
  const lang = useLang();
  const key = useApp((s) => s.selectedKey);
  const todayKey = useApp((s) => s.todayKey);
  const calY = useApp((s) => s.calY);
  const calM = useApp((s) => s.calM);
  const monthTotal = useApp((s) => {
    const n = new Date(calY, calM + 1, 0).getDate();
    let t = 0;
    for (let d = 1; d <= n; d++) for (const e of getDay(`${calY}-${calM + 1}-${d}`, s.raw)?.expenses || []) t += Number(e.amt) || 0;
    return t;
  });
  const day = useDay(key);
  const exps = day?.expenses || [];
  const locked = isLocked(key, todayKey);
  const fut = isFuture(key, todayKey);
  const isToday = key === todayKey;
  const total = exps.reduce((s, e) => s + (Number(e.amt) || 0), 0);
  const [all, setAll] = useState(false);
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [analytics, setAnalytics] = useState(false);
  const shown = all ? exps : exps.slice(0, 4);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addExpense(key, name, parseFloat(amt))) {
      setName('');
      setAmt('');
    }
  };

  return (
    <Card delay={delay} id={id}>
      <AnimatePresence mode="wait" initial={false}>
        {analytics ? (
          <motion.div key="an" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <Analytics onClose={() => setAnalytics(false)} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <div className="mb-4 flex items-center justify-between">
              <SecLabel icon="wallet">Daily Expense</SecLabel>
              <IconBtn icon="bars" label={L('বিশ্লেষণ — মাসিক / বাৎসরিক / সর্বমোট', 'Analytics — monthly / yearly / all-time')} onClick={() => setAnalytics(true)} />
            </div>

            <div className="tint-glass mb-4 flex items-center justify-between px-4 py-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                {months(lang)[calM]} {calY} {L('মাসের মোট', 'total')}
              </span>
              <AnimatedNumber value={monthTotal} format={(n) => money(n)} className="num text-[22px] text-white" />
            </div>

            {locked ? (
              <div className="mb-3 rounded-xl border border-line px-3 py-2.5 text-[12px] text-ink-4">🔒 {dateLabel(key, lang)} {L('lock।', 'is locked.')}</div>
            ) : (
              <form onSubmit={submit} className="mb-3 flex gap-2">
                <input
                  className="field flex-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={fut ? L('প্ল্যান করা খরচ...', 'Planned expense...') : isToday ? L('কী কিনলে...', 'What did you buy...') : L('গতকালের খরচ...', "Yesterday's expense...")}
                />
                <input className="field w-[92px] shrink-0 sm:w-[110px]" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} placeholder={L('টাকা *', 'Amount *')} />
                <Btn variant="primary" type="submit" icon="plus" className="shrink-0 px-3.5" aria-label="Add" />
              </form>
            )}

            <div>
              <AnimatePresence initial={false}>
                {shown.map((e) => (
                  <motion.div key={String(e.id)} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 30 }} transition={spring} className="overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-line py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                        {e.name || L('(নাম নেই)', '(no name)')}
                        {e.fromBazar && <span className="ml-2 rounded-full bg-blue/15 px-2 py-0.5 text-[10px] text-blue-3">{L('বাজার', 'Bazar')}</span>}
                      </span>
                      <span className="text-[14px] font-medium text-white">{money(Number(e.amt) || 0)}</span>
                      {!locked && (
                        <button type="button" onClick={() => deleteExpense(key, e)} className="grid h-7 w-7 place-items-center rounded-full text-ink-4 hover:bg-white/10 hover:text-white" aria-label="Delete">
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {exps.length > 4 && <SeeMore expanded={all} hidden={exps.length - 4} onClick={() => setAll(!all)} />}
              {!exps.length && <div className="py-2 text-[13px] text-ink-4">{L('এই দিনের কোনো খরচ নেই।', 'No expenses for this day.')}</div>}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[12.5px] text-ink-3">{isToday ? L('আজকের মোট', "Today's total") : dateLabel(key, lang) + L(' মোট', ' total')}</span>
              <AnimatedNumber value={total} format={(n) => money(n)} className="num text-[20px] text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
});
