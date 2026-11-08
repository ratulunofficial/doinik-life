import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { confirmDialog, openModal, toast, useApp, useL } from '../../lib/store';
import { calcDayLeft, calcExpiry, canRedo, canUndo, fmtDMY, getOrders, redoOrders, setOrders, undoOrders, useOrders } from '../../lib/data';
import { AnimatedNumber, Btn, Card, Empty, IconBtn, SecLabel, useMedia } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { copyText, cx, money } from '../../lib/format';
import type { Order } from '../../lib/types';
import { isNative, saveFileNative } from '../../lib/native';

type Row = Order & { _idx: number; _exp: string; _left: number; _hc: boolean };
const SORT_KEY = 'dl2_orders_sort';

function useFlash() {
  const [k, setK] = useState('');
  const flash = (key: string) => {
    setK(key);
    setTimeout(() => setK((c) => (c === key ? '' : c)), 900);
  };
  return [k, flash] as const;
}

function normalizeDate(s: string) {
  if (!s) return '';
  const a = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (a) return `${a[3]}-${a[2].padStart(2, '0')}-${a[1].padStart(2, '0')}`;
  const b = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (b) return `${b[1]}-${b[2].padStart(2, '0')}-${b[3].padStart(2, '0')}`;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const d = new Date((n - 25569) * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

export default function OrdersPage() {
  const L = useL();
  const orders = useOrders();
  useApp((s) => s.raw.orders_data); // re-render on undo/redo
  const wide = useMedia('(min-width: 768px)');
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [onlySel, setOnlySel] = useState(false);
  const [sort, setSort] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(SORT_KEY) || '0', 10);
    return v === 1 || v === -1 ? v : 0;
  });
  const lastClick = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Pin the table header right under the sticky toolbar (its height changes when selection buttons show).
  useLayoutEffect(() => {
    const tb = toolbarRef.current, root = rootRef.current;
    if (!tb || !root) return;
    const apply = () => root.style.setProperty('--orders-th-top', parseFloat(getComputedStyle(tb).top) + tb.offsetHeight + 'px');
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(tb);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);
  const [flashKey, flash] = useFlash();

  // drop selections that no longer exist
  useEffect(() => setSel((s) => new Set([...s].filter((i) => i < orders.length))), [orders.length]);

  // Undo / redo shortcuts, only while this page is visible and not typing.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (useApp.getState().modal) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if ((k === 'x' && !e.shiftKey) || (k === 'y' && !e.shiftKey) || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redoOrders();
      } else if (k === 'z') {
        e.preventDefault();
        undoOrders();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const rows: Row[] = useMemo(() => {
    let list: Row[] = orders.map((o, i) => {
      const exp = calcExpiry(o.date, o.validity);
      const st = (o.orderStatus || '').toLowerCase();
      return { ...o, _idx: i, _exp: exp, _left: calcDayLeft(exp), _hc: st === 'hold' || st === 'cancelled' };
    });
    const s = q.toLowerCase().trim();
    if (s) {
      const terms = s.split(/\s+/).filter(Boolean);
      list =
        terms.length > 1
          ? list.filter((o) => terms.some((t) => (o.account || '').toLowerCase().trim() === t || (o.username || '').toLowerCase().trim() === t))
          : list.filter((o) => (o.username || '').toLowerCase().includes(s) || (o.account || '').toLowerCase().includes(s));
    }
    if (onlySel && sel.size) list = list.filter((o) => sel.has(o._idx));
    return list.sort((a, b) => {
      if (a._hc !== b._hc) return a._hc ? 1 : -1;
      if (sort) {
        if (a._left !== b._left) return sort === 1 ? a._left - b._left : b._left - a._left;
        return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
      }
      return a._idx - b._idx;
    });
  }, [orders, q, onlySel, sel, sort]);

  const stats = useMemo(() => {
    let profit = 0, amount = 0, active = 0;
    for (const o of orders) {
      profit += (parseInt(String(o.amount), 10) || 0) - (parseInt(String(o.cost), 10) || 0);
      amount += parseInt(String(o.amount), 10) || 0;
      if (calcDayLeft(calcExpiry(o.date, o.validity)) > 0) active++;
    }
    return { profit, amount, active };
  }, [orders]);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || s.includes(' ')) return [];
    const seen = new Set<string>();
    for (const o of orders) {
      const a = (o.account || '').trim();
      if (a && a.toLowerCase().includes(s) && a.toLowerCase() !== s) seen.add(a);
      if (seen.size >= 8) break;
    }
    return [...seen];
  }, [q, orders]);

  const toggleSel = (idx: number, e: MouseEvent | { shiftKey: boolean }) => {
    const pos = rows.findIndex((r) => r._idx === idx);
    setSel((prev) => {
      const n = new Set(prev);
      if (e.shiftKey && lastClick.current != null && pos >= 0) {
        const a = Math.min(lastClick.current, pos), b = Math.max(lastClick.current, pos);
        for (let i = a; i <= b; i++) rows[i] && n.add(rows[i]._idx);
      } else if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
    lastClick.current = pos;
  };
  const allVisibleSelected = rows.length > 0 && rows.every((r) => sel.has(r._idx));
  const selectAll = () => setSel((prev) => {
    const n = new Set(prev);
    if (allVisibleSelected) rows.forEach((r) => n.delete(r._idx));
    else rows.forEach((r) => n.add(r._idx));
    return n;
  });

  const copyAccount = async (o: Row) => {
    let text = o.account || '';
    let count = 1;
    if (sel.size && sel.has(o._idx)) {
      const accs = [...sel].sort((a, b) => a - b).map((i) => orders[i]?.account).filter(Boolean) as string[];
      text = accs.join('\n');
      count = accs.length;
    }
    if (await copyText(text)) {
      flash('a' + o._idx);
      toast(count > 1 ? L(`📋 ${count} টি Account Details কপি হয়েছে`, `📋 ${count} accounts copied`) : L('📋 কপি হয়েছে', '📋 Copied'));
    }
  };
  const copyPass = async (o: Row) => {
    if (await copyText(o.password || '')) {
      flash('p' + o._idx);
      toast(L('📋 Password কপি হয়েছে', '📋 Password copied'));
    }
  };
  const copyDetails = async (o: Row) => {
    const targets = sel.size ? rows.filter((r) => sel.has(r._idx)) : [o];
    const list = targets.length ? targets : [o];
    const text = list
      .map((r) => `Mail: ${(r.account || '').replace(/[\r\n]+/g, ' ').trim()}\nPass: ${(r.password || '').replace(/[\r\n]+/g, ' ').trim()}\n\nExpired : ${fmtDMY(r._exp)}`)
      .join('\n\n');
    if (await copyText(text)) {
      flash('e' + o._idx);
      toast(list.length > 1 ? L(`📋 ${list.length} টি Order Details কপি হয়েছে`, `📋 ${list.length} order details copied`) : L('📋 Order Details কপি হয়েছে', '📋 Order details copied'));
    }
  };
  const changeDate = (o: Row, v: string) => {
    if (!v) return;
    const list = [...getOrders()];
    const targets = sel.size && sel.has(o._idx) ? [...sel] : [o._idx];
    targets.forEach((i) => list[i] && (list[i] = { ...list[i], date: v }));
    setOrders(list);
    toast(targets.length > 1 ? L(`📅 ${targets.length} টি Date আপডেট হয়েছে`, `📅 ${targets.length} dates updated`) : L('📅 Date আপডেট হয়েছে', '📅 Date updated'));
  };
  const del = async (idx: number) => {
    if (!(await confirmDialog({ title: L('এই অর্ডারটি মুছে ফেলতে চান?', 'Delete this order?'), danger: true, okText: L('মুছে ফেলো', 'Delete') }))) return;
    setOrders(getOrders().filter((_, i) => i !== idx));
    setSel(new Set());
    toast(L('🗑️ অর্ডার মুছে ফেলা হয়েছে', '🗑️ Order deleted'));
  };
  const delSelected = async () => {
    const n = sel.size;
    if (!n || !(await confirmDialog({ title: L(`${n} টি অর্ডার মুছে ফেলতে চান?`, `Delete ${n} orders?`), danger: true, okText: L('মুছে ফেলো', 'Delete') }))) return;
    setOrders(getOrders().filter((_, i) => !sel.has(i)));
    setSel(new Set());
    setOnlySel(false);
    toast(L(`🗑️ ${n} টি অর্ডার মুছে ফেলা হয়েছে`, `🗑️ ${n} orders deleted`));
  };
  const cycleSort = () => {
    const n = sort === 0 ? 1 : sort === 1 ? -1 : 0;
    setSort(n);
    localStorage.setItem(SORT_KEY, String(n));
    toast(n === 1 ? L('⬆ ছোট → বড়', '⬆ Fewest days first') : n === -1 ? L('⬇ বড় → ছোট', '⬇ Most days first') : L('Sort বন্ধ', 'Sort off'));
  };

  const exportExcel = async () => {
    if (!orders.length) return toast(L('❌ কোনো অর্ডার নেই', '❌ No orders'));
    const XLSX = await import('xlsx');
    const data = orders.map((o, i) => {
      const exp = calcExpiry(o.date, o.validity);
      const left = calcDayLeft(exp);
      return {
        'Order ID': i + 1,
        Username: o.username || '',
        Date: o.date || '',
        Items: o.items || '',
        'Validity (Month)': o.validity || '',
        'Expiry Date': exp || '',
        'Day Left': left,
        Status: left > 0 ? 'Continue' : 'Expired',
        Amount: o.amount || 0,
        Cost: o.cost || 0,
        Profit: (parseInt(String(o.amount), 10) || 0) - (parseInt(String(o.cost), 10) || 0),
        'Order Status': o.orderStatus || '',
        'Account Details': o.account || '',
        Password: o.password || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const fileName = `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (isNative()) {
      // Android WebView can't "download" — write the file to Documents instead.
      await saveFileNative(fileName, XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }));
      return;
    }
    XLSX.writeFile(wb, fileName);
    toast(L('📤 Excel Export সম্পন্ন হয়েছে', '📤 Exported to Excel'));
  };
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let rowsIn: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const lines = (await file.text()).split('\n').filter((l) => l.trim());
        const heads = (lines[0] || '').split(',').map((h) => h.trim().toLowerCase());
        rowsIn = lines.slice(1).map((l) => {
          const v = l.split(',').map((x) => x.trim());
          return Object.fromEntries(heads.map((h, i) => [h, v[i] || '']));
        });
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        rowsIn = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
      if (!rowsIn.length) return;
      const list = [...getOrders()];
      for (const row of rowsIn) {
        const keys = Object.keys(row);
        const g = (pats: string[]) => {
          for (const p of pats) {
            const k = keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(p));
            if (k) return String(row[k]).trim();
          }
          return '';
        };
        list.push({
          orderId: g(['orderid', 'order', 'id', 'serial']) || list.length + 1,
          username: g(['username', 'user', 'name']),
          date: normalizeDate(g(['date'])),
          items: g(['items', 'item', 'product']),
          validity: parseInt(g(['validity', 'month', 'months']), 10) || 1,
          status: g(['status']) || 'Continue',
          amount: parseInt(g(['amount', 'price', 'sell', 'selling']), 10) || 0,
          cost: parseInt(g(['cost', 'buy', 'buying']), 10) || 0,
          orderStatus: g(['orderstatus', 'ordstatus']) || 'completed',
          account: g(['account', 'accountdetails', 'email', 'gmail']),
          password: g(['password', 'pass', 'pwd'])
        });
      }
      setOrders(list);
      toast(L(`✅ ${rowsIn.length} টি অর্ডার import হয়েছে`, `✅ Imported ${rowsIn.length} orders`));
    } catch (err) {
      toast('❌ Import failed: ' + (err as Error).message);
    }
  };

  const pct = orders.length ? Math.round((stats.active / orders.length) * 100) : 0;
  const leftColor = (o: Row) => (o._left > 0 ? 'text-blue-2' : 'text-ink-4');
  const rowTint = (o: Row) => (o._hc ? '' : o._left === 1 ? 'bg-good/[0.06]' : o._left <= 0 ? 'bg-bad/[0.06]' : '');

  return (
    <div ref={rootRef} className="flex flex-col gap-3 lg:gap-4">
      <Card className="!p-4 lg:!p-5">
        <div className="flex flex-wrap items-center gap-3">
          <SecLabel icon="trend">{L('অর্ডার ড্যাশবোর্ড', 'Orders')}</SecLabel>
          <span className="pill ml-auto px-3 py-1 text-[11.5px] text-ink-3">
            {L('Active', 'Active')} <b className="text-white">{pct}%</b>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { v: orders.length, l: L('মোট অ্যাকাউন্ট', 'Accounts'), f: (n: number) => String(Math.round(n)) },
            { v: stats.profit, l: L('মোট প্রফিট', 'Total profit'), f: money },
            { v: stats.amount, l: L('মোট বিক্রি', 'Total sales'), f: money },
            { v: stats.active, l: 'Active', f: (n: number) => String(Math.round(n)) }
          ].map((s) => (
            <div key={s.l} className="sub-glass vline relative px-4 py-3 pl-6">
              <span className="absolute left-3 top-[26%] bottom-[26%] w-[1.5px] rounded bg-gradient-to-b from-transparent via-white/70 to-transparent" />
              <AnimatedNumber value={s.v} format={s.f} className="num block text-[24px] text-white" />
              <div className="text-[11px] text-ink-4">{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div ref={toolbarRef} className="glass sticky top-[calc(env(safe-area-inset-top)+62px)] z-30 flex flex-wrap items-center gap-1.5 !rounded-[20px] p-2 lg:top-4">
        <Btn variant="primary" size="sm" icon="plus" onClick={() => openModal({ type: 'order', index: -1 })}>
          {L('নতুন অর্ডার', 'New order')}
        </Btn>
        <Btn size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
          Import
        </Btn>
        <Btn size="sm" icon="download" onClick={exportExcel}>
          Export
        </Btn>
        <Btn size="sm" icon="sort" onClick={cycleSort} className={sort ? '!border-[#9b7bff] !bg-[#7c4dff] !text-white' : ''}>
          {sort === 1 ? '⬆' : sort === -1 ? '⬇' : ''} Day left
        </Btn>
        <IconBtn icon="undo" label="Undo (Ctrl+Z)" size={30} disabled={!canUndo()} onClick={undoOrders} className="disabled:opacity-30" />
        <IconBtn icon="redo" label="Redo (Ctrl+Y)" size={30} disabled={!canRedo()} onClick={redoOrders} className="disabled:opacity-30" />
        <AnimatePresence>
          {sel.size > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-1.5">
              <Btn size="sm" variant="danger" icon="trash" onClick={delSelected}>
                {sel.size}
              </Btn>
              <Btn size="sm" icon="x" onClick={() => (setSel(new Set()), setOnlySel(false))}>
                {L('Deselect', 'Deselect')}
              </Btn>
              <Btn size="sm" icon="eye" onClick={() => setOnlySel(!onlySel)} className={onlySel ? '!border-[#9b7bff] !bg-[#7c4dff] !text-white' : ''}>
                {onlySel ? L('সব', 'All') : L('Selected', 'Selected')}
              </Btn>
            </motion.div>
          )}
        </AnimatePresence>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFile} />
        <div className="relative ml-auto w-full sm:w-64">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input className="field py-2 pl-9 pr-8 text-[13px]" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-white" aria-label="Clear">
              <Icon name="x" size={13} />
            </button>
          )}
          <AnimatePresence>
            {focus && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-line-2 bg-[#110d24]/95 p-1 shadow-2xl backdrop-blur-xl">
                {suggestions.map((s) => (
                  <button key={s} type="button" onMouseDown={() => setQ(s)} className="block w-full truncate rounded-xl px-3 py-2 text-left text-[12.5px] text-ink-2 hover:bg-white/5">
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!rows.length ? (
        <Empty icon="trend">{orders.length ? L('কিছু পাওয়া যায়নি।', 'No matching orders.') : L('কোনো অর্ডার নেই। নতুন অর্ডার যোগ করুন বা Excel import করুন।', 'No orders yet. Add one or import from Excel.')}</Empty>
      ) : wide ? (
        <div className="glass !rounded-[20px] p-1">
          {/* The page scrolls (stats card scrolls away, toolbar stays pinned). On very wide
              screens the table fits, so its header can also pin under the toolbar. */}
          <div className="scroll-thin overflow-x-auto rounded-[16px] 2xl:overflow-visible">
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[12px] 2xl:text-[12.5px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-4">
                <th className="sticky top-0 z-10 w-9 rounded-tl-[16px] bg-[#110d24]/95 px-2.5 py-3 backdrop-blur-xl 2xl:top-[var(--orders-th-top,124px)]">
                  <input type="checkbox" checked={allVisibleSelected} onChange={selectAll} className="h-3.5 w-3.5 accent-[#7c4dff]" />
                </th>
                {['#', 'Username', 'Date', 'Items', 'Validity', 'Expiry', 'Day left', 'Status', 'Amount', 'Cost', 'Profit', 'Order status', 'Account', 'Password', ''].map((h, i, arr) => (
                  <th key={h} className={cx('sticky top-0 z-10 whitespace-nowrap bg-[#110d24]/95 px-2.5 py-3 backdrop-blur-xl 2xl:top-[var(--orders-th-top,124px)]', i === arr.length - 1 && 'rounded-tr-[16px]')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o, di) => {
                const profit = (parseInt(String(o.amount), 10) || 0) - (parseInt(String(o.cost), 10) || 0);
                const isSel = sel.has(o._idx);
                return (
                  <tr key={o._idx} className={cx('transition-colors hover:bg-white/[0.03]', isSel ? 'bg-blue/[0.12]' : rowTint(o))}>
                    <td className="border-t border-line px-2.5 py-2">
                      <input type="checkbox" checked={isSel} onClick={(e) => toggleSel(o._idx, e)} onChange={() => {}} className="h-3.5 w-3.5 accent-[#7c4dff]" />
                    </td>
                    <td className="border-t border-line px-2.5 py-2 text-ink-4">{di + 1}</td>
                    <td className="border-t border-line px-2.5 py-2 font-medium text-white">{o.username}</td>
                    <td className="border-t border-line px-2.5 py-2">
                      {!o._hc && (
                        <label className="relative cursor-pointer whitespace-nowrap rounded-lg px-1.5 py-0.5 hover:bg-white/5">
                          {fmtDMY(o.date)}
                          <input type="date" value={o.date || ''} onChange={(e) => changeDate(o, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                        </label>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-t border-line px-2.5 py-2">{o.items}</td>
                    <td className="whitespace-nowrap border-t border-line px-2.5 py-2">{!o._hc && `${o.validity} ${L('মাস', 'mo')}`}</td>
                    <td className="border-t border-line px-2.5 py-2">
                      {o._exp && (
                        <button type="button" onClick={() => copyDetails(o)} title={L('ক্লিক করে কপি করুন', 'Click to copy details')} className={cx('whitespace-nowrap rounded-lg px-1.5 py-0.5 transition-colors', flashKey === 'e' + o._idx ? 'bg-[#7c4dff] text-white' : 'hover:bg-white/5')}>
                          {fmtDMY(o._exp)}
                        </button>
                      )}
                    </td>
                    <td className={cx('whitespace-nowrap border-t border-line px-2.5 py-2 font-bold', leftColor(o))}>{!o._hc && `${o._left} ${L('দিন', 'd')}`}</td>
                    <td className="border-t border-line px-2.5 py-2">
                      <span className={cx('badge', o._left > 0 ? 'badge-work' : 'border-bad/30 bg-bad/10 text-[#ffb3b3]')}>{o._left > 0 ? 'Continue' : 'Expired'}</span>
                    </td>
                    <td className="border-t border-line px-2.5 py-2">{!o._hc && money(o.amount || 0)}</td>
                    <td className="border-t border-line px-2.5 py-2">{!o._hc && money(o.cost || 0)}</td>
                    <td className={cx('border-t border-line px-2.5 py-2 font-semibold', profit >= 0 ? 'text-good' : 'text-bad')}>{money(profit)}</td>
                    <td className="border-t border-line px-2.5 py-2 capitalize">{o.orderStatus || 'completed'}</td>
                    <td className="max-w-[240px] border-t border-line px-2.5 py-2 2xl:max-w-[380px]">
                      {o.account && (
                        <button type="button" onClick={() => copyAccount(o)} className={cx('max-w-full truncate rounded-lg px-1.5 py-0.5 text-left transition-colors', flashKey === 'a' + o._idx ? 'bg-[#7c4dff] text-white' : 'text-blue-3 hover:bg-white/5')}>
                          {o.account}
                        </button>
                      )}
                    </td>
                    <td className="border-t border-line px-2.5 py-2">
                      {o.password && (
                        <button type="button" onClick={() => copyPass(o)} className={cx('rounded-lg px-1.5 py-0.5 font-mono transition-colors', flashKey === 'p' + o._idx ? 'bg-[#7c4dff] text-white' : 'hover:bg-white/5')}>
                          {o.password}
                        </button>
                      )}
                    </td>
                    <td className="border-t border-line px-2.5 py-2">
                      <div className="flex gap-1">
                        <IconBtn icon="edit" label="Edit" size={28} onClick={() => openModal({ type: 'order', index: o._idx })} />
                        <IconBtn icon="trash" label="Delete" size={28} onClick={() => del(o._idx)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((o) => {
            const profit = (parseInt(String(o.amount), 10) || 0) - (parseInt(String(o.cost), 10) || 0);
            const isSel = sel.has(o._idx);
            return (
              <motion.div key={o._idx} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cx('glass !rounded-[20px] p-3.5', isSel && '!border-blue-2/50', rowTint(o))}>
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => toggleSel(o._idx, { shiftKey: false })} className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border', isSel ? 'border-transparent bg-blue' : 'border-line-3')} aria-label="Select">
                    {isSel && <Icon name="tick" size={12} stroke={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium text-white">{o.username || '—'}</span>
                      <span className="text-[12px] text-ink-4">· {o.items}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {!o._hc && <span className={cx('badge', o._left > 0 ? 'badge-work' : 'border-bad/30 bg-bad/10 text-[#ffb3b3]')}>{o._left} {L('দিন বাকি', 'days left')}</span>}
                      {o._hc && <span className="badge border-warn/30 bg-warn/10 capitalize text-[#ffd99a]">{o.orderStatus}</span>}
                      {o._exp && (
                        <button type="button" onClick={() => copyDetails(o)} className={cx('rounded-full border px-2 py-0.5', flashKey === 'e' + o._idx ? 'border-[#9b7bff] bg-[#7c4dff] text-white' : 'border-line-2 text-ink-3')}>
                          ⏳ {fmtDMY(o._exp)}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={cx('text-right text-[14px] font-semibold', profit >= 0 ? 'text-good' : 'text-bad')}>
                    {money(profit)}
                    <div className="text-[10px] font-normal text-ink-4">{money(o.amount || 0)}</div>
                  </div>
                </div>
                {(o.account || o.password) && (
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <button type="button" onClick={() => copyAccount(o)} className={cx('truncate rounded-xl border px-3 py-2 text-left text-[12px]', flashKey === 'a' + o._idx ? 'border-[#9b7bff] bg-[#7c4dff] text-white' : 'border-line-2 bg-white/[0.03] text-blue-3')}>
                      {o.account || '—'}
                    </button>
                    <button type="button" onClick={() => copyPass(o)} className={cx('rounded-xl border px-3 py-2 font-mono text-[12px]', flashKey === 'p' + o._idx ? 'border-[#9b7bff] bg-[#7c4dff] text-white' : 'border-line-2 bg-white/[0.03] text-ink-2')}>
                      {o.password || '—'}
                    </button>
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  {!o._hc ? (
                    <label className="relative text-[11.5px] text-ink-4">
                      📅 {fmtDMY(o.date)} · {o.validity} {L('মাস', 'mo')}
                      <input type="date" value={o.date || ''} onChange={(e) => changeDate(o, e.target.value)} className="absolute inset-0 opacity-0" />
                    </label>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-1.5">
                    <IconBtn icon="edit" label="Edit" size={30} onClick={() => openModal({ type: 'order', index: o._idx })} />
                    <IconBtn icon="trash" label="Delete" size={30} onClick={() => del(o._idx)} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
