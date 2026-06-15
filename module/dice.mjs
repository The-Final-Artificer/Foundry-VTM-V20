// Find an active player who owns this actor (prefer non-GM so dice match the player's theme)
import { blindedDifficulty } from './status-effects.mjs';
import { effectiveTraitValue, potenceAutoSuccesses, usesStrengthTrait } from './discipline-effects.mjs';

function getOwner(actor) {
  const owners = game.users.filter(u => u.active && actor.testUserPermission(u, 'OWNER') && !u.isGM);
  return owners[0] || game.users.find(u => u.active && u.isGM) || game.user;
}

// Trigger Dice So Nice with the actor owner's theme instead of the roller's
export async function showDice(roll, actor) {
  if (!game.dice3d) return;
  await game.dice3d.showForRoll(roll, getOwner(actor), true);
}

export async function rollDicePool(actor, { trait, trait2, label, pool, difficulty = 6, poolMod = 0, poolOverride = null } = {}) {
  // Resolution shortcut: skip dialog/capture, roll with the given pool directly.
  // Everything after this block (roll, tally, chat card) still runs normally.
  let result;
  if (poolOverride !== null) {
    result = {
      pool: Math.max(poolOverride, 1),
      difficulty: Number(difficulty) || 6,
      specialty: false,
      label: label || 'Roll',
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
    for (const [k, v] of Object.entries(sys.virtues)) {
      allTraits[`virtues.${k}`] = {
        label: game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`),
        value: v, group: 'virtues'
      };
    }
  }
  if (sys.willpower) {
    allTraits['willpower'] = { label: 'Willpower', value: sys.willpower.max, group: 'other' };
  }
  if (sys.humanity !== undefined) {
    allTraits['humanity'] = { label: sys.pathName || 'Humanity', value: sys.humanity, group: 'other' };
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
  const dialogDifficulty = initialBlindedImmune ? baseDifficulty : blindedDifficultyValue;
  const armorPen = Array.from(actor.items)
    .filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((sum, i) => sum + (i.system.penalty || 0), 0);

  const dlgHtml = await renderTemplate('systems/vtm-v20/templates/roll-dialog.hbs', {
    trait, trait2, label, difficulty: dialogDifficulty, woundPen, armorPen, blindedPenalty, potenceAuto,
    attrOpts: groupOpts('attributes'),
    abilOpts: groupOpts('abilities'),
    virtOpts: groupOpts('virtues'),
    otherOpts: groupOpts('other'),
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
            total = Math.max(total, 1);

            const rollLabel = parts.join(' + ') || label;
            resolve({
              pool: total,
              difficulty: diff,
              specialty: spec,
              autoSuccesses: autoSucc,
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
        if (armorRow.length) {
          const checkDex = () => {
            const pri = html.find('[name="primary"]').val();
            const sec = html.find('[name="secondary"]').val();
            armorRow.toggle(pri === 'attributes.dexterity' || sec === 'attributes.dexterity');
          };
          checkDex();
          html.find('[name="primary"], [name="secondary"]').change(checkDex);
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

  successes -= ones;
  const autoSucc = result.autoSuccesses || 0;
  const diceTotal = Math.max(successes, 0);
  const total = diceTotal + autoSucc;
  let outcome = 'failure';
  if (total > 0) outcome = 'success';
  else if (autoSucc > 0) outcome = 'failure';
  else if (ones > 0 && successes <= 0) outcome = 'botch';

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
    label: result.label, pool: result.pool, difficulty: result.difficulty,
    specialty: result.specialty, dice, total, outcome, portraitStyle,
    autoSuccesses: autoSucc, diceTotal,
  });

  await showDice(roll, actor);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: chatHtml,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
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

  successes -= ones;
  let outcome = 'failure';
  if (successes > 0) outcome = 'success';
  else if (successes < 0 || (successes <= 0 && ones > 0)) outcome = 'botch';
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
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });

  return { total, outcome, dice };
}
