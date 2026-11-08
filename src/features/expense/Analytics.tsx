import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, useL, useLang } from '../../lib/store';
import { aggregate, categories, scanExpenses, type Agg, type ExpRec } from '../../lib/analytics';
import { monShort, months } from '../../lib/dates';
import { compact, cx, money, pctDelta } from '../../lib/format';
import { IconBtn, Segmented, SeeMore, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';

type Mode = 'month' | 'year' | 'all';
const LIMIT = 6;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface Pt {
  v: number;
  l: string;
  cls?: 'now' | 'peak' | '';
  title: string;
  showLabel?: boolean;
}

function BarChart({ points, avg }: { points: Pt[]; avg?: number }) {
  const L = useL();
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(280, width || 560);
  const H = 190;
  const pl = 4, pr = 4, pt = 24, pb = 24;
  const cw = W - pl - pr, ch = H - pt - pb;
  const maxV = Math.max(avg || 0, ...points.map((p) => p.v));
  const yMax = maxV > 0 ? maxV * 1.16 : 1;
  const slot = cw / points.length;
  const bw = Math.max(3, Math.min(30, slot * 0.6));
  const showVals = slot >= 30;
  const base = pt + ch;
  return (
    <div ref={ref} className="sub-glass mb-4 px-2 pt-3 pb-1">
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block overflow-visible" role="img" aria-label={L('খরচের চার্ট', 'Spending chart')}>
          <defs>
            <linearGradient id="bg-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b9a0ff" />
              <stop offset="1" stopColor="#6d3df5" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="bg-peak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e7dcff" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="bg-now" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#cdb8ff" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <line x1={pl} x2={W - pr} y1={base} y2={base} stroke="rgba(255,255,255,0.12)" />
          {avg ? (
            <g>
              <line x1={pl} x2={W - pr} y1={base - (avg / yMax) * ch} y2={base - (avg / yMax) * ch} stroke="rgba(205,184,255,0.55)" strokeDasharray="4 5" />
              <text x={pl + 2} y={base - (avg / yMax) * ch - 5} fill="rgba(190,212,255,0.95)" fontSize="10" fontWeight="600" style={{ paintOrder: 'stroke', stroke: 'rgba(10,8,20,0.92)', strokeWidth: 3 }}>
                {L('গড় ', 'avg ')}৳{compact(avg)}
              </text>
            </g>
          ) : null}
          {points.map((p, i) => {
            const cx_ = pl + slot * (i + 0.5);
            const h = p.v > 0 ? Math.max(4, (p.v / yMax) * ch) : 3;
            return (
              <g key={i}>
                <motion.rect
                  x={cx_ - bw / 2}
                  width={bw}
                  rx={Math.min(7, bw / 2)}
                  fill={p.v <= 0 ? 'rgba(255,255,255,0.08)' : p.cls === 'now' ? 'url(#bg-now)' : p.cls === 'peak' ? 'url(#bg-peak)' : 'url(#bg-bar)'}
                  initial={{ height: 0, y: base }}
                  animate={{ height: h, y: base - h }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22, delay: i * 0.025 }}
                >
                  <title>{p.title}</title>
                </motion.rect>
                {p.v > 0 && (showVals || p.cls) && (
                  <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + i * 0.025 }} x={cx_} y={base - h - 6} textAnchor="middle" fontSize="10" fontWeight="500" fill="rgba(233,229,252,0.85)">
                    {compact(p.v)}
                  </motion.text>
                )}
                {p.showLabel !== false && (
                  <text x={cx_} y={H - 7} textAnchor="middle" fontSize={slot < 30 ? 8.5 : 10} fontWeight={p.cls === 'now' ? 700 : 500} fill={p.cls === 'now' ? '#fff' : 'rgba(190,182,230,0.5)'}>
                    {p.l}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function Rows({ rows, total, medal = true }: { rows: { key: string; badge: string; label: string; amt: number; meta?: ReactNode; muted?: boolean }[]; total: number; medal?: boolean }) {
  const L = useL();
  const [exp, setExp] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.amt));
  const shown = exp ? rows : rows.slice(0, LIMIT);
  return (
    <div>
      {shown.map((r, i) => (
        <motion.div key={r.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: r.muted ? 0.45 : 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 10) * 0.03 }} className="border-b border-line py-2.5 last:border-0">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span
              className={cx(
                'grid h-[19px] min-w-[19px] place-items-center rounded-full border px-1 text-[10px] font-bold',
                medal && i === 0 ? 'border-[#fbbf24]/40 bg-[#fbbf24]/15 text-[#fbbf24]' : medal && i === 1 ? 'border-white/30 bg-white/10 text-[#dfe6f3]' : medal && i === 2 ? 'border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fdba74]' : 'border-line-2 text-ink-4'
              )}
            >
              {r.badge}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.label}</span>
            <span className="text-[13.5px] font-medium text-white">{money(r.amt)}</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#6d3df5] via-[#a78bfa] to-[#e4d9ff]" initial={{ width: 0 }} animate={{ width: Math.max(r.amt > 0 ? 2 : 0, (r.amt / max) * 100) + '%' }} transition={{ ...spring, delay: 0.1 + Math.min(i, 10) * 0.03 }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-ink-4">
            <span className="font-semibold text-ink-3">
              {total > 0 ? ((r.amt / total) * 100).toFixed(1) : '0'}% {L('মোট খরচের', 'of total')}
            </span>
            {r.meta}
          </div>
        </motion.div>
      ))}
      {rows.length > LIMIT && <SeeMore expanded={exp} hidden={rows.length - LIMIT} onClick={() => setExp(!exp)} />}
      {!rows.length && <div className="py-3 text-center text-[12.5px] text-ink-4">{L('কিছু নেই।', 'Nothing here.')}</div>}
    </div>
  );
}

function Delta({ curr, prev, vs }: { curr: number; prev: number; vs: string }) {
  if (!(prev > 0)) return null;
  const d = curr - prev;
  if (Math.abs(d) < 1) return null;
  return <span className={d > 0 ? 'font-semibold text-bad' : 'font-semibold text-good'}>· {d > 0 ? '↑' : '↓'} {money(Math.abs(d))} {vs}</span>;
}

function TotalCard({ label, amt, sub, cmp }: { label: string; amt: number; sub?: string; cmp: { l: string; v: string; cls?: string }[] }) {
  return (
    <div className="tint-glass mb-3 p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{label}</div>
      <div className="num grad-text mt-0.5 text-[36px] leading-tight">{money(amt)}</div>
      {sub && <div className="mb-1 text-[11px] text-ink-4">{sub}</div>}
      <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {cmp.map((c) => (
          <div key={c.l} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-ink-4">{c.l}</div>
            <div className={cx('text-[13px] font-semibold', c.cls === 'up' ? 'text-bad' : c.cls === 'down' ? 'text-good' : 'text-ink-2')}>{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats({ items }: { items: { v: string; l: string }[] }) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {items.map((s) => (
        <div key={s.l} className="rounded-xl border border-line bg-white/[0.03] px-2 py-2.5 text-center">
          <div className="truncate text-[13.5px] font-medium text-white">{s.v}</div>
          <div className="mt-0.5 truncate text-[10px] font-medium text-ink-4">{s.l}</div>
        </div>
      ))}
    </div>
  );
}

function Nav({ label, onPrev, onNext, prevOk, nextOk, children }: { label: string; onPrev: () => void; onNext: () => void; prevOk: boolean; nextOk: boolean; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <IconBtn icon="chevL" label="Previous" onClick={onPrev} disabled={!prevOk} className="disabled:opacity-30" />
      <div className="relative flex-1">
        {children}
        <span className="sr-only">{label}</span>
      </div>
      <IconBtn icon="chevR" label="Next" onClick={onNext} disabled={!nextOk} className="disabled:opacity-30" />
    </div>
  );
}

export function Analytics({ onClose }: { onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const en = lang === 'en';
  const raw = useApp((s) => s.raw);
  const todayKey = useApp((s) => s.todayKey);
  const calY = useApp((s) => s.calY);
  const calM = useApp((s) => s.calM);
  const [nowY, nowM, nowD] = todayKey.split('-').map(Number);
  const recs = useMemo(() => scanExpenses(raw), [raw]);
  const [mode, setMode] = useState<Mode>('month');
  const [ym, setYm] = useState({ y: calY, m: calM });
  const [year, setYear] = useState(calY);
  const [tab, setTab] = useState('items');
  useEffect(() => setTab('items'), [mode]);

  const unnamed = L('নামবিহীন', 'Unnamed');
  const monthsList = useMemo(() => {
    const s = new Set(recs.map((r) => r.y * 12 + r.m));
    s.add(ym.y * 12 + ym.m);
    return [...s].sort((a, b) => b - a);
  }, [recs, ym]);
  const yearsList = useMemo(() => {
    const s = new Set(recs.map((r) => r.y));
    s.add(nowY);
    s.add(year);
    return [...s].sort((a, b) => b - a);
  }, [recs, nowY, year]);

  const title = mode === 'month' ? L('মাসিক বিশ্লেষণ', 'Monthly analytics') : mode === 'year' ? L('বাৎসরিক বিশ্লেষণ', 'Yearly analytics') : L('সর্বমোট বিশ্লেষণ', 'All-time analytics');
  const sub = mode === 'month' ? L('প্রতিমাসের খরচের বিশ্লেষণ', "Each month's breakdown") : mode === 'year' ? L('পুরো বছরের খরচ — মাস ধরে ধরে', 'A full year, month by month') : L('শুরু থেকে এখন পর্যন্ত সব খরচ', 'Everything so far');

  let body: ReactNode = null;
  const filterAgg = (f: (r: ExpRec) => boolean): Agg => aggregate(recs.filter(f), unnamed);
  const itemRows = (a: Agg) =>
    [...a.byName.values()]
      .sort((x, y) => y.amt - x.amt)
      .map((it, i) => ({ key: it.key, badge: String(i + 1), label: (it.emoji ? it.emoji + ' ' : '') + it.name, amt: it.amt, meta: <span>· {it.count} {L('টা এন্ট্রি', it.count === 1 ? 'entry' : 'entries')}</span> }));
  const catRows = (a: Agg) =>
    categories(a.byName).map((c, i) => ({ key: c.key, badge: String(i + 1), label: (c.emoji || '📦') + ' ' + (en ? `${c.items} item${c.items === 1 ? '' : 's'}` : `${c.items} টা আইটেম`), amt: c.amt, meta: <span>· {c.count} {L('টা এন্ট্রি', 'entries')}</span> }));
  const emptyBox = (t: string) => (
    <div className="rounded-2xl border border-dashed border-line-2 px-4 py-8 text-center">
      <div className="text-[34px]">📭</div>
      <div className="mt-1 text-[14px] font-semibold text-ink-2">{t}</div>
      <div className="mt-1 text-[12px] text-ink-4">{L('Daily Expense এ খরচ যোগ করলে এখানে দেখা যাবে।', 'Add expenses and they will show up here.')}</div>
    </div>
  );

  if (mode === 'month') {
    const { y, m } = ym;
    const a = filterAgg((r) => r.y === y && r.m === m);
    const pv = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const prev = filterAgg((r) => r.y === pv.y && r.m === pv.m);
    const ly = filterAgg((r) => r.y === y - 1 && r.m === m);
    const idx = monthsList.indexOf(y * 12 + m);
    const go = (i: number) => {
      const v = monthsList[i];
      if (v != null) setYm({ y: Math.floor(v / 12), m: v % 12 });
    };
    const nDays = new Date(y, m + 1, 0).getDate();
    let peakD = 0, peakV = 0;
    for (let d = 1; d <= nDays; d++) {
      const v = a.byDay.get(`${y}-${m}-${d}`) || 0;
      if (v > peakV) (peakV = v), (peakD = d);
    }
    const isCur = y === nowY && m === nowM - 1;
    const dp = pctDelta(a.total, prev.total, en);
    const dy = pctDelta(a.total, ly.total, en);
    const tips = [...a.byName.values()]
      .map((it) => ({ it, p: prev.byName.get(it.key) }))
      .filter(({ it, p }) => p && it.amt - p.amt >= 50 && (it.amt - p.amt) / p.amt >= 0.15)
      .sort((x, z) => z.it.amt - z.p!.amt - (x.it.amt - x.p!.amt))
      .slice(0, 4);
    body = (
      <>
        <Nav label="month" onPrev={() => go(idx + 1)} onNext={() => go(idx - 1)} prevOk={idx < monthsList.length - 1} nextOk={idx > 0}>
          <select className="field rounded-full py-2 font-semibold" value={y * 12 + m} onChange={(e) => go(monthsList.indexOf(+e.target.value))}>
            {monthsList.map((v) => (
              <option key={v} value={v}>
                {months(lang)[v % 12]} {Math.floor(v / 12)}
              </option>
            ))}
          </select>
        </Nav>
        {a.total <= 0 ? (
          emptyBox(L('এই মাসে কোনো খরচ নেই', 'No expenses this month'))
        ) : (
          <>
            <TotalCard
              label={L('এই মাসের মোট খরচ', 'Total spent this month')}
              amt={a.total}
              cmp={[
                { l: L('আগের মাস', 'vs last month'), v: dp.text + (prev.total > 0 ? '  · ' + money(prev.total) : ''), cls: dp.cls },
                { l: L('গত বছর একই মাস', 'vs same month last year'), v: dy.text + (ly.total > 0 ? '  · ' + money(ly.total) : ''), cls: dy.cls }
              ]}
            />
            <Stats
              items={[
                { v: money(a.days.size ? a.total / a.days.size : 0), l: L('দৈনিক গড়', 'Daily avg') },
                { v: String(a.days.size), l: L('এক্টিভ দিন', 'Active days') },
                { v: peakV ? `${money(peakV)} (${peakD})` : '৳0', l: L('সর্বোচ্চ দিন', 'Highest day') }
              ]}
            />
            <Segmented
              small
              tone="white"
              className="mb-3"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'items', label: L('আইটেম', 'Items') },
                { value: 'cats', label: L('ক্যাটাগরি', 'Categories') },
                { value: 'daily', label: L('দৈনিক', 'Daily') }
              ]}
            />
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                {tab === 'items' && <Rows rows={itemRows(a).map((r) => ({ ...r, meta: <>{r.meta}<Delta curr={r.amt} prev={prev.byName.get(r.key)?.amt || 0} vs={L('আগের মাসের চেয়ে', 'vs last month')} /></> }))} total={a.total} />}
                {tab === 'cats' && <Rows rows={catRows(a)} total={a.total} />}
                {tab === 'daily' && (
                  <BarChart
                    avg={a.days.size ? a.total / a.days.size : 0}
                    points={Array.from({ length: nDays }, (_, i) => {
                      const d = i + 1;
                      const v = a.byDay.get(`${y}-${m}-${d}`) || 0;
                      const now = isCur && d === nowD;
                      return { v, l: String(d), cls: now ? 'now' : d === peakD ? 'peak' : '', title: `${months(lang)[m]} ${d} — ${money(v)}`, showLabel: [1, 7, 14, 21, 28, nDays].includes(d) || now };
                    })}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {tips.length > 0 && (
              <div className="mt-3 rounded-2xl border border-[#fbbf24]/25 bg-[#fbbf24]/[0.05] p-3.5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#fbbf24]">💡 {L('সাশ্রয়ের সুযোগ', 'Where you can save')}</div>
                {tips.map(({ it, p }) => {
                  const diff = it.amt - p!.amt;
                  const target = Math.min(p!.amt, it.amt - Math.round(diff / 2));
                  const nm = (it.emoji ? it.emoji + ' ' : '') + it.name;
                  return (
                    <div key={it.key} className="border-b border-dashed border-[#fbbf24]/15 py-1.5 text-[12.5px] leading-relaxed text-ink-2 last:border-0">
                      {en ? (
                        <>
                          <b className="text-[#fbbf24]">{nm}</b> rose by <b className="text-[#fbbf24]">{money(diff)}</b> ({((diff / p!.amt) * 100).toFixed(0)}% up). Try keeping it under <b className="text-[#fbbf24]">{money(target)}</b> next month.
                        </>
                      ) : (
                        <>
                          <b className="text-[#fbbf24]">{nm}</b> এ {money(diff)} বেশি খরচ হয়েছে ({((diff / p!.amt) * 100).toFixed(0)}% বেশি)। পরের মাস <b className="text-[#fbbf24]">{money(target)}</b> এর মধ্যে রাখার চেষ্টা করো।
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    );
  } else if (mode === 'year') {
    const a = filterAgg((r) => r.y === year);
    const prev = filterAgg((r) => r.y === year - 1);
    const idx = yearsList.indexOf(year);
    const mk = (m: number) => a.byMonth.get(`${year}-${m}`) || 0;
    let peakM = -1, peakV = 0;
    for (let m = 0; m < 12; m++) if (mk(m) > peakV) (peakV = mk(m)), (peakM = m);
    const active = [...a.byMonth.values()].filter((v) => v > 0).length;
    const mAvg = active ? a.total / active : 0;
    const d = pctDelta(a.total, prev.total, en);
    body = (
      <>
        <Nav label="year" onPrev={() => setYear(yearsList[idx + 1])} onNext={() => setYear(yearsList[idx - 1])} prevOk={idx < yearsList.length - 1} nextOk={idx > 0}>
          <select className="field rounded-full py-2 font-semibold" value={year} onChange={(e) => setYear(+e.target.value)}>
            {yearsList.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Nav>
        {a.total <= 0 ? (
          emptyBox(L(`${year} সালে কোনো খরচ নেই`, `No expenses in ${year}`))
        ) : (
          <>
            <TotalCard
              label={L(`${year} সালের মোট খরচ`, `Total spent in ${year}`)}
              amt={a.total}
              cmp={[
                { l: L(`${year - 1} এর তুলনায়`, `vs ${year - 1}`), v: d.text + (prev.total > 0 ? '  · ' + money(prev.total) : ''), cls: d.cls },
                { l: L('দৈনিক গড়', 'Daily average'), v: money(a.days.size ? a.total / a.days.size : 0) }
              ]}
            />
            <Stats
              items={[
                { v: money(mAvg), l: L('মাসিক গড়', 'Monthly avg') },
                { v: `${active}/12`, l: L('এক্টিভ মাস', 'Active months') },
                { v: peakM >= 0 ? `${money(peakV)} (${monShort(lang)[peakM]})` : '—', l: L('সর্বোচ্চ মাস', 'Top month') }
              ]}
            />
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{L('মাস অনুযায়ী খরচ', 'Spending by month')}</div>
            <BarChart
              avg={mAvg}
              points={Array.from({ length: 12 }, (_, m) => ({
                v: mk(m),
                l: monShort(lang)[m],
                cls: year === nowY && m === nowM - 1 ? 'now' : m === peakM ? 'peak' : '',
                title: `${months(lang)[m]} ${year} — ${money(mk(m))}`
              }))}
            />
            <Segmented
              small
              tone="white"
              className="mb-3"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'items', label: L('আইটেম', 'Items') },
                { value: 'cats', label: L('ক্যাটাগরি', 'Categories') },
                { value: 'months', label: L('মাস', 'Months') }
              ]}
            />
            {tab === 'items' && <Rows rows={itemRows(a)} total={a.total} />}
            {tab === 'cats' && <Rows rows={catRows(a)} total={a.total} />}
            {tab === 'months' && (
              <Rows
                medal={false}
                total={a.total}
                rows={Array.from({ length: year === nowY ? nowM : 12 }, (_, m) => ({
                  key: String(m),
                  badge: String(m + 1),
                  label: `${months(lang)[m]} ${year}`,
                  amt: mk(m),
                  muted: mk(m) <= 0,
                  meta: <Delta curr={mk(m)} prev={m > 0 ? mk(m - 1) : 0} vs={L('আগের মাসের চেয়ে', 'vs prev month')} />
                }))}
              />
            )}
          </>
        )}
      </>
    );
  } else {
    const a = filterAgg(() => true);
    if (a.total <= 0) body = emptyBox(L('এখনো কোনো খরচ নেই', 'No expenses yet'));
    else {
      const ml = [...a.byMonth.entries()].map(([k, v]) => ({ y: +k.split('-')[0], m: +k.split('-')[1], v })).sort((p, q) => p.y - q.y || p.m - q.m);
      const first = ml[0], last = ml[ml.length - 1];
      const peak = ml.reduce((b, e) => (e.v > b.v ? e : b), ml[0]);
      const yrs = [...a.byYear.keys()].sort((p, q) => p - q);
      const thisYear = a.byYear.get(nowY) || 0;
      const byYear = yrs.length >= 2;
      const peakYear = yrs.reduce((b, y) => ((a.byYear.get(y) || 0) > (a.byYear.get(b) || 0) ? y : b), yrs[0]);
      const oneYear = yrs[0];
      body = (
        <>
          <TotalCard
            label={L('সর্বমোট খরচ (শুরু থেকে)', 'Total spent — all time')}
            amt={a.total}
            sub={L('সময়কাল: ', 'Period: ') + `${months(lang)[first.m]} ${first.y} — ${months(lang)[last.m]} ${last.y}`}
            cmp={[
              { l: L(`এই বছর (${nowY})`, `This year (${nowY})`), v: `${money(thisYear)}  · ${Math.round((thisYear / a.total) * 100)}%` },
              { l: L('মোট এন্ট্রি', 'Total entries'), v: a.entries.toLocaleString() + L(' টা', a.entries === 1 ? ' entry' : ' entries') }
            ]}
          />
          <Stats
            items={[
              { v: money(a.total / ml.length), l: L('মাসিক গড়', 'Monthly avg') },
              { v: a.days.size.toLocaleString(), l: L('এক্টিভ দিন', 'Active days') },
              { v: `${money(peak.v)} (${monShort(lang)[peak.m]} '${String(peak.y).slice(2)})`, l: L('সর্বোচ্চ মাস', 'Top month') }
            ]}
          />
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{byYear ? L('বছর অনুযায়ী খরচ', 'Spending by year') : L(`${oneYear} — মাস অনুযায়ী`, `${oneYear} — by month`)}</div>
          <BarChart
            avg={byYear ? a.total / yrs.length : a.total / ml.length}
            points={
              byYear
                ? Array.from({ length: yrs[yrs.length - 1] - yrs[0] + 1 }, (_, i) => {
                    const y = yrs[0] + i;
                    const v = a.byYear.get(y) || 0;
                    return { v, l: String(y), cls: y === nowY ? 'now' : y === peakYear ? 'peak' : '', title: `${y} — ${money(v)}` };
                  })
                : Array.from({ length: 12 }, (_, m) => {
                    const v = a.byMonth.get(`${oneYear}-${m}`) || 0;
                    return { v, l: monShort(lang)[m], cls: oneYear === nowY && m === nowM - 1 ? 'now' : peak.m === m ? 'peak' : '', title: `${months(lang)[m]} ${oneYear} — ${money(v)}` };
                  })
            }
          />
          <Segmented
            small
            tone="white"
            className="mb-3"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'items', label: L('আইটেম', 'Items') },
              { value: 'cats', label: L('ক্যাটাগরি', 'Categories') },
              { value: 'periods', label: byYear ? L('বছর', 'Years') : L('মাস', 'Months') }
            ]}
          />
          {tab === 'items' && <Rows rows={itemRows(a)} total={a.total} />}
          {tab === 'cats' && <Rows rows={catRows(a)} total={a.total} />}
          {tab === 'periods' &&
            (byYear ? (
              <Rows medal={false} total={a.total} rows={yrs.map((y, i) => ({ key: String(y), badge: String(i + 1), label: String(y), amt: a.byYear.get(y) || 0, meta: <Delta curr={a.byYear.get(y) || 0} prev={a.byYear.get(y - 1) || 0} vs={L('আগের বছরের চেয়ে', 'vs prev year')} /> }))} />
            ) : (
              <Rows medal={false} total={a.total} rows={ml.map((e, i) => ({ key: `${e.y}-${e.m}`, badge: String(i + 1), label: `${months(lang)[e.m]} ${e.y}`, amt: e.v, meta: <Delta curr={e.v} prev={i > 0 ? ml[i - 1].v : 0} vs={L('আগের মাসের চেয়ে', 'vs prev month')} /> }))} />
            ))}
        </>
      );
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[19px] tracking-[-0.02em] text-white">
            <span className="ic-disc h-7 w-7">
              <Icon name="bars" size={14} stroke={2.1} />
            </span>
            {title}
          </div>
          <p className="mt-1 text-[12px] text-ink-4">{sub}</p>
        </div>
        <IconBtn icon="x" label={L('বন্ধ করো', 'Close')} onClick={onClose} />
      </div>
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'month', label: L('মাসিক', 'Monthly') },
          { value: 'year', label: L('বাৎসরিক', 'Yearly') },
          { value: 'all', label: L('সর্বমোট', 'All-time') }
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={mode + (mode === 'month' ? ym.y * 12 + ym.m : mode === 'year' ? year : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          {body}
        </motion.div>
      </AnimatePresence>
      <button type="button" onClick={onClose} className="btn btn-primary mt-4 w-full py-2.5 text-[13px]">
        {L('✓ ঠিক আছে', '✓ Done')}
      </button>
    </div>
  );
}
