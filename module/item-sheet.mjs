import { VTM } from './config.mjs';
import { applyHealthDamage } from './combat.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

function parseCost(str) {
  if (!str) return null;
  let blood = 0, wp = 0, variable = false;
  const bm = str.match(/(\d+)(\+)?\s*blood/i);
  if (bm) { blood = parseInt(bm[1]); variable = !!bm[2]; }
  const wm = str.match(/(\d+)\s*(?:willpower|wp)/i);
  if (wm) wp = parseInt(wm[1]);
  return (blood || wp) ? { blood, wp, variable } : null;
}

async function confirmAndSpend(actor, costStr, powerName) {
  const cost = parseCost(costStr);
  if (!cost) return true;

  const blood = actor.system.blood;
  const wpVal = actor.system.willpower?.value ?? 0;

  if (cost.blood > 0 && (!blood || blood.value < cost.blood)) {
    ui.notifications.warn('Not enough blood.');
    return false;
  }
  if (cost.wp > 0 && wpVal < cost.wp) {
    ui.notifications.warn('Not enough Willpower.');
    return false;
  }

  let content;
  if (cost.variable) {
    content = `<div style="text-align:center;margin:8px 0">
      <label>Blood to spend for <b>${powerName}</b>:</label><br/>
      <input type="number" class="var-blood" value="${cost.blood}" min="${cost.blood}" max="${blood.value}"
        style="width:60px;text-align:center;margin-top:6px"/>
      ${cost.wp ? `<br/><small>Also costs ${cost.wp} Willpower</small>` : ''}
    </div>`;
  } else {
    const parts = [];
    if (cost.blood) parts.push(`${cost.blood} blood`);
    if (cost.wp) parts.push(`${cost.wp} Willpower`);
    content = `<p style="text-align:center;margin:10px 0">Spend <b>${parts.join(' and ')}</b> to use <b>${powerName}</b>?</p>`;
  }

  const result = await new Promise(resolve => {
    new Dialog({
      title: powerName,
      content,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>', label: 'Spend',
          callback: dlg => {
            if (cost.variable) {
              const val = parseInt(dlg[0].querySelector('.var-blood').value);
              resolve(Math.max(val || cost.blood, cost.blood));
            } else resolve(true);
          }
        },
        no: { icon: '<i class="fas fa-times"></i>', label: 'Cancel', callback: () => resolve(false) },
      },
      default: 'yes',
      close: () => resolve(false),
    }, { classes: ['vtm-v20', 'dialog'], width: 320 }).render(true);
  });

  if (result === false) return false;

  const bloodSpend = typeof result === 'number' ? result : cost.blood;
  if (bloodSpend > (blood?.value || 0)) {
    ui.notifications.warn('Not enough blood.');
    return false;
  }

  const updates = {};
  if (bloodSpend > 0) updates['system.blood.value'] = blood.value - bloodSpend;
  if (cost.wp > 0) updates['system.willpower.value'] = wpVal - cost.wp;
  if (Object.keys(updates).length) await actor.update(updates);

  if (bloodSpend > 0) {
    if (actor.sheet?.rendered && actor.sheet._playHealAnimation) {
      actor.sheet._playHealAnimation();
    } else {
      foundry.audio.AudioHelper.play({
        src: 'systems/vtm-v20/VTM icons/Blood Consumption Sound effect.mp3', volume: 0.6, loop: false
      }, false);
    }
  }

  return true;
}

async function whisperActivation(actor, powerName, detail, costStr, showActivated = true) {
  const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
  let portraitStyle = '';
  if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
    const r = 0.213 / (pFlags.scale ?? 1);
    portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
  }
  let costLine = '';
  const cost = parseCost(costStr);
  if (cost) {
    const parts = [];
    if (cost.blood) parts.push(`${cost.blood} blood spent (${actor.system.blood?.value ?? 0} remaining)`);
    if (cost.wp) parts.push(`${cost.wp} Willpower spent (${actor.system.willpower?.value ?? 0} remaining)`);
    costLine = parts.join(', ');
  }
  const html = `<div class="vtm-roll">
    <div class="roll-header">
      <div class="roll-portrait-wrap">
        <img class="roll-portrait" src="${actor.img}" style="${portraitStyle}" />
      </div>
      <div class="roll-info">
        <span class="roll-actor">${actor.name}</span>
        <span class="roll-label">${powerName}</span>
      </div>
    </div>
    ${showActivated ? '<div class="roll-result"><span class="result-success">Activated</span></div>' : ''}
    ${costLine ? `<div class="roll-meta">${costLine}</div>` : ''}
    ${detail ? `<div class="roll-extra">${detail}</div>` : ''}
  </div>`;
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  const whisperIds = [...new Set([game.user.id, ...gmIds])];
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    whisper: whisperIds,
  });
}

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
    if (this.document.type === 'discipline' || this.document.type === 'background' || this.document.type === 'path') {
      this.setPosition({ width: 655, height: 832 });
    } else if (this.document.type === 'weapon') {
      this.setPosition({ width: 580, height: 720 });
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
    ctx.isEditable = this.isEditable;
    ctx.typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    ctx.hasEI = game.modules.get('enhanced-inventory')?.active ?? false;

    if (item.type === 'background') {
      const maxVisible = (item.parent && ctx.system.rating > 0)
        ? ctx.system.rating : 5;
      ctx.bgLevels = await Promise.all([1, 2, 3, 4, 5].filter(n => n <= maxVisible).map(async n => {
        const key = `lvl${n}`;
        const lvl = ctx.system.levels[key];
        return {
          num: n,
          key,
          name: lvl.name,
          desc: lvl.desc,
          enrichedDesc: await TextEditor.enrichHTML(lvl.desc || '', { relativeTo: item }),
        };
      }));
    }

    ctx.isAuspex = item.type === 'discipline'
      && item.name.toLowerCase() === 'auspex';

    if (item.type === 'discipline' || item.type === 'path') {
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
      const disc = item.name.toLowerCase();

      ctx.powerLevels = await Promise.all([1, 2, 3, 4, 5].filter(n => n <= maxVisible).map(async n => {
        const key = `lvl${n}`;
        const power = ctx.system.powers[key];
        const needsActivate = (disc === 'vicissitude' && key === 'lvl3');
        return {
          num: n, key,
          name: power.name, desc: power.desc,
          enrichedDesc: await TextEditor.enrichHTML(power.desc || '', { relativeTo: item }),
          difficulty: power.difficulty, cost: power.cost,
          primary: power.primary, secondary: power.secondary,
          hasRoll: !!power.primary,
          hasActivate: (!power.primary && !!power.cost) || needsActivate,
          primaryOptions: traitOpts.map(o => ({ ...o, selected: o.key === power.primary })),
          secondaryOptions: traitOpts.map(o => ({ ...o, selected: o.key === power.secondary })),
        };
      }));
    }

    if (item.type === 'ritual') {
      const loc = k => game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`);
      const traitOpts = [
        ...Object.values(VTM.attributes).flat().map(k => ({ key: `attributes.${k}`, label: loc(k) })),
        ...Object.values(VTM.abilities).flat().map(k => ({ key: `abilities.${k}`, label: loc(k) })),
      ];
      ctx.ritualPrimaryOptions = traitOpts.map(o => ({ ...o, selected: o.key === ctx.system.primary }));
      ctx.ritualSecondaryOptions = traitOpts.map(o => ({ ...o, selected: o.key === ctx.system.secondary }));
      ctx.ritualCastDiff = ctx.system.castDifficulty;
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
    // Dot cap follows the owner's generation; unowned items show the mortal cap
    ctx.traitMax = item.parent?.system?.traitMax || 5;
    return ctx;
  }


  // -- Render & listeners ---------------------------------------------------

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    // Image: click for lightbox, edit button for file picker
    const img = el.querySelector('.sheet-header img');
    if (img) {
      img.addEventListener('click', ev => {
        ev.preventDefault();
        this._openLightbox(this.document.img);
      });
    }
    el.querySelector('.item-img-show')?.addEventListener('click', ev => {
      ev.stopPropagation();
      const src = this.document.img;
      const name = this.document.name;
      game.vtm.openLightbox(src, name);
      game.socket.emit('system.vtm-v20', { action: 'showPortrait', src, name });
    });
    el.querySelector('.item-img-edit')?.addEventListener('click', ev => {
      ev.stopPropagation();
      new FilePicker({
        type: 'image',
        current: this.document.img,
        callback: path => this.document.update({ img: path })
      }).browse();
    });

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

    // Typing the automatic value (or clearing) hands difficulty back to 3 + level
    el.querySelector('.ritual-diff')?.addEventListener('change', ev => {
      const sys = this.document.system;
      const auto = Math.min(3 + (sys.level || 1), 9);
      const v = parseInt(ev.currentTarget.value, 10);
      this.document.update({ 'system.difficulty': (!v || v === auto) ? 0 : Math.min(Math.max(v, 2), 10) });
    });

    el.querySelector('.ritual-roll')?.addEventListener('click', () => {
      const actor = this.document.parent;
      if (!actor) {
        ui.notifications.warn('This ritual must be on a character to roll.');
        return;
      }
      const sys = this.document.system;
      game.vtm.rollDicePool(actor, {
        trait: sys.primary,
        trait2: sys.secondary,
        label: `Ritual: ${this.document.name}`,
        difficulty: sys.castDifficulty,
      });
    });

    el.querySelectorAll('.power-roll').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.level;
        const power = this.document.system.powers[key];
        const actor = this.document.parent;
        if (!actor) {
          ui.notifications.warn('This item must be on a character to roll.');
          return;
        }
        if (power.cost) {
          const ok = await confirmAndSpend(actor, power.cost, power.name || this.document.name);
          if (!ok) return;
          await whisperActivation(actor, `${this.document.name}: ${power.name}`, null, power.cost, false);
        }
        game.vtm.rollDicePool(actor, {
          trait: power.primary,
          trait2: power.secondary,
          label: `${this.document.name}: ${power.name}`,
          difficulty: power.difficulty,
        });
      });
    });

    el.querySelectorAll('.power-activate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.level;
        const power = this.document.system.powers[key];
        const actor = this.document.parent;
        if (!actor) {
          ui.notifications.warn('This item must be on a character to activate.');
          return;
        }

        const disc = this.document.name.toLowerCase();
        const powerKey = `${disc}:${key}`;
        const pName = power.name || this.document.name;
        const markActive = async (d) => {
          const list = actor.getFlag('vtm-v20', 'activeDisciplines') || [];
          if (!list.includes(d)) await actor.setFlag('vtm-v20', 'activeDisciplines', [...list, d]);
        };

        // Shape of the Beast: wolf/bat choice
        if (disc === 'protean' && key === 'lvl4') {
          if (actor.getFlag('vtm-v20', 'wolfForm') || actor.getFlag('vtm-v20', 'batForm')) {
            ui.notifications.warn('Shape of the Beast already active.');
            return;
          }
          const form = await new Promise(resolve => {
            new Dialog({
              title: pName,
              content: '<p style="text-align:center;margin:10px 0">Choose your form:</p>',
              buttons: {
                wolf: { icon: '<i class="fas fa-paw"></i>', label: 'Wolf', callback: () => resolve('wolf') },
                bat: { icon: '<i class="fas fa-crow"></i>', label: 'Bat', callback: () => resolve('bat') },
              },
              close: () => resolve(null),
            }, { classes: ['vtm-v20', 'dialog'], width: 300 }).render(true);
          });
          if (!form) return;
          const ok = await confirmAndSpend(actor, power.cost, pName);
          if (!ok) return;
          if (form === 'wolf') {
            await actor.createEmbeddedDocuments('Item', [{
              name: 'Wolf Bite', type: 'weapon', img: this.document.img,
              system: { damage: 'Str+1', damageType: 'aggravated', equipped: true },
            }]);
            await actor.setFlag('vtm-v20', 'wolfForm', true);
          } else {
            await actor.setFlag('vtm-v20', 'batForm', { strength: actor.system.attributes.strength });
            await actor.update({ 'system.attributes.strength': 1 });
          }
          await markActive('protean');
          await whisperActivation(actor, `${pName} (${form})`, form === 'wolf' ? 'Wolf Bite added, speed doubled, Perception -2 diff.' : 'Strength set to 1, Perception -3 diff.', power.cost);
          return;
        }

        // Skin of the Adder
        if (disc === 'serpentis' && key === 'lvl3') {
          if (actor.getFlag('vtm-v20', 'skinOfTheAdder')) {
            ui.notifications.warn('Skin of the Adder already active.');
            return;
          }
          const ok = await confirmAndSpend(actor, power.cost, pName);
          if (!ok) return;
          const origApp = actor.system.attributes.appearance;
          await actor.setFlag('vtm-v20', 'skinOfTheAdder', { appearance: origApp });
          await actor.update({ 'system.attributes.appearance': 1 });
          await markActive('serpentis');
          await whisperActivation(actor, pName, 'Soak difficulty 5, bite +1 damage, Appearance set to 1.', power.cost);
          return;
        }

        // Horrid Reality
        if (disc === 'chimerstry' && key === 'lvl5') {
          if (actor.getFlag('vtm-v20', 'horridReality')) {
            ui.notifications.warn('Horrid Reality already active.');
            return;
          }
          const ok = await confirmAndSpend(actor, power.cost, pName);
          if (!ok) return;
          await actor.setFlag('vtm-v20', 'horridReality', true);
          await markActive('chimerstry');
          await whisperActivation(actor, pName, 'Horrid Reality Injury attack available.', power.cost);
          return;
        }

        // Shadow Play
        if (disc === 'obtenebration' && key === 'lvl1') {
          if (actor.getFlag('vtm-v20', 'shadowPlay')) {
            ui.notifications.warn('Shadow Play already active.');
            return;
          }
          const ok = await confirmAndSpend(actor, power.cost, pName);
          if (!ok) return;
          await actor.setFlag('vtm-v20', 'shadowPlay', true);
          await markActive('obtenebration');
          await whisperActivation(actor, pName, '+1 ranged difficulty against you, +1 Stealth/Intimidation.', power.cost);
          return;
        }

        // Bonecraft modes
        if (disc === 'vicissitude' && key === 'lvl3') {
          const hasSpikes = actor.items.find(i => i.type === 'weapon' && i.name === 'Bone Spikes');
          const hasQuills = actor.getFlag('vtm-v20', 'boneQuills');
          if (hasSpikes || hasQuills) {
            ui.notifications.warn('Bonecraft already active.');
            return;
          }

          const mode = await new Promise(resolve => {
            new Dialog({
              title: 'Bonecraft',
              content: '<p style="margin:8px 0;color:#ddd;">Choose Bonecraft mode:</p>',
              buttons: {
                spikes: { label: 'Knuckle Spikes', callback: () => resolve('spikes') },
                quills: { label: 'Defensive Quills', callback: () => resolve('quills') },
                rip: { label: 'Offensive Bone Rip', callback: () => resolve('rip') },
              },
              close: () => resolve(null),
            }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
          });
          if (!mode) return;

          const ok = await confirmAndSpend(actor, power.cost, pName);
          if (!ok) return;

          if (mode === 'spikes') {
            await applyHealthDamage(actor, 1, 'lethal');
            await actor.createEmbeddedDocuments('Item', [{
              name: 'Bone Spikes', type: 'weapon', img: this.document.img,
              system: { damage: 'Str+1', damageType: 'lethal', equipped: true },
            }]);
            await markActive(disc);
            await whisperActivation(actor, 'Bonecraft: Knuckle Spikes', 'Str+1 lethal. 1 lethal to self from bone piercing skin.', power.cost);
          } else if (mode === 'quills') {
            const result = await game.vtm.rollDicePool(actor, {
              trait: 'attributes.strength', trait2: 'abilities.medicine',
              label: `${pName}: Defensive Quills`, difficulty: 7,
            });
            if (!result) return;

            if (result.outcome === 'botch') {
              await whisperActivation(actor, 'Bonecraft: Defensive Quills', 'BOTCH: Sent to torpor!', power.cost);
              return;
            }

            const selfDmg = Math.max(5 - result.total, 0);
            if (selfDmg > 0) await applyHealthDamage(actor, selfDmg, 'lethal');
            await actor.setFlag('vtm-v20', 'boneQuills', true);
            await markActive(disc);
            const detail = selfDmg > 0
              ? `${selfDmg} lethal to self. Melee attackers take their Str in lethal (unless 3+ hit successes). +2 grapple damage.`
              : 'No self-damage. Melee attackers take their Str in lethal (unless 3+ hit successes). +2 grapple damage.';
            await whisperActivation(actor, 'Bonecraft: Defensive Quills', detail, power.cost);
          } else {
            const result = await game.vtm.rollDicePool(actor, {
              trait: 'attributes.strength', trait2: 'abilities.medicine',
              label: `${pName}: Offensive Bone Rip`, difficulty: 7,
            });
            if (!result) return;

            if (result.outcome === 'botch') {
              await whisperActivation(actor, 'Bonecraft: Offensive Bone Rip', 'BOTCH: The attempt fails.', power.cost);
              return;
            }
            const dmg = result.total;
            let detail = dmg > 0 ? `${dmg} lethal damage to target.` : 'No damage.';
            if (dmg >= 5) detail += ' 5+ successes: can collapse rib cage (target vampire loses half blood).';
            await whisperActivation(actor, 'Bonecraft: Offensive Bone Rip', detail, power.cost);
          }
          return;
        }

        // Weapon-creating powers
        const weaponTable = {
          'protean:lvl2': { name: 'Feral Claws', damage: 'Str+1', damageType: 'aggravated', img: 'systems/vtm-v20/VTM icons/claw-slashes.svg' },
        };
        const weap = weaponTable[powerKey];
        if (weap && actor.items.find(i => i.type === 'weapon' && i.name === weap.name)) {
          ui.notifications.warn(`${weap.name} already active.`);
          return;
        }

        // Horrid Form
        const isHorridForm = disc === 'vicissitude' && key === 'lvl4';
        if (isHorridForm && actor.getFlag('vtm-v20', 'horridForm')) {
          ui.notifications.warn('Horrid Form is already active.');
          return;
        }

        const ok = await confirmAndSpend(actor, power.cost, pName);
        if (!ok) return;

        if (weap) {
          await actor.createEmbeddedDocuments('Item', [{
            name: weap.name, type: 'weapon', img: weap.img || this.document.img,
            system: { damage: weap.damage, damageType: weap.damageType, equipped: true },
          }]);
          await markActive(disc);
          await whisperActivation(actor, weap.name, `${weap.damage} ${weap.damageType} damage.`, power.cost);
          return;
        }

        if (isHorridForm) {
          const a = actor.system.attributes;
          await actor.setFlag('vtm-v20', 'horridForm', {
            strength: a.strength, dexterity: a.dexterity, stamina: a.stamina,
            charisma: a.charisma, manipulation: a.manipulation, appearance: a.appearance,
          });
          await actor.update({
            'system.attributes.strength': Math.min(a.strength + 3, 10),
            'system.attributes.dexterity': Math.min(a.dexterity + 3, 10),
            'system.attributes.stamina': Math.min(a.stamina + 3, 10),
            'system.attributes.charisma': 0, 'system.attributes.manipulation': 0, 'system.attributes.appearance': 0,
          });
          await markActive('vicissitude');
          await whisperActivation(actor, pName, 'Physical +3, Social set to 0, +1 brawl damage.', power.cost);
          return;
        }

        await whisperActivation(actor, pName, null, power.cost);
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
