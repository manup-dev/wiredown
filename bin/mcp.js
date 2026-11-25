// `wiredown mcp`: a Model Context Protocol server over stdio. JSON-RPC 2.0, one message per line,
// no dependencies. stdout carries protocol messages only; anything else goes to stderr.
import { readFileSync } from 'node:fs';
import { TOOLS, callTool } from './mcp-tools.js';
import { checkRoot } from './safe-write.js';

export const PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
const NEWEST = PROTOCOL_VERSIONS[PROTOCOL_VERSIONS.length - 1];
const MAX_LINE = 1 << 20; // one message; a 64 KB block fits many times over, even fully escaped
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const INSTRUCTIONS = 'wiredown draws UI screens written as text. Call get_wiredown_grammar first, write the block, check it with lint_wiredown and fix every error, then share it with wiredown_link or draw it with render_wiredown.';

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const validId = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));

/**
 * The message handler: one parsed JSON value in, one response object out (or null for a
 * notification or a client response). opts: { root, icons, log }.
 */
export function createHandler({ root = process.cwd(), icons = [], log = (m) => process.stderr.write(m + '\n') } = {}) {
  let checked = null;
  const ctx = {
    icons,
    log,
    // The write root is checked on first use, so a server started in a bad folder still reads and lints.
    root: () => (checked ??= checkRoot(root)),
  };
  return function handle(msg) {
    if (Array.isArray(msg)) return fail(null, -32600, 'Batches are not supported. Send one message per line.');
    if (!msg || typeof msg !== 'object') return fail(null, -32600, 'A message is a JSON-RPC 2.0 object.');
    const hasId = 'id' in msg;
    if (typeof msg.method !== 'string') return hasId && validId(msg.id) && !('result' in msg || 'error' in msg) ? fail(msg.id, -32600, 'A request needs a method.') : null;
    if (!hasId) return null; // notifications (initialized, cancelled, …) need no answer
    if (!validId(msg.id)) return fail(null, -32600, 'A request id is a string or a number.');
    if (msg.jsonrpc !== '2.0') return fail(msg.id, -32600, 'Only JSON-RPC 2.0 is spoken here.');
    const p = msg.params && typeof msg.params === 'object' ? msg.params : {};
    switch (msg.method) {
      case 'initialize': {
        const asked = p.protocolVersion;
        return ok(msg.id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : NEWEST,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'wiredown', title: 'wiredown', version: VERSION },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return ok(msg.id, {});
      case 'tools/list': return ok(msg.id, { tools: TOOLS });
      case 'tools/call': {
        if (typeof p.name !== 'string') return fail(msg.id, -32602, 'tools/call needs a tool name.');
        const result = callTool(p.name, p.arguments, ctx);
        return result ? ok(msg.id, result) : fail(msg.id, -32602, `Unknown tool: ${p.name}`);
      }
      default: return fail(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  };
}

/** stdout is the protocol stream: console.log, info and debug (from an icon pack, say) go to stderr. */
export function protectStdout() {
  const toErr = (...a) => console.error(...a);
  console.log = toErr; console.info = toErr; console.debug = toErr;
  process.stdout.on('error', () => {}); // the client went away (EPIPE); nothing left to tell it
}

/** Serve on stdin/stdout until stdin closes. */
export function serve(opts = {}) {
  protectStdout();
  const handle = createHandler(opts);
  const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
  const line = (raw) => {
    const t = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!t.trim()) return;
    let msg;
    try { msg = JSON.parse(t); } catch { send(fail(null, -32700, 'Parse error: the line is not JSON.')); return; }
    let res;
    try { res = handle(msg); } catch (err) {
      process.stderr.write(`wiredown mcp: ${err?.stack ?? err}\n`);
      res = msg && validId(msg.id) ? fail(msg.id, -32603, 'Internal error.') : null;
    }
    if (res) send(res);
  };
  let buf = '';
  let skipping = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (skipping) { skipping = false; continue; }
      line(raw);
    }
    if (buf.length > MAX_LINE) {
      if (!skipping) send(fail(null, -32600, `A message is at most ${MAX_LINE} characters.`));
      skipping = true;
      buf = '';
    }
  });
  process.stdin.on('end', () => { if (buf && !skipping) line(buf); });
  process.stderr.write(`wiredown mcp ${VERSION} ready on stdio\n`);
}
