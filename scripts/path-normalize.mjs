// explicitPath: rewrite SVG path data so every arc flag is its own number ("a9 9 0 0118 0" becomes
// "a9 9 0 0 1 18 0"), the form the library's icon reader and defineIconPack accept. Dev tool for
// building icon packs (never shipped, never imported by src/). Throws on anything it cannot read.
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

export function explicitPath(d) {
  const s = String(d);
  let i = 0;
  let out = '';
  let last = '';
  const skip = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const put = (tok) => { out += last && !tok.startsWith('-') ? ` ${tok}` : tok; last = tok; };
  const num = () => { skip(); NUM.lastIndex = i; const m = NUM.exec(s); if (!m) throw new Error(`bad path data near "${s.slice(i, i + 12)}"`); i = NUM.lastIndex; return m[0]; };
  skip();
  while (i < s.length) {
    const c = s[i++];
    const n = ARGS[c.toLowerCase()];
    if (n === undefined) throw new Error(`bad path command ${c}`);
    out += c;
    last = '';
    if (n === 0) { skip(); continue; }
    let first = true;
    for (;;) {
      skip();
      if (i >= s.length || /[a-zA-Z]/.test(s[i])) { if (first) throw new Error(`${c} has no values`); break; }
      first = false;
      for (let k = 0; k < n; k++) {
        if (c.toLowerCase() === 'a' && (k === 3 || k === 4)) {
          skip();
          if (s[i] !== '0' && s[i] !== '1') throw new Error('bad arc flag');
          put(s[i++]);
        } else put(num());
      }
    }
  }
  return out;
}
