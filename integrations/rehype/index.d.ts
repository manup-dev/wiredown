import type { Root } from 'hast';
export interface Options {
  /** Extra info words for every block, e.g. "look=clean". A fence's own words win. */
  info?: string;
}
export default function rehypeWiremark(options?: Options): (tree: Root) => void;
