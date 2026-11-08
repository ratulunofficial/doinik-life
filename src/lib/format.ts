export const money = (n: number) => '৳' + Math.round(Number(n) || 0).toLocaleString();

export function compact(n: number) {
  n = Math.round(Number(n) || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function pctDelta(curr: number, prev: number, en: boolean): { text: string; cls: 'up' | 'down' | 'same' } {
  if (!prev || prev <= 0) {
    if (curr > 0) return { text: en ? 'New' : 'নতুন', cls: 'up' };
    return { text: '—', cls: 'same' };
  }
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { text: en ? 'Same' : 'একই', cls: 'same' };
  return { text: (pct > 0 ? '↑ ' : '↓ ') + Math.abs(pct).toFixed(0) + '%', cls: pct > 0 ? 'up' : 'down' };
}

const EMOJI_LEAD = /^([\p{Extended_Pictographic}‍️][\p{Extended_Pictographic}‍️\u{1F1E6}-\u{1F1FF}]*)/u;
export function leadEmoji(name: string): string | null {
  const m = (name || '').trim().match(EMOJI_LEAD);
  return m ? m[1] : null;
}
export function stripLeadEmoji(name: string) {
  const t = (name || '').trim();
  const e = leadEmoji(t);
  return e ? t.slice(e.length).trim() : t;
}
export const normalizeName = (name: string) => stripLeadEmoji(name).toLowerCase().replace(/\s+/g, ' ').trim();

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export const haptic = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
