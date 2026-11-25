// canHold: the one placement rule mockPatch's move and add, and a host's drop targets, share.
// Mirrors the parser's placement checks (a tab only in tabs, an item only in a list or tabbar,
// a kind's own child list), plus: overlays (modal, sheet, toast) sit only on a screen, and a
// screen is never a child. An unknown child goes where any kind may.
import { KINDS, hasKind } from './kinds.js';

const OVERLAY = new Set(['modal', 'sheet', 'toast']);

export function canHold(parentKind, childKind) {
  if (typeof parentKind !== 'string' || typeof childKind !== 'string' || !hasKind(parentKind)) return false;
  const kids = KINDS[parentKind].children;
  if (kids === 'none' || childKind === 'screen') return false;
  if (OVERLAY.has(childKind)) return parentKind === 'screen';
  if (childKind === 'tab' && parentKind !== 'tabs') return false;
  if (childKind === 'item' && parentKind !== 'list' && parentKind !== 'tabbar') return false;
  if (Array.isArray(kids)) return kids.includes(childKind);
  return childKind === 'unknown' || hasKind(childKind);
}

// The sentence for a refusal.
export const holdMessage = (parentKind, childKind) => {
  const kids = hasKind(parentKind) ? KINDS[parentKind].children : 'none';
  if (kids === 'none') return `A ${parentKind} cannot hold other elements.`;
  if (OVERLAY.has(childKind)) return `A ${childKind} goes directly on a screen.`;
  if (Array.isArray(kids)) return `A ${parentKind} holds only ${kids.join(', ')}.`;
  if (childKind === 'tab') return 'A tab goes inside tabs.';
  if (childKind === 'item') return 'An item goes inside a list or a tabbar.';
  return `A ${parentKind} cannot hold a ${childKind}.`;
};
