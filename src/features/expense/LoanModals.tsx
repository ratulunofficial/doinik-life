import { useEffect, useState } from 'react';
import { useL, type ModalReq } from '../../lib/store';
import { addMoreLoan, loanRemaining, settleLoan, useLoans } from '../../lib/data';
import { Btn, Modal, ModalHeader } from '../../components/ui';
import { money } from '../../lib/format';

function InfoRow({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? 'mt-1 border-t border-line pt-2.5' : ''}`}>
      <span className={strong ? 'text-[13px] font-semibold text-ink-2' : 'text-[12px] text-ink-4'}>{l}</span>
      <span className={strong ? 'num text-[20px] text-white' : 'text-[13px] font-medium text-ink'}>{v}</span>
    </div>
  );
}

export function SettleModal({ open, req, onClose }: { open: boolean; req?: Extract<ModalReq, { type: 'settle' }>; onClose: () => void }) {
  const L = useL();
  const loan = useLoans().find((l) => l.id === req?.loanId);
  const [v, setV] = useState('');
  useEffect(() => {
    if (open) setV('');
  }, [open]);
  const rem = loan ? loanRemaining(loan) : 0;
  const ok = () => {
    if (loan && settleLoan(loan.id, parseFloat(v))) onClose();
  };
  return (
    <Modal open={open && !!loan} onClose={onClose} width={420} label="Settle">
      {loan && (
        <>
          <ModalHeader
            icon="wallet"
            title={loan.type === 'gave' ? L('টাকা পেয়েছ', 'Money received') : L('টাকা শোধ করেছ', 'Money repaid')}
            subtitle={loan.type === 'gave' ? L(`${loan.name} কত টাকা ফেরত দিল?`, `How much did ${loan.name} return?`) : L(`${loan.name} কে কত টাকা শোধ করলে?`, `How much did you repay ${loan.name}?`)}
            onClose={onClose}
          />
          <div className="px-6 pb-6">
            <div className="sub-glass mb-4 px-4 py-2">
              <InfoRow l={L('মূল পরিমাণ', 'Original')} v={money(loan.amt)} />
              {loan.paid > 0 && <InfoRow l={L('আগে পরিশোধিত', 'Already paid')} v={money(loan.paid)} />}
              <InfoRow l={L('এখনও বাকি', 'Still due')} v={money(rem)} strong />
            </div>
            <label className="label">{L('পরিশোধের পরিমাণ', 'Amount paid')}</label>
            <input autoFocus className="field mb-3 text-[18px]" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && ok()} placeholder="0" />
            <div className="mb-5 grid grid-cols-4 gap-2">
              {[
                [0.25, '¼'],
                [0.5, '½'],
                [0.75, '¾'],
                [1, L('পুরো', 'All')]
              ].map(([f, lbl]) => (
                <Btn key={String(f)} size="sm" onClick={() => setV(String(Math.round(rem * (f as number))))}>
                  {lbl}
                </Btn>
              ))}
            </div>
            <div className="flex gap-2.5">
              <Btn className="flex-1" onClick={onClose}>
                {L('বাতিল', 'Cancel')}
              </Btn>
              <Btn variant="primary" className="flex-1" onClick={ok}>
                ✓ {L('পরিশোধ করো', 'Settle')}
              </Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export function AddMoreModal({ open, req, onClose }: { open: boolean; req?: Extract<ModalReq, { type: 'addMore' }>; onClose: () => void }) {
  const L = useL();
  const loan = useLoans().find((l) => l.id === req?.loanId);
  const [v, setV] = useState('');
  useEffect(() => {
    if (open) setV('');
  }, [open]);
  const ok = () => {
    if (loan && addMoreLoan(loan.id, parseFloat(v))) onClose();
  };
  return (
    <Modal open={open && !!loan} onClose={onClose} width={420} label="Add more">
      {loan && (
        <>
          <ModalHeader
            icon="plus"
            title={loan.type === 'gave' ? L('আরও দিচ্ছ', 'Lending more') : L('আরও নিচ্ছ', 'Borrowing more')}
            subtitle={loan.type === 'gave' ? L(`${loan.name} কে আরও কত টাকা দিলে?`, `How much more did you give ${loan.name}?`) : L(`${loan.name} এর কাছ থেকে আরও কত টাকা নিলে?`, `How much more did you take from ${loan.name}?`)}
            onClose={onClose}
          />
          <div className="px-6 pb-6">
            <div className="sub-glass mb-4 px-4 py-2">
              <InfoRow l={L('বর্তমান মূল', 'Current principal')} v={money(loan.amt)} />
              {loan.paid > 0 && <InfoRow l={L('পরিশোধিত', 'Paid')} v={money(loan.paid)} />}
              <InfoRow l={L('এখন বাকি', 'Due now')} v={money(loanRemaining(loan))} strong />
            </div>
            <label className="label">{L('অতিরিক্ত পরিমাণ', 'Extra amount')}</label>
            <input autoFocus className="field mb-5 text-[18px]" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && ok()} placeholder="0" />
            <div className="flex gap-2.5">
              <Btn className="flex-1" onClick={onClose}>
                {L('বাতিল', 'Cancel')}
              </Btn>
              <Btn variant="primary" className="flex-1" onClick={ok}>
                ✓ {L('যোগ করো', 'Add')}
              </Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
