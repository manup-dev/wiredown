// Per-kind intrinsic sizes and the text model's constants.
export const FONT = { h1: 28, h2: 22, h3: 18, text: 15, link: 15, small: 13 };
export const LINE = { h1: 36, h2: 30, h3: 26, text: 22, link: 22, small: 18 };
export const S = {
  button: 44, field: 44, fieldLabel: 18, fieldError: 18, textareaRow: 22, check: 24, toggleW: 40,
  divider: 1, avatar: 40, icon: 24, image: 160, badge: 24, tableRow: 36, navbar: 56, tabbar: 64,
  tab: 44, item: 48, item2: 64, placeholder: 44, toast: 44, header: 24, gap: 8, rootPad: 16, cardPad: 16,
  overlayPad: 16, toastMargin: 24, modalMax: 340, inputHug: 180, fieldMin: 64,
};
export const TEXT_KINDS = new Set(['h1', 'h2', 'h3', 'text', 'link']);
// Kinds that fill the column's cross axis unless told otherwise; the rest hug.
export const FILL_KINDS = new Set(['stack', 'row', 'grid', 'card', 'divider', 'input', 'textarea', 'select', 'image', 'table', 'navbar', 'tabbar', 'list', 'tabs', 'item', 'h1', 'h2', 'h3', 'text', 'spacer']);
export const OVERLAYS = new Set(['modal', 'sheet', 'toast']);
export const ROW_KINDS = new Set(['row', 'tabs', 'tabbar']);
