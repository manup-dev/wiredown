// diagnostics.mjs: lint results as 0-based ranges, no vscode import (unit-tested in node).
import { lintMock } from 'wiredown';
import { findFences } from 'wiredown/fences';

export function diagnosticsFor(text, languageId) {
  const blocks = languageId === 'wiredown' ? [{ body: text, info: 'wiredown', bodyLine: 1, openLine: 1 }] : findFences(text);
  const out = [];
  for (const b of blocks) for (const p of lintMock(b.body, b.info)) {
    const line0 = p.line > 0 ? b.bodyLine + p.line - 2 : b.openLine - 1;
    const col0 = Math.max(0, (p.column || 1) - 1);
    out.push({ line0, col0, endCol0: col0 + 1, severity: p.severity, code: p.code, message: p.message });
  }
  return out;
}
