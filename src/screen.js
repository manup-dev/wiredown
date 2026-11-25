// One screen of a parsed mock → its <svg> string: layout, paint, serialize. Never throws:
// an out-of-range index or a malformed mock gives ''.
import { layoutScreen } from './layout.js';
import { paintScreen } from './paint.js';
import { serializeScreen } from './svg.js';
import { iconContext, packsFrom } from './packs.js';

/** `packs`: the host's icon packs (branded ones are used, the rest ignored). */
export function renderScreenSvg(mock, screenIndex, blockIndex = 0, packs) {
  try {
    const screens = mock && Array.isArray(mock.screens) ? mock.screens : [];
    if (!Number.isInteger(screenIndex) || screenIndex < 0 || screenIndex >= screens.length) return '';
    const screen = screens[screenIndex];
    const layout = layoutScreen(screen, mock.device);
    const ops = paintScreen(layout, mock, screenIndex, blockIndex);
    return serializeScreen(ops, {
      width: layout.width, height: layout.height, title: screen.label || screen.id,
      blockIndex, screenId: screen.id, look: mock.look, icons: iconContext(packsFrom({ icons: packs }), mock.icons),
    });
  } catch {
    return '';
  }
}
