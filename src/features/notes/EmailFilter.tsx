import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast, useL } from '../../lib/store';
import { Btn, IconBtn, Modal, Segmented } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { copyText, cx } from '../../lib/format';
import { emailTokens } from '../../lib/text';

// Draft lives only in this browser — it is never synced to Firebase.
const KEY = 'dl2_email_filter_draft';
const CAP = 1500;

function Box({ icon, title, sub, count, accent, children }: { icon: IconName; title: string; sub: string; count: number; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className={cx('flex flex-col rounded-[20px] border p-3 lg:min-h-0 lg:flex-1', accent ? 'tint-glass border-blue-2/30' : 'sub-glass')}>
      <header className="mb-2.5 flex items-center gap-2.5">
        <span className={cx('ic-disc h-7 w-7', accent && '!bg-gradient-to-b !from-[#9466ff] !to-[#6d3df5] !text-white')}>
          <Icon name={icon} size={14} stroke={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-white">{title}</div>
          <div className="truncate text-[11px] text-ink-4">{sub}</div>
        </div>
        <motion.span key={count} initial={{ y: 6, opacity: 0.3 }} animate={{ y: 0, opacity: 1 }} className={cx('grid h-6 min-w-8 place-items-center rounded-full border px-2.5 text-[12px] font-semibold tabular-nums', accent ? 'border-[#9b7bff] bg-[#7c4dff] text-white' : 'border-line-2 bg-white/5 text-white')}>
          {count.toLocaleString()}
        </motion.span>
      </header>
      {children}
    </section>
  );
}

export function EmailFilter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const [list, setList] = useState('');
  const [check, setCheck] = useState('');
  const [mode, setMode] = useState<'missing' | 'both'>('missing');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedRow, setCopiedRow] = useState(-1);
  const [deb, setDeb] = useState({ list: '', check: '' });
  const loaded = useRef(false);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d) {
        setList(d.list || '');
        setCheck(d.check || '');
        if (d.mode === 'both') setMode('both');
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDeb({ list, check });
      try {
        localStorage.setItem(KEY, JSON.stringify({ list, check, mode }));
      } catch {
        /* ignore */
      }
    }, 120);
    return () => clearTimeout(t);
  }, [list, check, mode]);

  const r = useMemo(() => {
    const Ls = emailTokens(deb.list);
    const Cs = emailTokens(deb.check);
    const missing: { v: string; side: 'list' | 'check' }[] = [];
    let matched = 0;
    Ls.map.forEach((v, k) => (Cs.map.has(k) ? matched++ : missing.push({ v, side: 'list' })));
    const extra: { v: string; side: 'list' | 'check' }[] = [];
    Cs.map.forEach((v, k) => !Ls.map.has(k) && extra.push({ v, side: 'check' }));
    return { Ls, Cs, missing, extra, matched };
  }, [deb]);
  const out = mode === 'both' ? r.missing.concat(r.extra) : r.missing;
  const hasInput = r.Ls.map.size > 0 || (mode === 'both' && r.Cs.map.size > 0);

  const paste = async (set: (fn: (p: string) => string) => void) => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return toast(L('📋 Clipboard খালি', '📋 Clipboard is empty'));
      set((p) => (p.trim() ? p.replace(/\s+$/, '') + '\n' + t : t));
      toast(L('📋 Paste হয়েছে', '📋 Pasted'));
    } catch {
      toast(L('⌨️ Ctrl+V / long-press করে paste করো', '⌨️ Use Ctrl+V / long-press to paste'));
    }
  };
  const copyAll = async () => {
    if (!out.length) return;
    if (await copyText(out.map((o) => o.v).join('\n'))) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1600);
      toast(L(`✅ ${out.length} টা email copy হয়েছে`, `✅ ${out.length} emails copied`));
    } else toast(L('⚠️ Copy করা যায়নি', "⚠️ Couldn't copy"));
  };
  const copyOne = async (v: string, i: number) => {
    if (await copyText(v)) {
      setCopiedRow(i);
      setTimeout(() => setCopiedRow(-1), 1200);
      toast(L('📋 Copy হয়েছে: ', '📋 Copied: ') + v);
    }
  };

  const area = (value: string, set: (v: string) => void, ph: string) => (
    <textarea
      value={value}
      onChange={(e) => set(e.target.value)}
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      placeholder={ph}
      className="field scroll-thin h-[130px] resize-none whitespace-pre bg-black/25 font-mono text-[12.5px] leading-[1.7] lg:h-auto lg:min-h-[130px] lg:flex-1"
    />
  );
  const actions = (set: (fn: (p: string) => string) => void, clear: () => void) => (
    <div className="mt-2.5 flex gap-1.5">
      <Btn size="sm" icon="paste" onClick={() => paste(set)}>
        Paste
      </Btn>
      <Btn size="sm" icon="x" onClick={clear}>
        Clear
      </Btn>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} width={1100} label="Email Filter" className="lg:h-[min(86vh,760px)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-white/[0.025] px-4 py-3">
        <div className="flex gap-2">
          <button type="button" className="h-3 w-3 rounded-full bg-[#ff5f57]" onClick={onClose} aria-label="Close" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 text-[13px] font-medium text-ink-2">
          <span className="ic-disc h-6 w-6">
            <Icon name="filter" size={12} stroke={2.1} />
          </span>
          Email Filter
        </div>
        <IconBtn icon="x" label="Close" size={30} onClick={onClose} />
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4 lg:overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[640px] text-[12.5px] leading-relaxed text-ink-3">
            {L('List Mail এ সব email দাও, Checked Mail এ যেগুলো check করা শেষ সেগুলো দাও। যেগুলো মিলবে না বা Checked Mail এ নেই — সেগুলো Filtered Mail এ চলে আসবে, এক click এ copy করতে পারবে।', 'Paste every address into List Mail and the ones already checked into Checked Mail. Anything that does not match lands in Filtered Mail, ready to copy in one click.')}
          </p>
          <div className="flex gap-2">
            <span className="pill px-3 py-1.5 text-[11.5px] text-ink-3">
              <span className="h-1.5 w-1.5 rounded-full bg-good shadow-[0_0_8px_rgba(111,224,180,0.8)]" /> {L('মিলেছে', 'Matched')} <b className="text-white">{r.matched}</b>
            </span>
            <span className="pill px-3 py-1.5 text-[11.5px] text-ink-3">
              <span className="h-1.5 w-1.5 rounded-full bg-warn shadow-[0_0_8px_rgba(255,207,122,0.8)]" /> {L('ডুপ্লিকেট বাদ', 'Duplicates removed')} <b className="text-white">{r.Ls.dup + r.Cs.dup}</b>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_1fr_1.15fr]">
          <Box icon="list" title="List Mail" sub={L('সব email এখানে', 'All addresses')} count={r.Ls.map.size}>
            {area(list, setList, L('এখানে সব email paste করো…\nএকটা line এ একটা, বা comma / space দিয়ে\n\nname@example.com', 'Paste all addresses here…\nOne per line, or comma / space separated\n\nname@example.com'))}
            {actions(setList, () => setList(''))}
          </Box>
          <Box icon="tick" title="Checked Mail" sub={L('যেগুলো check করা হয়েছে', 'Already checked')} count={r.Cs.map.size}>
            {area(check, setCheck, L('যেগুলো check করা শেষ সেগুলো এখানে…\n\nname@example.com', 'Paste the ones already checked…\n\nname@example.com'))}
            {actions(setCheck, () => setCheck(''))}
          </Box>
          <div className="flex flex-col md:col-span-2 lg:col-span-1 lg:min-h-0">
            <Box icon="filter" title="Filtered Mail" sub={mode === 'both' ? L('যেকোনো এক দিকে নেই এমন সব', 'Missing from either side') : L('List এ আছে, Checked এ নেই', 'In List but not in Checked')} count={out.length} accent>
              <Segmented
                small
                tone="white"
                className="mb-2.5"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'missing', label: L('Checked এ নেই', 'Not in Checked') },
                  { value: 'both', label: L('দুই দিকের অমিল', 'All mismatches') }
                ]}
              />
              <div className="scroll-thin min-h-[150px] flex-1 overflow-y-auto rounded-[14px] border border-line-2 bg-black/25 p-1.5 lg:max-h-none" style={{ maxHeight: 'min(46vh, 520px)' }}>
                {!hasInput ? (
                  <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center text-[12px] text-ink-4">
                    <span className="ic-disc h-9 w-9">
                      <Icon name="inbox" size={16} />
                    </span>
                    {L('List Mail এ email দিলে এখানে ফলাফল দেখাবে', 'Results appear here once List Mail has addresses')}
                  </div>
                ) : !out.length ? (
                  <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center text-[12px] text-ink-4">
                    <span className="ic-disc h-9 w-9">
                      <Icon name="tick" size={16} />
                    </span>
                    {L('সব email মিলে গেছে — বাকি কিছু নেই ✓', 'Everything matched — nothing left ✓')}
                  </div>
                ) : (
                  <AnimatePresence initial={false} mode="popLayout">
                    {out.slice(0, CAP).map((o, i) => (
                      <motion.button
                        type="button"
                        key={o.side + o.v}
                        layout={out.length <= 150 ? 'position' : false}
                        initial={out.length <= 150 ? { opacity: 0, x: -8 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => copyOne(o.v, i)}
                        title={L('Click করলে copy হবে', 'Click to copy')}
                        className="group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left font-mono text-[12.5px] hover:bg-white/5"
                      >
                        <span className="w-6 shrink-0 text-right text-[10.5px] text-ink-4">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{o.v}</span>
                        {o.side === 'check' && <span className="shrink-0 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 font-sans text-[9.5px] font-semibold text-[#ffd99a]">{L('শুধু Checked এ', 'Only in Checked')}</span>}
                        <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors', copiedRow === i ? 'bg-[#7c4dff] text-white' : 'text-ink-3 group-hover:bg-white/10 group-hover:text-white')}>
                          <Icon name={copiedRow === i ? 'tick' : 'copy'} size={13} />
                        </span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                )}
                {out.length > CAP && <div className="py-2 text-center text-[11.5px] text-ink-4">{L(`আরো ${out.length - CAP} টা — "সব Copy" দিলে সবগুলো copy হবে`, `${out.length - CAP} more — "Copy all" includes them`)}</div>}
              </div>
              <button type="button" disabled={!out.length} onClick={copyAll} className={cx('btn mt-2.5 w-full py-2.5 text-[13px]', copiedAll ? 'btn-white' : 'btn-primary')}>
                <Icon name={copiedAll ? 'tick' : 'copy'} size={16} />
                {copiedAll ? L('Copy হয়েছে ✓', 'Copied ✓') : L('সব Copy করো', 'Copy all') + (out.length ? ` (${out.length.toLocaleString()})` : '')}
              </button>
            </Box>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-4">
          <span>💡 {L('বড়/ছোট হাতের অক্ষরের পার্থক্য ধরা হয় না, ডুপ্লিকেট নিজে থেকেই বাদ যায়। এই লেখাগুলো শুধু এই device এ থাকে।', 'Upper/lower case is ignored and duplicates are removed. This stays on this device only.')}</span>
          <Btn size="sm" icon="reset" onClick={() => (setList(''), setCheck(''), setMode('missing'), toast(L('🧹 সব মুছে দেওয়া হয়েছে', '🧹 Cleared')))}>
            {L('সব মুছে দাও', 'Clear everything')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
