import type { Lang } from './types';

export const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON_SHORT_BN = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
export const MON_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
export const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
export const DAYS_LONG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const months = (l: Lang) => (l === 'en' ? MONTHS_EN : MONTHS_BN);
export const monShort = (l: Lang) => (l === 'en' ? MON_SHORT_EN : MON_SHORT_BN);
export const days = (l: Lang) => (l === 'en' ? DAYS_EN : DAYS_BN);

/** Same format as the original app: "2026-11-8" (no zero padding). */
export const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const keyToDate = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function isFuture(key: string, todayKey: string) {
  return keyToDate(key) > keyToDate(todayKey);
}
/** Days older than yesterday are read-only (same rule as the original app). */
export function isLocked(key: string, todayKey: string) {
  if (key === todayKey) return false;
  const d = keyToDate(key);
  const t = keyToDate(todayKey);
  if (d > t) return false;
  const y = addDays(t, -1);
  if (key === dateKey(y)) return false;
  return d < y;
}

export function dateLabel(key: string, l: Lang) {
  const [y, m, d] = key.split('-');
  return l === 'en' ? `${MONTHS_EN[+m - 1]} ${d}, ${y}` : `${d} ${MONTHS_BN[+m - 1]} ${y}`;
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const BD_HOLIDAYS: Record<string, [string, string]> = {
  '2-21': ['শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', 'Language Martyrs Day & International Mother Language Day'],
  '3-17': ['জাতির পিতার জন্মদিন', "Father of the Nation's Birthday"],
  '3-26': ['স্বাধীনতা ও জাতীয় দিবস', 'Independence & National Day'],
  '4-14': ['পহেলা বৈশাখ', 'Pohela Boishakh (Bengali New Year)'],
  '5-1': ['মহান মে দিবস', 'May Day'],
  '8-15': ['জাতীয় শোক দিবস', 'National Mourning Day'],
  '11-7': ['জাতীয় বিপ্লব ও সংহতি দিবস', 'National Revolution & Solidarity Day'],
  '12-16': ['বিজয় দিবস', 'Victory Day'],
  '12-25': ['বড়দিন', 'Christmas Day']
};
export function bdHoliday(d: Date, l: Lang): string | null {
  const h = BD_HOLIDAYS[`${d.getMonth() + 1}-${d.getDate()}`];
  return h ? (l === 'en' ? h[1] : h[0]) : null;
}

export const bnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
