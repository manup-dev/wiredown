export interface WmFence {
  /** The full info string, trimmed. */
  info: string;
  /** The fence language: the first word of the info string. */
  lang: 'wiredown' | 'screens';
  /** The body, each line ending in "\n"; "" for an empty fence. */
  body: string;
  /** 1-based line of the opening fence. */
  openLine: number;
  /** 1-based line of the first body line (openLine + 1). */
  bodyLine: number;
}

/** Top-level wiredown and screens fences of a markdown text. 1-based lines. Linear. */
export function findFences(markdown: string): WmFence[];
