// The first line of every SVG file wiredown writes: the MCP tools (safe-write.js) and the command
// line's render and animate. The MCP server replaces an existing file only when it starts with this
// line, so a file the command line wrote can be written again by an AI, and nobody else's is touched.

export const MARKER = '<!-- made by wiredown -->\n';

/** `svg` with the marker line in front, as it is written to disk. */
export const marked = (svg) => MARKER + svg;
