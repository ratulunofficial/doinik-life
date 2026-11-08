import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useApp, useL, useLang } from '../../lib/store';
import { useDay, useMood, useWaterGoal } from '../../lib/data';
import { AnimatedNumber, Card, SecLabel, softSpring } from '../../components/ui';

export function StatTiles({ done, left, water }: { done: number; left: number; water: number }) {
  const L = useL();
  const tiles = [
    { v: done, l: L('শেষ', 'Done') },
    { v: left, l: L('বাকি', 'Left') },
    { v: water, l: L('পানি', 'Water') }
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.l} className="sub-glass relative px-4 py-3">
          <span className="absolute left-2.5 top-[26%] bottom-[26%] w-[2px] rounded bg-gradient-to-b from-[#a78bfa] to-[#6d3df5]" />
          <AnimatedNumber value={t.v} className="num block text-[28px] leading-none text-white" />
          <div className="mt-1.5 text-[11px] font-medium text-ink-4">{t.l}</div>
        </div>
      ))}
    </div>
  );
}

/** One coloured row, styled like the reference's "Today's Schedule" items. */
function Row({ color, value, title, sub, children, i }: { color: string; value: ReactNode; title: string; sub: string; children?: ReactNode; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...softSpring, delay: 0.08 + i * 0.06 }}
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.035] py-2.5 pl-4 pr-3"
    >
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: color }} />
      <div className="w-[62px] shrink-0 text-[15px] font-medium leading-tight tabular-nums text-white">{value}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{title}</span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-4">{sub}</div>
        {children}
      </div>
    </motion.div>
  );
}

const MOOD_LBL: Record<number, [string, string]> = { 5: ['দারুণ', 'Great'], 4: ['ভালো', 'Good'], 3: ['মোটামুটি', 'OK'], 2: ['একটু খারাপ', 'A bit off'], 1: ['খুব খারাপ', 'Very bad'] };

export const SummaryCard = memo(function SummaryCard({ delay = 0, id }: { delay?: number; id?: string }) {
  const L = useL();
  const lang = useLang();
  const tk = useApp((s) => s.todayKey);
  const day = useDay(tk);
  const goal = useWaterGoal();
  const mood = useMood()[tk];
  const tasks = day?.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const left = tasks.length - done;
  const water = day?.water || 0;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const exps = day?.expenses || [];
  const spent = exps.reduce((s, e) => s + (Number(e.amt) || 0), 0);

  return (
    <Card delay={delay} id={id} className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <SecLabel>{L('আজকের সারসংক্ষেপ', "Today's Overview")}</SecLabel>
        <span className="rounded-full bg-[#3a2d6e] px-2.5 py-1 text-[11px] font-semibold text-blue-3">{pct}%</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Row i={0} color="#8b5cf6" value={`${done}/${tasks.length}`} title="Tasks" sub={left > 0 ? L(`${left}টি task বাকি`, `${left} tasks left`) : tasks.length ? L('সব শেষ! 🎉', 'All done! 🎉') : L('কোনো task নেই', 'No tasks')}>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#6d3df5] to-[#c4b5fd]" initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={softSpring} />
          </div>
        </Row>
        <Row i={1} color="#3b82f6" value={`${water}/${goal}`} title={L('পানি', 'Water')} sub={water >= goal ? L('লক্ষ্য পূরণ! 🎉', 'Goal complete! 🎉') : L(`আরো ${goal - water} গ্লাস`, `${goal - water} glasses to go`)} />
        <Row
          i={2}
          color="#f59e0b"
          value={<AnimatedNumber value={spent} format={(n) => '৳' + Math.round(n).toLocaleString()} />}
          title={L('আজকের খরচ', 'Spent today')}
          sub={exps.length ? L(`${exps.length} টা খরচ`, `${exps.length} expense${exps.length === 1 ? '' : 's'}`) : L('এখনো কিছু খরচ হয়নি', 'Nothing spent yet')}
        />
        <Row i={3} color="#22c55e" value={<span className="text-[20px]">{mood ? mood.emoji : '—'}</span>} title={L('মন', 'Mood')} sub={mood ? MOOD_LBL[mood.level]?.[lang === 'en' ? 1 : 0] || '' : L('এখনো বেছে নাওনি', 'Not picked yet')} />
      </div>
    </Card>
  );
});
