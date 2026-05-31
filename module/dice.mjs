// Find an active player who owns this actor (prefer non-GM so dice match the player's theme)
function getOwner(actor) {
  const owners = game.users.filter(u => u.active && actor.testUserPermission(u, 'OWNER') && !u.isGM);
  return owners[0] || game.users.find(u => u.active && u.isGM) || game.user;
}

// Trigger Dice So Nice with the actor owner's theme instead of the roller's
export async function showDice(roll, actor) {
  if (!game.dice3d) return;
  await game.dice3d.showForRoll(roll, getOwner(actor), true);
}

export async function rollDicePool(actor, { trait, trait2, label, pool, difficulty = 6 } = {}) {
  const sys = actor.system;

  const allTraits = {};
  if (sys.attributes) {
    for (const [k, v] of Object.entries(sys.attributes)) {
      allTraits[`attributes.${k}`] = {
        label: game.i18n.localize(`VTM.${k.charAt(0).toUpperCase() + k.slice(1)}`),
        value: v, group: 'attributes'
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
  // Willpower and Virtue rolls aren't hindered by wounds
  const woundImmune = k => k === 'willpower' || (k || '').startsWith('virtues.');
  const armorPen = Array.from(actor.items)
    .filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((sum, i) => sum + (i.system.penalty || 0), 0);

  const dlgHtml = await renderTemplate('systems/vtm-v20/templates/roll-dialog.hbs', {
    trait, trait2, label, difficulty, woundPen, armorPen,
    attrOpts: groupOpts('attributes'),
    abilOpts: groupOpts('abilities'),
    virtOpts: groupOpts('virtues'),
    otherOpts: groupOpts('other'),
  });

  const result = await new Promise(resolve => {
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
            const diff = parseInt(form.difficulty.value) || 6;
            const spec = form.specialty.checked;

            const wp = (woundImmune(pri) || woundImmune(sec)) ? 0 : woundPen;

            let total = mod + wp;
            let parts = [];
            if (pri && allTraits[pri]) { total += allTraits[pri].value; parts.push(allTraits[pri].label); }
            if (sec && allTraits[sec]) { total += allTraits[sec].value; parts.push(allTraits[sec].label); }
            if (mod > 0) parts.push(`+${mod}`);
            else if (mod < 0) parts.push(`${mod}`);
            if (wp) parts.push(`wound ${wp}`);
            if (armorPen && (pri === 'attributes.dexterity' || sec === 'attributes.dexterity')) {
              total += armorPen;
              parts.push(`armor ${armorPen}`);
            }
            total = Math.max(total, 1);

            resolve({ pool: total, difficulty: diff, specialty: spec, label: parts.join(' + ') || label });
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
      },
      default: 'roll',
      close: () => resolve(null)
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 420 }).render(true);
  });

  if (!result) return null;

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
  let outcome = 'failure';
  if (successes > 0) outcome = 'success';
  else if (successes < 0 || (successes <= 0 && ones > 0)) outcome = 'botch';
  const total = Math.max(successes, 0);

  // Compute portrait positioning so the chat card matches the sheet framing.
  // Offsets are stored as pixels relative to the 100px sheet portrait,
  // so scale them to the 32px chat portrait and compensate for the zoom transform.
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
