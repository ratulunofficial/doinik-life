import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useL } from '../../lib/store';
import { addPermTask, removePermTask, usePerm } from '../../lib/data';
import { Btn, Empty, Modal, ModalHeader, spring } from '../../components/ui';
import { Icon } from '../../components/Icon';

const CATS = ['work', 'health', 'personal'] as const;
const label = (c: string) => (c === 'work' ? 'Work' : c === 'health' ? 'Health' : 'Personal');

export function PermModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const items = usePerm();
  const [text, setText] = useState('');
  const [cat, setCat] = useState('personal');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addPermTask(text, cat)) setText('');
  };
  return (
    <Modal open={open} onClose={onClose} width={480} label="Permanent tasks">
      <ModalHeader
        icon="pin"
        title={L('Permanent Task', 'Permanent tasks')}
        subtitle={L('এই tasks গুলো প্রতিদিন automatic আজকের list এ যোগ হবে — একবার add করলেই হবে।', 'These are added to your list automatically every day — add once, done.')}
        onClose={onClose}
      />
      <div className="scroll-thin max-h-[46vh] overflow-y-auto px-5 sm:px-6">
        {items.length === 0 ? (
          <Empty icon="pin">{L('এখনো কোনো permanent task নেই। নিচ থেকে যোগ করো।', 'No permanent tasks yet. Add one below.')}</Empty>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div key={it.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="ic-disc h-7 w-7">
                    <Icon name="pin" size={13} stroke={2.1} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{it.text}</span>
                  <span className={'badge badge-' + (it.cat || 'personal')}>{label(it.cat)}</span>
                  <button type="button" onClick={() => removePermTask(it.id)} className="grid h-7 w-7 place-items-center rounded-full text-ink-4 hover:bg-white/10 hover:text-white" aria-label="Remove">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 px-5 pt-4 sm:px-6">
        <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={L('📌 প্রতিদিনের permanent task...', '📌 A daily task...')} />
        <select className="field w-[98px] shrink-0" value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
        <Btn variant="primary" type="submit" icon="plus" className="shrink-0 px-3.5" aria-label="Add" />
      </form>
      <div className="px-5 pt-3 pb-6 sm:px-6">
        <Btn variant="white" className="w-full" onClick={onClose}>
          {L('✓ ঠিক আছে', '✓ Done')}
        </Btn>
      </div>
    </Modal>
  );
}
