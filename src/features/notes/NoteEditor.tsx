import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast, useL, type ModalReq } from '../../lib/store';
import { deleteNote, saveNote, useNotes } from '../../lib/data';
import { Btn, IconBtn, Modal } from '../../components/ui';
import { copyText, cx } from '../../lib/format';
import { parseCopyMarkers, type NotePart } from '../../lib/text';

const COLORS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

function CopyChip({ part }: { part: Extract<NotePart, { type: 'copy' }> }) {
  const L = useL();
  const [done, setDone] = useState(false);
  const onClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (await copyText(part.copy)) {
      setDone(true);
      setTimeout(() => setDone(false), 1100);
      toast('📋 Copied: ' + (part.copy.length > 30 ? part.copy.slice(0, 30) + '…' : part.copy));
    } else toast(L('❌ Copy করা যায়নি', "❌ Couldn't copy"));
  };
  return (
    <span className={cx('copy-chip', done && 'copied')} onClick={onClick} role="button" title={L('Click করলে copy', 'Click to copy')}>
      <Parts parts={part.children} />
    </span>
  );
}
function Parts({ parts }: { parts: NotePart[] }) {
  return (
    <>
      {parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : <CopyChip key={i} part={p} />))}
    </>
  );
}
export function NoteRich({ content }: { content: string }): ReactNode {
  return <Parts parts={parseCopyMarkers(content)} />;
}

export function NoteEditor({ open, req, onClose }: { open: boolean; req?: Extract<ModalReq, { type: 'note' }>; onClose: () => void }) {
  const L = useL();
  const notes = useNotes();
  const note = req?.id ? notes.find((n) => n.id === req.id) : undefined;
  const [mode, setMode] = useState<'view' | 'edit'>('edit');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [pinned, setPinned] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setColor(note?.color || 'default');
    setPinned(!!note?.pinned);
    setMode(note && !req?.edit ? 'view' : 'edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, req]);

  const save = () => {
    if (!title.trim() && !content.trim()) return toast(L('কিছু তো লেখো!', 'Write something first!'));
    saveNote({ title: title.trim(), content: content.trim(), color, pinned }, note?.id);
    onClose();
  };
  const wrapCopy = () => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd, v = el.value;
    let next: string, ns: number, ne: number;
    if (s === e) {
      const ph = L('এখানে copy text', 'copy text here');
      next = v.slice(0, s) + '{{' + ph + '}}' + v.slice(e);
      ns = s + 2;
      ne = ns + ph.length;
    } else {
      const sel = v.slice(s, e);
      if (/^\{\{[\s\S]*\}\}$/.test(sel)) {
        const inner = sel.slice(2, -2);
        next = v.slice(0, s) + inner + v.slice(e);
        ns = s;
        ne = s + inner.length;
      } else {
        next = v.slice(0, s) + '{{' + sel + '}}' + v.slice(e);
        ns = s + 2;
        ne = ns + sel.length;
      }
    }
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ns, ne);
    });
  };

  const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <Modal open={open} onClose={onClose} width={620} label="Note" className={cx('note-' + color)}>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(var(--note) / 0.10), transparent 40%)' }} />
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'view' && note ? (
          <motion.div key="view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative flex min-h-0 flex-col">
            <div className="flex items-start gap-3 px-6 pt-5 sm:pt-6">
              <h2 className="min-w-0 flex-1 text-[22px] font-normal tracking-[-0.025em] text-white">{note.title || L('(শিরোনামহীন)', '(untitled)')}</h2>
              <IconBtn icon="x" label="Close" size={32} onClick={onClose} />
            </div>
            <div className="scroll-thin mt-3 max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words px-6 text-[14.5px] leading-[1.75] text-ink-2">
              <NoteRich content={note.content} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 px-6 text-[11px] text-ink-4">
              <span className="pill px-2.5 py-1">🗓️ {L('তৈরি: ', 'Created: ')}{fmt(note.createdAt)}</span>
              {note.updatedAt !== note.createdAt && <span className="pill px-2.5 py-1">✏️ {L('আপডেট: ', 'Updated: ')}{fmt(note.updatedAt)}</span>}
              {note.pinned && <span className="pill px-2.5 py-1">📌 {L('পিন করা', 'Pinned')}</span>}
            </div>
            <div className="flex gap-2.5 px-6 pt-5 pb-6">
              <Btn className="flex-1" onClick={onClose}>
                {L('বন্ধ', 'Close')}
              </Btn>
              <Btn variant="primary" icon="edit" className="flex-1" onClick={() => setMode('edit')}>
                Edit
              </Btn>
            </div>
          </motion.div>
        ) : (
          <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative flex min-h-0 flex-col">
            <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
              <input className="min-w-0 flex-1 bg-transparent text-[22px] font-normal tracking-[-0.025em] text-white outline-none placeholder:text-ink-4" placeholder={L('শিরোনাম', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!note} />
              <IconBtn icon="x" label="Close" size={32} onClick={onClose} />
            </div>
            <textarea
              ref={ta}
              autoFocus={!!note}
              className="scroll-thin mx-5 mt-2 min-h-[220px] flex-1 resize-none bg-transparent text-[14.5px] leading-[1.75] text-ink-2 outline-none placeholder:text-ink-4 sm:mx-6"
              placeholder={L('এখানে note লেখো...', 'Write your note...')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="mx-5 mt-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-4 sm:mx-6">
              💡 {L('Copy করার মতো text ', 'Wrap copyable text in ')}
              <code className="text-blue-3">{'{{ }}'}</code>
              {L(' দিয়ে wrap করো, যেমন ', ', e.g. ')}
              <code className="text-blue-3">{'{{you@email.com}}'}</code>. {L('📋 button: text select করে চাপ দাও।', '📋 button: select text and tap it.')}
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-6 sm:px-6">
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    className={cx('note-' + c, 'h-6 w-6 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-[#9b7bff]' : 'border-transparent hover:scale-110')}
                    style={{ background: c === 'default' ? 'rgba(255,255,255,0.15)' : 'rgb(var(--note))' }}
                  />
                ))}
              </div>
              <div className="ml-auto flex gap-1.5">
                {note && <IconBtn icon="trash" label={L('মুছে দাও', 'Delete')} onClick={() => (deleteNote(note.id), onClose())} />}
                <IconBtn icon="copy" label={L('Selected text কে copy-able করো', 'Make selection copyable')} onClick={wrapCopy} />
                <IconBtn icon="pin" label={pinned ? L('আনপিন', 'Unpin') : L('পিন', 'Pin')} onClick={() => setPinned(!pinned)} className={pinned ? '!bg-[#7c4dff] !text-white' : ''} />
                <Btn variant="primary" onClick={save}>
                  {L('সংরক্ষণ', 'Save')}
                </Btn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
