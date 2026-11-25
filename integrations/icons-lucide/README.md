# wiredown-icons-lucide

Every Lucide icon as a wiredown icon pack. Names are the upstream names (`{name}` in `lucide-static`), so `icon "lucide:name"` draws one.

## Install

```sh
npm i wiredown wiredown-icons-lucide
```

## Use

```js
import { wiredownPlugin, renderMockBlock } from 'wiredown'
import lucide from 'wiredown-icons-lucide'

md.use(wiredownPlugin, { icons: [lucide] })
renderMockBlock(body, info, { icons: [lucide] })
```

In a block, `icon "lucide:name"` reads one icon from this pack. The header `@icons lucide` makes every bare icon name read this pack first, then the built-in icons.
Command line: `wiredown render file.wiredown --icons wiredown-icons-lucide`.
A host that caches rendered output adds `iconPacksKey([pack])` to its cache key.

The data is generated from `lucide-static@1.72.0` by `node build.mjs`. The package version (and the pack's `version`, which `iconPacksKey` reports) is bumped whenever the data is rebuilt.
