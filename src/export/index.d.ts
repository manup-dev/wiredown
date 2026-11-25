import type { WmLint } from '../index.js';
export interface ExportFile { screen: string; variant: string | null; name: string; text: string; notes: string[] }
export type ExportResult = { ok: true; files: ExportFile[] } | { ok: false; problems: WmLint[] };
/** Semantic HTML per screen and variant. A block with lint errors is refused. Never throws. */
export function toHTML(body: string, info?: string): ExportResult;
/** OpenUI Lang 1.0 per screen and variant, for @openuidev/react-ui. A block with lint errors is refused. Never throws. */
export function toOpenUI(body: string, info?: string): ExportResult;
