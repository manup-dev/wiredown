// The one text escaper. Exactly the five XML entities (EPUB is XHTML: no &nbsp; or other HTML names).
// Drops C0 controls except tab and newline, U+2028/U+2029, U+FFFE/U+FFFF and lone surrogates.

const ENT = { 38: '&amp;', 60: '&lt;', 62: '&gt;', 34: '&quot;', 39: '&#39;' };

export function escapeXml(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20) { if (c === 9 || c === 10) out += s[i]; continue; }
    if (c === 0x2028 || c === 0x2029 || c === 0xfffe || c === 0xffff) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) { out += s[i] + s[i + 1]; i++; }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    const e = ENT[c];
    out += e || s[i];
  }
  return out;
}

/** A coordinate: finite, rounded to 0.5, never "-0". */
export function px(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(Math.max(-1e6, Math.min(1e6, n)) * 2) / 2;
  return r === 0 ? '0' : String(r);
}

/** Path data precision: one decimal. */
export function dec1(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(Math.max(-1e6, Math.min(1e6, n)) * 10) / 10;
  return r === 0 ? '0' : String(r);
}
