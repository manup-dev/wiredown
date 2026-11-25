import type { IconPack } from './index.js';
export type { IconPack } from './index.js';
/**
 * Checks a pack and returns it frozen and branded for the renderers of the same copy of wiredown. Throws a
 * TypeError on a malformed one: id `[a-z][a-z0-9-]{0,23}` (not `wiredown`), at most 10,000 icons named
 * `[a-z0-9][a-z0-9-]{0,63}`, each a path of at most 6,000 characters (commands and numbers only, arc flags
 * written alone, every point, control points included, within -4..28 once relative steps are added up),
 * `strokeWidth` 1 to 3 (2 when missing).
 */
export function defineIconPack(spec: { id: string; name: string; version: string; license?: string; url?: string; strokeWidth?: number; icons: Record<string, string> }): IconPack;
export function isIconPack(value: unknown): value is IconPack;
/** `lucide@0.1.0,tabler@0.1.0` (ids sorted). A host that caches rendered output adds this to its cache key. */
export function iconPacksKey(packs: readonly unknown[]): string;
