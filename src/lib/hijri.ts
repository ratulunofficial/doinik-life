import type { Lang } from './types';
import { bnDigits } from './dates';

const HIJRI_BN = ['মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান', 'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ্জ'];
const HIJRI_EN = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];

export interface Hijri {
  day: number;
  month: number;
  year: string;
}

/** Bangladesh usually runs ~2 days behind Umm al-Qura; same default as the original. */
export function getHijriOffset() {
  const v = parseInt(localStorage.getItem('hijriOffset') || '', 10);
  return Number.isFinite(v) ? v : -2;
}
export function setHijriOffset(v: number) {
  localStorage.setItem('hijriOffset', String(v));
  Object.keys(localStorage)
    .filter((k) => k.startsWith('hijriCache:'))
    .forEach((k) => localStorage.removeItem(k));
}

function fromIntl(date: Date): Hijri | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    return {
      day: parseInt(parts.find((p) => p.type === 'day')!.value, 10),
      month: parseInt(parts.find((p) => p.type === 'month')!.value, 10),
      year: parts.find((p) => p.type === 'year')!.value
    };
  } catch {
    return null;
  }
}

export async function getHijri(date: Date): Promise<Hijri | null> {
  const adj = new Date(date.getTime() + getHijriOffset() * 864e5);
  const dd = String(adj.getDate()).padStart(2, '0');
  const mm = String(adj.getMonth() + 1).padStart(2, '0');
  const yyyy = adj.getFullYear();
  const ck = `hijriCache:${yyyy}-${mm}-${dd}`;
  try {
    const c = localStorage.getItem(ck);
    if (c) return JSON.parse(c);
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(`https://api.aladhan.com/v1/gToH/${dd}-${mm}-${yyyy}`, { cache: 'force-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const h = j?.data?.hijri;
    if (!h) throw new Error('bad payload');
    const out = { day: parseInt(h.day, 10), month: parseInt(h.month?.number, 10), year: String(h.year) };
    try {
      localStorage.setItem(ck, JSON.stringify(out));
    } catch {
      /* ignore */
    }
    return out;
  } catch {
    return fromIntl(adj);
  }
}

export function formatHijri(h: Hijri, lang: Lang, compact: boolean) {
  if (lang === 'en') {
    const m = HIJRI_EN[h.month - 1] || '';
    return compact ? `${h.day} ${m}` : `${h.day} ${m} ${h.year} AH`;
  }
  const m = HIJRI_BN[h.month - 1] || '';
  return compact ? `${bnDigits(h.day)} ${m}` : `${bnDigits(h.day)} ${m} ${bnDigits(h.year)} হিজরি`;
}
