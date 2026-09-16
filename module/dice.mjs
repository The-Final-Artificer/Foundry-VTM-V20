// Find an active player who owns this actor (prefer non-GM so dice match the player's theme)
import { blindedDifficulty } from './status-effects.mjs';
import { effectiveTraitValue, potenceLevel, potenceAutoSuccesses, usesStrengthTrait } from './discipline-effects.mjs';

const PHYSICAL_ATTRS = new Set(['attributes.strength', 'attributes.dexterity', 'attributes.stamina']);

// Tackled last round but kept footing: +1 difficulty to actions, one round only
export function unbalancedPenalty(actor) {
  const r = actor.getFlag('vtm-v20', 'unbalancedRound');
  return (r && game.combat && game.combat.round === r) ? 1 : 0;
}

export function isEncumbered(actor) {
  const str = (actor.system.attributes?.strength || 0) + potenceLevel(actor);
  const maxCarry = str * 10;
  let weight = 0;
  const eiActive = game.modules.get('enhanced-inventory')?.active;
  const eiData = eiActive ? (actor.getFlag('enhanced-inventory', 'data') || {}) : {};
  const slottedIds = new Set(Object.values(eiData.slots || {}).filter(Boolean));
  for (const it of actor.items) {
    if (eiActive) {
      const grid = it.getFlag('enhanced-inventory', 'grid');
      if (grid && grid.gridX === -1 && grid.gridY === -1 && !slottedIds.has(it.id) && !grid.armorId) continue;
    }
    const w = it.system.weight || 0;
    if (it.type === 'equipment') weight += w * (it.system.quantity || 1);
    else if (w > 0) weight += w;
  }
  return weight > maxCarry;
}

function getOwner(actor) {
  const owners = game.users.filter(u => u.active && actor.testUserPermission(u, 'OWNER') && !u.isGM);
  return owners[0] || game.users.find(u => u.active && u.isGM) || game.user;
}

// Trigger Dice So Nice with the actor owner's theme instead of the roller's
export async function showDice(roll, actor) {
  if (!game.dice3d) return;
  await game.dice3d.showForRoll(roll, getOwner(actor), true);
}

// Right-click adjustment dialog for rolls whose pool is already fixed (combat
// resolution). Same look as the roll dialog, but the pool can't be rebuilt from
// traits: the user adds bonus dice on top and overrides the difficulty.
// diffNotes lists the modifiers already baked into the preset difficulty.
// Resolves {mod, difficulty, specialty} or null if the dialog was closed.
export async function promptRollAdjust({ title = 'Adjust Roll', pool, poolLabel = '', difficulty = 6, diffNotes = [], specialty = false } = {}) {
  const diffBtns = [3, 4, 5, 6, 7, 8, 9, 10].map(d =>
    `<button type="button" class="diff-btn ${d === difficulty ? 'active' : ''}" data-diff="${d}">${d}</button>`).join('');
  const notes = diffNotes.filter(Boolean).map(n =>
    `<div class="difficulty-pen-row"><span class="wound-pen-val">${n}</span></div>`).join('');
  const content = `<form class="vtm-roll-dialog">
    <div class="form-group wound-pen-row">
      <label>Dice Pool</label>
      <span class="wound-pen-val">${pool}${poolLabel ? ` (${poolLabel})` : ''}</span>
    </div>
    <div class="form-group">
      <label>Bonus Dice</label>
      <input type="number" name="modifier" value="0" />
    </div>
    <div class="form-group">
      <label>Difficulty</label>
      <input type="hidden" name="difficulty" value="${difficulty}" />
      <div class="diff-buttons">${diffBtns}</div>
      ${notes}
    </div>
    ${specialty ? '<div class="form-group check"><label><input type="checkbox" name="specialty" /> Specialty (10s count double)</label></div>' : ''}
  </form>`;

  return new Promise(resolve => {
    new Dialog({
      title,
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: 'Roll',
          callback: dlg => {
            const form = dlg[0].querySelector('form');
            resolve({
              mod: parseInt(form.modifier.value) || 0,
              difficulty: parseInt(form.difficulty.value) || difficulty,
              specialty: !!form.specialty?.checked,
            });
          },
        },
      },
      render: html => {
        html.find('.diff-btn').click(ev => {
          html.find('.diff-btn').removeClass('active');
          ev.currentTarget.classList.add('active');
          html.find('[name="difficulty"]').val(ev.currentTarget.dataset.diff);
        });
      },
      default: 'roll',
      close: () => resolve(null),
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 420 }).render(true);
  });
}

export async function rollDicePool(actor, { trait, trait2, label, pool, difficulty = 6, poolMod = 0, poolOverride = null, poolNote = '', adjust = false } = {}) {
  // Resolution shortcut: skip dialog/capture, roll with the given pool directly.
  // Everything after this block (roll, tally, chat card) still runs normally.
  let result;
  if (poolOverride !== null) {
    let ovPool = Math.max(poolOverride, 1);
    let ovDiff = Number(difficulty) || 6;
    let ovSpec = false;
    let ovLabel = label || 'Roll';
    if (unbalancedPenalty(actor)) {
      ovDiff = Math.min(ovDiff + 1, 10);
      ovLabel += ' | unbalanced +1 diff';
    }
    if (adjust) {
      const adj = await promptRollAdjust({
        title: `Roll: ${ovLabel}`,
        pool: ovPool,
        poolLabel: poolNote,
        difficulty: ovDiff,
        specialty: true,
      });
      if (!adj) return null;
      ovPool = Math.max(ovPool + adj.mod, 1);
      ovDiff = adj.difficulty;
      ovSpec = adj.specialty;
      if (adj.mod) ovLabel += ` | bonus ${adj.mod > 0 ? '+' : ''}${adj.mod}`;
    }
    result = {
      pool: ovPool,
      difficulty: ovDiff,
      specialty: ovSpec,
      label: ovLabel,
    };
  } else {
  const sys = actor.system;
  const baseDifficulty = Number(difficulty) || 6;

  const allTraits = {};
  if (sys.attributes) {
    for (const k of Object.keys(sys.attributes)) {
      allTraits[`attributes.${k}`] = {
        label: game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`),
        value: effectiveTraitValue(actor, `attributes.${k}`), group: 'attributes'
      };
    }
  }
  if (sys.abilities) {
    for (const [k, v] of Object.entries(sys.abilities)) {
      allTraits[`abilities.${k}`] = {
        label: game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`),
        value: v, group: 'abilities'
      };
    }
  }
  if (sys.virtues) {
    const vFlags = actor.getFlag('vtm-v20', 'virtueLabels');
    for (const [k, v] of Object.entries(sys.virtues)) {
      const label = (k === 'conscience' || k === 'selfControl') && vFlags?.[k]
        ? vFlags[k]
        : game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`);
      allTraits[`virtues.${k}`] = { label, value: v, group: 'virtues' };
    }
  }
  if (sys.willpower) {
    allTraits['willpower'] = { label: 'Willpower', value: sys.willpower.max, group: 'other' };
  }
  if (sys.humanity !== undefined) {
    allTraits['humanity'] = { label: sys.pathName || 'Humanity', value: sys.humanity, group: 'other' };
  }
  for (const bg of actor.items.filter(i => i.type === 'background' && i.system.rating > 0)) {
    allTraits[`bg.${bg.id}`] = { label: bg.name, value: bg.system.rating, group: 'backgrounds' };
  }

  const groupOpts = (g) => Object.entries(allTraits)
    .filter(([, v]) => v.group === g)
    .map(([k, v]) => ({ key: k, ...v }));

  const woundPen = actor.system.woundPenalty || 0;
  const potenceAuto = potenceAutoSuccesses(actor);
  // Willpower and Virtue rolls aren't hindered by wounds
  const woundImmune = k => k === 'willpower' || (k || '').startsWith('virtues.');
  const blindedImmune = k => woundImmune(k);
  const initialBlindedImmune = blindedImmune(trait) || blindedImmune(trait2);
  const blindedDifficultyValue = blindedDifficulty(actor, baseDifficulty);
  const blindedPenalty = blindedDifficultyValue - baseDifficulty;
  let dialogDifficulty = initialBlindedImmune ? baseDifficulty : blindedDifficultyValue;

  const isPerception = k => k === 'attributes.perception';
  const wolfForm = !!actor.getFlag('vtm-v20', 'wolfForm');
  const batForm = !!actor.getFlag('vtm-v20', 'batForm');
  const wolfPerceptionBonus = wolfForm && (isPerception(trait) || isPerception(trait2)) ? -2 : 0;
  const batPerceptionBonus = batForm && (isPerception(trait) || isPerception(trait2)) ? -3 : 0;
  if (wolfPerceptionBonus) dialogDifficulty = Math.max(dialogDifficulty + wolfPerceptionBonus, 3);
  if (batPerceptionBonus) dialogDifficulty = Math.max(dialogDifficulty + batPerceptionBonus, 3);
  const armorPen = Array.from(actor.items)
    .filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((sum, i) => sum + (i.system.penalty || 0), 0);

  const shadowPlay = !!actor.getFlag('vtm-v20', 'shadowPlay');
  const isStealth = k => k === 'abilities.stealth';
  const isIntimidation = k => k === 'abilities.intimidation';
  const shadowPlayPool = shadowPlay && (isStealth(trait) || isStealth(trait2) || isIntimidation(trait) || isIntimidation(trait2)) ? 1 : 0;

  const encumbered = isEncumbered(actor);
  const encumbranceDiff = encumbered && (PHYSICAL_ATTRS.has(trait) || PHYSICAL_ATTRS.has(trait2)) ? 1 : 0;
  if (encumbranceDiff) dialogDifficulty = Math.min(dialogDifficulty + 1, 10);
  const unbalanced = unbalancedPenalty(actor);
  if (unbalanced) dialogDifficulty = Math.min(dialogDifficulty + 1, 10);

  const dlgHtml = await renderTemplate('systems/vtm-v20/templates/roll-dialog.hbs', {
    trait, trait2, label, difficulty: dialogDifficulty, woundPen, armorPen, blindedPenalty, wolfPerceptionBonus, batPerceptionBonus, shadowPlayPool, potenceAuto, encumbered, unbalanced,
    attrOpts: groupOpts('attributes'),
    abilOpts: groupOpts('abilities'),
    virtOpts: groupOpts('virtues'),
    otherOpts: groupOpts('other'),
    bgOpts: groupOpts('backgrounds'),
  });

  result = await new Promise(resolve => {
    new Dialog({
      title: `Roll: ${label}`,
      content: dlgHtml,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: 'Roll',
          callback: dlg => {
            const form = dlg[0].querySelector('form');
            const pri = form.primary.value;
            const sec = form.secondary.value;
            const mod = parseInt(form.modifier.value) || 0;
            const selectedBlindedImmune = blindedImmune(pri) || blindedImmune(sec);
            const chosenDiff = parseInt(form.difficulty.value) || dialogDifficulty;
            const diff = chosenDiff;
            const spec = form.specialty.checked;

            const wp = (woundImmune(pri) || woundImmune(sec)) ? 0 : woundPen;

            let total = mod + wp + poolMod;
            let parts = [];
            if (pri && allTraits[pri]) { total += allTraits[pri].value; parts.push(allTraits[pri].label); }
            if (sec && allTraits[sec]) { total += allTraits[sec].value; parts.push(allTraits[sec].label); }
            if (mod > 0) parts.push(`+${mod}`);
            else if (mod < 0) parts.push(`${mod}`);
            if (wp) parts.push(`wound ${wp}`);
            if (poolMod) parts.push(`full def ${poolMod}`);
            const autoSucc = (potenceAuto && usesStrengthTrait(pri, sec)) ? potenceAuto : 0;
            if (armorPen && (pri === 'attributes.dexterity' || sec === 'attributes.dexterity')) {
              total += armorPen;
              parts.push(`armor ${armorPen}`);
            }
            if (shadowPlay && (isStealth(pri) || isStealth(sec) || isIntimidation(pri) || isIntimidation(sec))) {
              total += 1;
              parts.push('Shadow Play +1');
            }
            total = Math.max(total, 1);

            // Self-Control/Instinct rolls can't exceed current blood pool
            let bloodCapped = false;
            if (pri === 'virtues.selfControl' || sec === 'virtues.selfControl') {
              const bp = actor.system.blood?.value || 0;
              if (bp < total) {
                total = Math.max(bp, 1);
                bloodCapped = true;
              }
            }

            let rollLabel = parts.join(' + ') || label;
            if (bloodCapped) rollLabel += ` | capped by blood pool (${actor.system.blood.value})`;
            resolve({
              pool: total,
              difficulty: diff,
              specialty: spec,
              autoSuccesses: autoSucc,
              traits: [pri, sec].filter(Boolean),
              label: blindedPenalty && !selectedBlindedImmune ? `${rollLabel} | blinded diff +${blindedPenalty}` : rollLabel,
            });
          }
        },
      },
      render: html => {
        html.find('.diff-btn').click(ev => {
          html.find('.diff-btn').removeClass('active');
          ev.currentTarget.classList.add('active');
          html.find('[name="difficulty"]').val(ev.currentTarget.dataset.diff);
        });

        // Only show armor penalty when Dexterity is actually in the pool
        const armorRow = html.find('.armor-pen-row');
        const encRow = html.find('.encumbrance-diff-row');
        const isPhysical = k => PHYSICAL_ATTRS.has(k);
        if (armorRow.length || encRow.length) {
          const checkPhysical = () => {
            const pri = html.find('[name="primary"]').val();
            const sec = html.find('[name="secondary"]').val();
            if (armorRow.length) armorRow.toggle(pri === 'attributes.dexterity' || sec === 'attributes.dexterity');
            if (encRow.length) encRow.toggle(isPhysical(pri) || isPhysical(sec));
          };
          checkPhysical();
          html.find('[name="primary"], [name="secondary"]').change(checkPhysical);
        }

        // Willpower and Virtue rolls ignore wound penalties, so hide the row for them
        const woundRow = html.find('.wound-pen-row:not(.armor-pen-row)');
        if (woundRow.length) {
          const checkWp = () => {
            const pri = html.find('[name="primary"]').val();
            const sec = html.find('[name="secondary"]').val();
            woundRow.toggle(!(woundImmune(pri) || woundImmune(sec)));
          };
          checkWp();
          html.find('[name="primary"], [name="secondary"]').change(checkWp);
        }

        const blindedRow = html.find('.blinded-pen-row');
        if (blindedRow.length) {
          const checkBlinded = () => {
            const pri = html.find('[name="primary"]').val();
            const sec = html.find('[name="secondary"]').val();
            const immune = blindedImmune(pri) || blindedImmune(sec);
            const difficulty = immune ? baseDifficulty : blindedDifficultyValue;
            blindedRow.toggle(!immune);
            html.find('[name="difficulty"]').val(difficulty);
            html.find('.diff-btn').removeClass('active');
            html.find(`.diff-btn[data-diff="${difficulty}"]`).addClass('active');
          };
          checkBlinded();
          html.find('[name="primary"], [name="secondary"]').change(checkBlinded);
        }

        const potenceRow = html.find('.potence-row');
        if (potenceRow.length) {
          const checkPotence = () => {
            const pri = html.find('[name="primary"]').val();
            const sec = html.find('[name="secondary"]').val();
            potenceRow.toggle(!!potenceAuto && usesStrengthTrait(pri, sec));
          };
          checkPotence();
          html.find('[name="primary"], [name="secondary"]').change(checkPotence);
        }
      },
      default: 'roll',
      close: () => resolve(null)
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 420 }).render(true);
  });

  if (!result) return null;

  // Capture mode: declaration dialog is listening for a roll to use as a custom action.
  // Hand off the roll config and bail before dice hit the table.
  if (game.vtm?._captureAction) {
    const cb = game.vtm._captureAction;
    game.vtm._captureAction = null;
    cb(result);
    return null;
  }
  } // end of normal (non-override) path

  const roll = new Roll(`${result.pool}d10`);
  await roll.evaluate();

  let successes = 0, ones = 0;
  const dice = roll.terms[0].results.map(r => {
    const val = r.result;
    let status = 'fail';
    if (val >= result.difficulty) {
      successes++;
      status = 'success';
      if (val === 10 && result.specialty) { successes++; status = 'crit'; }
    }
    if (val === 1) { ones++; status = 'botch'; }
    return { value: val, status };
  });

  const hadSuccess = successes > 0;
  successes -= ones;
  let autoSucc = result.autoSuccesses || 0;

  // Willpower spend: +1 auto-success, but not on virtue rolls (conviction/conscience)
  let wpUsed = false;
  const traits = result.traits || [];
  const isVirtueRoll = traits.some(k => (k || '').startsWith('virtues.'));
  if (actor.getFlag('vtm-v20', 'wpSpent') && !isVirtueRoll) {
    autoSucc += 1;
    wpUsed = true;
    await actor.unsetFlag('vtm-v20', 'wpSpent');
  }

  const diceTotal = Math.max(successes, 0);
  const total = diceTotal + autoSucc;
  let outcome = 'failure';
  if (total > 0) outcome = 'success';
  else if (autoSucc > 0) outcome = 'failure';
  else if (ones > 0 && !hadSuccess) outcome = 'botch';

  const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
  const pScale = pFlags.scale ?? 1;
  const pOffX = pFlags.offX ?? 0;
  const pOffY = pFlags.offY ?? 0;
  let portraitStyle = '';
  if (pScale > 1 || pOffX || pOffY) {
    const r = 0.213 / pScale;
    const x = (pOffX * r).toFixed(1);
    const y = (pOffY * r).toFixed(1);
    portraitStyle = `object-position: calc(50% + ${x}px) calc(50% + ${y}px); transform: scale(${pScale});`;
  }

  const autoLabels = [];
  if (result.autoSuccesses) autoLabels.push(`${result.autoSuccesses} Potence`);
  if (wpUsed) autoLabels.push('1 WP');
  const autoLabel = autoLabels.join(' + ');

  const chatHtml = await renderTemplate('systems/vtm-v20/templates/roll-result.hbs', {
    actorImg: actor.img, actorName: actor.name,
    label: result.label, pool: result.pool, difficulty: result.difficulty,
    specialty: result.specialty, dice, total, outcome, portraitStyle,
    autoSuccesses: autoSucc, autoLabel, diceTotal, poolNote,
  });

  await showDice(roll, actor);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: chatHtml,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });

  return { total, outcome, dice };
}

// Roll a fixed-size pool with no dialog. Used when the pool is already determined
// (e.g. resolution phase reload rolls).
export async function rollFixedPool(actor, { pool, difficulty = 6, label = 'Roll', specialty = false } = {}) {
  pool = Math.max(pool, 1);
  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();

  let successes = 0, ones = 0;
  const dice = roll.terms[0].results.map(r => {
    const val = r.result;
    let status = 'fail';
    if (val >= difficulty) {
      successes++;
      status = 'success';
      if (val === 10 && specialty) { successes++; status = 'crit'; }
    }
    if (val === 1) { ones++; status = 'botch'; }
    return { value: val, status };
  });

  const hadSuccess = successes > 0;
  successes -= ones;
  let outcome = 'failure';
  if (successes > 0) outcome = 'success';
  else if (ones > 0 && !hadSuccess) outcome = 'botch';
  const total = Math.max(successes, 0);

  const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
  const pScale = pFlags.scale ?? 1;
  const pOffX = pFlags.offX ?? 0;
  const pOffY = pFlags.offY ?? 0;
  let portraitStyle = '';
  if (pScale > 1 || pOffX || pOffY) {
    const r = 0.213 / pScale;
    const x = (pOffX * r).toFixed(1);
    const y = (pOffY * r).toFixed(1);
    portraitStyle = `object-position: calc(50% + ${x}px) calc(50% + ${y}px); transform: scale(${pScale});`;
  }

  const chatHtml = await renderTemplate('systems/vtm-v20/templates/roll-result.hbs', {
    actorImg: actor.img, actorName: actor.name,
    label, pool, difficulty, specialty, dice, total, outcome, portraitStyle,
  });

  await showDice(roll, actor);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: chatHtml,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });

  return { total, outcome, dice };
}
