# wiredown-icons-tabler

Every Tabler outline icon as a wiredown icon pack. Names are the upstream names (`{name}` in `@tabler/icons`), so `icon "tabler:name"` draws one.

## Install

```sh
npm i wiredown wiredown-icons-tabler
```

## Use

```js
import { wiredownPlugin, renderMockBlock } from 'wiredown'
import tabler from 'wiredown-icons-tabler'

md.use(wiredownPlugin, { icons: [tabler] })
renderMockBlock(body, info, { icons: [tabler] })
```

In a block, `icon "tabler:name"` reads one icon from this pack. The header `@icons tabler` makes every bare icon name read this pack first, then the built-in icons.
Command line: `wiredown render file.wiredown --icons wiredown-icons-tabler`.
A host that caches rendered output adds `iconPacksKey([pack])` to its cache key.

The data is generated from `@tabler/icons@3.51.0` by `node build.mjs`. The package version (and the pack's `version`, which `iconPacksKey` reports) is bumped whenever the data is rebuilt.
Two upstream icons are left out because their arcs are larger than the pack format allows: `heart-check` and `spade` (5,231 of 5,233 outline icons are included).
