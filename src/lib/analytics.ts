import { leadEmoji, normalizeName, stripLeadEmoji } from './format';

export interface ExpRec {
  y: number;
  m: number;
  d: number;
  amt: number;
  name: string;
}
export interface ItemAgg {
  key: string;
  name: string;
  emoji: string;
  amt: number;
  count: number;
}
export interface Agg {
  total: number;
  entries: number;
  byName: Map<string, ItemAgg>;
  byMonth: Map<string, number>; // "y-m"
  byYear: Map<number, number>;
  byDay: Map<string, number>; // "y-m-d"
  days: Set<string>;
}

/** One pass over every day_* key → flat expense records. */
export function scanExpenses(raw: Record<string, string>): ExpRec[] {
  const out: ExpRec[] = [];
  for (const k in raw) {
    if (!k.startsWith('day_')) continue;
    const p = k.slice(4).split('-');
    if (p.length !== 3) continue;
    const y = +p[0], m = +p[1] - 1, d = +p[2];
    if (!y || isNaN(m) || !d) continue;
    let data: { expenses?: { amt?: unknown; name?: unknown }[] } | null;
    try {
      data = JSON.parse(raw[k]);
    } catch {
      continue;
    }
    if (!data || !Array.isArray(data.expenses)) continue;
    for (const e of data.expenses) {
      const amt = Number(e?.amt) || 0;
      if (amt > 0) out.push({ y, m, d, amt, name: String(e?.name || '').trim() });
    }
  }
  return out;
}

export function aggregate(recs: ExpRec[], unnamed: string): Agg {
  const a: Agg = { total: 0, entries: 0, byName: new Map(), byMonth: new Map(), byYear: new Map(), byDay: new Map(), days: new Set() };
  for (const r of recs) {
    a.total += r.amt;
    a.entries++;
    const mk = r.y + '-' + r.m;
    const dk = mk + '-' + r.d;
    a.byMonth.set(mk, (a.byMonth.get(mk) || 0) + r.amt);
    a.byYear.set(r.y, (a.byYear.get(r.y) || 0) + r.amt);
    a.byDay.set(dk, (a.byDay.get(dk) || 0) + r.amt);
    a.days.add(dk);
    const rawName = r.name || unnamed;
    const key = normalizeName(rawName) || rawName.toLowerCase();
    const emoji = leadEmoji(rawName) || '';
    const ex = a.byName.get(key);
    if (ex) {
      ex.amt += r.amt;
      ex.count++;
      if (emoji && !ex.emoji) ex.emoji = emoji;
    } else a.byName.set(key, { key, name: stripLeadEmoji(rawName) || rawName, emoji, amt: r.amt, count: 1 });
  }
  return a;
}

export interface CatAgg {
  key: string;
  emoji: string;
  amt: number;
  count: number;
  items: number;
}
/** Group items by their leading emoji (same "category" idea as the original). */
export function categories(byName: Map<string, ItemAgg>): CatAgg[] {
  const m = new Map<string, CatAgg>();
  byName.forEach((it) => {
    const k = it.emoji || '__none__';
    const ex = m.get(k);
    if (ex) {
      ex.amt += it.amt;
      ex.count += it.count;
      ex.items++;
    } else m.set(k, { key: k, emoji: it.emoji, amt: it.amt, count: it.count, items: 1 });
  });
  return [...m.values()].sort((a, b) => b.amt - a.amt);
}
