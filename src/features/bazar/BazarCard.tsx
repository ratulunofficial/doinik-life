import { memo, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { confirmDialog, toast, useL, useLang } from '../../lib/store';
import { BAZAR_CATS, UNITS, addBazarItem, catInfo, clearBazarAll, clearBazarDone, deleteBazarItem, formatQty, setBazarPrice, toggleBazarItem, useBazar } from '../../lib/data';
import { AnimatedNumber, Btn, Card, Empty, SecLabel, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { cx, haptic, money } from '../../lib/format';
import type { BazarItem } from '../../lib/types';

function Ring({ pct }: { pct: number }) {
  const r = 21, c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 50 50" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6d3df5" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <motion.circle cx="25" cy="25" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[13px] font-medium text-white">{pct}%</div>
    </div>
  );
}

function PriceInput({ item }: { item: BazarItem }) {
  const [v, setV] = useState(item.price > 0 ? String(item.price) : '');
  useEffect(() => setV(item.price > 0 ? String(item.price) : ''), [item.price]);
  return (
    <label className={cx('flex items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors', item.price > 0 ? 'border-blue-2/40 bg-blue/10' : 'border-line-2 bg-white/[0.03]')} onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-ink-4">৳</span>
      <input
        className="w-14 bg-transparent text-right text-[13px] text-white outline-none placeholder:text-ink-4"
        inputMode="numeric"
        placeholder="0"
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => setBazarPrice(item.id, parseFloat(v) || 0)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export const BazarCard = memo(function BazarCard({ delay = 0, id }: { delay?: number; id?: string }) {
  const L = useL();
  const lang = useLang();
  const en = lang === 'en';
  const items = useBazar();
  const [filter, setFilter] = useState('all');
  const [name, setName] = useState('');
  const [cat, setCat] = useState('grocery');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');

  const total = items.length;
  const done = items.filter((x) => x.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const budget = items.reduce((s, x) => s + (x.price || 0), 0);
  let list = items;
  if (filter === 'pending') list = items.filter((x) => !x.done);
  else if (filter === 'done') list = items.filter((x) => x.done);
  else if (filter !== 'all') list = items.filter((x) => x.cat === filter);
  list = [...list].sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : !a.done ? a.addedAt - b.addedAt : (b.doneAt || 0) - (a.doneAt || 0)));
  const firstDone = list.findIndex((x) => x.done);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (addBazarItem(name, cat, !isNaN(q) && q > 0 ? q : null, unit || null)) {
      setName('');
      setQty('');
      setUnit('');
    }
  };

  const chips: { k: string; l: string }[] = [
    { k: 'all', l: L('📋 সব', '📋 All') },
    { k: 'pending', l: L('⏳ বাকি', '⏳ Pending') },
    { k: 'done', l: L('✅ কেনা', '✅ Bought') },
    ...Object.entries(BAZAR_CATS)
      .filter(([k]) => k !== 'other')
      .map(([k, c]) => ({ k, l: c.emoji + ' ' + (en ? c.en : c.bn) }))
  ];
  const subtitle = !total ? L('কী কিনতে হবে?', 'What do you need?') : done === total ? L('🎉 সব কেনা হয়ে গেছে!', '🎉 Everything is bought!') : L(`${total - done} টা বাকি · ${done}/${total} শেষ`, `${total - done} left · ${done}/${total} done`);

  return (
    <Card delay={delay} id={id}>
      <SecLabel icon="cart" className="mb-4">
        {L('বাজার লিস্ট', 'Shopping list')}
      </SecLabel>
      <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-5">
        <div>
          <div className="tint-glass mb-4 p-4">
            <div className="flex items-center gap-3">
              <span className="ic-disc h-10 w-10">
                <Icon name="cart" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-white">{L('আজকের বাজার', "Today's bazar")}</div>
                <div className="text-[11.5px] text-ink-3">{subtitle}</div>
              </div>
              <Ring pct={pct} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { v: total, l: L('মোট আইটেম', 'Items'), f: (n: number) => String(Math.round(n)) },
                { v: done, l: L('কেনা শেষ', 'Bought'), f: (n: number) => String(Math.round(n)) },
                { v: budget, l: L('আনুমানিক', 'Estimate'), f: money }
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-line bg-white/[0.03] px-2 py-2 text-center">
                  <AnimatedNumber value={s.v} format={s.f} className="block text-[16px] font-medium text-white" />
                  <div className="text-[10px] text-ink-4">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="mb-3 grid grid-cols-2 gap-2">
            <input className="field col-span-2" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('পণ্যের নাম... (যেমন: চাল, মাছ)', 'Item name... (e.g. rice, fish)')} />
            <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
              {Object.entries(BAZAR_CATS).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.emoji} {en ? c.en : c.bn}
                </option>
              ))}
            </select>
            <Btn variant="primary" type="submit" icon="plus">
              {L('যোগ করো', 'Add')}
            </Btn>
            <input className="field" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} placeholder={L('পরিমাণ (optional)', 'Qty (optional)')} />
            <select className="field" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">{L('— একক —', '— unit —')}</option>
              {Object.entries(UNITS).map(([k, u]) => (
                <option key={k} value={k}>
                  {en ? u[1] : `${u[0]} (${u[1]})`}
                </option>
              ))}
            </select>
          </form>

          <div data-noswipe className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
            {chips.map((c) => (
              <button
                key={c.k}
                type="button"
                onClick={() => setFilter(c.k)}
                className={cx('shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors', filter === c.k ? 'border-[#9b7bff] bg-[#7c4dff] font-semibold text-white' : 'border-line-2 bg-white/[0.035] text-ink-3 hover:text-white')}
              >
                {c.l}
              </button>
            ))}
          </div>
          {total > 0 && (
            <div className="mb-4 flex gap-2">
              <Btn
                size="sm"
                icon="reset"
                onClick={async () => {
                  if (!done) return toast(L('কেনা item নেই', 'Nothing bought yet'));
                  if (await confirmDialog({ title: L('🧹 কেনা items ক্লিয়ার', '🧹 Clear bought items'), message: L(`${done} টি কেনা item মুছে দেবে?\n(Expense রেকর্ড থাকবে)`, `Remove ${done} bought items?\n(Expense records stay)`), okText: L('✓ মুছে দাও', '✓ Clear') })) {
                    clearBazarDone();
                    toast(L(`🧹 ${done} টি ক্লিয়ার হয়েছে`, `🧹 ${done} cleared`));
                  }
                }}
              >
                {L('কেনা ক্লিয়ার', 'Clear bought')}
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                icon="trash"
                onClick={async () => {
                  if (await confirmDialog({ title: L('🗑️ পুরো লিস্ট মুছে দাও', '🗑️ Clear the whole list'), message: L('পুরো লিস্ট মুছে দেবে?\n(কেনা items এর expense রেকর্ড থাকবে)', 'Delete the whole list?\n(Expenses for bought items stay)'), okText: L('✓ সব মুছো', '✓ Delete all'), danger: true })) {
                    clearBazarAll();
                    toast(L('🗑️ সব ক্লিয়ার হয়েছে', '🗑️ All cleared'));
                  }
                }}
              >
                {L('সব মুছো', 'Delete all')}
              </Btn>
            </div>
          )}
        </div>

        <div className="scroll-thin lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
          {!list.length ? (
            <Empty icon={total ? 'search' : 'cart'}>{total ? L('এই category তে কিছু নেই', 'Nothing in this filter') : L('লিস্ট খালি — উপরে items যোগ করো', 'The list is empty — add items above')}</Empty>
          ) : (
            <AnimatePresence initial={false}>
              {list.map((it, i) => {
                const c = catInfo(it.cat);
                const q = formatQty(it, en);
                return (
                  <motion.div key={it.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 40 }} transition={spring} className="overflow-hidden">
                    {filter === 'all' && i === firstDone && (
                      <div className="my-2 flex items-center gap-2 text-[10.5px] font-semibold text-ink-4">
                        <span className="hairline flex-1" />✓ {L('কেনা হয়ে গেছে', 'Bought')}
                        <span className="hairline flex-1" />
                      </div>
                    )}
                    <div className={cx('mb-2 flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors', it.done ? 'border-line bg-white/[0.015]' : 'border-line-2 bg-white/[0.035]')}>
                      <button
                        type="button"
                        onClick={() => {
                          haptic();
                          toggleBazarItem(it.id);
                        }}
                        className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors', it.done ? 'border-transparent bg-gradient-to-b from-[#9466ff] to-[#6d3df5]' : 'border-line-3 hover:border-blue-2')}
                        aria-label={it.done ? 'Unmark' : 'Mark bought'}
                      >
                        {it.done && <Icon name="tick" size={13} stroke={3} className="text-white" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cx('truncate text-[14px] font-medium', it.done ? 'text-ink-4 line-through' : 'text-white')}>
                          {c.emoji} {it.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px]">
                          <span className="rounded-full px-2 py-0.5" style={{ background: `hsl(${c.hue} 80% 60% / 0.12)`, color: `hsl(${c.hue} 90% 80%)` }}>
                            {en ? c.en : c.bn}
                          </span>
                          {q && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-ink-3">{q}</span>}
                          {it.done && it.expenseDateKey && it.price > 0 && <span className="rounded-full bg-blue/15 px-2 py-0.5 text-blue-3">💰 {L('খরচে যোগ', 'In expenses')}</span>}
                        </div>
                      </div>
                      <PriceInput item={it} />
                      <button type="button" onClick={() => deleteBazarItem(it.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-4 hover:bg-white/10 hover:text-white" aria-label="Delete">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </Card>
  );
});
