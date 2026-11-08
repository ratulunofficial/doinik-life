import { memo, useEffect, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { openModal, useL, useLang } from '../../lib/store';
import { deleteNote, useNotes } from '../../lib/data';
import { months } from '../../lib/dates';
import { Btn, Card, Empty, SecLabel, SeeMore, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { cx } from '../../lib/format';
import { stripMarkers } from '../../lib/text';
import type { Note } from '../../lib/types';

const LIMIT = 6;

function useNow(ms: number) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function NoteTile({ note, now }: { note: Note; now: number }) {
  const L = useL();
  const lang = useLang();
  const ago = (ts: number) => {
    const m = Math.floor((now - ts) / 60000);
    if (m < 1) return L('এইমাত্র', 'just now');
    if (m < 60) return L(`${m} মিনিট আগে`, `${m}m ago`);
    const h = Math.floor(m / 60);
    if (h < 24) return L(`${h} ঘন্টা আগে`, `${h}h ago`);
    const d = Math.floor(h / 24);
    if (d < 7) return L(`${d} দিন আগে`, `${d}d ago`);
    const dt = new Date(ts);
    return `${dt.getDate()} ${months(lang)[dt.getMonth()]} ${dt.getFullYear()}`;
  };
  let foot = ago(note.updatedAt || note.createdAt);
  if (note.temporary && note.expiresAt) {
    const r = Math.max(0, note.expiresAt - now);
    foot = `⏳ ${Math.floor(r / 3.6e6)}h ${Math.floor((r % 3.6e6) / 6e4)}m`;
  }
  const open = () => openModal(note.temporary ? { type: 'temp', id: note.id } : { type: 'note', id: note.id });
  const del = (e: MouseEvent) => {
    e.stopPropagation();
    deleteNote(note.id);
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className={cx('note-card group relative flex min-h-[96px] cursor-pointer flex-col rounded-2xl p-3.5', 'note-' + (note.color || 'default'), note.temporary && 'border-dashed')}
    >
      {note.pinned && <span className="absolute right-3 top-3 text-[11px]">📌</span>}
      {note.title && <div className="mb-1 truncate pr-5 text-[13.5px] font-semibold text-white">{note.title}</div>}
      {note.content && <div className="line-clamp-4 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-ink-3">{stripMarkers(note.content)}</div>}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className={cx('text-[10.5px]', note.temporary ? 'font-semibold text-[#ffd98a]' : 'text-ink-4')}>{foot}</span>
        <button type="button" onClick={del} className="grid h-6 w-6 place-items-center rounded-full text-ink-4 opacity-70 transition hover:bg-white/10 hover:text-white group-hover:opacity-100" aria-label="Delete note">
          <Icon name="x" size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export const NotesCard = memo(function NotesCard({ delay = 0, id }: { delay?: number; id?: string }) {
  const L = useL();
  const notes = useNotes();
  const now = useNow(30_000);
  const [all, setAll] = useState(false);
  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);
  const ordered = [...pinned, ...others];
  const visible = all ? ordered : ordered.slice(0, LIMIT);
  const vp = visible.filter((n) => n.pinned);
  const vo = visible.filter((n) => !n.pinned);

  return (
    <Card delay={delay} id={id}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SecLabel>{L('Quick Notes', 'Quick Notes')}</SecLabel>
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          <Btn size="sm" icon="mail" onClick={() => openModal({ type: 'emailFilter' })} className="border-blue-2/40 bg-blue/15 text-[#e9e0ff]">
            Email Filter
          </Btn>
          <Btn size="sm" icon="clock" onClick={() => openModal({ type: 'temp' })} className="border-dashed">
            Temporary
          </Btn>
          <button
            type="button"
            onClick={() => openModal({ type: 'note' })}
            aria-label={L('নতুন note', 'New note')}
            title={L('নতুন note', 'New note')}
            className="grid h-[30px] w-[30px] place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors hover:bg-[#7c4dff]"
          >
            <Icon name="plus" size={15} stroke={2.2} />
          </button>
        </div>
      </div>
      {!notes.length ? (
        <Empty icon="note">{L('কোনো note নেই — উপরে থেকে নতুন note যোগ করো', 'No notes yet — add one above')}</Empty>
      ) : (
        <>
          {vp.length > 0 && <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-4">📌 {L('পিন করা', 'Pinned')}</div>}
          <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence initial={false}>
              {vp.map((n) => (
                <NoteTile key={n.id} note={n} now={now} />
              ))}
            </AnimatePresence>
          </motion.div>
          {vo.length > 0 && vp.length > 0 && <div className="mt-4 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-4">{L('অন্যান্য', 'Others')}</div>}
          <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence initial={false}>
              {vo.map((n) => (
                <NoteTile key={n.id} note={n} now={now} />
              ))}
            </AnimatePresence>
          </motion.div>
          {ordered.length > LIMIT && <SeeMore expanded={all} hidden={ordered.length - LIMIT} onClick={() => setAll(!all)} />}
        </>
      )}
    </Card>
  );
});
