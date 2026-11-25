// flowPath: the order an animated flow plays its screens in. Deterministic, at most 24 steps.
// With @flow: exactly the screens @flow names, in its order, repeats kept (the author's path; no
// other screen or variant is shown); a step's `via` is the previous screen's first link to it,
// `back` included. Otherwise from the prototype start screen: at each screen, the first linked
// element (document order, outermost link only, never `back`) whose target is unvisited leads to
// the next step (its id is that step's `via`); else the screen's next unvisited variant; else
// the next unvisited screen in storyboard order.
import { parseMock } from '../parse.js';
import { storyboard } from '../flow.js';
import { captions } from '../html.js';
import { backTarget } from '../paint.js';

export const MAX_STEPS = 24;
const SCREEN_ID = /^[a-z][a-z0-9-]{0,63}$/;

// The first outermost linked node (document order) whose target passes `want(target, isBack)`.
// As the painter reads links: a node naming a screen that exists, or `back` resolved to `back`
// (the painter's backTarget); links inside a link are not tappable, so never taken.
function firstLink(node, ids, back, want, depth = 0) {
  if (!node || depth > 64) return null;
  const isBack = node.link === 'back';
  const t = isBack ? back : node.link;
  if (typeof t === 'string' && SCREEN_ID.test(t) && ids.has(t)) return want(t, isBack) ? node : null;
  if (isBack) return null;
  for (const c of Array.isArray(node.children) ? node.children : []) {
    const hit = firstLink(c, ids, back, want, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Steps over a parsed mock: [{ index, screenId, label, via }]. */
export function pathOf(mock) {
  const screens = mock.screens;
  const byId = new Map();
  screens.forEach((s, i) => { if (s && typeof s.id === 'string' && !byId.has(s.id)) byId.set(s.id, i); });
  const { groups, start } = storyboard(mock);
  const { cap } = captions(mock);
  const steps = [];
  const add = (i, via) => steps.push({ index: i, screenId: screens[i].id, label: cap(screens[i]), via });
  if (Array.isArray(mock.flow) && mock.flow.some((id) => byId.has(id))) {
    for (const id of mock.flow) {
      if (steps.length >= MAX_STEPS) break;
      const i = byId.get(id);
      if (i === undefined) continue;
      const p = steps.length ? steps[steps.length - 1].index : -1;
      const link = p >= 0 ? firstLink(screens[p].root, byId, backTarget(mock, p), (t) => t === id) : null;
      add(i, link ? link.id : null);
    }
    return steps;
  }
  if (start < 0) return steps;
  const order = groups.flat();
  const groupOf = new Map();
  for (const g of groups) for (const i of g) groupOf.set(i, g);
  const seen = new Set();
  let cur = start;
  let via = null;
  while (cur >= 0 && steps.length < MAX_STEPS) {
    seen.add(cur);
    add(cur, via);
    const link = firstLink(screens[cur].root, byId, backTarget(mock, cur), (t, isBack) => !isBack && !seen.has(byId.get(t)));
    if (link) { cur = byId.get(link.link); via = link.id; continue; }
    via = null;
    const variant = (groupOf.get(cur) || []).find((i) => !seen.has(i));
    cur = variant !== undefined ? variant : order.find((i) => !seen.has(i)) ?? -1;
  }
  return steps;
}

/** body + info string → { ok, steps: [{ screenId, label, via }] }. Never throws. */
export function flowPath(body, info) {
  try {
    const r = parseMock(body, typeof info === 'string' ? info : '');
    if (!r.ok || !r.mock.screens.length) return { ok: false, steps: [] };
    return { ok: true, steps: pathOf(r.mock).map(({ screenId, label, via }) => ({ screenId, label, via })) };
  } catch {
    return { ok: false, steps: [] };
  }
}
