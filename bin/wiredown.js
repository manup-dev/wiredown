#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { lint, formatProblem, render, exportFiles, animate, link, contract, loadPacks, UsageError } from './cli-lib.js';

const HELP = `wiredown <command>

  lint <files...> [--json] [--icons <module>]    check .wiredown files and wiredown fences in .md files
  render <file> [--out dir] [--format svg|html] [--icons <module>]  draw each screen as SVG, or one HTML page
                                                 --icons loads an icon pack module (repeat for several)
  export <file> --to openui|html [--out dir]     starter code per screen
  animate <file> [--out flow.svg] [--block N] [--step 2.6] [--no-credit] [--icons <module>]
                                                 the flow as one animated SVG (plays as an image);
                                                 in a .md file, fence N (default the first)
  link <file> [--block N]                        print a playground link that draws the block
                                                 (the text travels in the link; no server sees it)
  mcp [--root <folder>] [--icons <module>]       run the MCP server on stdio for AI tools; it writes
                                                 files only inside --root (default: the current folder)
  contract                                       print the language reference for an AI model
  --help, --version`;

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return undefined; const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) throw new UsageError(`${name} needs a value`); argv.splice(i, 2); return v; };
const bool = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };

try {
  const version = bool('--version');
  const help = bool('--help');
  const json = bool('--json');
  const out = flag('--out');
  const format = flag('--format') ?? 'svg';
  if (format !== 'svg' && format !== 'html') throw new UsageError('--format must be svg or html');
  const to = flag('--to');
  const block = flag('--block');
  const step = flag('--step');
  const noCredit = bool('--no-credit');
  const root = flag('--root');
  const packs = [];
  while (argv.includes('--icons')) packs.push(flag('--icons'));
  if (version) { console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version); process.exit(0); }
  if (help || argv.length === 0) { console.log(HELP); process.exit(help ? 0 : 2); }
  const [cmd, ...files] = argv;
  if (root !== undefined && cmd !== 'mcp') throw new UsageError('--root is only for mcp');
  if (cmd === 'lint') {
    if (!files.length) throw new UsageError('lint needs at least one file');
    const problems = lint(files, { icons: await loadPacks(packs) });
    if (json) console.log(JSON.stringify(problems, null, 2));
    else if (problems.length) console.log(problems.map(formatProblem).join('\n'));
    process.exit(problems.some((p) => p.severity === 'error') ? 1 : 0);
  }
  if (cmd === 'render') {
    if (!files[0]) throw new UsageError('render needs a file');
    for (const f of render(files[0], { out, format, icons: await loadPacks(packs) })) console.log(f);
    process.exit(0);
  }
  if (cmd === 'export') {
    if (!files[0]) throw new UsageError('export needs a file');
    for (const f of exportFiles(files[0], { to, out })) console.log(f);
    process.exit(0);
  }
  if (cmd === 'animate') {
    if (!files[0]) throw new UsageError('animate needs a file');
    console.log(animate(files[0], { out, block, step, credit: !noCredit, icons: await loadPacks(packs) }));
    process.exit(0);
  }
  if (cmd === 'link') {
    if (!files[0]) throw new UsageError('link needs a file');
    console.log(link(files[0], { block }));
    process.exit(0);
  }
  if (cmd === 'mcp') {
    if (files.length) throw new UsageError('mcp takes no files');
    const { serve, protectStdout } = await import('./mcp.js');
    protectStdout(); // before any icon pack module runs
    if (root !== undefined) {
      const { checkRoot } = await import('./safe-write.js');
      try { checkRoot(root); } catch (e) { throw new UsageError(`--root: ${e.message}`); }
    }
    serve({ root: root ?? process.cwd(), icons: await loadPacks(packs) });
  } else if (cmd === 'contract') { process.stdout.write(contract() + '\n'); process.exit(0); }
  else throw new UsageError(`unknown command ${cmd}`);
} catch (err) {
  console.error(err instanceof UsageError ? `wiredown: ${err.message}\n\n${HELP}` : err.stack);
  process.exit(2);
}
