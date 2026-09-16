import { VTM } from './module/config.mjs';
import { VampireData } from './module/vampire-data.mjs';
import { MortalData } from './module/mortal-data.mjs';
import { DisciplineData, BackgroundData, MeritData, WeaponData, ArmorData, EquipmentData, ContainerData, PathData, RitualData } from './module/item-data.mjs';
import { VampireSheet } from './module/vampire-sheet.mjs';
import { VtmItemSheet } from './module/item-sheet.mjs';
import { rollDicePool } from './module/dice.mjs';
import { rollAttack, bindCombatButtons, bindCombatSocketHandlers, clearClinchForActor, clearHoldForActor } from './module/combat.mjs';
import { registerInitiativeHooks, bindInitiativeSocketHandlers, renderInitiativeTracker } from './module/initiative.mjs';
import { populateCompendiums, registerCompendiumSettings, WEAPONS } from './module/compendiums.mjs';
import { registerAuthenticSettings } from './module/authentic-store.mjs';
import { AuthenticTextManager } from './module/authentic-manager.mjs';
import { ChargenWizard } from './module/chargen.mjs';
import {
  BLINDED_STATUS_ID,
  CLINCHED_STATUS_ID,
  DAZED_STATUS_ID,
  PRONE_STATUS_ID,
  KNOCKDOWN_STATUS_ID,
  INCAPACITATED_STATUS_ID,
  FULL_IMMOBILIZED_STATUS_ID,
  STRUGGLING_IMMOBILIZED_STATUS_ID,
  FRENZY_STATUS_ID,
  ROTSCHRECK_STATUS_ID,
  iterableValues,
} from './module/status-effects.mjs';

const COVER_STATUS_EFFECTS = [
  {
    id: 'vtm-cover-light',
    name: 'Light Cover',
    label: 'Light Cover',
    icon: 'systems/vtm-v20/VTM icons/rank-1.svg',
    img: 'systems/vtm-v20/VTM icons/rank-1.svg',
    origin: 'status',
    statuses: ['vtm-cover-light'],
  },
  {
    id: 'vtm-cover-good',
    name: 'Good Cover',
    label: 'Good Cover',
    icon: 'systems/vtm-v20/VTM icons/rank-2.svg',
    img: 'systems/vtm-v20/VTM icons/rank-2.svg',
    origin: 'status',
    statuses: ['vtm-cover-good'],
  },
  {
    id: 'vtm-cover-superior',
    name: 'Superior Cover',
    label: 'Superior Cover',
    icon: 'systems/vtm-v20/VTM icons/rank-3.svg',
    img: 'systems/vtm-v20/VTM icons/rank-3.svg',
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
  {
    id: CLINCHED_STATUS_ID,
    name: 'Clinched',
    label: 'Clinched',
    icon: 'systems/vtm-v20/VTM icons/grab-status.svg',
    img: 'systems/vtm-v20/VTM icons/grab-status.svg',
    origin: 'status',
    statuses: [CLINCHED_STATUS_ID],
  },
  {
    id: PRONE_STATUS_ID,
    name: 'Prone',
    label: 'Prone',
    icon: 'systems/vtm-v20/VTM icons/prone.svg',
    img: 'systems/vtm-v20/VTM icons/prone.svg',
    origin: 'status',
    statuses: [PRONE_STATUS_ID],
  },
  {
    id: KNOCKDOWN_STATUS_ID,
    name: 'Knockdown',
    label: 'Knockdown',
    icon: 'systems/vtm-v20/VTM icons/falling-status.svg',
    img: 'systems/vtm-v20/VTM icons/falling-status.svg',
    origin: 'status',
    statuses: [KNOCKDOWN_STATUS_ID],
  },
  {
    id: FRENZY_STATUS_ID,
    name: 'Frenzy',
    label: 'Frenzy',
    icon: 'systems/vtm-v20/VTM icons/frenzy-status.svg',
    img: 'systems/vtm-v20/VTM icons/frenzy-status.svg',
    origin: 'status',
    statuses: [FRENZY_STATUS_ID],
  },
  {
    id: ROTSCHRECK_STATUS_ID,
    name: 'R\u00f6tschreck',
    label: 'R\u00f6tschreck',
    icon: 'systems/vtm-v20/VTM icons/rotschreck-status.svg',
    img: 'systems/vtm-v20/VTM icons/rotschreck-status.svg',
    origin: 'status',
    statuses: [ROTSCHRECK_STATUS_ID],
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

  CONFIG.Combat.fallbackTurnMarker = 'systems/vtm-v20/VTM icons/VTM Turn Marker.png';

  CONFIG.Actor.dataModels.vampire = VampireData;
  CONFIG.Actor.dataModels.mortal = MortalData;
  CONFIG.Item.dataModels.discipline = DisciplineData;
  CONFIG.Item.dataModels.background = BackgroundData;
  CONFIG.Item.dataModels.merit = MeritData;
  CONFIG.Item.dataModels.weapon = WeaponData;
  CONFIG.Item.dataModels.armor = ArmorData;
  CONFIG.Item.dataModels.equipment = EquipmentData;
  CONFIG.Item.dataModels.container = ContainerData;
  CONFIG.Item.dataModels.path = PathData;
  CONFIG.Item.dataModels.ritual = RitualData;

  CONFIG.Actor.trackableAttributes = {
    vampire: {
      bar: ['blood', 'willpower', 'health', 'movement.current'],
      value: ['movement.jog', 'movement.run', 'movement.walk', 'humanity'],
    },
    mortal: {
      bar: ['willpower', 'health', 'movement.current'],
      value: ['movement.jog', 'movement.run', 'movement.walk', 'humanity'],
    },
  };

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
  registerAuthenticSettings();

  game.settings.registerMenu('vtm-v20', 'authenticTextMenu', {
    name: 'Authentic Text',
    label: 'Open Authentic Text Manager',
    hint: 'Own the book? Paste its text here to replace the shipped descriptions with the originals, locally in this world.',
    icon: 'fas fa-book-open',
    type: AuthenticTextManager,
    restricted: true,
  });

  game.settings.register('vtm-v20', 'moneyAnimation', {
    name: 'Money Change Animation',
    hint: 'Show a floating icon and play a sound when money is changed.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('vtm-v20', 'declarationTimer', {
    name: 'Declaration Timer',
    hint: 'Show a countdown timer during the declaration phase. When time runs out, the turn is automatically skipped.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register('vtm-v20', 'declarationTimerSeconds', {
    name: 'Declaration Timer (seconds)',
    hint: 'How many seconds each player has to declare their actions.',
    scope: 'world',
    config: true,
    type: Number,
    default: 35,
    range: { min: 5, max: 120, step: 1 },
  });

  game.settings.register('vtm-v20', 'movementBarMigrated', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register('vtm-v20', 'fireModesMigrated', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register('vtm-v20', 'weaponHandsMigrated', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register('vtm-v20', 'firearmFlagMigrated', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
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

  Handlebars.registerHelper('join', (arr, sep) => {
    if (!Array.isArray(arr)) return '';
    return arr.map(v => typeof v === 'object' ? v.name : v).join(sep);
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
    'systems/vtm-v20/templates/resisted-card.hbs',
    'systems/vtm-v20/templates/falling-card.hbs',
    'systems/vtm-v20/templates/chargen.hbs',
  ]);
});

Hooks.once('ready', () => {
  populateCompendiums();
  bindCombatSocketHandlers();
  bindInitiativeSocketHandlers();

  // One-time: token bars bound to blood switch to the movement rate
  if (game.user.isGM && !game.settings.get('vtm-v20', 'movementBarMigrated')) {
    (async () => {
      for (const actor of game.actors) {
        if (!['vampire', 'mortal'].includes(actor.type)) continue;
        if (actor.prototypeToken?.bar2?.attribute === 'blood') {
          await actor.update({ 'prototypeToken.bar2.attribute': 'movement.current' });
        }
      }
      for (const scene of game.scenes) {
        const updates = scene.tokens
          .filter(t => ['vampire', 'mortal'].includes(t.actor?.type) && t.bar2?.attribute === 'blood')
          .map(t => ({ _id: t.id, 'bar2.attribute': 'movement.current' }));
        if (updates.length) await scene.updateEmbeddedDocuments('Token', updates);
      }
      await game.settings.set('vtm-v20', 'movementBarMigrated', true);
      console.log('VtM V20 | Token bars migrated: blood -> movement.current');
    })();
  }

  // One-time: the research pass over the gun list moved the burst stars around
  // and added full-auto flags. Weapons already sitting in the world or on
  // actors keep their old data, so sync any that still match a book gun by name.
  if (game.user.isGM && !game.settings.get('vtm-v20', 'fireModesMigrated')) {
    (async () => {
      const source = new Map(WEAPONS.filter(w => w.system?.rate !== undefined).map(w => [w.name, w.system]));
      const patchFor = item => {
        const src = source.get(item.name);
        if (!src) return null;
        const upd = {};
        if ((src.rate || '') !== (item.system.rate || '')) upd['system.rate'] = src.rate || '';
        if ((src.fullAuto || '') !== (item.system.fullAuto || '')) upd['system.fullAuto'] = src.fullAuto || '';
        if (src.description && item.system.description !== src.description) upd['system.description'] = src.description;
        return Object.keys(upd).length ? upd : null;
      };
      let count = 0;
      for (const item of game.items) {
        if (item.type !== 'weapon') continue;
        const upd = patchFor(item);
        if (upd) { await item.update(upd); count++; }
      }
      for (const actor of game.actors) {
        const updates = [];
        for (const item of actor.items) {
          if (item.type !== 'weapon') continue;
          const upd = patchFor(item);
          if (upd) updates.push({ _id: item.id, ...upd });
        }
        if (updates.length) { await actor.updateEmbeddedDocuments('Item', updates); count += updates.length; }
      }
      await game.settings.set('vtm-v20', 'fireModesMigrated', true);
      console.log(`VtM V20 | Fire mode data migrated on ${count} weapons`);
    })();
  }

  // One-time: hand counts landed on the gun list; long guns and two-handed
  // melee in the world need their 2 set, everything else defaults to 1.
  if (game.user.isGM && !game.settings.get('vtm-v20', 'weaponHandsMigrated')) {
    (async () => {
      const source = new Map(WEAPONS.map(w => [w.name, w.system]));
      const handsFor = item => {
        const src = source.get(item.name);
        if (!src) return null;
        const target = Number(src.hands) || 1;
        return target !== (Number(item.system.hands) || 1) ? target : null;
      };
      let count = 0;
      for (const item of game.items) {
        if (item.type !== 'weapon') continue;
        const h = handsFor(item);
        if (h) { await item.update({ 'system.hands': h }); count++; }
      }
      for (const actor of game.actors) {
        const updates = [];
        for (const item of actor.items) {
          if (item.type !== 'weapon') continue;
          const h = handsFor(item);
          if (h) updates.push({ _id: item.id, 'system.hands': h });
        }
        if (updates.length) { await actor.updateEmbeddedDocuments('Item', updates); count += updates.length; }
      }
      await game.settings.set('vtm-v20', 'weaponHandsMigrated', true);
      console.log(`VtM V20 | Weapon hand counts migrated on ${count} weapons`);
    })();
  }

  // One-time: stamp the firearm flag onto guns already in the world so the
  // bullets-are-bashing-to-Kindred rule knows what fires bullets.
  if (game.user.isGM && !game.settings.get('vtm-v20', 'firearmFlagMigrated')) {
    (async () => {
      const source = new Map(WEAPONS.map(w => [w.name, w.system]));
      const flagFor = item => {
        const src = source.get(item.name);
        if (!src) return null;
        return !!src.firearm !== !!item.system.firearm ? !!src.firearm : null;
      };
      let count = 0;
      for (const item of game.items) {
        if (item.type !== 'weapon') continue;
        const v = flagFor(item);
        if (v !== null) { await item.update({ 'system.firearm': v }); count++; }
      }
      for (const actor of game.actors) {
        const updates = [];
        for (const item of actor.items) {
          if (item.type !== 'weapon') continue;
          const v = flagFor(item);
          if (v !== null) updates.push({ _id: item.id, 'system.firearm': v });
        }
        if (updates.length) { await actor.updateEmbeddedDocuments('Item', updates); count += updates.length; }
      }
      await game.settings.set('vtm-v20', 'firearmFlagMigrated', true);
      console.log(`VtM V20 | Firearm flags migrated on ${count} weapons`);
    })();
  }

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

  // Grapples don't outlive the fight
  for (const c of combat.combatants) {
    const a = c.actor;
    if (!a || !shouldEnforceCoverExclusivity(a)) continue;
    if (a.getFlag('vtm-v20', 'clinch')) clearClinchForActor(a);
    if (a.getFlag('vtm-v20', 'held') || a.getFlag('vtm-v20', 'holding')) clearHoldForActor(a);
    if (a.getFlag('vtm-v20', 'multiOpp')) a.unsetFlag('vtm-v20', 'multiOpp');
    if (a.getFlag('vtm-v20', 'nextRoundInitPenalty')) a.unsetFlag('vtm-v20', 'nextRoundInitPenalty');
    if (a.getFlag('vtm-v20', 'unbalancedRound')) a.unsetFlag('vtm-v20', 'unbalancedRound');
    if (a.getFlag('vtm-v20', 'frenzyResist')) a.unsetFlag('vtm-v20', 'frenzyResist');
    if (a.getFlag('vtm-v20', 'rotschreckResist')) a.unsetFlag('vtm-v20', 'rotschreckResist');
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

// Removing a grapple status by hand releases the partner as well
Hooks.on('deleteActiveEffect', effect => {
  const statuses = effect.statuses;
  if (!statuses?.has) return;
  const actor = effect.parent;
  if (!actor?.getFlag) return;
  if (statuses.has(CLINCHED_STATUS_ID) && actor.getFlag('vtm-v20', 'clinch')) {
    if (shouldEnforceCoverExclusivity(actor)) clearClinchForActor(actor);
    return;
  }
  if (statuses.has(STRUGGLING_IMMOBILIZED_STATUS_ID) && actor.getFlag('vtm-v20', 'held')) {
    if (shouldEnforceCoverExclusivity(actor)) clearHoldForActor(actor);
  }
  if (statuses.has(FRENZY_STATUS_ID) && actor.getFlag('vtm-v20', 'frenzyDiff') !== undefined) {
    if (shouldEnforceCoverExclusivity(actor)) actor.unsetFlag('vtm-v20', 'frenzyDiff');
  }
});

Hooks.on('renderCombatTracker', (app, html) => renderInitiativeTracker(app, html));

// Movement bars show both paces (jog / run) instead of an editable number
Hooks.on('renderTokenHUD', (hud, html) => {
  const el = html instanceof HTMLElement ? html : html[0];
  const doc = hud.object?.document;
  const move = doc?.actor?.system?.movement;
  if (!el || !move) return;
  for (const bar of ['bar1', 'bar2']) {
    if (doc[bar]?.attribute !== 'movement.current') continue;
    const input = el.querySelector(`.attribute.${bar} input`);
    if (!input) continue;
    input.type = 'text';
    input.value = `${move.current.value} / ${move.curValue}`;
    input.readOnly = true;
  }
});

Hooks.on('renderChatMessageHTML', (msg, html) => bindCombatButtons(msg, html));

// Wire the "Catch a Ledge" button on a failed jump card
Hooks.on('renderChatMessageHTML', (msg, html) => {
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
Hooks.on('renderChatMessageHTML', (msg, html) => {
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
  if (!changes.system) return true;
  if (changes.system.equipped === false) {
    changes.system.offHand = false;
    return true;
  }
  if (changes.system.equipped !== true) return true;
  if (item.system.equipped) return true; // already equipped, this is something else
  const actor = item.parent;
  if (!actor) return true;

  // Two hands total: a rifle fills both, a pistol takes one
  const hands = Number(changes.system.hands ?? item.system.hands) || 1;
  const inUse = actor.items
    .filter(i => i.type === 'weapon' && i.system.equipped && i.id !== item.id)
    .reduce((s, i) => s + (Number(i.system.hands) || 1), 0);
  if (inUse + hands > 2) {
    ui.notifications.warn(`${actor.name} has no free hand for ${item.name} (${inUse}/2 hands in use).`);
    return false;
  }

  // Second one-handed weapon drawn goes to the off hand. An explicit choice
  // (Enhanced Inventory dropping into a specific hand slot) is respected.
  if (hands === 2) {
    changes.system.offHand = false;
  } else if (changes.system.offHand === undefined) {
    changes.system.offHand = actor.items.some(i =>
      i.type === 'weapon' && i.system.equipped && i.id !== item.id
      && (Number(i.system.hands) || 1) === 1 && !i.system.offHand);
  }

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

// Losing the main-hand weapon promotes the off-hand one
Hooks.on('updateItem', async (item, changes, options, userId) => {
  if (userId !== game.user.id) return;
  if (item.type !== 'weapon' || !item.parent) return;
  if (foundry.utils.getProperty(changes, 'system.equipped') !== false) return;
  const weapons = item.parent.items.filter(i => i.type === 'weapon' && i.system.equipped);
  const off = weapons.find(i => i.system.offHand);
  if (off && !weapons.some(i => !i.system.offHand)) await off.update({ 'system.offHand': false });
});

// Willpower spend chat notification
Hooks.on('preUpdateActor', (actor, changes, options, userId) => {
  if (userId !== game.user.id) return;
  const newWp = foundry.utils.getProperty(changes, 'system.willpower.value');
  if (newWp === undefined) return;
  const oldWp = actor.system.willpower.value;
  if (newWp >= oldWp) return;
  const spent = oldWp - newWp;
  const max = actor.system.willpower.max;

  const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
  const pScale = pFlags.scale ?? 1;
  const pOffX = pFlags.offX ?? 0;
  const pOffY = pFlags.offY ?? 0;
  let pStyle = '';
  if (pScale > 1 || pOffX || pOffY) {
    const r = 0.213 / pScale;
    pStyle = `object-position: calc(50% + ${(pOffX * r).toFixed(1)}px) calc(50% + ${(pOffY * r).toFixed(1)}px); transform: scale(${pScale});`;
  }

  const content = `<div class="vtm-roll">
    <div class="roll-header">
      <div class="roll-portrait-wrap"><img class="roll-portrait" src="${actor.img}" style="${pStyle}" /></div>
      <div class="roll-info">
        <span class="roll-actor">${actor.name}</span>
        <span class="roll-label">Spends ${spent} Willpower</span>
      </div>
    </div>
    <div class="roll-meta">${newWp} / ${max} remaining</div>
  </div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
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
