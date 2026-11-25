import type { WmLint } from '../index.js';
export interface ExportFile { screen: string; variant: string | null; name: string; text: string; notes: string[] }
export type ExportResult = { ok: true; files: ExportFile[] } | { ok: false; problems: WmLint[] };
/** Semantic HTML per screen and variant. A block with lint errors is refused. Never throws. */
export function toHTML(body: string, info?: string): ExportResult;
/** OpenUI Lang 1.0 per screen and variant, for @openuidev/react-ui. A block with lint errors is refused. Never throws. */
export function toOpenUI(body: string, info?: string): ExportResult;
export interface FlowStep { screenId: string; label: string; via: string | null }
/**
 * The order an animated flow plays, at most 24 steps. Never throws.
 * With `@flow`: exactly the screens it names, in its order, repeats kept; no other screen or variant is shown.
 * Without: from the start screen, the first link (document order) to an unvisited screen, never `back`;
 * else the screen's next unvisited variant; else the next unvisited screen in storyboard order.
 * `via` is the id of the element tapped to reach the step (null when none).
 */
export function flowPath(body: string, info?: string): { ok: boolean; steps: FlowStep[] };
export interface FlowAnimationOptions {
  /** Seconds each step is shown, 0.5 to 30 (default 2.6). */
  step?: number;
  /** Seconds a screen change takes (default 0.45, at most 40% of a step). */
  transition?: number;
  /** The small "wiredown" text, bottom right (default true). */
  credit?: boolean;
  /** Icon packs, as for renderMockBlock. */
  icons?: unknown;
}
/** A standalone animated SVG file of the flow (plays as <img src>; follows prefers-color-scheme and prefers-reduced-motion), or an error SVG (also when over 2 MB of UTF-8). Never throws. */
export function renderFlowAnimation(body: string, info?: string, opts?: FlowAnimationOptions): string;
/** The same picture at `at` seconds (wrapped to the loop), with no <style>: one frame for a GIF encoder. `theme` picks the colours (default light). Never throws. */
export function renderFlowFrame(body: string, info?: string, opts?: FlowAnimationOptions & { at?: number; theme?: 'light' | 'dark' }): string;
/** Seconds one loop lasts: steps x step, nominal (0 when the block does not parse). Never throws. */
export function flowDuration(body: string, info?: string, opts?: FlowAnimationOptions): number;
