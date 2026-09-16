// The Authentic Text Manager: a GM settings window where owners of the book
// paste chapters, review what the parser found, and apply the text into their
// world. Shipped system files never change; everything lands in a world
// setting and gets picked up at compendium build time.

import { parseAuthenticText } from './authentic-parser.mjs';
import { buildCatalog, listSlots } from './authentic-catalog.mjs';
import { getOverrides, setOverrides, getRev, getAppliedRev } from './authentic-store.mjs';
import { populateCompendiums } from './compendiums.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CATEGORY_PREFIXES = {
  'Archetypes': ['archetype:'],
  'Disciplines': ['discipline:'],
  'Paths': ['path:'],
  'Rituals': ['ritual:', 'ritualcat:'],
  'Backgrounds': ['background:'],
  'Merits': ['merit:'],
  'Flaws': ['flaw:'],
  'Attributes & Abilities': ['trait:'],
};

export class AuthenticTextManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'authentic-text-manager',
    classes: ['vtm-v20', 'authentic-manager'],
    window: { title: 'Authentic Text Manager', resizable: true },
    position: { width: 900, height: 680 },
    actions: {
      parse: AuthenticTextManager.#onParse,
      apply: AuthenticTextManager.#onApply,
      setMode: AuthenticTextManager.#onSetMode,
      pickCategory: AuthenticTextManager.#onPickCategory,
      exportJson: AuthenticTextManager.#onExport,
      importJson: AuthenticTextManager.#onImport,
      rebuild: AuthenticTextManager.#onRebuild,
      saveSlot: AuthenticTextManager.#onSaveSlot,
      clearSlot: AuthenticTextManager.#onClearSlot,
      resetCategory: AuthenticTextManager.#onResetCategory,
      clearResults: AuthenticTextManager.#onClearResults,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/vtm-v20/templates/authentic-manager.hbs',
      scrollable: ['.atm-body'],
    },
  };

  mode = 'paste';
  category = 'Archetypes';
  results = null;
  pasteValue = '';

  async _prepareContext() {
    const catalog = buildCatalog();
    const slots = listSlots(catalog);
    const ov = getOverrides();

    const byCat = {};
    for (const s of slots) {
      const c = (byCat[s.category] ??= { name: s.category, total: 0, filled: 0 });
      c.total++;
      if (ov[s.key]) c.filled++;
    }
    const categories = Object.values(byCat).map(c => ({ ...c, active: c.name === this.category }));

    let browseSlots = null;
    if (this.mode === 'browse') {
      browseSlots = slots.filter(s => s.category === this.category).map(s => ({
        ...s,
        value: ov[s.key] || '',
        has: !!ov[s.key],
      }));
    }

    let missing = null;
    if (this.results?.containersSeen?.length) {
      missing = [];
      const got = new Set(this.results.captures.map(c => c.key));
      for (const seen of this.results.containersSeen) {
        if (seen.type === 'discipline' || seen.type === 'path') {
          const entry = (seen.type === 'discipline' ? catalog.disciplines : catalog.paths)
            .find(d => d.name === seen.name);
          for (const p of entry?.powers || []) {
            const slot = p.name || `lvl${p.lvl}`;
            if (!got.has(`${seen.type}:${seen.name}:power:${slot}`)) {
              missing.push(`${seen.name}: ${p.name || 'level ' + p.lvl}`);
            }
          }
        } else if (seen.type === 'background') {
          const entry = catalog.backgrounds.find(b => b.name === seen.name);
          for (const l of entry?.levels || []) {
            if (!got.has(`background:${seen.name}:level:${l.key}`)) {
              missing.push(`${seen.name}: ${l.name}`);
            }
          }
        }
      }
      if (!missing.length) missing = null;
    }

    return {
      categories,
      pasteMode: this.mode === 'paste',
      pasteValue: this.pasteValue,
      results: this.results ? {
        rows: this.results.captures.map((c, idx) => ({
          idx, key: c.key, label: c.label, text: c.text,
          warn: c.status === 'warn', checked: c.checked !== false,
          notes: c.notes.join('; '),
          chars: c.text.replace(/<[^>]+>/g, '').length,
        })),
        okCount: this.results.captures.filter(c => c.status === 'ok').length,
        warnCount: this.results.captures.filter(c => c.status === 'warn').length,
        skipped: this.results.skipped,
        leftovers: this.results.leftovers,
      } : null,
      missing,
      browseSlots,
      category: this.category,
      needsRebuild: getRev() > getAppliedRev(),
    };
  }

  _onRender() {
    const el = this.element;
    el.querySelector('.atm-paste')?.addEventListener('input', ev => {
      this.pasteValue = ev.currentTarget.value;
    });
    el.querySelectorAll('.atm-row-check').forEach(cb => cb.addEventListener('change', ev => {
      const idx = Number(ev.currentTarget.dataset.idx);
      if (this.results?.captures[idx]) this.results.captures[idx].checked = ev.currentTarget.checked;
    }));
    el.querySelectorAll('.atm-row-text').forEach(ta => ta.addEventListener('change', ev => {
      const idx = Number(ev.currentTarget.dataset.idx);
      if (this.results?.captures[idx]) this.results.captures[idx].text = ev.currentTarget.value;
    }));
  }

  static async #onParse() {
    const raw = this.element.querySelector('.atm-paste')?.value || '';
    if (raw.trim().length < 40) {
      ui.notifications.warn('Paste a section of the book first.');
      return;
    }
    this.results = parseAuthenticText(raw, buildCatalog());
    for (const c of this.results.captures) c.checked = true;
    if (!this.results.captures.length) {
      ui.notifications.warn('No known entries found in that text. Include the section headers when pasting.');
    }
    this.render();
  }

  static async #onApply() {
    if (!this.results) return;
    const picked = this.results.captures.filter(c => c.checked !== false && c.text.trim());
    if (!picked.length) {
      ui.notifications.warn('Nothing selected to apply.');
      return;
    }
    const ov = { ...getOverrides() };
    for (const c of picked) ov[c.key] = c.text;
    await setOverrides(ov);
    ui.notifications.info(`Applied ${picked.length} authentic text entries. Archetypes and tooltips update immediately; compendium text needs a rebuild.`);
    this.results = null;
    this.pasteValue = '';
    this.render();
  }

  static #onClearResults() {
    this.results = null;
    this.render();
  }

  static #onSetMode(_ev, target) {
    this.mode = target.dataset.mode;
    this.render();
  }

  static #onPickCategory(_ev, target) {
    this.category = target.dataset.cat;
    if (this.mode !== 'browse') this.mode = 'browse';
    this.render();
  }

  static #onExport() {
    const data = JSON.stringify(getOverrides(), null, 2);
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(data, 'text/json', 'vtm-authentic-text.json');
  }

  static async #onImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          if (typeof data !== 'object' || Array.isArray(data)) throw new Error('bad shape');
          const merged = { ...getOverrides(), ...data };
          await setOverrides(merged);
          ui.notifications.info(`Imported ${Object.keys(data).length} entries.`);
          this.render();
        } catch {
          ui.notifications.error('That file is not a valid authentic text export.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  static async #onRebuild() {
    ui.notifications.info('Rebuilding compendiums with authentic text...');
    await populateCompendiums({ force: true });
    this.render();
  }

  static async #onSaveSlot(_ev, target) {
    const key = target.dataset.key;
    const ta = this.element.querySelector(`.atm-slot-text[data-key="${CSS.escape(key)}"]`);
    if (!ta) return;
    const ov = { ...getOverrides() };
    const val = ta.value.trim();
    if (val) ov[key] = val;
    else delete ov[key];
    await setOverrides(ov);
    this.render();
  }

  static async #onClearSlot(_ev, target) {
    const ov = { ...getOverrides() };
    delete ov[target.dataset.key];
    await setOverrides(ov);
    this.render();
  }

  static async #onResetCategory() {
    const prefixes = CATEGORY_PREFIXES[this.category] || [];
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Reset category' },
      content: `<p>Remove all authentic text for <b>${this.category}</b> and return to the shipped descriptions?</p>`,
    });
    if (!confirmed) return;
    const ov = { ...getOverrides() };
    for (const key of Object.keys(ov)) {
      if (prefixes.some(p => key.startsWith(p))) delete ov[key];
    }
    await setOverrides(ov);
    this.render();
  }
}
