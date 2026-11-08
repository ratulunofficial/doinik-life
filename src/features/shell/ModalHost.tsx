import { useRef } from 'react';
import { closeModal, useApp, type ModalReq } from '../../lib/store';
import { PermModal } from '../tasks/PermModal';
import { NoteEditor } from '../notes/NoteEditor';
import { TempNotepad } from '../notes/TempNotepad';
import { EmailFilter } from '../notes/EmailFilter';
import { AccountModal } from '../auth/AccountModal';
import { UsernameModal } from '../auth/UsernameModal';
import { AddMoreModal, SettleModal } from '../expense/LoanModals';
import { OrderForm } from '../orders/OrderForm';

type Of<T extends ModalReq['type']> = Extract<ModalReq, { type: T }>;

/** Renders every modal once; the last request per type is kept so exit animations have data. */
export function ModalHost() {
  const modal = useApp((s) => s.modal);
  const last = useRef<Partial<Record<ModalReq['type'], ModalReq>>>({});
  if (modal) last.current[modal.type] = modal;
  const req = <T extends ModalReq['type']>(t: T) => last.current[t] as Of<T> | undefined;
  const is = (t: ModalReq['type']) => modal?.type === t;

  return (
    <>
      <PermModal open={is('perm')} onClose={closeModal} />
      <NoteEditor open={is('note')} req={req('note')} onClose={closeModal} />
      <TempNotepad open={is('temp')} req={req('temp')} onClose={closeModal} />
      <EmailFilter open={is('emailFilter')} onClose={closeModal} />
      <AccountModal open={is('account')} onClose={closeModal} />
      <SettleModal open={is('settle')} req={req('settle')} onClose={closeModal} />
      <AddMoreModal open={is('addMore')} req={req('addMore')} onClose={closeModal} />
      <OrderForm open={is('order')} req={req('order')} onClose={closeModal} />
      <UsernameModal open={is('username')} req={req('username')} />
    </>
  );
}
