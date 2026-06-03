import { VTM } from './config.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class VtmItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["vtm-v20", "sheet", "item"],
    position: { width: 540, height: 660 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {}
  };

  static PARTS = {
    sheet: { template: "systems/vtm-v20/templates/item-sheet.hbs" }
  };

  // Item types with dense sheet content get room to breathe.
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    if (this.document.type === 'discipline' || this.document.type === 'background') {
      this.setPosition({ width: 655, height: 832 });
    } else if (this.document.type === 'weapon') {
      this.setPosition({ width: 540, height: 760 });
    }
  }


  // -- Context --------------------------------------------------------------

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const item = this.document;
    ctx.item = item;
    ctx.system = item.system;
    ctx.config = CONFIG.VTM;
    ctx.isGM = game.user.isGM;
    ctx.typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    ctx.hasEI = game.modules.get('enhanced-inventory')?.active ?? false;

    if (item.type === 'background') {
      const maxVisible = (item.parent && ctx.system.rating > 0)
        ? ctx.system.rating : 5;
      ctx.bgLevels = [1, 2, 3, 4, 5].filter(n => n <= maxVisible).map(n => {
        const key = `lvl${n}`;
        const lvl = ctx.system.levels[key];
        return { num: n, key, name: lvl.name, desc: lvl.desc };
      });
    }

    ctx.isAuspex = item.type === 'discipline'
      && item.name.toLowerCase() === 'auspex';

    if (item.type === 'discipline') {
      const loc = k => game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`);
      const traitOpts = [
        ...Object.values(VTM.attributes).flat().map(k => ({ key: `attributes.${k}`, label: loc(k) })),
        ...Object.values(VTM.abilities).flat().map(k => ({ key: `abilities.${k}`, label: loc(k) })),
        { key: 'virtues.conscience', label: 'Conscience' },
        { key: 'virtues.selfControl', label: 'Self-Control' },
        { key: 'virtues.courage', label: 'Courage' },
        { key: 'willpower', label: 'Willpower' },
        { key: 'humanity', label: 'Humanity' },
      ];

      const maxVisible = (item.parent && ctx.system.level > 0)
        ? ctx.system.level : 5;

      ctx.powerLevels = [1, 2, 3, 4, 5].filter(n => n <= maxVisible).map(n => {
        const key = `lvl${n}`;
        const power = ctx.system.powers[key];
        return {
          num: n, key,
          name: power.name, desc: power.desc,
          difficulty: power.difficulty, cost: power.cost,
          primary: power.primary, secondary: power.secondary,
          hasRoll: !!power.primary,
          primaryOptions: traitOpts.map(o => ({ ...o, selected: o.key === power.primary })),
          secondaryOptions: traitOpts.map(o => ({ ...o, selected: o.key === power.secondary })),
        };
      });
    }

    if (item.type === 'weapon') {
      const loc = k => game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`);
      ctx.requireTraitOptions = [
        { key: '', label: 'None', selected: !item.system.requireTrait },
        ...Object.values(VTM.attributes).flat().map(k => ({
          key: `attributes.${k}`, label: loc(k),
          selected: item.system.requireTrait === `attributes.${k}`,
        })),
        ...Object.values(VTM.abilities).flat().map(k => ({
          key: `abilities.${k}`, label: loc(k),
          selected: item.system.requireTrait === `abilities.${k}`,
        })),
      ];
    }

    ctx.enrichedDescription = await TextEditor.enrichHTML(item.system.description || '', { relativeTo: item });
    return ctx;
  }


  // -- Render & listeners ---------------------------------------------------

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    // Image: click for lightbox, right-click for file picker
    const img = el.querySelector('.sheet-header img');
    if (img) {
      img.addEventListener('click', ev => {
        ev.preventDefault();
        this._openLightbox(this.document.img);
      });
      if (this.isEditable) {
        img.addEventListener('contextmenu', ev => {
          ev.preventDefault();
          new FilePicker({
            type: 'image',
            current: this.document.img,
            callback: path => this.document.update({ img: path })
          }).browse();
        });
      }
    }

    if (!this.isEditable) return;

    // Dot ratings
    el.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const val = parseInt(dot.dataset.value);
        const path = dot.closest('.dot-row').dataset.path;
        const cur = foundry.utils.getProperty(this.document, path);
        this.document.update({ [path]: val === cur ? val - 1 : val });
      });
    });

    el.querySelector('.aura-chart-btn')?.addEventListener('click', () => this._showAuraChart());

    el.querySelectorAll('.power-roll').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.level;
        const power = this.document.system.powers[key];
        const actor = this.document.parent;
        if (!actor) {
          ui.notifications.warn('This discipline must be on a character to roll.');
          return;
        }
        game.vtm.rollDicePool(actor, {
          trait: power.primary,
          trait2: power.secondary,
          label: `${this.document.name}: ${power.name}`,
          difficulty: power.difficulty,
        });
      });
    });
  }


  // -- Aura chart (Auspex) --------------------------------------------------

  _showAuraChart() {
    const emotions = [
      ['Afraid', 'Orange', '#e87800'],
      ['Aggressive', 'Purple', '#8b008b'],
      ['Angry', 'Red', '#dc143c'],
      ['Bitter', 'Brown', '#8b4513'],
      ['Calm', 'Light Blue', '#87ceeb'],
      ['Compassionate', 'Pink', '#ff69b4'],
      ['Conservative', 'Lavender', '#b8a9c9'],
      ['Depressed', 'Gray', '#808080'],
      ['Desirous / Lustful', 'Deep Red', '#8b0000'],
      ['Distrustful', 'Light Green', '#78c878'],
      ['Envious', 'Dark Green', '#2d6e2d'],
      ['Excited', 'Violet', '#9b59b6'],
      ['Generous', 'Rose', '#e84080'],
      ['Happy', 'Vermilion', '#e34234'],
      ['Hateful', 'Black', '#1a1a1a'],
      ['Idealistic', 'Yellow', '#e6c619'],
      ['Innocent', 'White', '#e8e8e8'],
      ['Lovestruck', 'Blue', '#4169e1'],
      ['Obsessed', 'Green', '#2e8b2e'],
      ['Sad', 'Silver', '#b0b0b0'],
      ['Spiritual', 'Gold', '#d4a940'],
      ['Suspicious', 'Dark Blue', '#1a3a6e'],
    ];

    const special = [
      ['Anxious', 'Scrambled, like static or white noise'],
      ['Confused', 'Mottled, shifting colors'],
      ['Diablerist', 'Black veins in aura'],
      ['Daydreaming', 'Sharp flickering colors'],
      ['Frenzied', 'Rapidly rippling colors'],
      ['Psychotic', 'Hypnotic, swirling colors'],
      ['Vampire', 'Aura colors are pale'],
      ['Ghoul', 'Pale blotches in the aura'],
      ['Magic Use', 'Myriad sparkles in aura'],
      ['Werebeast', 'Bright, vibrant aura'],
      ['Ghost', 'Weak, intermittent aura'],
      ['Faerie', 'Rainbow highlights in aura'],
    ];

    const emotionRows = emotions.map(([cond, color, hex]) =>
      `<tr><td>${cond}</td><td><span class="aura-swatch" style="background:${hex}"></span>${color}</td></tr>`
    ).join('');

    const specialRows = special.map(([cond, desc]) =>
      `<tr><td>${cond}</td><td>${desc}</td></tr>`
    ).join('');

    const content = `
      <div class="aura-chart">
        <table>${emotionRows}</table>
        <h3>Supernatural & Special</h3>
        <table>${specialRows}</table>
      </div>`;

    new Dialog({
      title: 'Aura Colors',
      content,
      buttons: { ok: { label: 'Close' } },
      default: 'ok',
    }, { classes: ['vtm-v20', 'aura-dialog'], width: 380 }).render(true);
  }


  // -- Image lightbox -------------------------------------------------------

  _openLightbox(src) {
    const overlay = document.createElement('div');
    overlay.classList.add('vtm-lightbox');

    const pic = document.createElement('img');
    pic.src = src;
    overlay.appendChild(pic);

    let zoom = 1;
    overlay.addEventListener('wheel', ev => {
      ev.preventDefault();
      zoom = Math.min(Math.max(zoom + (ev.deltaY < 0 ? 0.15 : -0.15), 0.3), 5);
      pic.style.transform = `scale(${zoom})`;
    }, { passive: false });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    pic.addEventListener('transitionend', () => overlay.classList.add('zooming'), { once: true });

    overlay.addEventListener('click', () => {
      overlay.classList.remove('zooming');
      pic.style.transform = `scale(0.3)`;
      overlay.classList.remove('active');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    });
  }
}
