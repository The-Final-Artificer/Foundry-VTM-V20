// Combat resolution: attack rolls, defense choices, damage + soak, auto-apply
import { showDice } from './dice.mjs';

function portraitStyle(actor) {
  const p = actor.getFlag('vtm-v20', 'portrait') || {};
  const s = p.scale ?? 1, ox = p.offX ?? 0, oy = p.offY ?? 0;
  if (s <= 1 && !ox && !oy) return '';
  const r = 0.213 / s;
  return `object-position: calc(50% + ${(ox * r).toFixed(1)}px) calc(50% + ${(oy * r).toFixed(1)}px); transform: scale(${s});`;
}

function evalPool(roll, diff) {
  let succ = 0, ones = 0;
  const dice = roll.terms[0].results.map(r => {
    const v = r.result;
    let st = 'fail';
    if (v >= diff) { succ++; st = 'success'; }
    if (v === 1) { ones++; st = 'botch'; }
    return { value: v, status: st };
  });
  succ -= ones;
  let outcome = 'failure';
  if (succ > 0) outcome = 'success';
  else if (succ < 0 || (succ <= 0 && ones > 0)) outcome = 'botch';
  return { dice, total: Math.max(succ, 0), raw: succ, outcome };
}

// "Str+2" → strength + 2 + net successes; "4" → 4 + net successes
function calcDmgPool(formula, str, netSucc) {
  const f = (formula || '').trim().toLowerCase();
  let base;
  if (!f || f === 'str') base = str;
  else if (f.startsWith('str')) base = str + (parseInt(f.replace(/str\+?/, '')) || 0);
  else base = parseInt(f) || 0;
  return Math.max(base + netSucc, 1);
}

// Resolve actor through its token first (handles unlinked tokens with their own data)
function getActor(actorId, tokenId) {
  if (tokenId && canvas.tokens) {
    const tok = canvas.tokens.get(tokenId);
    if (tok?.actor) return tok.actor;
  }
  return game.actors.get(actorId);
}

// Mark a combat message as resolved. If we don't own the message, ask the GM to do it.
async function resolveMessage(msg) {
  if (msg.isAuthor || game.user.isGM) {
    await msg.update({ 'flags.vtm-v20.combat.resolved': true });
  } else {
    game.socket.emit('system.vtm-v20', { action: 'resolveMsg', msgId: msg.id });
  }
}

export function getCondition(actor) {
  const lvls = actor.system.health.levels;
  for (const k of ['incapacitated', 'crippled', 'mauled', 'wounded', 'injured', 'hurt', 'bruised']) {
    if (lvls[k] > 0) return k.charAt(0).toUpperCase() + k.slice(1);
  }
  return 'Unharmed';
}


// ── Phase 1: Attack Roll ────────────────────────────────────────────

export async function rollAttack(attacker, atk) {
  const target = game.user.targets.size ? game.user.targets.first() : null;
  const defender = target?.actor;
  const attackerToken = canvas.tokens?.placeables.find(t => t.actor === attacker);

  const dex = attacker.system.attributes?.dexterity || 0;
  const sk = atk.skill.split('.')[1];
  const skVal = attacker.system.abilities?.[sk] || 0;
  const wp = attacker.system.woundPenalty || 0;
  const ap = Array.from(attacker.items)
    .filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((s, i) => s + (i.system.penalty || 0), 0);
  const pool = Math.max(dex + skVal + wp + ap, 1);

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, 6);

  const skLabel = game.i18n.localize(`VTM.${sk.charAt(0).toUpperCase() + sk.slice(1)}`);
  const parts = [`Dex ${dex}`, `${skLabel} ${skVal}`];
  if (wp) parts.push(`wound ${wp}`);
  if (ap) parts.push(`armor ${ap}`);

  const canDef = res.outcome === 'success' && !!defender;
  const label = defender ? `${atk.name} → ${defender.name}` : `${atk.name} Attack`;

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: attacker.img, actorName: attacker.name,
    portraitStyle: portraitStyle(attacker),
    targetImg: defender?.img || null,
    targetPortraitStyle: defender ? portraitStyle(defender) : '',
    label, sublabel: parts.join(' + '),
    pool, difficulty: 6, isAttack: true,
    dice: res.dice, total: res.total, outcome: res.outcome,
    canDefend: canDef, targetName: defender?.name,
  });

  const flags = {};
  if (canDef) {
    flags['vtm-v20'] = { combat: {
      phase: 'attack',
      attackerId: attacker.id,
      attackerTokenId: attackerToken?.id || null,
      defenderTokenId: target.id,
      defenderId: defender.id,
      attackSuccesses: res.total,
      weaponName: atk.name,
      damageFormula: atk.damageFormula,
      damageType: atk.damageType,
      isRanged: atk.isRanged,
    }};
  }

  await showDice(roll, attacker);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER, flags,
  });
}


// ── Phase 2: Defense Roll ───────────────────────────────────────────

export async function rollDefense(msg) {
  const c = msg.flags?.['vtm-v20']?.combat;
  if (!c || c.phase !== 'attack') return;

  const defender = getActor(c.defenderId, c.defenderTokenId);
  if (!defender) return ui.notifications.error('Defender not found.');
  if (!defender.isOwner && !game.user.isGM)
    return ui.notifications.warn("You don't control this character.");

  // Build defense options (ranged attacks can only be dodged)
  const types = { dodge: { label: 'Dodge', attr: 'dexterity', skill: 'athletics' } };
  if (!c.isRanged) {
    types.block = { label: 'Block', attr: 'dexterity', skill: 'brawl' };
    types.parry = { label: 'Parry', attr: 'dexterity', skill: 'melee' };
  }

  const btnEntries = Object.entries(types).map(([key, d]) => {
    const a = defender.system.attributes?.[d.attr] || 0;
    const s = defender.system.abilities?.[d.skill] || 0;
    const sl = game.i18n.localize(`VTM.${d.skill.charAt(0).toUpperCase() + d.skill.slice(1)}`);
    return [key, `${d.label} (Dex + ${sl}) [${a + s}]`];
  });
  btnEntries.push(['none', 'No Defense']);

  const choice = await new Promise(resolve => {
    const btns = {};
    for (const [k, lbl] of btnEntries)
      btns[k] = { label: lbl, callback: () => resolve(k === 'none' ? null : k) };
    new Dialog({
      title: `${defender.name}: Choose Defense`,
      content: `<p style="margin:8px 0;color:#ddd;">Defend against ${c.weaponName}?</p>`,
      buttons: btns, default: 'dodge',
      close: () => resolve(null),
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-defense-dialog'], width: 400 }).render(true);
  });

  // Disable the defend button on the original attack message
  await resolveMessage(msg);

  const base = {
    phase: 'defense', attackerId: c.attackerId, attackerTokenId: c.attackerTokenId,
    defenderId: c.defenderId, defenderTokenId: c.defenderTokenId, weaponName: c.weaponName,
    damageFormula: c.damageFormula, damageType: c.damageType, isRanged: c.isRanged,
  };

  // No defense chosen: attack lands with full successes
  if (!choice) {
    base.netSuccesses = c.attackSuccesses;
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: defender.img, actorName: defender.name,
      portraitStyle: portraitStyle(defender),
      label: 'No Defense', sublabel: '',
      noDice: true, showDamageBtn: true,
      hitLabel: `${c.weaponName} hits with ${c.attackSuccesses} net success${c.attackSuccesses > 1 ? 'es' : ''}!`,
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: html, type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: { 'vtm-v20': { combat: base } },
    });
    return;
  }

  // Roll defense pool
  const def = types[choice];
  const av = defender.system.attributes?.[def.attr] || 0;
  const sv = defender.system.abilities?.[def.skill] || 0;
  const wp = defender.system.woundPenalty || 0;
  const ap = Array.from(defender.items)
    .filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((s, i) => s + (i.system.penalty || 0), 0);
  const pool = Math.max(av + sv + wp + ap, 1);

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, 6);

  const net = c.attackSuccesses - res.total;
  const hit = net > 0;
  if (hit) base.netSuccesses = net;

  const sl = game.i18n.localize(`VTM.${def.skill.charAt(0).toUpperCase() + def.skill.slice(1)}`);
  const parts = [`Dex ${av}`, `${sl} ${sv}`];
  if (wp) parts.push(`wound ${wp}`);
  if (ap) parts.push(`armor ${ap}`);

  const verbs = { dodge: 'dodges', block: 'blocks', parry: 'parries' };

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: defender.img, actorName: defender.name,
    portraitStyle: portraitStyle(defender),
    label: `${def.label} Defense`, sublabel: parts.join(' + '),
    pool, difficulty: 6, isAttack: false,
    dice: res.dice, total: res.total, outcome: res.outcome,
    showDamageBtn: hit,
    hitLabel: hit ? `${c.weaponName} hits with ${net} net success${net > 1 ? 'es' : ''}!` : null,
    defendedLabel: !hit ? `${defender.name} ${verbs[choice]} the attack!` : null,
  });

  await showDice(roll, defender);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    content: html,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: hit ? { 'vtm-v20': { combat: base } } : {},
  });
}


// ── Phase 3: Damage + Soak Resolution ──────────────────────────────

export async function rollDamage(msg) {
  const c = msg.flags?.['vtm-v20']?.combat;
  if (!c || c.phase !== 'defense') return;

  await resolveMessage(msg);

  const attacker = getActor(c.attackerId, c.attackerTokenId);
  const defender = getActor(c.defenderId, c.defenderTokenId);
  if (!attacker || !defender) return ui.notifications.error('Actor not found.');

  // Damage roll
  const str = attacker.system.attributes?.strength || 0;
  const dp = calcDmgPool(c.damageFormula, str, c.netSuccesses);
  const dmgRoll = new Roll(`${dp}d10`);
  await dmgRoll.evaluate();
  const dmg = evalPool(dmgRoll, 6);

  // Soak roll
  const sta = defender.system.attributes?.stamina || 0;
  const di = Array.from(defender.items);
  const fort = di.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
  const fl = fort?.system.level || 0;
  const ar = di.filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((s, i) => s + (i.system.rating || 0), 0);
  const sp = Math.max(sta + fl + ar, 1);
  const soakRoll = new Roll(`${sp}d10`);
  await soakRoll.evaluate();
  const soak = evalPool(soakRoll, 6);

  // Apply net damage
  const net = Math.max(dmg.total - soak.total, 0);
  const dt = c.damageType || 'lethal';
  if (net > 0) await applyHealthDamage(defender, net, dt);

  // Read condition AFTER damage is applied
  const cond = getCondition(defender);
  const pen = defender.system.woundPenalty || 0;

  // Build labels for the card
  const f = (c.damageFormula || '').trim().toLowerCase();
  let dmgLabel;
  if (!f || f === 'str' || f.startsWith('str')) {
    const bonus = f.startsWith('str') ? (parseInt(f.replace(/str\+?/, '')) || 0) : 0;
    dmgLabel = bonus ? `Str ${str} + ${bonus} + ${c.netSuccesses} net` : `Str ${str} + ${c.netSuccesses} net`;
  } else {
    dmgLabel = `Base ${parseInt(f) || 0} + ${c.netSuccesses} net`;
  }
  const soakParts = [`Sta ${sta}`];
  if (fl) soakParts.push(`Fort ${fl}`);
  if (ar) soakParts.push(`Armor ${ar}`);

  const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
    attackerName: attacker.name, attackerImg: attacker.img,
    attackerPortraitStyle: portraitStyle(attacker),
    defenderName: defender.name, defenderImg: defender.img,
    defenderPortraitStyle: portraitStyle(defender),
    weaponName: c.weaponName, damageType: dt,
    dmgPool: dp, dmgLabel,
    dmgDice: dmg.dice, dmgSuccesses: dmg.total,
    soakPool: sp, soakLabel: soakParts.join(' + '),
    soakDice: soak.dice, soakSuccesses: soak.total,
    netDamage: net, noDamage: net === 0,
    condition: cond, penalty: pen ? `${pen}` : null,
  });

  await showDice(dmgRoll, attacker);
  await showDice(soakRoll, defender);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}


// ── Health Damage Application ───────────────────────────────────────

export async function applyHealthDamage(actor, amount, type) {
  const levels = foundry.utils.deepClone(actor.system.health.levels);
  const keys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];
  const cap = keys.length;

  // Count what's already on the track
  let bash = 0, leth = 0, agg = 0;
  for (const k of keys) {
    if (levels[k] === 1) bash++;
    else if (levels[k] === 2) leth++;
    else if (levels[k] === 3) agg++;
  }

  // Add new damage: fill empty slots first, overflow upgrades lower types
  const filled = agg + leth + bash;
  const fits = Math.min(amount, cap - filled);
  const overflow = amount - fits;

  if (type === 'bashing') bash += fits;
  else if (type === 'lethal') leth += fits;
  else agg += fits;

  for (let i = 0; i < overflow; i++) {
    if (type === 'bashing' || type === 'lethal') {
      // Bashing/lethal overflow: upgrade one bashing to lethal
      if (bash > 0) { bash--; leth++; }
    } else {
      // Aggravated overflow: upgrade lethal to agg, or bashing to agg
      if (leth > 0) { leth--; agg++; }
      else if (bash > 0) { bash--; agg++; }
    }
  }

  // Rebuild track with V20 ordering: agg on top, then lethal, then bashing
  let idx = 0;
  for (let i = 0; i < agg && idx < cap; i++) levels[keys[idx++]] = 3;
  for (let i = 0; i < leth && idx < cap; i++) levels[keys[idx++]] = 2;
  for (let i = 0; i < bash && idx < cap; i++) levels[keys[idx++]] = 1;
  while (idx < cap) levels[keys[idx++]] = 0;

  await actor.update({ 'system.health.levels': levels });
}


// ── Chat Button Wiring ─────────────────────────────────────────────
// Called from renderChatMessage hook in vtm-v20.mjs

export function bindCombatButtons(msg, html) {
  const c = msg.flags?.['vtm-v20']?.combat;
  if (!c) return;

  // html could be jQuery or HTMLElement depending on Foundry version
  const el = html instanceof HTMLElement ? html : (html[0] || html);
  if (!el) return;

  if (c.phase === 'attack') {
    const btn = el.querySelector('.combat-defend-btn');
    if (!btn) return;
    if (c.resolved) { btn.remove(); return; }

    const defender = getActor(c.defenderId, c.defenderTokenId);
    if (!defender?.isOwner && !game.user.isGM) { btn.remove(); return; }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Defending...';
      await rollDefense(msg);
    });
  }

  if (c.phase === 'defense') {
    const btn = el.querySelector('.combat-damage-btn');
    if (!btn) return;
    if (c.resolved) { btn.remove(); return; }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Rolling...';
      await rollDamage(msg);
    });
  }
}
