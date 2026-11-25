// Device presets and the WxH form. One table, used by the parser and the layout.
import { WM_LIMITS } from './limits.js';

export const DEVICES = Object.freeze({
  phone: Object.freeze({ name: 'phone', w: 390, h: 844 }),
  tablet: Object.freeze({ name: 'tablet', w: 820, h: 1180 }),
  laptop: Object.freeze({ name: 'laptop', w: 1280, h: 800 }),
  desktop: Object.freeze({ name: 'desktop', w: 1440, h: 900 }),
});

function digits(s) {
  if (!s || s.length > 5) return NaN;
  for (let i = 0; i < s.length; i++) if (s[i] < '0' || s[i] > '9') return NaN;
  return Number(s);
}

/** A preset name or WxH (sides 100..deviceMax) to a fresh { name, w, h }, else null. */
export function resolveDevice(value) {
  const v = typeof value === 'string' ? value : '';
  if (Object.prototype.hasOwnProperty.call(DEVICES, v)) {
    const d = DEVICES[v];
    return { name: d.name, w: d.w, h: d.h };
  }
  const [a, b, c] = v.split('x');
  const w = digits(a);
  const h = digits(b);
  if (c !== undefined || !(w >= 100 && w <= WM_LIMITS.deviceMax && h >= 100 && h <= WM_LIMITS.deviceMax)) return null;
  return { name: `${w}x${h}`, w, h };
}
