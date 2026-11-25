// Line lexer: one forward character walk per line, no regex over author text.
import { WM_LIMITS, wmError } from './limits.js';

const isSpace = (c) => c === ' ' || c === '\t';
const isKeyStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isKeyChar = (c) => isKeyStart(c) || (c >= '0' && c <= '9') || c === '_' || c === '-';

// Reads a label starting at the opening quote. Returns { v, end } or null if unterminated.
function readLabel(s, i) {
  let v = '';
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\' && (s[j + 1] === '"' || s[j + 1] === '\\')) {
      v += s[j + 1];
      j += 2;
    } else if (c === '"') {
      return { v, end: j + 1 };
    } else {
      v += c;
      j++;
    }
  }
  return null;
}

function readBare(s, i) {
  let j = i;
  while (j < s.length && !isSpace(s[j])) j++;
  return j;
}

export function lexLine(text, lineNo) {
  let i = 0;
  while (i < text.length && isSpace(text[i])) {
    if (text[i] === '\t') return { error: wmError(lineNo, i + 1, 'bad_indent', 'Indent with spaces, not tabs.') };
    i++;
  }
  const indent = i;
  const tokens = [];
  let comment = null;
  const push = (tok) => {
    tokens.push(tok);
    return tokens.length > WM_LIMITS.tokensPerLine
      ? { error: wmError(lineNo, tok.col, 'limit_tokens', `A line may have at most ${WM_LIMITS.tokensPerLine} tokens.`) }
      : null;
  };
  while (i < text.length) {
    const c = text[i];
    if (isSpace(c)) { i++; continue; }
    const col = i + 1;
    if (c === '/' && text[i + 1] === '/') {
      comment = text.slice(i + 2).trim();
      break;
    }
    let err = null;
    if (c === '"') {
      const r = readLabel(text, i);
      if (!r) return { error: wmError(lineNo, col, 'bad_label', 'This label is missing its closing quote.') };
      err = push({ t: 'label', v: r.v, col });
      i = r.end;
    } else if (c === '-' && text[i + 1] === '>') {
      let j = i + 2;
      while (j < text.length && isSpace(text[j])) j++;
      const end = readBare(text, j);
      err = push({ t: 'link', v: text.slice(j, end), col });
      i = end;
    } else if (c === '#' && i + 1 < text.length && !isSpace(text[i + 1])) {
      const end = readBare(text, i + 1);
      err = push({ t: 'id', v: text.slice(i + 1, end), col });
      i = end;
    } else if (c === '@' && i + 1 < text.length && !isSpace(text[i + 1])) {
      const end = readBare(text, i + 1);
      err = push({ t: 'at', v: text.slice(i + 1, end), col });
      i = end;
    } else {
      let j = i;
      if (isKeyStart(c)) {
        while (j < text.length && isKeyChar(text[j])) j++;
      }
      if (j > i && text[j] === '=') {
        const k = text.slice(i, j);
        if (text[j + 1] === '"') {
          const r = readLabel(text, j + 1);
          if (!r) return { error: wmError(lineNo, j + 2, 'bad_label', 'This value is missing its closing quote.') };
          err = push({ t: 'kv', k, v: r.v, quoted: true, col });
          i = r.end;
        } else {
          const end = readBare(text, j + 1);
          err = push({ t: 'kv', k, v: text.slice(j + 1, end), quoted: false, col });
          i = end;
        }
      } else {
        const end = readBare(text, i);
        err = push({ t: 'word', v: text.slice(i, end), col });
        i = end;
      }
    }
    if (err) return err;
  }
  return { indent, tokens, comment };
}

export function splitLines(body) {
  if (body.length > WM_LIMITS.body) {
    return { error: wmError(1, 1, 'limit_body', `A block may have at most ${WM_LIMITS.body} characters.`) };
  }
  const raw = body.split('\n');
  if (raw.length > WM_LIMITS.lines) {
    return { error: wmError(WM_LIMITS.lines + 1, 1, 'limit_lines', `A block may have at most ${WM_LIMITS.lines} lines.`) };
  }
  const out = [];
  for (let n = 0; n < raw.length; n++) {
    let text = raw[n];
    if (text.endsWith('\r')) text = text.slice(0, -1);
    if (text.length > WM_LIMITS.lineLength) {
      return { error: wmError(n + 1, WM_LIMITS.lineLength + 1, 'limit_line_length', `A line may have at most ${WM_LIMITS.lineLength} characters.`) };
    }
    out.push({ lineNo: n + 1, text });
  }
  return out;
}
