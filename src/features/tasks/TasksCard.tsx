import { memo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { openModal, useApp, useL, useLang } from '../../lib/store';
import { addTask, deleteTask, toggleTask, useDay } from '../../lib/data';
import { dateLabel, isFuture, isLocked } from '../../lib/dates';
import { Btn, Card, SecLabel, Segmented, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { StatTiles } from '../calendar/SummaryCard';
import { cx, haptic } from '../../lib/format';

const CATS = ['work', 'health', 'personal'] as const;
const catLabel = (c: string) => (c === 'work' ? 'Work' : c === 'health' ? 'Health' : 'Personal');

export const TasksCard = memo(function TasksCard({ delay = 0, showStats, id }: { delay?: number; showStats?: boolean; id?: string }) {
  const L = useL();
  const lang = useLang();
  const key = useApp((s) => s.selectedKey);
  const todayKey = useApp((s) => s.todayKey);
  const day = useDay(key);
  const todayData = useDay(todayKey);
  const tasks = day?.tasks || [];
  const locked = isLocked(key, todayKey);
  const fut = isFuture(key, todayKey);
  const isToday = key === todayKey;
  const [text, setText] = useState('');
  const [cat, setCat] = useState<string>('work');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addTask(key, text, cat)) setText('');
  };

  const badge = isToday ? L('আজকে — ', 'Today — ') + dateLabel(key, lang) : (locked ? '🔒 ' : fut ? '📅 ' : '✏️ ') + dateLabel(key, lang);
  const tt = todayData?.tasks || [];
  const shown = filter === 'pending' ? tasks.filter((t) => !t.done) : filter === 'done' ? tasks.filter((t) => t.done) : tasks;

  return (
    <Card delay={delay} id={id} className="flex flex-col">
      {showStats && (
        <div className="mb-4">
          <StatTiles done={tt.filter((t) => t.done).length} left={tt.filter((t) => !t.done).length} water={todayData?.water || 0} />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SecLabel>{L('আমার Tasks', 'My Tasks')}</SecLabel>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Btn size="sm" icon="pin" onClick={() => openModal({ type: 'perm' })}>
            Permanent
          </Btn>
          {!locked && (
            <Btn size="sm" variant="primary" icon="plus" onClick={() => inputRef.current?.focus()}>
              {L('Task যোগ', 'Add Task')}
            </Btn>
          )}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented
          small
          tone="white"
          className="w-[280px] max-w-full"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: L('সব', 'All') },
            { value: 'pending', label: L('বাকি', 'Pending') },
            { value: 'done', label: L('শেষ', 'Completed') }
          ]}
        />
        <span className={cx('ml-auto text-[11.5px] font-medium', isToday ? 'text-blue-3' : 'text-ink-3')}>{badge}</span>
      </div>

      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {shown.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, x: 30 }}
              transition={spring}
              className="overflow-hidden"
            >
              <div className="group flex items-center gap-3 border-b border-line py-2.5">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    haptic();
                    toggleTask(key, t.id);
                  }}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                  className={cx(
                    'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
                    t.done ? 'border-transparent bg-gradient-to-b from-[#9466ff] to-[#6d3df5] shadow-[0_0_14px_rgba(124,77,255,0.6)]' : 'border-line-3 hover:border-blue-2'
                  )}
                >
                  <AnimatePresence>
                    {t.done && (
                      <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
                        <Icon name="tick" size={14} stroke={3} className="text-white" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                <span className={cx('min-w-0 flex-1 truncate text-[14px] transition-colors', t.done ? 'text-ink-4 line-through decoration-white/30' : 'text-ink')}>{t.text}</span>
                {t.perm && (
                  <span className="hidden text-[10px] text-ink-4 sm:inline" title="Permanent">
                    📌
                  </span>
                )}
                <span className={cx('badge', 'badge-' + (CATS.includes(t.cat as never) ? t.cat : 'personal'))}>{catLabel(t.cat)}</span>
                {!locked && (
                  <button type="button" onClick={() => deleteTask(key, t.id)} className="grid h-7 w-7 place-items-center rounded-full text-ink-4 transition-colors hover:bg-white/10 hover:text-white" aria-label="Delete">
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!shown.length && (
          <div className="py-3 text-[13px] text-ink-4">
            {tasks.length
              ? filter === 'done'
                ? L('এখনো কিছু শেষ হয়নি।', 'Nothing completed yet.')
                : L('সব task শেষ! 🎉', 'All done! 🎉')
              : locked
                ? L('এই দিনের কোনো task ছিল না।', 'There were no tasks this day.')
                : fut
                  ? L('📅 এই দিনের জন্য task plan করো।', '📅 Plan tasks for this day.')
                  : L('কোনো task নেই।', 'No tasks.')}
          </div>
        )}
      </div>

      {locked ? (
        <div className="mt-auto rounded-xl border border-line px-3 py-2.5 text-[12px] text-ink-4">{L('🔒 এই দিন lock হয়ে গেছে।', '🔒 This day is locked.')}</div>
      ) : (
        <form onSubmit={submit} className="mt-auto flex gap-2 pt-3">
          <input
            ref={inputRef}
            className="field flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={fut ? L('📅 plan করো...', '📅 Plan...') : isToday ? L('নতুন task...', 'New task...') : L('গতকালের task...', "Yesterday's task...")}
          />
          <select className="field w-[98px] shrink-0" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {catLabel(c)}
              </option>
            ))}
          </select>
          <Btn variant="primary" type="submit" icon="plus" className="shrink-0 px-3.5">
            <span className="hidden sm:inline">{L('যোগ', 'Add')}</span>
          </Btn>
        </form>
      )}
    </Card>
  );
});
