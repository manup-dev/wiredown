// Where the MCP server may write: only inside its root folder (the folder it was started in, or
// --root). Writes only ever add files or replace files this server made. Every target of a call is
// checked before anything is written:
//   - a path is relative to the root, or absolute and inside it; no '..' segment, no NUL, at most
//     1024 characters; no part starting with ~ or holding % (both read as something they are not
//     here), no \ where it is not a separator;
//   - every existing folder on the way is resolved with realpath and must stay inside the root, so
//     a symlink that points out of the root is refused;
//   - only .svg files are written, never a dot-file;
//   - an existing target is replaced only when it is a regular file that starts with MARKER (the
//     comment this server writes at the top of every file). Anything else there (someone's
//     logo.svg, a link, a folder) is refused by name, and then nothing in the call is written;
//   - missing folders are made one at a time inside folders already checked, after every check;
//   - each file is written to a new temp file in its checked folder (opened with O_EXCL, 'wx', so
//     an existing file or link at that name is never followed) and then renamed over the target.
//   - the filesystem root, the home folder and any folder above it are refused as roots.
import { closeSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, statSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { MARKER, marked } from './marker.js';

/** The first line of every file this server writes; how it knows a file is its own (marker.js). */
export { MARKER };

/** A refusal whose message is a plain sentence the client can show. */
export class PathError extends Error {}

const inside = (root, p) => { const r = relative(root, p); return r === '' || (r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r)); };
const shown = (root, p) => relative(root, p) || 'the root folder';

/** The checked root folder (a real path), or a PathError. */
export function checkRoot(dir) {
  let real;
  try { real = realpathSync(dir); } catch { throw new PathError(`The folder ${dir} does not exist.`); }
  if (!statSync(real).isDirectory()) throw new PathError(`${dir} is not a folder.`);
  let home = null;
  try { home = realpathSync(homedir()); } catch { /* no home folder */ }
  if (resolve(real) === resolve(real, '/') || (home && inside(real, home))) throw new PathError('This server was started in the filesystem root, the home folder or a folder above it, so it does not write files. Start it from a project folder, or pass --root <folder>.');
  return real;
}

/** The parts of a user path below the root, checked; refuses '..' and paths outside the root. */
function segments(root, p, what) {
  if (typeof p !== 'string' || p === '') throw new PathError(`${what} must be a path.`);
  if (p.length > 1024 || p.includes('\0')) throw new PathError(`${what} is not a usable path.`);
  if (p.split(/[\\/]/).includes('..')) throw new PathError(`${what} may not contain "..".`);
  if (sep === '/' && p.includes('\\')) throw new PathError(`${what} may not contain \\; use / between folders.`);
  const abs = resolve(root, p);
  if (!inside(root, abs)) throw new PathError(`${what} must be inside ${root}.`);
  const segs = relative(root, abs).split(sep).filter((s) => s !== '' && s !== '.');
  if (segs.some((s) => s.startsWith('~'))) throw new PathError(`${what} may not have a part that starts with ~; paths are relative to ${root}.`);
  if (segs.some((s) => s.includes('%'))) throw new PathError(`${what} may not contain %.`);
  return segs;
}

/** A file name this server may write: name.svg, no dot first, at most 200 characters. */
function checkName(name, what) {
  if (name.startsWith('.')) throw new PathError(`${what} may not name a hidden file (a name that starts with a dot).`);
  if (!/^.+\.svg$/i.test(name)) throw new PathError(`${what} must name an .svg file, such as flow.svg.`);
  if (name.length > 200) throw new PathError(`${what} has a file name over 200 characters.`);
}

/** Folder parts (from outDir), checked; no folder is made yet. */
export const outFolder = (root, p) => segments(root, p, 'outDir');

/** A file path (out), checked: { segs, name }. Nothing is made yet. */
export function outFile(root, p) {
  const segs = segments(root, p, 'out');
  const name = segs.pop();
  checkName(name ?? '', 'out');
  return { segs, name };
}

/** The real folder `segs` names, or { at, missing } when part of it does not exist yet. */
function existing(root, segs, what) {
  let at = root;
  for (let i = 0; i < segs.length; i++) {
    const next = join(at, segs[i]);
    let st = null;
    try { st = lstatSync(next); } catch { /* missing */ }
    if (!st) return { at, missing: segs.slice(i) };
    let real;
    try { real = realpathSync(next); } catch { throw new PathError(`${what} goes through a broken link.`); }
    if (!inside(root, real)) throw new PathError(`${what} goes through a link that points outside ${root}.`);
    if (!statSync(real).isDirectory()) throw new PathError(`${shown(root, next)} is a file, not a folder.`);
    at = real;
  }
  return { at, missing: [] };
}

/** True when `file` is a regular file (not a link) that starts with MARKER. */
function ours(file) {
  const st = lstatSync(file);
  if (!st.isFile()) return false;
  const buf = Buffer.alloc(MARKER.length);
  const fd = openSync(file, 'r');
  try { readSync(fd, buf, 0, buf.length, 0); } finally { closeSync(fd); }
  return buf.toString('utf8') === MARKER;
}

let n = 0;
function writeOne(root, dir, name, text) {
  const target = join(dir, name);
  const tmp = join(dir, `.wd-${process.pid}-${n++}.tmp`);
  let fd;
  try { fd = openSync(tmp, 'wx', 0o644); } catch { throw new PathError(`Could not write in ${shown(root, dir)}.`); }
  try { writeSync(fd, marked(text)); } catch { closeSync(fd); rmSync(tmp, { force: true }); throw new PathError(`Could not write ${shown(root, target)}.`); }
  closeSync(fd);
  try { renameSync(tmp, target); } catch { rmSync(tmp, { force: true }); throw new PathError(`Could not write ${shown(root, target)}.`); }
  return relative(root, target);
}

/**
 * Write files: [{ segs, name, text, what }]. Every target is checked first; one refusal writes
 * nothing. Returns the written paths relative to the root.
 */
export function writeAll(root, files) {
  const plans = files.map((f) => {
    checkName(f.name, f.what);
    const { at, missing } = existing(root, f.segs, f.what);
    if (!missing.length) {
      const target = join(at, f.name);
      let st = null;
      try { st = lstatSync(target); } catch { /* new file */ }
      if (st && !ours(target)) throw new PathError(`${shown(root, target)} already exists and was not made by wiredown, so it was kept. Pick another ${f.what === 'out' ? 'out file' : 'outDir'}.`);
    }
    return { ...f, at, missing };
  });
  return plans.map((p) => {
    let dir = p.at;
    for (const s of p.missing) {
      const next = join(dir, s);
      try { mkdirSync(next); } catch (e) { if (e?.code !== 'EEXIST') throw new PathError(`Could not make the folder ${shown(root, next)}.`); }
      const real = realpathSync(next);
      if (!inside(root, real) || !statSync(real).isDirectory()) throw new PathError(`${shown(root, next)} is not a folder inside ${root}.`);
      dir = real;
    }
    return writeOne(root, dir, p.name, p.text);
  });
}
