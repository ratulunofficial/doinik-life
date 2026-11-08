import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast, useL, type ModalReq } from '../../lib/store';
import { getNotes, purgeExpiredTempNotes, saveTempNote, useNotes } from '../../lib/data';
import { Modal } from '../../components/ui';
import { applyLineMath } from '../../lib/text';

export function TempNotepad({ open, req, onClose }: { open: boolean; req?: Extract<ModalReq, { type: 'temp' }>; onClose: () => void }) {
  const L = useL();
  const notes = useNotes();
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [, tick] = useState(0);
  const idRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const n = req?.id ? getNotes().find((x) => x.id === req.id) : undefined;
    idRef.current = n?.id || null;
    setText(n?.content || '');
    setCaret(0);
    const t = setInterval(() => tick((x) => x + 1), 1000);
    setTimeout(() => taRef.current?.focus(), 120);
    return () => clearInterval(t);
  }, [open, req]);

  const note = idRef.current ? notes.find((n) => n.id === idRef.current) : undefined;
  const remaining = note?.expiresAt ? Math.max(0, note.expiresAt - Date.now()) : 864e5;
  useEffect(() => {
    if (open && note?.expiresAt && remaining <= 0) {
      onClose();
      purgeExpiredTempNotes();
    }
  }, [open, note, remaining, onClose]);

  const persist = (t: string) => {
    idRef.current = saveTempNote(t, idRef.current);
  };
  const onChange = (v: string, pos: number) => {
    const m = applyLineMath(v, pos);
    const next = m ? m.text : v;
    setText(next);
    setCaret(m ? m.caret : pos);
    if (m) requestAnimationFrame(() => taRef.current?.setSelectionRange(m.caret, m.caret));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 1500);
  };
  const close = () => {
    clearTimeout(saveTimer.current);
    if (text.trim()) persist(text);
    onClose();
  };
  const saveNow = () => {
    if (!text.trim()) return toast(L('কিছু তো লেখো!', 'Write something first!'));
    clearTimeout(saveTimer.current);
    persist(text);
    toast(L('💾 Temporary note সংরক্ষিত (24h)', '💾 Temporary note saved (24h)'));
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const s = el.selectionStart;
      const v = el.value.slice(0, s) + '\t' + el.value.slice(el.selectionEnd);
      onChange(v, s + 1);
      requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
    }
  };

  const lines = text.split('\n');
  const before = text.slice(0, caret).split('\n');
  const ln = before.length;
  const col = before[before.length - 1].length + 1;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hrs = Math.floor(remaining / 3.6e6), mins = Math.floor((remaining % 3.6e6) / 6e4), secs = Math.floor((remaining % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Modal open={open} onClose={close} width={780} label="Temporary note" className="h-[84dvh] sm:h-[80vh]">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-white/[0.025] px-4 py-3">
        <div className="flex gap-2">
          <button type="button" className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110" title={L('বন্ধ করো', 'Close')} onClick={close} />
          <button type="button" className="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110" title={L('মিনিমাইজ', 'Minimise')} onClick={() => (saveNow(), close())} />
          <button type="button" className="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110" title={L('সংরক্ষণ', 'Save')} onClick={saveNow} />
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-[12px] font-medium text-ink-3">{(note?.title || 'Temporary Note') + ' — 24h auto-delete'}</div>
        <div className="font-mono text-[11px] text-ink-4">⏳ {pad(hrs)}:{pad(mins)}:{pad(secs)}</div>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div ref={lnRef} className="w-11 shrink-0 select-none overflow-hidden border-r border-line bg-white/[0.015] py-3 text-right font-mono text-[12.5px] leading-[1.65] text-ink-4">
          {lines.map((_, i) => (
            <div key={i} className={i + 1 === ln ? 'pr-2.5 text-white' : 'pr-2.5'}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={taRef}
          spellCheck={false}
          value={text}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onScroll={(e) => lnRef.current && (lnRef.current.scrollTop = e.currentTarget.scrollTop)}
          onKeyDown={onKey}
          className="scroll-thin flex-1 resize-none bg-transparent px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-[#dfe6f3] outline-none placeholder:text-ink-4"
          style={{ tabSize: 4 }}
          placeholder={L('এখানে লেখো...\n\n💡 Math: যেকোনো line এ expression লিখে = দাও\n   5+3= → 8\n   25*4+10/2= → 105 (BODMAS)', 'Write here...\n\n💡 Math: end any line with =\n   5+3= → 8\n   25*4+10/2= → 105 (BODMAS)')}
        />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#6d3df5] to-[#9466ff] px-4 py-1.5 text-[11px] font-medium text-white">
        <div className="flex gap-3.5 overflow-hidden whitespace-nowrap">
          <span>
            Ln {ln}, Col {col}
          </span>
          <span className="hidden sm:inline">Characters: {text.length}</span>
          <span>Words: {words}</span>
          <span className="hidden sm:inline">Lines: {lines.length}</span>
        </div>
        <span className="whitespace-nowrap">{hrs < 1 ? `⚠️ ${mins}m ${secs}s` : `⏳ ${hrs}h ${mins}m`} {L('বাকি', 'left')}</span>
      </div>
    </Modal>
  );
}
