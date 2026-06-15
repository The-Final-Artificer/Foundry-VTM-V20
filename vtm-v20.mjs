import { VTM } from './module/config.mjs';
import { VampireData } from './module/vampire-data.mjs';
import { MortalData } from './module/mortal-data.mjs';
import { DisciplineData, BackgroundData, MeritData, WeaponData, ArmorData, EquipmentData, ContainerData } from './module/item-data.mjs';
import { VampireSheet } from './module/vampire-sheet.mjs';
import { VtmItemSheet } from './module/item-sheet.mjs';
import { rollDicePool } from './module/dice.mjs';
import { rollAttack, bindCombatButtons, bindCombatSocketHandlers } from './module/combat.mjs';
import { registerInitiativeHooks, bindInitiativeSocketHandlers, renderInitiativeTracker } from './module/initiative.mjs';
import { populateCompendiums, registerCompendiumSettings } from './module/compendiums.mjs';
import { ChargenWizard } from './module/chargen.mjs';
import {
  BLINDED_STATUS_ID,
  DAZED_STATUS_ID,
  INCAPACITATED_STATUS_ID,
  FULL_IMMOBILIZED_STATUS_ID,
  STRUGGLING_IMMOBILIZED_STATUS_ID,
  iterableValues,
} from './module/status-effects.mjs';

const COVER_STATUS_EFFECTS = [
  {
    id: 'vtm-cover-light',
    name: 'Light Cover',
    label: 'Light Cover',
    icon: 'systems/vtm-v20/VTM icons/cover-light.svg',
    origin: 'status',
    statuses: ['vtm-cover-light'],
  },
  {
    id: 'vtm-cover-good',
    name: 'Good Cover',
    label: 'Good Cover',
    icon: 'systems/vtm-v20/VTM icons/cover-good.svg',
    origin: 'status',
    statuses: ['vtm-cover-good'],
  },
  {
    id: 'vtm-cover-superior',
    name: 'Superior Cover',
    label: 'Superior Cover',
    icon: 'systems/vtm-v20/VTM icons/cover-superior.svg',
    origin: 'status',
    statuses: ['vtm-cover-superior'],
  },
];

const OTHER_STATUS_EFFECTS = [
  {
    id: BLINDED_STATUS_ID,
    name: 'Blinded',
    label: 'Blinded',
    icon: 'systems/vtm-v20/VTM icons/blinded.svg',
    img: 'systems/vtm-v20/VTM icons/blinded.svg',
    origin: 'status',
    statuses: [BLINDED_STATUS_ID],
  },
  {
    id: DAZED_STATUS_ID,
    name: 'Dazed',
    label: 'Dazed',
    icon: 'systems/vtm-v20/VTM icons/star-swirl.svg',
    img: 'systems/vtm-v20/VTM icons/star-swirl.svg',
    origin: 'status',
    statuses: [DAZED_STATUS_ID],
  },
  {
    id: INCAPACITATED_STATUS_ID,
    name: 'Incapacitated',
    label: 'Incapacitated',
    icon: 'systems/vtm-v20/VTM icons/incapacitated.svg',
    img: 'systems/vtm-v20/VTM icons/incapacitated.svg',
    origin: 'status',
    statuses: [INCAPACITATED_STATUS_ID],
  },
  {
    id: STRUGGLING_IMMOBILIZED_STATUS_ID,
    name: 'Struggling Immobilization',
    label: 'Struggling Immobilization',
    icon: 'systems/vtm-v20/VTM icons/nailed-foot.svg',
    img: 'systems/vtm-v20/VTM icons/nailed-foot.svg',
    origin: 'status',
    statuses: [STRUGGLING_IMMOBILIZED_STATUS_ID],
  },
  {
    id: FULL_IMMOBILIZED_STATUS_ID,
    name: 'Full Immobilization',
    label: 'Full Immobilization',
    icon: 'systems/vtm-v20/VTM icons/heart-stake.svg',
    img: 'systems/vtm-v20/VTM icons/heart-stake.svg',
    origin: 'status',
    statuses: [FULL_IMMOBILIZED_STATUS_ID],
  },
];

const COVER_STATUS_IDS = new Set(COVER_STATUS_EFFECTS.map(effect => effect.id));
const IMMOBILIZATION_STATUS_IDS = new Set([STRUGGLING_IMMOBILIZED_STATUS_ID, FULL_IMMOBILIZED_STATUS_ID]);

function registerCoverStatusEffects() {
  CONFIG.statusEffects = foundry.utils.deepClone([...COVER_STATUS_EFFECTS, ...OTHER_STATUS_EFFECTS]);
}

function coverStatusesForEffect(effect) {
  const statuses = new Set();
  for (const status of iterableValues(effect?.statuses)) {
    if (COVER_STATUS_IDS.has(status)) statuses.add(status);
  }

  const coreStatus = effect?.getFlag?.('core', 'statusId')
    ?? effect?.flags?.core?.statusId
    ?? effect?.statusId;
  if (COVER_STATUS_IDS.has(coreStatus)) statuses.add(coreStatus);

  return statuses;
}

function immobilizationStatusesForEffect(effect) {
  const statuses = new Set();
  for (const status of iterableValues(effect?.statuses)) {
    if (IMMOBILIZATION_STATUS_IDS.has(status)) statuses.add(status);
  }

  const coreStatus = effect?.getFlag?.('core', 'statusId')
    ?? effect?.flags?.core?.statusId
    ?? effect?.statusId;
  if (IMMOBILIZATION_STATUS_IDS.has(coreStatus)) statuses.add(coreStatus);

  return statuses;
}

function shouldEnforceCoverExclusivity(parent) {
  const activeGms = game.users?.filter(user => user.active && user.isGM) ?? [];
  if (activeGms.length) return game.user.id === activeGms[0].id;
  return parent?.isOwner || game.user.isGM;
}

async function enforceExclusiveCoverStatus(effect) {
  const activeCover = coverStatusesForEffect(effect);
  if (!activeCover.size) return;

  const parent = effect.parent;
  if (!parent?.effects || !shouldEnforceCoverExclusivity(parent)) return;

  const toDelete = [];
  for (const other of iterableValues(parent.effects)) {
    if (other.id === effect.id) continue;
    const otherCover = coverStatusesForEffect(other);
    if (otherCover.size) toDelete.push(other.id);
  }

  if (toDelete.length) await parent.deleteEmbeddedDocuments('ActiveEffect', toDelete);
}

async function enforceExclusiveImmobilizationStatus(effect) {
  const activeImmobilization = immobilizationStatusesForEffect(effect);
  if (!activeImmobilization.size) return;

  const parent = effect.parent;
  if (!parent?.effects || !shouldEnforceCoverExclusivity(parent)) return;

  const toDelete = [];
  for (const other of iterableValues(parent.effects)) {
    if (other.id === effect.id) continue;
    const otherImmobilization = immobilizationStatusesForEffect(other);
    if (otherImmobilization.size) toDelete.push(other.id);
  }

  if (toDelete.length) await parent.deleteEmbeddedDocuments('ActiveEffect', toDelete);
}

function openLightbox(src, title) {
  if (document.querySelector('.vtm-lightbox')) return; // one at a time
  const overlay = document.createElement('div');
  overlay.classList.add('vtm-lightbox');

  const pic = document.createElement('img');
  pic.src = src;
  if (title) pic.alt = title;
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
    pic.style.transform = 'scale(0.3)';
    overlay.classList.remove('active');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  });
}

Hooks.once('init', () => {
  console.log('VtM V20 | Initializing');

  game.vtm = { rollDicePool, rollAttack, ChargenWizard, openLightbox };
  CONFIG.VTM = VTM;
  registerInitiativeHooks();
  registerCoverStatusEffects();

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
  Handlebars.registerHelper('math', (a, op, b) => {
    a = Number(a); b = Number(b);
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return a / b;
    return a;
  });

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
  bindCombatSocketHandlers();
  bindInitiativeSocketHandlers();

  // GM-side handler for cross-permission operations (e.g. player marking an attack message resolved)
  game.socket.on('system.vtm-v20', async ({ action, msgId }) => {
    if (!game.user.isGM) return;
    if (action === 'resolveMsg') {
      const msg = game.messages.get(msgId);
      if (msg) await msg.update({ 'flags.vtm-v20.combat.resolved': true });
    }
  });

  // Show portrait to all players when GM broadcasts it
  game.socket.on('system.vtm-v20', ({ action, src, name }) => {
    if (action === 'showPortrait') openLightbox(src, name);
  });
});

// When a combat encounter ends, clear all combat UI on every combatant's sheet.
// Actor sheets are singletons: the instance persists even when the window is closed.
// We need to reach those closed sheets too, not just the ones currently rendered.
Hooks.on('deleteCombat', (combat) => {
  const sheets = new Set();

  // Grab every combatant's sheet (covers closed windows)
  for (const c of combat.combatants) {
    const s = c.actor?.sheet;
    if (s instanceof VampireSheet) sheets.add(s);
  }

  // Also sweep rendered sheets in case they weren't combatants
  const apps = foundry.applications?.instances;
  if (apps) {
    for (const app of apps.values()) {
      if (app instanceof VampireSheet && (app._declCombat || app._resCombat)) {
        sheets.add(app);
      }
    }
  }

  for (const sheet of sheets) {
    sheet._declCombat = null;
    sheet._declCombatant = null;
    sheet._declActions = [];
    sheet._declFullDefense = false;
    sheet._declCapturing = false;
    sheet._resCombat = null;
    sheet._resCombatant = null;
    sheet._resExecuted = new Set();
    sheet._resSpent = new Map();
    sheet._resDefenseSpent = new Map();
    sheet._resFullDefCount = 0;
    sheet._resTurnDone = false;
    if (sheet.rendered) sheet.render();
  }
  game.vtm._captureAction = null;

  // Clear discipline activations when combat ends
  for (const c of combat.combatants) {
    const active = c.actor?.getFlag('vtm-v20', 'activeDisciplines');
    if (active?.length) c.actor.unsetFlag('vtm-v20', 'activeDisciplines');
  }
});

// When the active resolver or declarer changes, re-render all combat sheets
// so "Not your turn" buttons update correctly
Hooks.on('updateCombat', (combat, changes) => {
  const vtmFlags = changes?.flags?.['vtm-v20'];
  if (!vtmFlags?.currentResolver && !vtmFlags?.currentDeclarer) return;
  const apps = foundry.applications?.instances;
  if (!apps) return;
  for (const app of apps.values()) {
    if (!(app instanceof VampireSheet)) continue;
    if (app._resCombat || app._declCombat) app.render();
  }
});

Hooks.on('createActiveEffect', effect => {
  enforceExclusiveCoverStatus(effect);
  enforceExclusiveImmobilizationStatus(effect);
});

Hooks.on('updateActiveEffect', effect => {
  enforceExclusiveCoverStatus(effect);
  enforceExclusiveImmobilizationStatus(effect);
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

Hooks.on('renderCombatTracker', (app, html) => renderInitiativeTracker(app, html));

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
