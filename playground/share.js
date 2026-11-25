// Share links: the text deflate-raw compressed into the URL hash. No server sees it.
// WM_LIMITS.body counts UTF-16 units (as the core does). The stream is capped at body * 3 bytes (the UTF-8 maximum
// for that many units), then the decoded text length is checked against the real limit.
const MAX_PAYLOAD = 300000;
import { WM_LIMITS } from '../src/limits.js';

const b64url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };

async function pipe(bytes, stream, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export async function encodeShare(text) {
  return 'v1:' + b64url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

export async function decodeShare(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (!/^v1:[A-Za-z0-9_-]+$/.test(h)) return { ok: false, reason: h.startsWith('v1:') ? 'corrupt' : 'format' };
  if (h.length > MAX_PAYLOAD) return { ok: false, reason: 'too_large' };
  try {
    const out = await pipe(unb64url(h.slice(3)), new DecompressionStream('deflate-raw'), WM_LIMITS.body * 3);
    if (!out) return { ok: false, reason: 'too_large' };
    const text = new TextDecoder('utf-8', { fatal: true }).decode(out);
    if (text.length > WM_LIMITS.body) return { ok: false, reason: 'too_large' };
    return { ok: true, text };
  } catch { return { ok: false, reason: 'corrupt' }; }
}
