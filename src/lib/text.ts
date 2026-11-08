// ── BODMAS calculator for the temporary notepad (no eval) ──
export function safeEvaluate(expr: string): number | null {
  expr = expr.replace(/\s/g, '');
  if (!expr || !/^[\d+\-*/().]+$/.test(expr)) return null;
  let pos = 0;
  const parseExpr = (): number => {
    let r = parseTerm();
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos++];
      const t = parseTerm();
      r = op === '+' ? r + t : r - t;
    }
    return r;
  };
  const parseTerm = (): number => {
    let r = parseFactor();
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
      const op = expr[pos++];
      const f = parseFactor();
      if (op === '/') {
        if (f === 0) throw new Error('div0');
        r /= f;
      } else r *= f;
    }
    return r;
  };
  const parseFactor = (): number => {
    if (expr[pos] === '(') {
      pos++;
      const r = parseExpr();
      if (expr[pos] === ')') pos++;
      return r;
    }
    let neg = false;
    if (expr[pos] === '-') {
      neg = true;
      pos++;
    } else if (expr[pos] === '+') pos++;
    let s = '';
    while (pos < expr.length && ((expr[pos] >= '0' && expr[pos] <= '9') || expr[pos] === '.')) s += expr[pos++];
    if (!s) throw new Error('num');
    const n = parseFloat(s);
    return neg ? -n : n;
  };
  try {
    const r = parseExpr();
    if (pos < expr.length) return null;
    return isFinite(r) ? r : null;
  } catch {
    return null;
  }
}

/**
 * If the caret line ends with "<math>=", append the result.
 * Returns the new text + caret, or null when nothing to do.
 */
export function applyLineMath(text: string, caret: number): { text: string; caret: number } | null {
  const before = text.slice(0, caret);
  const lineIdx = before.split('\n').length - 1;
  const lines = text.split('\n');
  const line = lines[lineIdx] || '';
  const m = line.match(/^(.*?)([\d+\-*/().\s]+)=\s*$/);
  if (!m) return null;
  const res = safeEvaluate(m[2].trim());
  if (res === null) return null;
  const formatted = Number.isInteger(res) ? String(res) : res.toFixed(6).replace(/\.?0+$/, '');
  const lineStart = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0);
  const eqPos = lineStart + line.lastIndexOf('=') + 1;
  const after = text.slice(eqPos).replace(/^\s*[\d.-]*/, '');
  return { text: text.slice(0, eqPos) + ' ' + formatted + after, caret: eqPos + 1 + formatted.length };
}

// ── {{copy}} markers in notes ──
export type NotePart = { type: 'text'; text: string } | { type: 'copy'; copy: string; children: NotePart[] };

const plain = (s: string) => {
  let r = s;
  let prev;
  do {
    prev = r;
    r = r.replace(/\{\{([\s\S]*?)\}\}/g, (_, i) => i);
  } while (r !== prev);
  return r;
};

/** Parses nested {{ }} markers exactly like the original renderNoteContentHtml. */
export function parseCopyMarkers(str: string): NotePart[] {
  const out: NotePart[] = [];
  let i = 0;
  while (i < str.length) {
    const open = str.indexOf('{{', i);
    if (open === -1) {
      out.push({ type: 'text', text: str.slice(i) });
      break;
    }
    if (open > i) out.push({ type: 'text', text: str.slice(i, open) });
    let depth = 1;
    let j = open + 2;
    while (j < str.length && depth > 0) {
      if (str[j] === '{' && str[j + 1] === '{') {
        depth++;
        j += 2;
      } else if (str[j] === '}' && str[j + 1] === '}') {
        depth--;
        j += 2;
      } else j++;
    }
    const inner = str.slice(open + 2, depth === 0 ? j - 2 : j);
    out.push({ type: 'copy', copy: plain(inner), children: parseCopyMarkers(inner) });
    i = j;
  }
  return out;
}
export const stripMarkers = plain;

// ── Email filter ──
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
export function emailTokens(text: string) {
  const src = String(text || '');
  let toks: string[] | null = src.match(EMAIL_RE);
  if (!toks || !toks.length) toks = src.split(/[\n,;\t]+/);
  const map = new Map<string, string>();
  let dup = 0;
  for (const t of toks) {
    const v = String(t)
      .trim()
      .replace(/^[<("'[\s]+|[>)"'\]\s.,;:]+$/g, '');
    if (!v) continue;
    const k = v.toLowerCase();
    if (map.has(k)) dup++;
    else map.set(k, v);
  }
  return { map, dup };
}
