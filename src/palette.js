// PALETTE: what a person adds from an editor's insert menu, grouped, each with a sensible default.
// Lines use a 2-space indent; mockPatch's add re-bases them to the block's own unit and depth.
// Items and tabs are not listed: they live in a list, tabbar or tabs, which come with some, and
// a host duplicates one to add another.
const item = (id, label, kind, ...lines) => Object.freeze({ id, label, kind, lines: Object.freeze(lines) });
const group = (name, ...items) => Object.freeze({ group: name, items: Object.freeze(items) });

export const PALETTE = Object.freeze([
  group('Text',
    item('h1', 'Heading 1', 'h1', 'h1 "Heading"'),
    item('h2', 'Heading 2', 'h2', 'h2 "Heading"'),
    item('h3', 'Heading 3', 'h3', 'h3 "Heading"'),
    item('text', 'Text', 'text', 'text "Some text"'),
    item('link', 'Link', 'link', 'link "Link"')),
  group('Controls',
    item('button', 'Button', 'button', 'button "Button"'),
    item('button-primary', 'Primary button', 'button', 'button "Continue" primary'),
    item('input', 'Text field', 'input', 'input "Label" placeholder="Placeholder"'),
    item('textarea', 'Text area', 'textarea', 'textarea "Message" rows=3'),
    item('select', 'Dropdown', 'select', 'select "Choose one" options="One, Two, Three"'),
    item('checkbox', 'Checkbox', 'checkbox', 'checkbox "Checkbox"'),
    item('radio', 'Radio button', 'radio', 'radio "Option"'),
    item('toggle', 'Toggle', 'toggle', 'toggle "Setting"')),
  group('Media',
    item('image', 'Image', 'image', 'image "Image"'),
    item('icon', 'Icon', 'icon', 'icon "star"'),
    item('avatar', 'Avatar', 'avatar', 'avatar "Ada Lovelace"'),
    item('badge', 'Badge', 'badge', 'badge "New"')),
  group('Layout',
    item('stack', 'Stack', 'stack', 'stack gap=8', '  text "First"', '  text "Second"'),
    item('row', 'Row', 'row', 'row gap=8', '  button "Cancel"', '  button "Save" primary'),
    item('grid', 'Grid', 'grid', 'grid cols=2 gap=12', '  card', '    text "One"', '  card', '    text "Two"'),
    item('card', 'Card', 'card', 'card', '  h3 "Card title"', '  text "A short description."'),
    item('spacer', 'Spacer', 'spacer', 'spacer'),
    item('divider', 'Divider', 'divider', 'divider')),
  group('Data and navigation',
    item('list', 'List', 'list', 'list', '  item "First item"', '  item "Second item"', '  item "Third item"'),
    item('table', 'Table', 'table', 'table cols="Name, Status, Date" rows=3'),
    item('tabs', 'Tabs', 'tabs', 'tabs', '  tab "First" selected', '  tab "Second"', '  tab "Third"'),
    item('navbar', 'Navigation bar', 'navbar', 'navbar "Title" back'),
    item('tabbar', 'Tab bar', 'tabbar', 'tabbar', '  item "Home" icon=home selected', '  item "Search" icon=search', '  item "Alerts" icon=bell', '  item "Profile" icon=user')),
  group('Overlays',
    item('modal', 'Dialog', 'modal', 'modal "Title"', '  text "Are you sure?"', '  row gap=8 justify=end', '    button "Cancel"', '    button "OK" primary'),
    item('sheet', 'Bottom sheet', 'sheet', 'sheet "Title"', '  text "Sheet content"'),
    item('toast', 'Toast', 'toast', 'toast "Saved" tone=good')),
]);
