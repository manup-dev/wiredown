import test from 'node:test';
import assert from 'node:assert/strict';
import { svgToPath } from '../scripts/svg-to-path.mjs';

const wrap = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;

test('several elements join in order, each from its own absolute start', () => {
  assert.equal(svgToPath(wrap('<path d="M1 2h3" /><path d="m4 5 l1 1"/>')), 'M1 2h3M4 5l1 1');
  // a leading m is absolute, and the pairs after it stay relative linetos
  assert.equal(svgToPath(wrap('<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>')), 'M21.801 10A10 10 0 1 1 17 3.335M9 11l3 3L22 4');
  assert.equal(svgToPath(wrap('<path d="m14 12 4 4 4-4"/><path d="M18 16V7"/>')), 'M14 12l4 4 4-4M18 16V7');
  assert.equal(svgToPath(wrap('<path d="m.5.5-1 1"/>')), 'M.5 .5l-1 1');
  assert.equal(svgToPath(wrap('<path d="M1 2m3 4 5 6"/>')), 'M1 2m3 4 5 6', 'a later m inside one element is kept');
});
test('circle and ellipse become two arcs', () => {
  assert.equal(svgToPath(wrap('<circle cx="12" cy="12" r="3"/>')), 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0');
  assert.equal(svgToPath(wrap('<ellipse cx="10" cy="5" rx="4" ry="2"/>')), 'M6 5a4 2 0 1 0 8 0a4 2 0 1 0 -8 0');
});
test('rect, with and without rx/ry', () => {
  assert.equal(svgToPath(wrap('<rect x="2" y="3" width="4" height="5"/>')), 'M2 3h4v5h-4z');
  assert.equal(svgToPath(wrap('<rect x="3" y="3" width="18" height="18" rx="2"/>')),
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z');
  assert.match(svgToPath(wrap('<rect width="10" height="6" rx="1" ry="2"/>')), /^M1 0h8a1 2 0 0 1 1 2v2a1 2/);
});
test('line, polyline, polygon', () => {
  assert.equal(svgToPath(wrap('<line x1="1" y1="2" x2="3" y2="4"/>')), 'M1 2L3 4');
  assert.equal(svgToPath(wrap('<polyline points="1,2 3,4 5 6"/>')), 'M1 2L3 4L5 6');
  assert.equal(svgToPath(wrap('<polygon points="1 2 3 4 5 6"/>')), 'M1 2L3 4L5 6z');
});
test('comments and groups are skipped', () => {
  assert.equal(svgToPath('<!-- x --><svg><g><path d="M0 0h1"/></g></svg>'), 'M0 0h1');
});
test('refuses a transform and any other drawable element', () => {
  assert.throws(() => svgToPath(wrap('<path d="M0 0" transform="scale(2)"/>')), /transform/);
  assert.throws(() => svgToPath(wrap('<g transform="x"><path d="M0 0"/></g>')), /transform/);
  assert.throws(() => svgToPath(wrap('<text>a</text>')), /not supported/);
  assert.throws(() => svgToPath(wrap('<image href="x"/>')), /not supported/);
  assert.throws(() => svgToPath(wrap('')), /no drawable/);
});
