// Hard limits shared by the parser, linter and renderer.
export const WM_LIMITS = Object.freeze({
  body: 65536,
  lines: 1500,
  lineLength: 500,
  tokensPerLine: 40,
  screens: 24,
  variants: 48,
  nodes: 2000,
  depth: 16,
  label: 200,
  defines: 50,
  notes: 99,
  deviceMax: 4000,
  output: 524288,
});

// 1-based line and column.
export function wmError(line, column, code, message) {
  return { line, column, code, message };
}
