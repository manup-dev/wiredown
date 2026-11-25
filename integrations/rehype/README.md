# rehype-wiremark

A rehype plugin that draws `wiremark` and `screens` code fences as the static SVG wireframes from wiremark (see the wiremark README).

## Install

```sh
npm i rehype-wiremark wiremark
```

Add the stylesheet once: `import 'wiremark/wiremark.css'`.

## Use

unified:

```js
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeWiremark from 'rehype-wiremark'

const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeWiremark).use(rehypeStringify).process(markdown)
```

Astro (`astro.config.mjs`):

```js
import rehypeWiremark from 'rehype-wiremark'
export default { markdown: { rehypePlugins: [rehypeWiremark] } }
```

Docusaurus (`docusaurus.config.js`, in the docs preset options):

```js
docs: { rehypePlugins: [require('rehype-wiremark').default] }
```

(Docusaurus config is CommonJS; use `(await import('rehype-wiremark')).default` in an async config.)

Next.js MDX (`next.config.mjs`):

```js
import createMDX from '@next/mdx'
import rehypeWiremark from 'rehype-wiremark'
export default createMDX({ options: { rehypePlugins: [rehypeWiremark] } })({})
```

Options: `{ info: 'look=clean' }` adds info words to every block. A fence's own words win.

## Notes

Do not run it before a sanitizer that strips SVG. Put it after `rehype-sanitize`, or allow the figure there.

MIT.
