import { VTM } from './module/config.mjs';
import { VampireData } from './module/vampire-data.mjs';
import { MortalData } from './module/mortal-data.mjs';
import { DisciplineData, BackgroundData, MeritData, WeaponData, ArmorData, EquipmentData, ContainerData } from './module/item-data.mjs';
import { VampireSheet } from './module/vampire-sheet.mjs';
import { VtmItemSheet } from './module/item-sheet.mjs';
import { rollDicePool } from './module/dice.mjs';
import { rollAttack, bindCombatButtons } from './module/combat.mjs';
import { populateCompendiums, registerCompendiumSettings } from './module/compendiums.mjs';
import { ChargenWizard } from './module/chargen.mjs';

Hooks.once('init', () => {
  console.log('VtM V20 | Initializing');

  game.vtm = { rollDicePool, rollAttack, ChargenWizard };
  CONFIG.VTM = VTM;

  CONFIG.Actor.dataModels.vampire = VampireData;
  CONFIG.Actor.dataModels.mortal = MortalData;
  CONFIG.Item.dataModels.discipline = DisciplineData;
  CONFIG.Item.dataModels.background = BackgroundData;
  CONFIG.Item.dataModels.merit = MeritData;
  CONFIG.Item.dataModels.weapon = WeaponData;
  CONFIG.Item.dataModels.armor = ArmorData;
  CONFIG.Item.dataModels.equipment = EquipmentData;
  CONFIG.Item.dataModels.container = ContainerData;

  Actors.registerSheet('vtm-v20', VampireSheet, {
    types: ['vampire', 'mortal'],
    makeDefault: true,
    label: 'VTM.SheetVampire'
  });

  Items.registerSheet('vtm-v20', VtmItemSheet, {
    makeDefault: true,
    label: 'VTM.SheetItem'
  });

  registerCompendiumSettings();

  game.settings.register('vtm-v20', 'moneyAnimation', {
    name: 'Money Change Animation',
    hint: 'Show a floating icon and play a sound when money is changed.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  Handlebars.registerHelper('vtmDots', (value, max) => {
    let html = '';
    for (let i = 1; i <= max; i++) {
      html += `<span class="dot ${i <= value ? 'filled' : 'empty'}" data-value="${i}"></span>`;
    }
    return new Handlebars.SafeString(html);
  });

  Handlebars.registerHelper('vtmSquares', (value, max) => {
    let html = '';
    for (let i = 1; i <= max; i++) {
      html += `<span class="square ${i <= value ? 'filled' : 'empty'}" data-value="${i}"></span>`;
    }
    return new Handlebars.SafeString(html);
  });

  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('abs', v => Math.abs(v));

  loadTemplates([
    'systems/vtm-v20/templates/vampire-sheet.hbs',
    'systems/vtm-v20/templates/item-sheet.hbs',
    'systems/vtm-v20/templates/roll-dialog.hbs',
    'systems/vtm-v20/templates/roll-result.hbs',
    'systems/vtm-v20/templates/combat-card.hbs',
    'systems/vtm-v20/templates/damage-card.hbs',
    'systems/vtm-v20/templates/falling-card.hbs',
    'systems/vtm-v20/templates/chargen.hbs',
  ]);
});

Hooks.once('ready', () => {
  populateCompendiums();

  // GM-side handler for cross-permission operations (e.g. player marking an attack message resolved)
  game.socket.on('system.vtm-v20', async ({ action, msgId }) => {
    if (!game.user.isGM) return;
    if (action === 'resolveMsg') {
      const msg = game.messages.get(msgId);
      if (msg) await msg.update({ 'flags.vtm-v20.combat.resolved': true });
    }
  });
});

// Dark Pack agreement notice in the settings sidebar
Hooks.on('renderSettings', (app, html) => {
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el || el.querySelector('.dark-pack-notice')) return;
  const notice = document.createElement('div');
  notice.className = 'dark-pack-notice';
  notice.innerHTML = `
    <h2>Licensed Dark Pack Agreement</h2>
    <p>Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit <a href="https://www.worldofdarkness.com" target="_blank">worldofdarkness.com</a>.</p>
    <p class="dark-pack-unofficial">This is not official World of Darkness material.</p>
    <img src="systems/vtm-v20/VTM icons/darkpack_logo2.webp" alt="Dark Pack" />
  `;
  el.appendChild(notice);
});

Hooks.on('renderChatMessage', (msg, html) => bindCombatButtons(msg, html));

// Wire the "Catch a Ledge" button on a failed jump card
Hooks.on('renderChatMessage', (msg, html) => {
  const el = html instanceof HTMLElement ? html : html[0];
  const btn = el?.querySelector('.jump-ledge-btn');
  if (!btn) return;

  const uuid = msg.flags?.['vtm-v20']?.jump?.actorUuid;
  const actor = uuid ? fromUuidSync(uuid) : null;
  if (!actor || (!actor.isOwner && !game.user.isGM) || typeof actor.sheet?._rollLedgeCatch !== 'function') {
    btn.remove();
    return;
  }

  btn.addEventListener('click', () => {
    btn.disabled = true;
    actor.sheet._rollLedgeCatch();
  });
});

// Wire the "Soak" button on a falling damage card
Hooks.on('renderChatMessage', (msg, html) => {
  const el = html instanceof HTMLElement ? html : html[0];
  const btn = el?.querySelector('.fall-soak-btn');
  if (!btn) return;

  const f = msg.flags?.['vtm-v20']?.fall;
  if (!f) { btn.remove(); return; }
  if (f.resolved) { btn.remove(); return; }

  const actor = fromUuidSync(f.actorUuid);
  if (!actor || (!actor.isOwner && !game.user.isGM)) { btn.remove(); return; }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Soaking...';
    if (msg.isAuthor || game.user.isGM) {
      await msg.update({ 'flags.vtm-v20.fall.resolved': true });
    } else {
      game.socket.emit('system.vtm-v20', { action: 'resolveMsg', msgId: msg.id });
    }
    actor.sheet?._rollFallingSoak(f);
  });
});

// Block equipping weapons the character can't wield
Hooks.on('preUpdateItem', (item, changes, options, userId) => {
  if (item.type !== 'weapon') return true;
  if (!changes.system || changes.system.equipped !== true) return true;
  if (item.system.equipped) return true; // already equipped, this is something else
  const actor = item.parent;
  if (!actor) return true;
  const req = item.system.requireTrait;
  const min = item.system.requireMin;
  if (!req || min <= 0) return true;
  const [cat, key] = req.split('.');
  const val = (cat === 'attributes' ? actor.system.attributes?.[key] : actor.system.abilities?.[key]) || 0;
  if (val < min) {
    const name = game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`);
    ui.notifications.warn(`${actor.name} needs ${name} ${min} to wield ${item.name} (current: ${val}).`);
    return false;
  }
});

// Money change animation + SFX
Hooks.on('updateActor', (actor, changes) => {
  if (!game.settings.get('vtm-v20', 'moneyAnimation')) return;

  // changes can be nested OR flat dot-notation depending on Foundry internals
  const nested = changes.system?.money !== undefined;
  const flat = ('system.money.dollars' in changes) || ('system.money.cents' in changes);
  if (!nested && !flat) return;

  const sheet = actor.sheet;
  if (!sheet?._playMoneyAnimation) return;

  // Delay so the sheet finishes its re-render before we touch the DOM
  setTimeout(() => {
    if (!sheet.rendered) return;
    sheet._playMoneyAnimation();
    foundry.audio.AudioHelper.play({
      src: 'systems/vtm-v20/VTM icons/Money SFX.mp3', volume: 0.5, loop: false
    }, false);
  }, 300);
});

// Inject folder descriptions into compendium browsers
Hooks.on('renderCompendium', (app, html) => {
  const pack = app.collection;
  if (!pack.collection.startsWith('vtm-v20.')) return;
  if (!pack.folders.size) return;

  const el = html instanceof HTMLElement ? html : html[0];
  el.classList.add('vtm-compendium');

  const descs = new Map();
  for (const f of pack.folders.contents) {
    if (f.description) descs.set(f.id, f.description);
  }
  if (!descs.size) return;

  el.querySelectorAll('[data-folder-id]').forEach(li => {
    const id = li.dataset.folderId;
    li.classList.add('vtm-folder');
    const desc = descs.get(id);
    if (!desc) return;
    const sub = li.querySelector('.subdirectory');
    if (!sub || sub.querySelector('.vtm-folder-description')) return;
    const div = document.createElement('div');
    div.className = 'vtm-folder-description';
    div.innerHTML = desc;
    sub.prepend(div);
  });
});
