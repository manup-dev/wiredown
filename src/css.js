// Stylesheet for hosts that have one: figure layout and the prototype view only, never paint
// (the SVG carries its own). Without it every screen shows, stacked, and links still jump.
// The prototype rules use :has; where :has is missing they drop out and every screen shows.
export const WIREDOWN_CSS = [
  '.wm{margin:1.5em 0}',
  '.wm .wm-strip{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}',
  '.wm .wm-variants{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}',
  '.wm .wm-screen{min-width:0;max-width:100%}',
  '.wm .wm-cap{font-size:.85em;margin:0 0 6px}',
  '.wm .wm-title{font-weight:600;margin:0 0 12px}',
  '.wm svg{display:block;max-width:100%;height:auto}',
  '.wm .wm-notes{margin:12px 0 0;padding-inline-start:1.75em}',
  '.wm .wm-outline{margin-top:8px}',
  '.wm.wm-proto .wm-strip,.wm.wm-proto .wm-variants{display:block}',
  '.wm.wm-proto:has(.wm-screen:target) .wm-screen:not(:target){display:none}',
  '.wm.wm-proto:not(:has(.wm-screen:target)) .wm-screen:not(.wm-start){display:none}',
  '.wm.wm-proto{overflow-x:clip}',
  '.wm.wm-proto .wm-in-slide:is(:target,.wm-current){animation:wm-slide .22s ease-out}',
  '.wm.wm-proto .wm-in-fade:is(:target,.wm-current){animation:wm-fade .22s ease-out}',
  '.wm.wm-proto .wm-in-push:is(:target,.wm-current){animation:wm-push .32s ease-out}',
  '.wm.wm-proto .wm-in-sheet:is(:target,.wm-current){animation:wm-sheet .28s ease-out}',
  '.wm.wm-proto .wm-in-zoom:is(:target,.wm-current){animation:wm-zoom .22s ease-out}',
  '@keyframes wm-slide{from{opacity:0;transform:translateX(32px)}}',
  '@keyframes wm-fade{from{opacity:0}}',
  '@keyframes wm-push{from{opacity:.4;transform:translateX(64px)}}',
  '@keyframes wm-sheet{from{transform:translateY(48px)}}',
  '@keyframes wm-zoom{from{opacity:0;transform:scale(.96)}}',
  '@media (prefers-reduced-motion:reduce){.wm.wm-proto [class*=wm-in-]{animation:none!important}}',
].join('\n');
