// Vendored stroke icons on a 24-unit grid, stored as path data only (circles and rects converted).
// Drawn with stroke-width 2, round caps and joins, no fill, like Lucide. `google` is wiredown's own
// stroke "G" (Lucide ships no brand mark for it); every other icon is from Lucide.
//
// Lucide licence (https://lucide.dev):
//
// ISC License
//
// Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
// All other copyright (c) for Lucide are held by Lucide Contributors 2022.
//
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without
// fee is hereby granted, provided that the above copyright notice and this permission notice appear
// in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
// SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
// AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
// NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
// OF THIS SOFTWARE.
import { dec1 } from './escape.js';
import data1 from './icons-data-1.js';

const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x, y, w, h, rx) =>
  `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${rx} 0 0 1 ${rx} ${rx}v${h - 2 * rx}a${rx} ${rx} 0 0 1 ${-rx} ${rx}` +
  `h${-(w - 2 * rx)}a${rx} ${rx} 0 0 1 ${-rx} ${-rx}v${-(h - 2 * rx)}a${rx} ${rx} 0 0 1 ${rx} ${-rx}z`;
const TRAY = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4';

// Hand-kept icons win over generated ones of the same name (goldens).
const OWN = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' + circ(9, 7, 4) + 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73' +
    'l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38' +
    'a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18' +
    'a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08' +
    'a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08' +
    'a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' + circ(12, 12, 3),
  search: circ(11, 11, 8) + 'M21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  plus: 'M5 12h14M12 5v14',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  mail: rect(2, 4, 20, 16, 2) + 'M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
  lock: rect(3, 11, 18, 11, 2) + 'M7 11V7a5 5 0 0 1 10 0v4',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' + circ(12, 7, 4),
  card: rect(2, 5, 20, 14, 2) + 'M2 10h20',
  download: TRAY + 'M7 10l5 5 5-5M12 15V3',
  upload: TRAY + 'M17 8l-5-5-5 5M12 3v12',
  trash: 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6',
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5zM15 5l4 4',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2' +
    'A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  calendar: rect(3, 4, 18, 18, 2) + 'M16 2v4M8 2v4M3 10h18',
  clock: circ(12, 12, 10) + 'M12 6v6l4 2',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  more: circ(5, 12, 1) + circ(12, 12, 1) + circ(19, 12, 1),
  google: 'M18 6a8.5 8.5 0 1 0 2.5 6H12',
  apple: 'M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2' +
    '-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06zM10 2c1 .5 2 2 2 5',
  github: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5' +
    '-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5' +
    '-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2',
  image: rect(3, 3, 18, 18, 2) + circ(9, 9, 2) + 'M21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4',
};

export const ICONS = Object.freeze({ ...data1, ...OWN });

// The icon names in sorted order (code-unit order), for a host's icon picker.
export const ICON_NAMES = Object.freeze(Object.keys(ICONS).sort());

export const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

// Aliases never shadow an icon or point at a missing one.
const WANTED = {
  home: 'house', gear: 'settings', delete: 'trash-2', trash: 'trash-2', close: 'x', profile: 'user',
  cart: 'shopping-cart', cog: 'settings', notifications: 'bell', chat: 'message-circle', help: 'circle-help',
  warning: 'circle-alert', error: 'x-circle', success: 'check-circle', logout: 'log-out', login: 'log-in',
};
export const ICON_ALIASES = Object.freeze(Object.fromEntries(
  Object.entries(WANTED).filter(([a, t]) => !has(ICONS, a) && has(ICONS, t)),
));

export const hasIcon = (name) => has(ICONS, name) || has(ICON_ALIASES, name);

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** The closest name in `names` (edit distance <= 2, else a prefix match of 3+ letters), or null. */
export function nearestIcon(name, names = ICON_NAMES) {
  const n = String(name).toLowerCase().slice(0, 64);
  let best = null;
  let bestScore = Infinity;
  for (const c of names) {
    let score = Infinity;
    const d = distance(n, c);
    if (d <= 2) score = d;
    else if (Math.min(n.length, c.length) >= 3 && (n.startsWith(c) || c.startsWith(n))) score = 3 + Math.abs(n.length - c.length);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best;
}

const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

// Command letters and numbers (a second '.' starts a number; 2e3 is one number).
function tokens(d) {
  const out = [];
  let i = 0;
  while (i < d.length) {
    const ch = d[i];
    if (/[a-zA-Z]/.test(ch)) { out.push(ch); i++; continue; }
    if (ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) {
      let j = i + (ch === '-' ? 1 : 0);
      let dot = false;
      while (j < d.length && ((d[j] >= '0' && d[j] <= '9') || (d[j] === '.' && !dot))) { if (d[j] === '.') dot = true; j++; }
      if ((d[j] === 'e' || d[j] === 'E') && j > i) {
        let k = j + 1;
        if (d[k] === '-' || d[k] === '+') k++;
        if (d[k] >= '0' && d[k] <= '9') { while (d[k] >= '0' && d[k] <= '9') k++; j = k; }
      }
      const v = Number(d.slice(i, j));
      out.push(Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, v)) : 0);
      i = j;
      continue;
    }
    i++;
  }
  return out;
}

// Role of parameter k of a command: x, y, len (scale only) or keep (angle, flag).
function role(cmd, k) {
  const c = cmd.toLowerCase();
  if (c === 'h') return 'x';
  if (c === 'v') return 'y';
  if (c === 'a') return k < 2 ? 'len' : k < 5 ? 'keep' : k === 5 ? 'x' : 'y';
  return k % 2 === 0 ? 'x' : 'y';
}

/** Icon path data placed at (x, y) and scaled to `size`, one decimal; null for an unknown name. */
export function iconPath(name, x, y, size) {
  if (!hasIcon(name)) return null;
  return pathFromD(has(ICONS, name) ? ICONS[name] : ICONS[ICON_ALIASES[name]], x, y, size);
}

const MAX_D = 20000;
const MAX_PARTS = 4000;

/** Path data on the 24 grid placed at (x, y), scaled to `size`. Total: known commands and finite numbers only. */
export function pathFromD(d, x, y, size) {
  if (typeof d !== 'string') return '';
  x = Number.isFinite(Number(x)) ? Number(x) : 0;
  y = Number.isFinite(Number(y)) ? Number(y) : 0;
  const s = (Number.isFinite(Number(size)) ? Number(size) : 24) / 24;
  const tk = tokens(d.length > MAX_D ? d.slice(0, MAX_D) : d);
  const parts = [];
  let i = 0;
  while (i < tk.length) {
    let cmd = tk[i++];
    if (typeof cmd !== 'string') continue;
    const lead = cmd === 'm' && !parts.length; // absolute, its pairs relative
    if (lead) cmd = 'M';
    const n = ARITY[cmd.toLowerCase()];
    if (n === undefined) continue;
    if (parts.length >= MAX_PARTS) break;
    if (n === 0) { parts.push('z'); continue; }
    while (i < tk.length && typeof tk[i] === 'number' && parts.length < MAX_PARTS) {
      const rel = cmd === cmd.toLowerCase();
      const vals = [];
      for (let k = 0; k < n; k++) {
        const v = Number(tk[i++]) || 0;
        const r = role(cmd, k);
        if (r === 'keep') vals.push(String(Math.round(v)));
        else if (r === 'len' || rel) vals.push(dec1(v * s));
        else vals.push(dec1(r === 'x' ? x + v * s : y + v * s));
      }
      // every group names its command; pairs after a moveto are linetos
      parts.push(cmd + vals.join(' '));
      if (cmd === 'm' || lead) cmd = 'l';
      else if (cmd === 'M') cmd = 'L';
    }
  }
  return parts.join('');
}
