import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { drawInto } from './render.js';

const DEFAULTS = { look: 'wire' };

// Block numbers only need to be distinct within one document; wrap well before the core's cap.
let index = 0;

export default class WiremarkPlugin extends Plugin {
  async onload() {
    this.settings = { ...DEFAULTS, ...(await this.loadData()) };
    for (const lang of ['wiremark', 'screens']) {
      this.registerMarkdownCodeBlockProcessor(lang, (source, el) =>
        drawInto(el, source, lang, this.settings.look, index++ % 10000));
    }
    this.addSettingTab(new WiremarkSettings(this.app, this));
  }
}

class WiremarkSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('Default look')
      .setDesc('Used when a block has no look= of its own. Use @look clean inside a block to override it there.')
      .addDropdown((d) => d
        .addOptions({ wire: 'Wireframe', clean: 'Clean' })
        .setValue(this.plugin.settings.look)
        .onChange(async (v) => {
          this.plugin.settings.look = v;
          await this.plugin.saveData(this.plugin.settings);
        }));
  }
}
