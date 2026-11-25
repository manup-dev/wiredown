// Deterministic text model: widths by character class, greedy wrapping. No fonts, no Intl.
const NARROW = new Set("ijl.,'!|".split(''));
const WIDE = new Set('mwMW@'.split(''));
const MARK = /^\p{M}$/u;

function isWide(cp) {
  return (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x20000 && cp <= 0x3fffd);
}

function charEm(ch) {
  if (ch === ' ') return 0.28;
  if (NARROW.has(ch)) return 0.28;
  if (WIDE.has(ch)) return 0.86;
  if (ch >= '0' && ch <= '9') return 0.56;
  if (MARK.test(ch)) return 0;
  const cp = ch.codePointAt(0);
  return isWide(cp) ? 1 : 0.55;
}

export function textWidth(text, size, weight = 'normal') {
  let em = 0;
  for (const ch of String(text)) em += charEm(ch);
  return em * size * (weight === 'bold' ? 1.06 : 1);
}

const wide = (ch) => isWide(ch.codePointAt(0));

// Code points with their following marks.
function graphemes(s) {
  const out = [];
  for (const ch of s) {
    if (out.length && MARK.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

// The pieces a line may break between: words, and CJK characters that stand alone; sp = a real
// space came before it.
function pieces(para) {
  const words = [];
  let word = '';
  let sp = false;
  const flush = () => { if (word) { words.push({ s: word, sp }); word = ''; sp = false; } };
  for (const g of graphemes(para)) {
    if (g === ' ') { flush(); sp = true; } else if (wide(g)) { flush(); words.push({ s: g, sp }); sp = false; } else word += g;
  }
  flush();
  return words;
}

// Widths are sums of floats: a word that fits exactly must never read as a hair too wide.
const FUZZ = 1e-6;

/** The widest piece wrapText will not break (its min-content width). */
export function longestWord(text, size, weight = 'normal') {
  let max = 0;
  for (const para of String(text).split('\n')) for (const { s } of pieces(para)) max = Math.max(max, textWidth(s, size, weight));
  return max;
}

/** Greedy wrap at spaces; unspaced runs and CJK break per grapheme. Always at least one line. */
export function wrapText(text, size, maxWidth, weight = 'normal') {
  const max = Math.max(maxWidth, 1) + FUZZ;
  const w = (s) => textWidth(s, size, weight);
  const lines = [];
  let cur = '';
  let curW = 0;
  const push = () => { lines.push(cur); cur = ''; curW = 0; };
  for (const para of String(text).split('\n')) {
    for (const { s: wd, sp: spaced } of pieces(para)) {
      const ww = w(wd);
      const gap = spaced && cur !== '' ? w(' ') : 0;
      if (cur !== '' && curW + gap + ww <= max) { cur += (gap ? ' ' : '') + wd; curW += gap + ww; continue; }
      if (cur !== '') push();
      if (ww <= max) { cur = wd; curW = ww; continue; }
      for (const g of graphemes(wd)) {
        const gw = w(g);
        if (cur !== '' && curW + gw > max) push();
        cur += g; curW += gw;
      }
    }
    push();
  }
  return lines;
}
