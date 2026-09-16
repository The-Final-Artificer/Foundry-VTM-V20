// V20 Combat: Initiative, Declaration, and Action Resolution
// Works alongside Foundry's built-in Combat document without subclassing it,
// to avoid collection-lookup issues in Foundry V13+.

import { celerityLevel } from './discipline-effects.mjs';

// Override the built-in initiative roll with V20 rules:
// 1d10 + Dex + Wits + Celerity + wound penalty, ties broken by the static rating.
// Celerity in the rating is the DAV20 reading, adopted as a house rule.
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
    const cel = celerityLevel(actor);
    const rating = dex + wits + cel;

    // Foundry already rolled 1d10 + dex + wits from system.json formula.
    // We add Celerity and wound penalty, and store the rating for tiebreaking.
    const patched = changes.initiative + cel + wp;
    combatant.update({
      initiative: patched,
      'flags.vtm-v20.initRating': rating,
      'flags.vtm-v20.initPatched': true,
    });
  });

  // Clear the patched flag when a new round starts so re-rolls work
  Hooks.on('updateCombat', async (combat, changes) => {
    if (!('round' in changes)) return;
    const updates = combat.combatants.map(c => ({
      _id: c.id,
      'flags.vtm-v20.initPatched': false,
    }));
    if (updates.length) combat.updateEmbeddedDocuments('Combatant', updates);

    // Clear "ignore wounds" WP spend at the start of each new round
    for (const c of combat.combatants) {
      if (c.actor?.getFlag('vtm-v20', 'wpIgnoreWounds')) {
        await c.actor.unsetFlag('vtm-v20', 'wpIgnoreWounds');
      }
      // Celerity activations last one round in combat
      if (c.actor?.getFlag('vtm-v20', 'celerityBurst')) {
        await c.actor.unsetFlag('vtm-v20', 'celerityBurst');
      }
      if (c.actor?.getFlag('vtm-v20', 'celerityActions')) {
        await c.actor.unsetFlag('vtm-v20', 'celerityActions');
      }
    }

    // Blood buff overflow decay: dots above traitMax+1 last 3 turns after last spend
    const round = changes.round;
    for (const c of combat.combatants) {
      if (!c.actor) continue;
      const decayFlag = c.actor.getFlag('vtm-v20', 'bloodBuffDecay');
      const buffs = c.actor.getFlag('vtm-v20', 'bloodBuffs');
      if (!decayFlag && !buffs) continue;

      const decay = { ...(decayFlag || {}) };
      const buffsCopy = { ...(buffs || {}) };
      const traitMax = c.actor.system.traitMax || 5;
      const freeLimit = traitMax + 1;
      const decayed = [];

      // Seed timers for overflow dots that entered combat without one
      for (const attr of ['strength', 'dexterity', 'stamina']) {
        const base = c.actor.system.attributes?.[attr] || 0;
        const buff = buffsCopy[attr] || 0;
        if (base + buff > freeLimit && decay[attr] === undefined) {
          decay[attr] = Math.max(round - 1, 0);
        }
      }

      // Check for expired overflow
      for (const [attr, lastSpent] of Object.entries(decay)) {
        if (round - lastSpent < 3) continue;
        const base = c.actor.system.attributes?.[attr] || 0;
        const cap = Math.max(freeLimit - base, 0);
        if ((buffsCopy[attr] || 0) > cap) {
          buffsCopy[attr] = cap;
          decayed.push(attr);
        }
        delete decay[attr];
      }

      if (!decayed.length) {
        // Still might need to save seeded timers
        if (!decayFlag && Object.keys(decay).length) {
          await c.actor.setFlag('vtm-v20', 'bloodBuffDecay', decay);
        }
        continue;
      }

      // Save trimmed buffs
      const anyLeft = Object.values(buffsCopy).some(v => v > 0);
      if (anyLeft) {
        const clean = {};
        for (const [k, v] of Object.entries(buffsCopy)) if (v > 0) clean[k] = v;
        await c.actor.unsetFlag('vtm-v20', 'bloodBuffs');
        await c.actor.setFlag('vtm-v20', 'bloodBuffs', clean);
      } else {
        await c.actor.unsetFlag('vtm-v20', 'bloodBuffs');
      }

      // Save remaining decay entries
      if (Object.keys(decay).length) {
        await c.actor.unsetFlag('vtm-v20', 'bloodBuffDecay');
        await c.actor.setFlag('vtm-v20', 'bloodBuffDecay', decay);
      } else {
        await c.actor.unsetFlag('vtm-v20', 'bloodBuffDecay');
      }

      const names = decayed.map(a => a[0].toUpperCase() + a.slice(1));
      ui.notifications.warn(`${c.actor.name}: ${names.join(', ')} blood enhancement decayed.`);
    }
  });

  // Combat over: combat-scoped Celerity activations end with it
  Hooks.on('deleteCombat', async combat => {
    if (!game.user.isGM) return;
    for (const c of combat.combatants) {
      if (c.actor?.getFlag('vtm-v20', 'celerityActions')) {
        await c.actor.unsetFlag('vtm-v20', 'celerityActions');
      }
    }
  });
}


// Re-roll initiative for all active combatants in one batch.
// Does the full calc (1d10 + Dex + Wits + Celerity + wound penalty) directly
// so we don't depend on the async hook patching settling in time.
async function rerollAllInitiative(combat) {
  const updates = [];
  for (const c of combat.combatants) {
    if (!c.actor || c.defeated) continue;
    const dex = c.actor.system.attributes?.dexterity || 0;
    const wits = c.actor.system.attributes?.wits || 0;
    const cel = celerityLevel(c.actor);
    const wp = c.actor.system.woundPenalty || 0;
    // Raw random instead of Roll so Dice So Nice doesn't show 3D dice
    const d10 = Math.floor(Math.random() * 10) + 1;
    let init = d10 + dex + wits + cel + wp;
    // Standing up from a knockdown last round: -2, this round only
    const kdPen = c.actor.getFlag('vtm-v20', 'nextRoundInitPenalty') || 0;
    if (kdPen) {
      init -= kdPen;
      await c.actor.unsetFlag('vtm-v20', 'nextRoundInitPenalty');
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: c.actor }),
        content: `<div class="vtm-roll"><div class="roll-meta"><i class="fas fa-person-falling"></i> ${c.actor.name}: -${kdPen} initiative this round (knockdown recovery).</div></div>`,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
    }
    updates.push({
      _id: c.id,
      initiative: init,
      'flags.vtm-v20.initRating': dex + wits + cel,
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
    'flags.vtm-v20.deferred': null,
    'flags.vtm-v20.effInit': null,
  }));
  if (updates.length) await combat.updateEmbeddedDocuments('Combatant', updates);
  await combat.update({
    'flags.vtm-v20.deferredResolver': null,
    'flags.vtm-v20.interruptStack': [],
    'flags.vtm-v20.finalCall': false,
  });

  // Discipline activations expire each round
  for (const c of combat.combatants) {
    const active = c.actor?.getFlag('vtm-v20', 'activeDisciplines');
    if (active?.length) c.actor.unsetFlag('vtm-v20', 'activeDisciplines');
  }

  const order = declarationOrder(combat);
  const first = order.find(c => c.actor && !c.defeated);
  const turnIdx = first ? combat.turns.indexOf(first) : 0;
  await combat.update({
    turn: turnIdx,
    'flags.vtm-v20.phase': 'declaration',
    'flags.vtm-v20.currentDeclarer': first?.id || null,
  });

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
    const turnIdx = combat.turns.indexOf(next);
    await combat.update({
      turn: turnIdx,
      'flags.vtm-v20.currentDeclarer': next.id,
    });
  } else {
    await beginResolution(combat);
  }
}

// Start resolution phase (highest init acts first)
async function beginResolution(combat) {
  const first = combat.turns.find(c => c.actor && !c.defeated);
  const turnIdx = first ? combat.turns.indexOf(first) : 0;
  await combat.update({
    turn: turnIdx,
    'flags.vtm-v20.phase': 'resolution',
    'flags.vtm-v20.currentResolver': first?.id || null,
    'flags.vtm-v20.currentDeclarer': null,
    'flags.vtm-v20.interruptStack': [],
    'flags.vtm-v20.finalCall': false,
  });

  // Put ALL combatant sheets into resolution mode so they can
  // track defenses and dice spent before their turn comes up
  for (const cb of combat.turns) {
    if (!cb.actor || cb.defeated) continue;
    const sheet = cb.actor.sheet;
    if (sheet) sheet.enterResolutionPhase(combat, cb);
  }

  if (first) promptResolution(combat, first);
}

// Deferred Celerity slots still waiting, sorted by slot initiative.
// On equal initiative a real combatant acts first, so the caller compares
// with a strict greater-than.
function pendingDeferred(combat) {
  const list = [];
  for (const c of combat.turns) {
    if (!c.actor || c.defeated) continue;
    for (const e of (c.getFlag('vtm-v20', 'deferred') || [])) {
      list.push({ combatant: c, idx: e.idx, init: e.init, delayed: !!e.delayed });
    }
  }
  list.sort((a, b) => b.init - a.init
    || (b.combatant.getFlag('vtm-v20', 'initRating') || 0) - (a.combatant.getFlag('vtm-v20', 'initRating') || 0));
  return list;
}

// Advance to the next resolver
async function advanceResolution(combat) {
  await combat.update({ 'flags.vtm-v20.deferredResolver': null, 'flags.vtm-v20.finalCall': false });

  // An interrupted turn resumes before anything else moves
  const stack = [...(combat.getFlag('vtm-v20', 'interruptStack') || [])];
  while (stack.length) {
    const id = stack.pop();
    const cb = combat.combatants.get(id);
    if (cb && cb.actor && !cb.defeated && !cb.getFlag('vtm-v20', 'resolved') && !cb.getFlag('vtm-v20', 'delayed')) {
      await combat.update({
        turn: Math.max(combat.turns.indexOf(cb), 0),
        'flags.vtm-v20.currentResolver': id,
        'flags.vtm-v20.interruptStack': stack,
      });
      promptResolution(combat, cb);
      return;
    }
  }
  if ((combat.getFlag('vtm-v20', 'interruptStack') || []).length) {
    await combat.update({ 'flags.vtm-v20.interruptStack': [] });
  }

  const curId = combat.getFlag('vtm-v20', 'currentResolver');
  const curIdx = combat.turns.findIndex(c => c.id === curId);
  const next = combat.turns.slice(curIdx + 1).find(c =>
    c.actor && !c.defeated && !c.getFlag('vtm-v20', 'resolved')
    && !c.getFlag('vtm-v20', 'yielded') && !c.getFlag('vtm-v20', 'delayed'));

  // A deferred slot fires when it beats the next real turn outright.
  // Delayed slots wait for their owner's Act Now mid-round, but everything
  // flushes at the end of the round.
  const allDef = pendingDeferred(combat);
  const top = next ? allDef.find(e => !e.delayed) : allDef[0];
  if (top && (!next || top.init > next.initiative)) {
    await combat.update({
      'flags.vtm-v20.deferredResolver': { combatantId: top.combatant.id, idx: top.idx, init: top.init },
    });
    promptDeferred(combat, top.combatant, top.idx, top.init);
    return;
  }

  if (next) {
    const turnIdx = combat.turns.indexOf(next);
    await combat.update({
      turn: turnIdx,
      'flags.vtm-v20.currentResolver': next.id,
    });
    promptResolution(combat, next);
  } else {
    // Final call: delayed characters must act now or lose it, highest rating first
    const delayedLeft = combat.turns
      .filter(c => c.actor && !c.defeated && !c.getFlag('vtm-v20', 'resolved') && c.getFlag('vtm-v20', 'delayed'))
      .sort((a, b) => (b.getFlag('vtm-v20', 'initRating') || 0) - (a.getFlag('vtm-v20', 'initRating') || 0));
    if (delayedLeft.length) {
      const cb = delayedLeft[0];
      await cb.unsetFlag('vtm-v20', 'delayed');
      await combat.update({
        turn: Math.max(combat.turns.indexOf(cb), 0),
        'flags.vtm-v20.currentResolver': cb.id,
        'flags.vtm-v20.finalCall': true,
      });
      promptResolution(combat, cb);
      return;
    }

    const active = combat.turns.filter(c => c.actor && !c.defeated);
    const anyResolved = active.some(c => c.getFlag('vtm-v20', 'resolved'));
    const yielded = anyResolved
      ? combat.turns.find(c => c.actor && !c.defeated && !c.getFlag('vtm-v20', 'resolved') && c.getFlag('vtm-v20', 'yielded'))
      : null;
    if (yielded) {
      await yielded.unsetFlag('vtm-v20', 'yielded');
      const turnIdx = combat.turns.indexOf(yielded);
      await combat.update({
        turn: turnIdx,
        'flags.vtm-v20.currentResolver': yielded.id,
      });
      promptResolution(combat, yielded);
    } else {
      await combat.update({
        'flags.vtm-v20.phase': 'initiative',
        'flags.vtm-v20.currentResolver': null,
      });
      if (game.user.isGM) promptRoundEnd(combat, { allYielded: !anyResolved });
    }
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

// A delayed character jumps in, freezing whoever is currently acting.
// The frozen turn goes on the interrupt stack and resumes afterward.
async function requestActNow(combat, combatant) {
  if (combat.getFlag('vtm-v20', 'phase') !== 'resolution') return;
  if (!combatant.getFlag('vtm-v20', 'delayed') || combatant.getFlag('vtm-v20', 'resolved')) return;

  const stack = [...(combat.getFlag('vtm-v20', 'interruptStack') || [])];
  const cur = combat.combatants.get(combat.getFlag('vtm-v20', 'currentResolver'));
  if (cur && cur.id !== combatant.id && !cur.getFlag('vtm-v20', 'resolved')) stack.push(cur.id);

  // Jumping in adopts the interrupted turn's initiative: Celerity deferral
  // slots count down from here, not from the original roll
  await combatant.setFlag('vtm-v20', 'effInit', cur?.initiative ?? combatant.initiative);
  await combatant.unsetFlag('vtm-v20', 'delayed');
  await combat.update({
    turn: Math.max(combat.turns.indexOf(combatant), 0),
    'flags.vtm-v20.currentResolver': combatant.id,
    'flags.vtm-v20.interruptStack': stack,
    'flags.vtm-v20.finalCall': false,
  });
  promptResolution(combat, combatant);
}

// A delayed deferred slot jumps back in, freezing the current actor. The
// fired slot adopts the interrupted initiative and every remaining slot
// re-anchors to trail one step behind it.
async function requestDeferredNow(combat, combatant) {
  if (combat.getFlag('vtm-v20', 'phase') !== 'resolution') return;
  const entries = [...(combat.combatants.get(combatant.id)?.getFlag('vtm-v20', 'deferred') || [])];
  const delayedEntries = entries.filter(e => e.delayed).sort((a, b) => b.init - a.init);
  const target = delayedEntries[0];
  if (!target) return;

  const stack = [...(combat.getFlag('vtm-v20', 'interruptStack') || [])];
  const cur = combat.combatants.get(combat.getFlag('vtm-v20', 'currentResolver'));
  if (cur && !cur.getFlag('vtm-v20', 'resolved')) stack.push(cur.id);

  // Re-anchor: fired slot acts at the interrupted initiative, the rest trail it
  if (cur) {
    target.init = cur.initiative ?? target.init;
    const rest = entries.filter(e => e !== target).sort((a, b) => b.init - a.init);
    rest.forEach((e, n) => { e.init = (cur.initiative ?? 0) - (n + 1); });
  }
  await combatant.setFlag('vtm-v20', 'deferred', entries);

  await combat.update({
    'flags.vtm-v20.currentResolver': null,
    'flags.vtm-v20.interruptStack': stack,
    'flags.vtm-v20.deferredResolver': { combatantId: combatant.id, idx: target.idx, init: target.init },
    'flags.vtm-v20.finalCall': false,
  });
  promptDeferred(combat, combatant, target.idx, target.init);
}

// Deferred Celerity slot: route to whoever owns the combatant
function promptDeferred(combat, combatant, idx, init) {
  const userId = ownerOf(combatant);
  if (userId === game.userId) {
    openDeferredDialog(combat, combatant, idx, init);
  } else {
    game.socket.emit('system.vtm-v20', {
      action: 'openDeferred',
      combatId: combat.id,
      combatantId: combatant.id,
      idx, init, userId,
    });
  }
}

function openDeferredDialog(combat, combatant, idx, init) {
  const sheet = combatant.actor?.sheet;
  if (!sheet) return;
  sheet.startDeferredResolution(combat, combatant, idx, init);
}


function promptRoundEnd(combat, { allYielded = false } = {}) {
  const round = combat.round || 1;
  const msg = allYielded
    ? `Everyone has yielded. Round ${round} is over.`
    : `All combatants have acted. Round ${round} is over.`;
  new Dialog({
    title: `Round ${round} Complete`,
    content: `
      <div class="vtm-round-end-dialog">
        <p>${msg}</p>
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
  game.socket.on('system.vtm-v20', ({ action, combatId, combatantId, userId, idx, init }) => {
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
    if (action === 'openDeferred' && userId === game.userId) {
      const combat = game.combats.get(combatId);
      const combatant = combat?.combatants.get(combatantId);
      if (combat && combatant) openDeferredDialog(combat, combatant, idx, init);
    }
    // GM-only: players route combat advancement through the GM
    if (game.user.isGM) {
      const combat = game.combats.get(combatId);
      if (!combat) return;
      if (action === 'advanceDeclaration') advanceDeclaration(combat);
      if (action === 'advanceResolution') advanceResolution(combat);
      if (action === 'actNow') {
        const cb = combat.combatants.get(combatantId);
        if (cb) requestActNow(combat, cb);
      }
      if (action === 'deferredNow') {
        const cb = combat.combatants.get(combatantId);
        if (cb) requestDeferredNow(combat, cb);
      }
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
    const dr = combat.getFlag('vtm-v20', 'deferredResolver');
    if (dr) {
      const cb = combat.combatants.get(dr.combatantId);
      controls.innerHTML = `<div class="vtm-phase-label"><i class="fas fa-wind"></i> Deferred: <b>${cb?.name || '...'}</b> (init ${dr.init})</div>`;
    } else {
      const curId = combat.getFlag('vtm-v20', 'currentResolver');
      const cur = combat.combatants.get(curId);
      const interrupting = (combat.getFlag('vtm-v20', 'interruptStack') || []).length > 0;
      const finalCall = combat.getFlag('vtm-v20', 'finalCall');
      const label = finalCall ? 'Final call' : interrupting ? 'Interrupt' : 'Acting';
      const icon = finalCall ? 'fa-hourglass-end' : interrupting ? 'fa-bolt' : 'fa-fist-raised';
      controls.innerHTML = `<div class="vtm-phase-label"><i class="fas ${icon}"></i> ${label}: <b>${cur?.name || '...'}</b></div>`;
    }
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
export { advanceDeclaration, advanceResolution, requestActNow, requestDeferredNow };
