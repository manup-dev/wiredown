// The error card: plain text in a div, legible with no stylesheet. Up to 5 problems listed.
import { escapeXml as esc } from './escape.js';

const HEAD = '<div class="wm wm-error" role="note"><strong>Screens: </strong>';
export const SHOWN_ERRORS = 5;
export const MSG = Object.freeze({
  empty: 'This block has no screens yet.',
  failed: 'This block could not be drawn.',
  tooLarge: 'This mock is too large to draw (over 512 KB). Split it into smaller blocks.',
  tooMany: 'Too many screens blocks in one document (50 max).',
});

function item(e) {
  const n = Number(e.line);
  const msg = esc(typeof e.message === 'string' ? e.message : '');
  return Number.isInteger(n) && n >= 1 ? `line ${n}: ${msg}` : msg;
}

/** errors: WmError-like objects; a line below 1 prints the message alone. */
export function renderErrorCard(errors) {
  const list = Array.isArray(errors) ? errors.filter((e) => e && typeof e === 'object') : [];
  if (!list.length) return HEAD + MSG.failed + '</div>';
  if (list.length === 1) return HEAD + item(list[0]) + '</div>';
  const intro = list.length > SHOWN_ERRORS ? `${list.length} problems; the first ${SHOWN_ERRORS}:` : `${list.length} problems:`;
  return HEAD + intro + '<ol>' + list.slice(0, SHOWN_ERRORS).map((e) => `<li>${item(e)}</li>`).join('') + '</ol></div>';
}

/** A card with one plain message (no line number). */
export const messageCard = (message) => renderErrorCard([{ line: 0, message }]);
