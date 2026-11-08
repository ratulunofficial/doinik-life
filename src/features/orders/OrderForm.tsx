import { useEffect, useState } from 'react';
import { toast, useL, type ModalReq } from '../../lib/store';
import { getOrders, setOrders } from '../../lib/data';
import { Btn, Modal, ModalHeader } from '../../components/ui';
import { toISODate } from '../../lib/dates';
import type { Order } from '../../lib/types';

const blank = (): Order => ({ username: '', date: toISODate(new Date()), items: '', validity: 1, status: 'Continue', amount: 0, cost: 0, orderStatus: 'completed', account: '', password: '' });

export function OrderForm({ open, req, onClose }: { open: boolean; req?: Extract<ModalReq, { type: 'order' }>; onClose: () => void }) {
  const L = useL();
  const [o, setO] = useState<Order>(blank());
  const idx = req?.index ?? -1;
  useEffect(() => {
    if (!open) return;
    const cur = idx >= 0 ? getOrders()[idx] : null;
    setO(cur ? { ...blank(), ...cur } : blank());
  }, [open, idx]);
  const f = (k: keyof Order) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setO({ ...o, [k]: e.target.value });

  const save = () => {
    const clean: Order = {
      ...o,
      username: String(o.username || '').trim(),
      items: String(o.items || '').trim(),
      validity: parseInt(String(o.validity), 10) || 1,
      amount: parseInt(String(o.amount), 10) || 0,
      cost: parseInt(String(o.cost), 10) || 0,
      account: String(o.account || '').trim(),
      password: String(o.password || '').trim()
    };
    const list = [...getOrders()];
    if (idx >= 0) list[idx] = clean;
    else list.push(clean);
    setOrders(list);
    toast(idx >= 0 ? L('✏️ অর্ডার আপডেট হয়েছে', '✏️ Order updated') : L('✅ নতুন অর্ডার যোগ হয়েছে', '✅ Order added'));
    onClose();
  };

  const field = (label: string, el: React.ReactNode, full = false) => (
    <div className={full ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      {el}
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} width={560} label="Order">
      <ModalHeader icon="trend" title={idx >= 0 ? L('অর্ডার সম্পাদনা', 'Edit order') : L('নতুন অর্ডার', 'New order')} onClose={onClose} />
      <div className="scroll-thin grid grid-cols-2 gap-3 overflow-y-auto px-5 pb-2 sm:px-6">
        {field('Username', <input className="field" value={o.username} onChange={f('username')} placeholder="Username" />)}
        {field('Date', <input className="field" type="date" value={o.date} onChange={f('date')} />)}
        {field('Items', <input className="field" value={o.items} onChange={f('items')} placeholder="Product name" />)}
        {field('Validity (month)', <input className="field" inputMode="numeric" value={String(o.validity)} onChange={f('validity')} placeholder="1-12" />)}
        {field(
          'Status',
          <select className="field" value={o.status} onChange={f('status')}>
            <option>Continue</option>
            <option>Expired</option>
          </select>
        )}
        {field(
          'Order status',
          <select className="field" value={o.orderStatus} onChange={f('orderStatus')}>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="hold">Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        {field('Amount (৳)', <input className="field" inputMode="numeric" value={String(o.amount || '')} onChange={f('amount')} placeholder="Selling price" />)}
        {field('Cost (৳)', <input className="field" inputMode="numeric" value={String(o.cost || '')} onChange={f('cost')} placeholder="Buy price" />)}
        {field('Account details', <input className="field" value={o.account} onChange={f('account')} placeholder="Gmail or any text" />, true)}
        {field('Password', <input className="field" value={o.password} onChange={f('password')} placeholder="Password" autoComplete="off" />, true)}
      </div>
      <div className="flex gap-2.5 px-5 pt-3 pb-6 sm:px-6">
        <Btn className="flex-1" onClick={onClose}>
          {L('বাতিল', 'Cancel')}
        </Btn>
        <Btn variant="primary" className="flex-1" onClick={save}>
          {L('সেভ করুন', 'Save')}
        </Btn>
      </div>
    </Modal>
  );
}
