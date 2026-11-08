import { memo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { openModal, useApp, useL, useLang } from '../../lib/store';
import { addLoan, loanRemaining, useLoans } from '../../lib/data';
import { months, toISODate } from '../../lib/dates';
import { AnimatedNumber, Btn, Card, Empty, SecLabel, SeeMore, Segmented, spring } from '../../components/ui';
import { cx, money } from '../../lib/format';

export const LoansCard = memo(function LoansCard({ delay = 0 }: { delay?: number }) {
  const L = useL();
  const lang = useLang();
  const loans = useLoans();
  const todayKey = useApp((s) => s.todayKey);
  const [tab, setTab] = useState<'gave' | 'took'>('gave');
  const [all, setAll] = useState(false);
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState('');
  const gave = loans.filter((l) => l.type === 'gave' && !l.settled);
  const took = loans.filter((l) => l.type === 'took' && !l.settled);
  const gaveT = gave.reduce((s, l) => s + loanRemaining(l), 0);
  const tookT = took.reduce((s, l) => s + loanRemaining(l), 0);
  const net = gaveT - tookT;
  const cur = tab === 'gave' ? gave : took;
  const shown = all ? cur : cur.slice(0, 3);

  const fmtDate = (s: string) => {
    const p = (s || '').split('-');
    return p.length === 3 ? `${+p[2]} ${months(lang)[+p[1] - 1]}` : s;
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // stored as "YYYY-MM-DD" from the date input, or today's key — same as the original
    if (addLoan(tab, name, parseFloat(amt), date || todayKey)) {
      setName('');
      setAmt('');
      setDate('');
    }
  };

  return (
    <Card delay={delay}>
      <SecLabel icon="loan" className="mb-4">
        {L('ধার / লোন ট্র্যাকার', 'Loan tracker')}
      </SecLabel>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { l: L('আমি দিয়েছি', 'I gave'), v: gaveT },
          { l: L('আমি নিয়েছি', 'I took'), v: tookT }
        ].map((b) => (
          <div key={b.l} className="tint-glass px-3.5 py-3">
            <div className="text-[11px] font-medium text-ink-3">{b.l}</div>
            <AnimatedNumber value={b.v} format={money} className="num text-[24px] text-white" />
          </div>
        ))}
      </div>
      <Segmented
        tone="white"
        small
        className="mb-3"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setAll(false);
        }}
        options={[
          { value: 'gave', label: L('📤 কাকে দিয়েছি', '📤 Lent to') },
          { value: 'took', label: L('📥 কার কাছে নিয়েছি', '📥 Borrowed from') }
        ]}
      />
      <form onSubmit={submit} className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
        <input className="field col-span-2 sm:col-span-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === 'gave' ? L('কাকে দিয়েছেন *', 'Lent to *') : L('কার কাছে নিয়েছেন *', 'Borrowed from *')} />
        <input className="field" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} placeholder={L('৳ টাকা *', '৳ amount *')} />
        <input className="field" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
        <Btn variant="primary" type="submit" icon="plus" className="col-span-2 sm:col-span-1">
          <span className="sm:hidden">{L('যোগ করো', 'Add')}</span>
        </Btn>
      </form>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, x: tab === 'gave' ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {!cur.length ? (
            <Empty icon="loan">{tab === 'gave' ? L('কাউকে ধার দেননি।', "You haven't lent anyone money.") : L('কারো কাছে ধার নেননি।', "You haven't borrowed from anyone.")}</Empty>
          ) : (
            <AnimatePresence initial={false}>
              {shown.map((l) => {
                const rem = loanRemaining(l);
                return (
                  <motion.div key={l.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-line py-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9466ff]/40 to-[#6d3df5]/10 text-[14px] font-medium text-white">{l.name.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{l.name}</div>
                        <div className="text-[11px] text-ink-4">
                          📅 {fmtDate(l.date)}
                          {l.paid > 0 && <span className="ml-2 text-blue-3">✓ {money(l.paid)} {L('পরিশোধিত', 'paid')}</span>}
                        </div>
                      </div>
                      <div className={cx('text-[15px] font-medium', l.type === 'gave' ? 'text-blue-3' : 'text-white')}>{money(rem)}</div>
                      <div className="flex flex-col gap-1 sm:flex-row">
                        <button type="button" onClick={() => openModal({ type: 'addMore', loanId: l.id })} className="pill px-2.5 py-1 text-[10.5px] font-semibold text-ink-2 hover:text-white">
                          + {L('আরও', 'More')}
                        </button>
                        <button type="button" onClick={() => openModal({ type: 'settle', loanId: l.id })} className="rounded-full bg-[#7c4dff] px-2.5 py-1 text-[10.5px] font-semibold text-white">
                          {L('শোধ', 'Settle')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          {cur.length > 3 && <SeeMore expanded={all} hidden={cur.length - 3} onClick={() => setAll(!all)} />}
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[12.5px] text-ink-3">{L('নেট পজিশন', 'Net position')}</span>
        <span className={cx('num text-[20px]', net > 0 ? 'text-blue-3' : net < 0 ? 'text-white' : 'text-ink-3')}>
          {net > 0 ? '+' : net < 0 ? '-' : ''}
          {money(Math.abs(net))}
        </span>
      </div>
    </Card>
  );
});
