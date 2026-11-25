// The wiredown MCP server's tools: definitions (what tools/list answers) and handlers. Every
// handler returns an MCP tool result; a refusal is { isError: true } with one plain sentence.
import { lintMock, parseMock, renderMockBlock, renderScreenSvg, isWiredownLang, fenceLang, AI_CONTRACT, WM_LIMITS } from '../src/index.js';
import { flowPath, renderFlowAnimation } from '../src/export/index.js';
import { isFlowError } from '../src/export/animate.js';
import { playgroundLink, wantsPrototype } from './link.js';
import { PathError, outFile, outFolder, writeAll } from './safe-write.js';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const SOURCE = { type: 'string', description: `The wiredown block: the text between the fence lines, at most ${WM_LIMITS.body} characters.` };
const INFO = { type: 'string', description: 'The fence info string, such as "wiredown" or "wiredown look=clean view=prototype". Default "wiredown".' };
const schema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

export const TOOLS = [
  {
    name: 'get_wiredown_grammar',
    title: 'Get the wiredown language',
    description: 'The whole wiredown language as one text: headers, element kinds, attributes, links between screens, variants and an example. Read it before writing a wiredown block.',
    inputSchema: schema({}),
    annotations: READ,
  },
  {
    name: 'lint_wiredown',
    title: 'Check a wiredown block',
    description: 'Checks a wiredown block and lists its problems, one per line as "line:column severity code message". Lines count from the first line of the block. Fix every error before showing the block to someone.',
    inputSchema: schema({ source: SOURCE, info: INFO }, ['source']),
    outputSchema: schema({
      ok: { type: 'boolean', description: 'True when there is no error.' },
      problems: { type: 'array', items: schema({ line: { type: 'integer' }, column: { type: 'integer' }, severity: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } }) },
    }, ['ok', 'problems']),
    annotations: READ,
  },
  {
    name: 'wiredown_link',
    title: 'Link to the wiredown playground',
    description: 'A link that opens the block in the wiredown playground, where the screens are drawn and can be edited. The text travels in the link itself; the playground sends it to no server.',
    inputSchema: schema({ source: SOURCE, info: INFO }, ['source']),
    outputSchema: schema({ url: { type: 'string' } }, ['url']),
    annotations: READ,
  },
  {
    name: 'render_wiredown',
    title: 'Draw a wiredown block as SVG',
    description: 'Draws the block. Without outDir it returns the drawing as HTML text (a figure holding one SVG per screen). With outDir it writes one <screen-id>.svg file per screen into that folder, which must be inside the folder this server runs in. It never replaces a file it did not make: if any target exists and is not a wiredown file, nothing is written.',
    inputSchema: schema({ source: SOURCE, info: INFO, outDir: { type: 'string', description: 'A folder inside the server\'s folder, such as "screens". Made when missing.' } }, ['source']),
    annotations: WRITE,
  },
  {
    name: 'animate_wiredown',
    title: 'Write the flow as an animated SVG',
    description: 'Writes the block\'s flow (the screens @flow names, in order; without @flow, the path its links take from the first screen) as one animated SVG file that plays in a browser or as an image in a README. out must name an .svg file inside the folder this server runs in. It never replaces a file it did not make.',
    inputSchema: schema({ source: SOURCE, info: INFO, out: { type: 'string', description: 'An .svg file inside the server\'s folder, such as "flow.svg".' } }, ['source', 'out']),
    annotations: WRITE,
  },
];

const text = (t) => ({ type: 'text', text: t });
const refuse = (message) => ({ content: [text(message)], isError: true });

class ArgError extends Error {}

/** The tool's arguments, checked against its schema (types, required keys, no others, limits). */
function args(tool, raw) {
  const a = raw ?? {};
  if (typeof a !== 'object' || Array.isArray(a)) throw new ArgError('The arguments must be an object.');
  const props = tool.inputSchema.properties;
  for (const k of Object.keys(a)) if (!Object.hasOwn(props, k)) throw new ArgError(`${tool.name} has no argument named ${k}.`);
  for (const k of tool.inputSchema.required) if (a[k] === undefined) throw new ArgError(`${tool.name} needs ${k}.`);
  for (const [k, v] of Object.entries(a)) if (typeof v !== 'string') throw new ArgError(`${k} must be text.`);
  if (a.source !== undefined && a.source.length > WM_LIMITS.body) throw new ArgError(`The source is ${a.source.length} characters; one block holds at most ${WM_LIMITS.body}.`);
  if (a.info !== undefined && (a.info.length > 200 || !isWiredownLang(fenceLang(a.info)))) throw new ArgError('info must start with wiredown (or wiremark or screens), such as "wiredown look=clean".');
  return { ...a, info: a.info ?? 'wiredown' };
}

const lineOf = (p) => `${p.line}:${p.column || 1} ${p.severity} ${p.code} ${p.message}`;
const NOT_PARSED = 'The block does not parse, so nothing was drawn. Call lint_wiredown to see the problems.';

const HANDLERS = {
  get_wiredown_grammar: () => ({ content: [text(AI_CONTRACT)] }),

  lint_wiredown: (a, ctx) => {
    const problems = lintMock(a.source, a.info, { icons: ctx.icons }).map((p) => ({ line: p.line, column: p.column || 1, severity: p.severity, code: p.code, message: p.message }));
    const structured = { ok: !problems.some((p) => p.severity === 'error'), problems };
    const summary = problems.length ? problems.map(lineOf).join('\n') : 'No problems.';
    return { content: [text(summary), text(JSON.stringify(structured))], structuredContent: structured };
  },

  wiredown_link: (a) => {
    const url = playgroundLink(a.source, a.info);
    if (!url) return refuse('The block is too large for a link.');
    const note = wantsPrototype(a.info) ? '\nThe link opens the stacked view; pick Prototype in the playground to click through the screens.' : '';
    return { content: [text(`Open this link to see the screens drawn: ${url}${note}`)], structuredContent: { url } };
  },

  render_wiredown: (a, ctx) => {
    const r = parseMock(a.source, a.info);
    if (!r.ok) return refuse(NOT_PARSED);
    if (a.outDir === undefined) return { content: [text(renderMockBlock(a.source, a.info, { icons: ctx.icons }))] };
    const bad = r.mock.screens.find((s) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(String(s.id)));
    if (bad) return refuse(`The screen id ${bad.id} cannot be a file name.`);
    const root = ctx.root();
    const segs = outFolder(root, a.outDir);
    const files = r.mock.screens.map((s, j) => ({ segs, name: `${s.id}.svg`, text: renderScreenSvg(r.mock, j, 0, ctx.icons), what: 'outDir' }));
    const written = writeAll(root, files);
    return { content: [text(`Wrote ${written.length} file${written.length === 1 ? '' : 's'}:\n${written.join('\n')}`)] };
  },

  animate_wiredown: (a, ctx) => {
    if (!flowPath(a.source, a.info).ok) return refuse(NOT_PARSED);
    const svg = renderFlowAnimation(a.source, a.info, { icons: ctx.icons });
    if (isFlowError(svg)) return refuse(svg.includes('too large') ? 'The flow is too large to animate (over 2 MB).' : 'The flow could not be drawn.');
    const root = ctx.root();
    const { segs, name } = outFile(root, a.out);
    const [file] = writeAll(root, [{ segs, name, text: svg, what: 'out' }]);
    return { content: [text(`Wrote ${file} (${Math.ceil(svg.length / 1024)} KB). Open it in a browser to watch the flow.`)] };
  },
};

/** Run one tools/call. Unknown tool names return null (the caller answers with a protocol error). */
export function callTool(name, rawArgs, ctx) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return null;
  try {
    return HANDLERS[name](args(tool, rawArgs), ctx);
  } catch (err) {
    if (err instanceof ArgError || err instanceof PathError) return refuse(err.message);
    ctx.log(`wiredown mcp: ${name} failed: ${err?.message ?? err}`);
    return refuse(`${name} failed. The details are in the server log.`);
  }
}
