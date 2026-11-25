export interface WmError { line: number; column: number; code: string; message: string }
export const WM_LIMITS: Readonly<{
  body: number; lines: number; lineLength: number; tokensPerLine: number; screens: number; variants: number;
  nodes: number; depth: number; label: number; defines: number; notes: number; deviceMax: number; output: number;
}>;
export function wmError(line: number, column: number, code: string, message: string): WmError;

export type Token =
  | { t: 'label'; v: string; col: number }
  | { t: 'kv'; k: string; v: string; quoted: boolean; col: number }
  | { t: 'link' | 'id' | 'at' | 'word'; v: string; col: number };
export function lexLine(text: string, lineNo: number): { error: WmError } | { indent: number; tokens: Token[]; comment: string | null };
export function splitLines(body: string): { lineNo: number; text: string }[] | { error: WmError };

export interface WmNode {
  kind: string; id: string; explicitId: boolean; labels: string[]; attrs: Record<string, string>;
  flags: string[]; link: string | null; note: string | null; children: WmNode[];
  line: number; col: number; endCol: number;
  /** Typed word of an unknown kind (kind === 'unknown'). */
  typed?: string;
  /** Set on every node produced by a define use; its span is the use line's. */
  fromDefine?: string;
}
export interface WmScreen { id: string; label: string; root: WmNode; variantOf: string | null; line: number }
export interface Mock {
  version: 1;
  /** fit: `@device … fit`, a screen ends at its content (not with an overlay). */
  device: { name: string; w: number; h: number; fit?: true };
  look: 'wire' | 'clean';
  title: string | null;
  flow: string[] | null;
  screens: WmScreen[];
  view: 'stack' | 'prototype';
}
export type ParseResult = { ok: true; mock: Mock; warnings: WmError[] } | { ok: false; errors: WmError[] };
export function parseMock(body: string, info?: string): ParseResult;
export function deriveIds(screen: WmScreen): void;
export function slug(label: string): string;
export interface KindSpec {
  name: string; group: string; children: 'none' | 'any' | readonly string[];
  attrs: Readonly<Record<string, string>>; flags: readonly string[]; labels: 0 | 1 | 2;
}
export const KINDS: Readonly<Record<string, KindSpec>>;

export const DEVICES: Readonly<Record<'phone' | 'tablet' | 'laptop' | 'desktop', Readonly<{ name: string; w: number; h: number }>>>;
export function resolveDevice(value: string): { name: string; w: number; h: number } | null;
export function textWidth(text: string, size: number, weight?: 'normal' | 'bold'): number;
export function wrapText(text: string, size: number, maxWidth: number, weight?: 'normal' | 'bold'): string[];
export interface WmBox {
  node: WmNode; x: number; y: number; w: number; h: number;
  lines?: string[];
  /** input, textarea, select: y of the field box (the label sits above it). */
  fieldY?: number;
  children: WmBox[];
}
export interface WmLayout { root: WmBox; width: number; height: number; fold: number | null }
export function layoutScreen(screen: WmScreen, device: { w: number; h: number; fit?: boolean }): WmLayout;

/** Paint tokens name colours; only the serializer turns them into attributes for a look. */
export type FillToken = 'none' | 'clear' | 'wash' | 'faint' | 'soft' | 'mid' | 'solid' | 'ink' | 'strong' | 'muted' | 'hint'
  | 'accent' | 'accentSoft' | 'onAccent' | 'good' | 'bad' | 'warn' | 'info' | 'goodSoft' | 'badSoft' | 'warnSoft' | 'infoSoft';
export type StrokeToken = 'none' | 'hair' | 'line' | 'hint' | 'muted' | 'strong' | 'ink' | 'accent' | 'onAccent' | 'good' | 'bad' | 'warn' | 'info';
export type Op =
  | { op: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: FillToken; stroke?: StrokeToken; sw?: number; dash?: boolean }
  | { op: 'text'; x: number; y: number; text?: string; lines?: string[]; lh?: number; size: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; tone?: FillToken }
  | { op: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: StrokeToken; sw?: number; dash?: boolean; cap?: boolean }
  | { op: 'circle'; cx: number; cy: number; r: number; fill?: FillToken; stroke?: StrokeToken; sw?: number; dash?: boolean }
  | { op: 'path'; d: string; fill?: FillToken; stroke?: StrokeToken; sw?: number; dash?: boolean; cap?: boolean }
  | { op: 'cross'; x: number; y: number; w: number; h: number; stroke?: StrokeToken }
  | { op: 'icon'; name: string; x: number; y: number; size: number; tone?: StrokeToken }
  | { op: 'group'; el?: string; opacity?: '.3' | '.35' | '.45' | '.5' | '.6'; ops: Op[] }
  | { op: 'link'; target: string; ops: Op[] };
export function escapeXml(value: unknown): string;
export const ACCENT: string;
export const LOOKS: Readonly<Record<'wire' | 'clean', unknown>>;
export const ICONS: Readonly<Record<string, string>>;
export function hasIcon(name: unknown): boolean;
export function iconPath(name: string, x: number, y: number, size: number): string | null;
/** Note numbers 1, 2, … in source order across the block; a variant's copy keeps its source number. */
export function numberNotes(mock: Mock): Map<WmNode, number>;
export function paintScreen(layout: WmLayout, mock: Mock, screenIndex: number, blockIndex?: number): Op[];
export function serializeScreen(ops: Op[], opts: { width: number; height: number; title: string; blockIndex: number; screenId: string; look: 'wire' | 'clean' }): string;
/** layoutScreen + paintScreen + serializeScreen for mock.screens[screenIndex]. */
export function renderScreenSvg(mock: Mock, screenIndex: number, blockIndex?: number): string;

/** Storyboard order: groups of screen indexes (a base screen, then its variants), `start` = the prototype's first screen (-1 when none). */
export function storyboard(mock: Mock): { groups: number[][]; start: number };
/** The block index as the serializer reads it: an integer 0..9999, else 0. */
export function blockIndexOf(value: unknown): number;
/** One <figure class="wm …">: screens strip, notes legend, text outline; or an error card (empty, too large, not drawable). */
export function renderMockHtml(mock: Mock, opts?: { blockIndex?: number; digest?: string }): string;
/** Fence body + info string → figure HTML or an error card. Never throws. */
export function renderMockBlock(body: string, info?: string, opts?: { blockIndex?: number }): string;
/** `<div class="wm wm-error" role="note">`: one problem inline, several as a list of up to 5. A line below 1 prints the message alone. */
export function renderErrorCard(errors: ReadonlyArray<{ line?: number; message?: string }> | null | undefined): string;
/** Layout and prototype-view rules for hosts with a stylesheet, every selector under `.wm`. Never paint. */
/** The fixed card sentences (empty, failed, tooLarge, tooMany); `tooMany` is the 51st block's card. */
export const MSG: Readonly<{ empty: string; failed: string; tooLarge: string; tooMany: string }>;
/** An error card with one plain message (no line number), e.g. `messageCard(MSG.tooMany)`. */
export function messageCard(message: string): string;
export const WIREDOWN_CSS: string;
export const MAX_BLOCKS_PER_DOC: 50;
/** info.trim().split(/\s+/)[0], case-sensitive (markdown-it's reading). */
export function fenceLang(info: unknown): string;
export function isWiredownLang(lang: string): boolean;
/**
 * markdown-it plugin: fences whose language is `wiredown` or `screens` render through
 * `defer(env, html)` (for example a store the host fills before its sanitizer and swaps back after); blocks are numbered per render in `env.wmCount`,
 * and from the 51st on each is the cap card. Every other fence goes to the previous rule.
 * A host that joins separately rendered pages into one HTML document sets `env.wmBase`
 * (a non-negative integer, clamped to 9999; anything else is 0) per page: each block's index
 * is `min(wmBase + its number in this parse, 9999)`, so ids and links never repeat.
 * `env.wmMode === 'digest'` emits only `<figure class="wm" data-wm-digest="{mockDigest}"></figure>`
 * per block, for a host that computes from a render but never serves its HTML.
 */
export function wiredownPlugin(
  md: { renderer: { rules: { fence?: (tokens: any[], idx: number, options: any, env: any, self: any) => string } } },
  opts?: { defer?: (env: any, html: string) => string },
): void;
export const WM_RENDER_VERSION: 1;
/** 64-bit FNV-1a in two 32-bit lanes, 16 hex characters. */
export function fnv1a64(s: string): string;
/** The recognised info keys in fixed order (look=, then view=; last occurrence wins; view=stack dropped). */
export function infoAttrs(info: unknown): string;
/** fnv1a64(WM_RENDER_VERSION + '\0' + body), plus '\0' + infoAttrs(info) when it is not empty. */
/** Excludes the block index, which the HTML embeds in ids/hrefs: never cache figure HTML across positions by digest alone. */
export function mockDigest(body: string, info?: string): string;

export interface WmLint extends WmError { severity: 'error' | 'warning' }
/** parseMock's errors and warnings with a severity; unknown_kind, unknown_attr and dangling_link are errors; unknown info words are `unknown_info` warnings at line 0. At most 50. */
export function lintMock(body: string, info?: string): WmLint[];
/** The language reference for agents (3,000 to 7,000 characters), generated from KINDS. */
export const AI_CONTRACT: string;
/** A place for an added or moved element: before or after an element, or into a container (`at`
 *  start or end, default end; into a screen's id puts it on the screen). `screen` says which screen the
 *  target is in (ids derived from labels repeat across screens); without it the first match wins. */
export type PatchPlace =
  | { before: string; screen?: string }
  | { after: string; screen?: string }
  | { into: string; at?: 'start' | 'end'; screen?: string };
export type PatchOp =
  /** Rewrites the element's line in canonical order. A derived id needs `pin: true` (write it first) or
   *  `pin: false` (let it follow the change; the result's `id` is the new one). `label: null` removes the
   *  last label; `labelIndex: 1` is an item's second label. `kind` changes between leaf kinds with a label
   *  (attributes and flags the new kind does not take are dropped). `link` is a screen id, 'back' or null. */
  | { set: string; screen?: string; attrs?: Record<string, string | null>; flags?: Record<string, boolean>; label?: string | null; labelIndex?: 0 | 1; link?: string | null; kind?: string; pin?: boolean }
  /** Removes the element's line and every deeper line under it. */
  | { remove: string; screen?: string }
  /** Moves the element's subtree (with comments directly above it), re-indented for its new depth. The
   *  target is looked up in `toScreen`, else in the element's own screen first. */
  | ({ move: string; screen?: string; toScreen?: string } & ({ before: string } | { after: string } | { into: string; at?: 'start' | 'end' }))
  /** Copies the subtree right after itself; explicit ids are dropped from the copy. */
  | { duplicate: string; screen?: string }
  /** Adds one line, or up to 40 lines whose relative indentation is kept (re-based to the block's unit). */
  | { add: PatchPlace; line: string }
  | { add: PatchPlace; lines: string[] }
  /** A new screen (id derived from the label when absent), after `after`'s screen and its variants, else last. */
  | { addScreen: { label: string; id?: string; after?: string; lines?: string[] } }
  /** Sets, replaces or (null) removes a screen's or variant's label. */
  | { renameScreen: string; label: string | null }
  /** Removes a screen and its variants, or one variant. Links to it are refused unless `unlink: true`. */
  | { removeScreen: string; unlink?: boolean }
  /** Moves a screen (with its variants) or a variant before or after another screen. */
  | { moveScreen: string; before: string }
  | { moveScreen: string; after: string }
  /** Sets, adds (in header order) or (null) removes `@device`, `@look` or `@title`. */
  | { header: 'device' | 'look' | 'title'; value: string | null }
  /** Writes or updates the element's patch line inside the variant (null / false / hide: false remove). */
  | { variant: string; set: string; attrs?: Record<string, string | null>; flags?: Record<string, boolean>; hide?: boolean; pin?: boolean };
export type PatchError = 'bad_op' | 'not_found' | 'in_define' | 'pin_first' | 'would_break' | 'invalid_body'
  | 'bad_move' | 'cannot_hold' | 'id_taken' | 'last_screen' | 'dangling_link';
export type PatchResult =
  | { ok: true; body: string; id: string | null; screen: string | null; ids: (string | null)[] }
  | { ok: false; error: PatchError; message: string };
/** Ops apply in turn, each to a fresh parse of the body so far; untouched lines stay byte-identical.
 *  `id`/`screen`: the element (or screen) the last op added, moved, duplicated or changed, after the change. */
export function mockPatch(body: string, ops: PatchOp | PatchOp[]): PatchResult;
/** May a `parentKind` hold a `childKind`? The rule move and add apply, for a host's drop targets. */
export function canHold(parentKind: string, childKind: string): boolean;

export interface TreeElement {
  id: string; kind: string; typed: string | null;
  /** Body line (1-based): a define's output is its use line, a variant's copy the base line; null for an implicit screen. */
  line: number | null;
  parent: string | null; index: number; depth: number;
  labels: readonly string[]; flags: readonly string[]; attrs: Readonly<Record<string, string>>;
  link: string | null; note: string | null; explicitId: boolean; fromDefine: string | null;
  /** The kind can hold children; axis is how it lays them out (null when it cannot). */
  container: boolean; axis: 'column' | 'row' | 'grid' | null;
  accepts: 'any' | 'none' | readonly string[];
  /** False for a screen frame, an element a define made, and any element of a variant. */
  editable: boolean; reason?: 'define' | 'variant' | 'frame';
  /** A variant patch line names it by id: pin a derived id before relabelling it (or the patch is orphaned). */
  referenced: boolean;
}
export interface TreeScreen { id: string; label: string; line: number | null; variantOf: string | null; implicit: boolean; elements: readonly TreeElement[] }
/** The block as an editor sees it, elements in source order (the screen frame first). Frozen and memoised. */
export function mockTree(body: string, info?: string): { ok: true; screens: readonly TreeScreen[] } | { ok: false; errors: WmError[] };
export interface KindForm {
  kind: string; group: string;
  labels: { name: 'label' | 'detail'; type: 'string' | 'icon' }[];
  flags: string[];
  /** The kind's own attributes first, then the box attributes (w h pad gap grow align justify span note). */
  attrs: { name: string; type: 'number' | 'size' | 'enum' | 'string' | 'icon'; options?: string[]; min?: number; max?: number }[];
  container: boolean; accepts: 'any' | 'none' | string[];
}
/** A kind's properties for a form, built from KINDS; null for a word that is not a kind. */
export function kindForm(kind: string): KindForm | null;
export interface PaletteItem { id: string; label: string; kind: string; lines: readonly string[] }
/** What a person adds, grouped (Text, Controls, Media, Layout, Data and navigation, Overlays). */
export const PALETTE: readonly { group: string; items: readonly PaletteItem[] }[];
/** The names of ICONS, sorted. */
export const ICON_NAMES: readonly string[];

/** Where element `elementId` (drawn in `screenId`, else any screen) is written: its body line (1-based),
 *  the id to name it by (a define's output names its use), the screen to name it in (a variant's base),
 *  a label (`button "Sign in"`), and how to make its id explicit (`patch`: mockPatch set+pin; `use`:
 *  append `#id` to the use line; null: explicit already or not pinnable). Null when not found. */
export interface ElementLocation { line: number; elementId: string; screenId: string; label: string; pin: null | 'patch' | 'use'; frame: boolean }
export function locateElement(body: string, info: string, elementId: string, screenId?: string): ElementLocation | null;
/** The one element written on body line `line`, as locateElement describes it, or null. */
export function elementAtLine(body: string, info: string, line: number): ElementLocation | null;
/** Body line `line` of the fence opening at `fenceFrom` in `text`: its trimmed span, where the body text
 *  starts in the source line (`at`, after container prefixes) and the line's end. */
export function bodyLineSpan(text: string, fenceFrom: number, body: string, line: number): { from: number; to: number; at: number; end: number } | null;
