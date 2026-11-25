import { parseMock, lintMock } from '../src/index.js';

export function extractFence(answer) {
  const t = String(answer ?? '');
  const m = /```(?:wiremark|screens)[^\n]*\n([\s\S]*?)```/.exec(t);
  if (m) return m[1];
  return parseMock(t).ok && !lintMock(t).some((p) => p.severity === 'error') ? t : null;
}

function walk(n, f) { f(n); n.children.forEach((c) => walk(c, f)); }

export function scoreAnswer(prompt, body) {
  const none = { parsed: false, errors: 1, warnings: 0, screens: 0, missingKinds: [], missingLinks: [], checks: { minScreens: false, kinds: false, links: false }, pass: false };
  if (body == null) return none;
  const lint = lintMock(body);
  const errors = lint.filter((p) => p.severity === 'error').length;
  const warnings = lint.length - errors;
  const r = parseMock(body);
  const screens = r.ok ? r.mock.screens.filter((s) => !s.variantOf) : [];
  const kinds = new Set();
  const pairs = [];
  if (r.ok) {
    const byId = new Map(r.mock.screens.map((x) => [x.id, x]));
    // Only base screens count: a kind that appears only in a variant, or a link written in a variant, is not credit.
    for (const s of r.mock.screens.filter((x) => !x.variantOf)) walk(s.root, (n) => {
      kinds.add(n.kind);
      // n.link is a screen id, 'back' or null; a non-screen target matches nothing. A link to the same screen is not navigation.
      const t = n.link ? byId.get(n.link) : null;
      if (t && t.id !== s.id) pairs.push([String(s.label).toLowerCase(), String(t.label).toLowerCase()]);
    });
  }
  const missingKinds = prompt.kinds.filter((k) => !kinds.has(k));
  const missingLinks = prompt.links.filter(([a, b]) => !pairs.some(([x, y]) => x.includes(a) && y.includes(b)));
  const checks = { minScreens: screens.length >= prompt.minScreens, kinds: missingKinds.length === 0, links: missingLinks.length === 0 };
  return { parsed: r.ok, errors, warnings, screens: screens.length, missingKinds, missingLinks, checks, pass: r.ok && errors === 0 && Object.values(checks).every(Boolean) };
}
