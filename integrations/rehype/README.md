# rehype-wiredown

A rehype plugin that draws `wiredown` and `screens` code fences as the static SVG wireframes from wiredown (see the wiredown README).

## Install

```sh
npm i rehype-wiredown wiredown
```

Add the stylesheet once: `import 'wiredown/wiredown.css'`.

## Use

unified:

```js
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeWiredown from 'rehype-wiredown'

const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeWiredown).use(rehypeStringify).process(markdown)
```

Astro (`astro.config.mjs`):

```js
import rehypeWiredown from 'rehype-wiredown'
export default { markdown: { rehypePlugins: [rehypeWiredown] } }
```

Docusaurus (`docusaurus.config.js`, in the docs preset options):

```js
docs: { rehypePlugins: [require('rehype-wiredown').default] }
```

(Docusaurus config is CommonJS; use `(await import('rehype-wiredown')).default` in an async config.)

Next.js MDX (`next.config.mjs`):

```js
import createMDX from '@next/mdx'
import rehypeWiredown from 'rehype-wiredown'
export default createMDX({ options: { rehypePlugins: [rehypeWiredown] } })({})
```

Options: `{ info: 'look=clean' }` adds info words to every block. A fence's own words win.

## Notes

Do not run it before a sanitizer that strips SVG. Put it after `rehype-sanitize`, or allow the figure there.

MIT.
