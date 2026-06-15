// V20 Combat: Initiative, Declaration, and Action Resolution
// Works alongside Foundry's built-in Combat document without subclassing it,
// to avoid collection-lookup issues in Foundry V13+.

// Override the built-in initiative roll with V20 rules:
// 1d10 + Dex + Wits + wound penalty, ties broken by Dex+Wits.
export function registerInitiativeHooks() {

  // After initiative is rolled, patch in wound penalty and store tiebreaker
  Hooks.on('updateCombatant', (combatant, changes) => {
    // Only act when initiative was just set by Foundry's built-in roll
    if (!('initiative' in changes)) return;
    if (combatant.getFlag('vtm-v20', 'initPatched')) return;

    const actor = combatant.actor;
    if (!actor) return;

    const wp = actor.system.woundPenalty || 0;
    const dex = actor.system.attributes?.dexterity || 0;
    const wits = actor.system.attributes?.wits || 0;
    const rating = dex + wits;

    // Foundry already rolled 1d10 + dex + wits from system.json formula.
    // We just add wound penalty and store the static rating for tiebreaking.
    const patched = changes.initiative + wp;
    combatant.update({
      initiative: patched,
      'flags.vtm-v20.initRating': rating,
      'flags.vtm-v20.initPatched': true,
    });
  });

  // Clear the patched flag when a new round starts so re-rolls work
  Hooks.on('updateCombat', (combat, changes) => {
    if (!('round' in changes)) return;
    const updates = combat.combatants.map(c => ({
      _id: c.id,
      'flags.vtm-v20.initPatched': false,
    }));
    if (updates.length) combat.updateEmbeddedDocuments('Combatant', updates);
  });
}


// Re-roll initiative for all active combatants in one batch.
// Does the full V20 calc (1d10 + Dex + Wits + wound penalty) directly
// so we don't depend on the async hook patching settling in time.
async function rerollAllInitiative(combat) {
  const updates = [];
  for (const c of combat.combatants) {
    if (!c.actor || c.defeated) continue;
    const dex = c.actor.system.attributes?.dexterity || 0;
    const wits = c.actor.system.attributes?.wits || 0;
    const wp = c.actor.system.woundPenalty || 0;
    // Raw random instead of Roll so Dice So Nice doesn't show 3D dice
    const d10 = Math.floor(Math.random() * 10) + 1;
    updates.push({
      _id: c.id,
      initiative: d10 + dex + wits + wp,
      'flags.vtm-v20.initRating': dex + wits,
      'flags.vtm-v20.initPatched': true,
    });
  }
  if (updates.length) await combat.updateEmbeddedDocuments('Combatant', updates);
}

// Get combatants sorted lowest-init-first for declaration
function declarationOrder(combat) {
  return combat.turns.slice().reverse();
}

// Begin the declaration phase
async function beginDeclaration(combat) {
  // Clear previous declarations
  const updates = combat.combatants.map(c => ({
    _id: c.id,
    'flags.vtm-v20.declaration': null,
    'flags.vtm-v20.resolved': false,
    'flags.vtm-v20.delayed': false,
  }));
  if (updates.length) await combat.updateEmbeddedDocuments('Combatant', updates);

  // Discipline activations expire each round
  for (const c of combat.combatants) {
    const active = c.actor?.getFlag('vtm-v20', 'activeDisciplines');
    if (active?.length) c.actor.unsetFlag('vtm-v20', 'activeDisciplines');
  }

  const order = declarationOrder(combat);
  const first = order.find(c => c.actor && !c.defeated);
  await combat.setFlag('vtm-v20', 'phase', 'declaration');
  await combat.setFlag('vtm-v20', 'currentDeclarer', first?.id || null);

  // Open the declaration panel for ALL combatants so everyone can
  // start planning their actions while waiting for their turn
  for (const cb of combat.combatants.contents) {
    if (!cb.actor || cb.defeated) continue;
    const sheet = cb.actor.sheet;
    if (sheet) sheet.startDeclaration(combat, cb);
  }
}

// Advance to the next declarer
async function advanceDeclaration(combat) {
  const order = declarationOrder(combat);
  const curId = combat.getFlag('vtm-v20', 'currentDeclarer');
  const curIdx = order.findIndex(c => c.id === curId);
  const next = order.slice(curIdx + 1).find(c => c.actor && !c.defeated && !c.getFlag('vtm-v20', 'declaration'));

  if (next) {
    // All sheets are already in declaration mode, just update the flag.
    // The updateCombat hook re-renders everyone so confirm buttons update.
    await combat.setFlag('vtm-v20', 'currentDeclarer', next.id);
  } else {
    await beginResolution(combat);
  }
}

// Start resolution phase (highest init acts first)
async function beginResolution(combat) {
  const first = combat.turns.find(c => c.actor && !c.defeated);
  await combat.setFlag('vtm-v20', 'phase', 'resolution');
  await combat.setFlag('vtm-v20', 'currentResolver', first?.id || null);
  await combat.setFlag('vtm-v20', 'currentDeclarer', null);

  // Put ALL combatant sheets into resolution mode so they can
  // track defenses and dice spent before their turn comes up
  for (const cb of combat.turns) {
    if (!cb.actor || cb.defeated) continue;
    const sheet = cb.actor.sheet;
    if (sheet) sheet.enterResolutionPhase(combat, cb);
  }

  if (first) promptResolution(combat, first);
}

// Advance to the next resolver
async function advanceResolution(combat) {
  const curId = combat.getFlag('vtm-v20', 'currentResolver');
  const curIdx = combat.turns.findIndex(c => c.id === curId);
  const next = combat.turns.slice(curIdx + 1).find(c => c.actor && !c.defeated && !c.getFlag('vtm-v20', 'resolved'));

  if (next) {
    await combat.setFlag('vtm-v20', 'currentResolver', next.id);
    promptResolution(combat, next);
  } else {
    await combat.setFlag('vtm-v20', 'phase', 'initiative');
    await combat.setFlag('vtm-v20', 'currentResolver', null);
    if (game.user.isGM) promptRoundEnd(combat);
  }
}

// Open the declaration dialog for a combatant
function promptDeclaration(combat, combatant) {
  const userId = ownerOf(combatant);
  if (userId === game.userId) {
    openDeclarationDialog(combat, combatant);
  } else {
    game.socket.emit('system.vtm-v20', {
      action: 'openDeclaration',
      combatId: combat.id,
      combatantId: combatant.id,
      userId,
    });
  }
}

// Open the resolution dialog for a combatant
function promptResolution(combat, combatant) {
  const userId = ownerOf(combatant);
  if (userId === game.userId) {
    openResolutionDialog(combat, combatant);
  } else {
    game.socket.emit('system.vtm-v20', {
      action: 'openResolution',
      combatId: combat.id,
      combatantId: combatant.id,
      userId,
    });
  }
}

function ownerOf(combatant) {
  if (!combatant.actor) return game.userId;
  const players = game.users.filter(u => u.active && !u.isGM && combatant.actor.testUserPermission(u, 'OWNER'));
  return players[0]?.id || game.userId;
}

function openDeclarationDialog(combat, combatant) {
  const sheet = combatant.actor?.sheet;
  if (!sheet) return;
  sheet.startDeclaration(combat, combatant);
}

function openResolutionDialog(combat, combatant) {
  const sheet = combatant.actor?.sheet;
  if (!sheet) return;
  sheet.startResolution(combat, combatant);
}


function promptRoundEnd(combat) {
  const round = combat.round || 1;
  new Dialog({
    title: `Round ${round} Complete`,
    content: `
      <div class="vtm-round-end-dialog">
        <p>All combatants have acted. Round ${round} is over.</p>
      </div>
    `,
    buttons: {
      declare: {
        icon: '<i class="fas fa-scroll"></i>',
        label: 'Begin Declarations',
        callback: async () => {
          await combat.nextRound();
          await rerollAllInitiative(combat);
          beginDeclaration(combat);
        },
      },
      end: {
        icon: '<i class="fas fa-flag-checkered"></i>',
        label: 'End Combat',
        callback: () => combat.endCombat(),
      },
    },
    default: 'declare',
  }, { classes: ['vtm-v20', 'dialog', 'vtm-round-end'], width: 340 }).render(true);
}

// Socket handler registration
export function bindInitiativeSocketHandlers() {
  game.socket.on('system.vtm-v20', ({ action, combatId, combatantId, userId }) => {
    if (action === 'openDeclaration' && userId === game.userId) {
      const combat = game.combats.get(combatId);
      const combatant = combat?.combatants.get(combatantId);
      if (combat && combatant) openDeclarationDialog(combat, combatant);
    }
    if (action === 'openResolution' && userId === game.userId) {
      const combat = game.combats.get(combatId);
      const combatant = combat?.combatants.get(combatantId);
      if (combat && combatant) openResolutionDialog(combat, combatant);
    }
  });
}


// Inject phase controls into the combat tracker sidebar
export function renderInitiativeTracker(app, html) {
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el) return;

  // Always remove stale controls first so we never hold a dead combat reference
  el.querySelector('.vtm-phase-controls')?.remove();

  const combat = game.combat;
  if (!combat || !game.user.isGM) return;

  const phase = combat.getFlag('vtm-v20', 'phase') || 'initiative';
  const hasInit = combat.combatants.some(c => c.initiative !== null);

  const controls = document.createElement('div');
  controls.className = 'vtm-phase-controls';

  if (phase === 'initiative' && hasInit) {
    controls.innerHTML = `<button type="button" class="vtm-phase-btn begin-declaration"><i class="fas fa-scroll"></i> Begin Declarations</button>`;
    // Use game.combat at click time, not a captured reference
    controls.querySelector('.begin-declaration').addEventListener('click', async () => {
      const c = game.combat;
      if (!c) return;
      if (!c.started) await c.startCombat();
      beginDeclaration(c);
    });
  } else if (phase === 'declaration') {
    const curId = combat.getFlag('vtm-v20', 'currentDeclarer');
    const cur = combat.combatants.get(curId);
    controls.innerHTML = `<div class="vtm-phase-label"><i class="fas fa-scroll"></i> Declaring: <b>${cur?.name || '...'}</b></div>`;
  } else if (phase === 'resolution') {
    const curId = combat.getFlag('vtm-v20', 'currentResolver');
    const cur = combat.combatants.get(curId);
    controls.innerHTML = `<div class="vtm-phase-label"><i class="fas fa-fist-raised"></i> Acting: <b>${cur?.name || '...'}</b></div>`;
  }

  // Try various Foundry V13 selectors for the tracker header
  const anchor = el.querySelector('.combat-tracker-header')
    || el.querySelector('.encounter-controls')
    || el.querySelector('header')
    || el.querySelector('nav')
    || el.querySelector('ol')
    || el.firstElementChild;
  if (anchor && anchor !== controls) anchor.before(controls);
  else el.prepend(controls);
}

// Expose for the declaration/resolution apps to call
export { advanceDeclaration, advanceResolution };
