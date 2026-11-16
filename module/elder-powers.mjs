// Elder powers with mechanical teeth. The generic item-sheet roll covers pool,
// difficulty, and cost for most elders; the powers here need more (targets,
// soak, statuses), so the sheet hands their clicks to these flows instead.
import { rollDicePool, showDice } from './dice.mjs';
import {
  applyWounds, computeSoakPool, dazeThreshold, evalPool,
  finalDamageAfterSoak, getActor, getCondition, portraitStyle, statusEffectData,
} from './combat.mjs';
import { confirmAndSpend, whisperActivation } from './item-sheet.mjs';
import { hasStatus, FRENZY_STATUS_ID, CONTROLLED_FRENZY_STATUS_ID } from './status-effects.mjs';
import { effectiveTraitValue } from './discipline-effects.mjs';

async function enterFrenzy(actor, difficulty, note) {
  await actor.unsetFlag('vtm-v20', 'frenzyResist');
  if (difficulty) await actor.setFlag('vtm-v20', 'frenzyDiff', difficulty);
  if (!hasStatus(FRENZY_STATUS_ID, actor)) {
    await actor.createEmbeddedDocuments('ActiveEffect', [
      statusEffectData(FRENZY_STATUS_ID, 'Frenzy', 'systems/vtm-v20/VTM icons/frenzy-status.svg'),
    ]);
  }
  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: actor.img, actorName: actor.name,
    portraitStyle: portraitStyle(actor),
    label: 'Frenzy', noDice: true,
    hitLabel: note,
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// Fixed damage successes against a normal soak roll. The wounds land through
// the GM relay when the clicking player doesn't own the victim.
async function soakAndApply(source, victim, victimToken, successes, dmgType, label, dmgLabel) {
  const soakData = computeSoakPool(victim, { dmgType });
  let soakRoll = null;
  let soak = { dice: [], total: 0 };
  if (soakData.canSoak) {
    soakRoll = new Roll(`${Math.max(soakData.pool, 1)}d10`);
    await soakRoll.evaluate();
    soak = evalPool(soakRoll, soakData.difficulty);
  }

  const rawNet = Math.max(successes - soak.total, 0);
  const net = finalDamageAfterSoak(victim, rawNet, dmgType);
  const threshold = dazeThreshold(victim);
  const dazed = rawNet > 0 && rawNet > threshold;
  await applyWounds(victim, victimToken, { amount: net, type: dmgType, dazed });

  const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
    attackerName: source.name, attackerImg: source.img,
    attackerPortraitStyle: portraitStyle(source),
    defenderName: victim.name, defenderImg: victim.img,
    defenderPortraitStyle: portraitStyle(victim),
    weaponName: label, damageType: dmgType,
    dmgPool: 0, dmgLabel,
    dmgDice: [], dmgSuccesses: successes, dmgDiceTotal: successes,
    soakPool: soakData.pool, soakLabel: soakData.parts.join(' + '),
    soakDice: soak.dice, soakSuccesses: soak.total, soakSkipped: !soakData.canSoak,
    netDamage: net, noDamage: net === 0,
    damageAdjustment: rawNet !== net ? `Vampire bashing damage halved: ${rawNet} to ${net}.` : null,
    dazedNotice: dazed ? `${victim.name} is dazed (${rawNet} damage successes exceeded ${threshold}).` : null,
    condition: getCondition(victim),
    penalty: victim.system.woundPenalty ? `${victim.system.woundPenalty}` : null,
  });

  if (soakRoll) await showDice(soakRoll, victim);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// Conquer the Beast: enter a controlled frenzy at will (diff 7), or wrestle an
// involuntary one under control (diff 9, 1 WP per turn to hold it). V20 p. 128.
async function rollConquerTheBeast(actor, item, power) {
  if (hasStatus(CONTROLLED_FRENZY_STATUS_ID, actor)) {
    ui.notifications.info('Already in a controlled frenzy. Use End Frenzy on the banner.');
    return;
  }
  const raging = hasStatus(FRENZY_STATUS_ID, actor);
  const result = await rollDicePool(actor, {
    trait: power.primary || 'willpower',
    label: `${item.name}: ${power.name}${raging ? ' (control the frenzy)' : ''}`,
    difficulty: raging ? 9 : (power.difficulty || 7),
  });
  if (!result) return;

  if (result.outcome === 'success') {
    if (raging) {
      const ids = Array.from(actor.effects).filter(e => e.statuses?.has?.(FRENZY_STATUS_ID)).map(e => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
    }
    await actor.createEmbeddedDocuments('ActiveEffect', [
      statusEffectData(CONTROLLED_FRENZY_STATUS_ID, 'Controlled Frenzy', 'systems/vtm-v20/VTM icons/frenzy-status.svg'),
    ]);
    const note = raging
      ? `${actor.name} seizes the reins of the frenzy: controlled frenzy. Spend 1 Willpower each turn to keep hold of it, or it slips back into a true frenzy.`
      : `${actor.name} looses the Beast on a leash: controlled frenzy. Targets chosen at will, wound penalties ignored, immune to Rötschreck (p. 298). End it from the frenzy banner.`;
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: actor.img, actorName: actor.name,
      portraitStyle: portraitStyle(actor),
      label: power.name, noDice: true,
      hitLabel: note,
    });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
    return;
  }

  if (result.outcome === 'botch') {
    if (raging) {
      // p. 128: a botched control roll hardens the frenzy instead of taming it
      const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
        actorImg: actor.img, actorName: actor.name,
        portraitStyle: portraitStyle(actor),
        label: power.name, noDice: true,
        hitLabel: `${actor.name}'s grip slips: Self-Control rolls against this frenzy are at +2 difficulty, and Conquer the Beast is useless for the rest of the night.`,
      });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
    } else {
      await enterFrenzy(actor, power.difficulty || 7, `${actor.name} opens the cage and the Beast takes everything: an uncontrolled frenzy that Conquer the Beast cannot end.`);
    }
  }
}

// Taunt the Caged Beast: touch, 1 WP, Man + Empathy diff 7. The victim resists
// with Self-Control at 5 + successes or frenzies; works on mortals too. p. 128.
async function rollTauntCagedBeast(actor, item, power) {
  const targetToken = game.user.targets.first();
  const target = targetToken?.actor;
  if (!target) {
    ui.notifications.warn('Target a token first.');
    return;
  }

  const ok = await confirmAndSpend(actor, power.cost, power.name);
  if (!ok) return;
  await whisperActivation(actor, `${item.name}: ${power.name}`, null, power.cost, false);

  const result = await rollDicePool(actor, {
    trait: power.primary, trait2: power.secondary,
    label: `${item.name}: ${power.name} vs ${target.name}`,
    difficulty: power.difficulty || 7,
  });
  if (!result) return;

  if (result.outcome === 'botch') {
    await enterFrenzy(actor, power.difficulty || 7, `${actor.name} reaches for ${target.name}'s Beast and unleashes their own instead!`);
    return;
  }
  if (result.outcome !== 'success') return;

  const difficulty = Math.min(5 + result.total, 10);
  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: actor.img, actorName: actor.name,
    portraitStyle: portraitStyle(actor),
    targetImg: target.img, targetPortraitStyle: portraitStyle(target),
    label: power.name, noDice: true,
    hitLabel: `${actor.name}'s touch rouses ${target.name}'s Beast: resist with Self-Control/Instinct (diff ${difficulty}) or frenzy.`,
    resistBtn: { cls: 'taunt-resist-btn', icon: 'fa-fist-raised', label: 'Resist the Beast' },
  });
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: { 'vtm-v20': { combat: {
      phase: 'taunt-resist',
      defenderId: target.id,
      defenderTokenId: targetToken?.id ?? null,
      difficulty,
      resolved: false,
    } } },
  });
}

// Unchain the Beast: eye contact, 3 blood, Man + Intimidation against the
// victim's Self-Control + 4. Every success is one aggravated health level,
// soaked normally; a botch turns the power on its wielder. V20 p. 128.
async function rollUnchainTheBeast(actor, item, power) {
  const targetToken = game.user.targets.first();
  const target = targetToken?.actor;
  if (!target) {
    ui.notifications.warn('Target a token first.');
    return;
  }

  const sc = Number(target.system.virtues?.selfControl) || 0;
  const difficulty = Math.min(sc + 4, 10);

  const ok = await confirmAndSpend(actor, power.cost, power.name);
  if (!ok) return;
  await whisperActivation(actor, `${item.name}: ${power.name}`, null, power.cost, false);

  const result = await rollDicePool(actor, {
    trait: power.primary, trait2: power.secondary,
    label: `${item.name}: ${power.name} vs ${target.name} (their Self-Control + 4)`,
    difficulty,
  });
  if (!result) return;

  if (result.outcome === 'botch') {
    const ones = result.dice.filter(d => d.value === 1).length;
    await soakAndApply(actor, actor, null, ones, 'lethal', `${power.name} Backlash`, `1 lethal per 1 rolled: ${ones}`);
    return;
  }
  if (result.total > 0) {
    await soakAndApply(actor, target, targetToken ?? null, result.total, 'aggravated',
      power.name, `${result.total} success${result.total > 1 ? 'es' : ''}, 1 agg each`);
  }
}

// The same two questions Horrid Reality asks: the player may cap the damage
// or soften it to bashing before the dice are rolled
function promptNightmare(title) {
  const content = `
    <div style="margin:6px 0">
      <div class="form-group" style="margin-bottom:6px">
        <label>Damage Type</label>
        <select id="sn-dmg-type" style="width:100%">
          <option value="lethal">Lethal</option>
          <option value="bashing">Bashing</option>
        </select>
      </div>
      <div class="form-group">
        <label>Damage Limit (0 = no limit)</label>
        <input id="sn-limit" type="number" value="0" min="0" max="20" style="width:100%" />
      </div>
    </div>`;
  return new Promise(resolve => {
    new Dialog({
      title,
      content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll', callback: dlg => resolve({
          dmgType: dlg[0].querySelector('#sn-dmg-type').value,
          limit: parseInt(dlg[0].querySelector('#sn-limit').value) || 0,
        }) },
      },
      close: () => resolve(null),
    }, { classes: ['vtm-v20', 'dialog'], width: 300 }).render(true);
  });
}

// Shared Nightmare: Horrid Reality turned on a crowd. 2 WP plus one blood per
// victim, then a single Man + Subterfuge roll read against each victim's own
// Perception + Self-Control. Unsoakable, like the single-target power.
async function rollSharedNightmare(actor, item, power) {
  const tokens = Array.from(game.user.targets).filter(t => t.actor);
  if (!tokens.length) {
    ui.notifications.warn('Target the victims first.');
    return;
  }

  const opts = await promptNightmare(power.name);
  if (!opts) return;

  // The 2 WP is what sets Horrid Reality in motion for the scene. With it
  // already running, only the blood per victim is left to pay.
  const running = actor.getFlag('vtm-v20', 'horridReality');
  const cost = `${running ? '' : '2 Willpower, '}${tokens.length} blood`;
  const ok = await confirmAndSpend(actor, cost, power.name);
  if (!ok) return;
  await whisperActivation(actor, `${item.name}: ${power.name}`,
    `${tokens.length} victim${tokens.length > 1 ? 's' : ''}, 1 blood each.`, cost, false);

  const manip = effectiveTraitValue(actor, 'attributes.manipulation');
  const sub = effectiveTraitValue(actor, 'abilities.subterfuge');
  const pool = Math.max(manip + sub, 1);
  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  await showDice(roll, actor);

  // One set of dice, counted again at every victim's difficulty
  for (const token of tokens) {
    const victim = token.actor;
    const perc = victim.system.attributes?.perception || 0;
    const sc = victim.system.virtues?.selfControl || 0;
    const difficulty = Math.min(Math.max(perc + sc, 3), 10);
    const res = evalPool(roll, difficulty);
    const dmg = opts.limit > 0 ? Math.min(res.total, opts.limit) : res.total;
    if (dmg > 0) await applyWounds(victim, token, { amount: dmg, type: opts.dmgType });

    const capped = dmg < res.total ? ` (limit ${opts.limit})` : '';
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: actor.img, actorName: actor.name,
      portraitStyle: portraitStyle(actor),
      targetImg: victim.img, targetPortraitStyle: portraitStyle(victim),
      label: `${power.name} vs ${victim.name}`,
      sublabel: `Man ${manip} + Sub ${sub} vs Perc ${perc} + SC ${sc}`,
      pool, difficulty,
      dice: res.dice, total: res.total, outcome: res.outcome,
      hitLabel: dmg > 0 ? `${dmg} ${opts.dmgType} damage${capped}, no soak` : null,
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }
}

const ELDER_ACTIONS = {
  'animalism:conquer the beast': rollConquerTheBeast,
  'animalism:taunt the caged beast': rollTauntCagedBeast,
  'animalism:unchain the beast': rollUnchainTheBeast,
  'chimerstry:shared nightmare': rollSharedNightmare,
};

export function elderPowerAction(item, power) {
  if (item?.type !== 'discipline') return null;
  const key = `${(item.name || '').toLowerCase()}:${(power?.name || '').toLowerCase().trim()}`;
  return ELDER_ACTIONS[key] ?? null;
}

// Fatuus Mastery (Chimerstry 6): the first three levels cost no Willpower or
// blood. Returns the note for the activation card, or null when the cost stands.
export function costWaiver(item, key) {
  if (item?.type !== 'discipline' || (item.name || '').toLowerCase() !== 'chimerstry') return null;
  if (!['lvl1', 'lvl2', 'lvl3'].includes(key)) return null;
  const lvl = Number(item.system.level) || 0;
  const mastery = (item.system.elderPowers || [])
    .some(p => p?.known && p.level <= lvl && (p.name || '').toLowerCase().trim() === 'fatuus mastery');
  return mastery ? 'Fatuus Mastery: no cost.' : null;
}

// Taunt's resist button, bound from the chat render hook beside bindCombatButtons
export function bindElderPowerButtons(msg, html) {
  const c = msg.flags?.['vtm-v20']?.combat;
  if (!c || c.phase !== 'taunt-resist') return;

  const el = html instanceof HTMLElement ? html : (html[0] || html);
  const btn = el?.querySelector('.taunt-resist-btn');
  if (!btn) return;
  if (c.resolved) { btn.remove(); return; }

  const defender = getActor(c.defenderId, c.defenderTokenId);
  if (!defender || (!defender.isOwner && !game.user.isGM)) { btn.remove(); return; }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const result = await rollDicePool(defender, {
      trait: 'virtues.selfControl',
      label: 'Resist the Roused Beast',
      difficulty: c.difficulty || 5,
    });
    if (!result) { btn.disabled = false; return; }

    if (msg.isAuthor || game.user.isGM) {
      await msg.update({ 'flags.vtm-v20.combat.resolved': true });
    } else {
      game.socket.emit('system.vtm-v20', { action: 'resolveMsg', msgId: msg.id });
    }

    if (result.outcome === 'success') {
      const card = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
        actorImg: defender.img, actorName: defender.name,
        portraitStyle: portraitStyle(defender),
        label: 'Beast Resisted', noDice: true,
        defendedLabel: `${defender.name} chains the Beast back down.`,
      });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        content: card,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
    } else {
      await enterFrenzy(defender, c.difficulty, `${defender.name}'s Beast tears free: frenzy!`);
    }
  });
}
