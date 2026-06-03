// Combat resolution: attack rolls, defense choices, damage + soak, auto-apply
import { showDice } from './dice.mjs';
import {
  BLINDED_STATUS_ID,
  DAZED_STATUS_ID,
  FULL_IMMOBILIZED_STATUS_ID,
  STRUGGLING_IMMOBILIZED_STATUS_ID,
  hasStatus,
  iterableValues,
} from './status-effects.mjs';

const TARGETING_ARMOR_REQUESTS = new Map();

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

function firstActiveGm() {
  const activeGms = game.users?.filter(user => user.active && user.isGM) ?? [];
  return activeGms[0] ?? null;
}

async function promptTargetingArmorChoice({ attackerName, defenderName, weaponName, targeting }) {
  return new Promise(resolve => {
    const targetLabel = targeting?.label ?? 'Targeted attack';
    new Dialog({
      title: 'Targeted Attack',
      content: `
        <div class="vtm-roll-dialog gm-targeting-dialog">
          <p class="gm-targeting-intro">Decide whether this targeted attack bypasses armor before the roll proceeds.</p>
          <div class="gm-targeting-summary">
            <strong>${attackerName}</strong> attacks <strong>${defenderName}</strong> with <strong>${weaponName}</strong>.<br>
            ${targetLabel}: Difficulty +${targeting?.difficultyMod ?? 0}, Damage +${targeting?.damageMod ?? 0}
          </div>
        </div>
      `,
      buttons: {
        armor: {
          icon: '<i class="fas fa-shield-alt"></i>',
          label: 'Armor Applies',
          callback: () => resolve(false),
        },
        bypass: {
          icon: '<i class="fas fa-bullseye"></i>',
          label: 'Bypass Armor',
          callback: () => resolve(true),
        },
      },
      default: 'armor',
      close: () => resolve(false),
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-gm-targeting-dialog'], width: 410 }).render(true);
  });
}

async function requestGmTargetingArmorChoice(attacker, defender, atk, targeting) {
  if (!targeting || !defender) return false;

  if (game.user.isGM) {
    return promptTargetingArmorChoice({
      attackerName: attacker.name,
      defenderName: defender.name,
      weaponName: atk.name,
      targeting,
    });
  }

  const gm = firstActiveGm();
  if (!gm) {
    ui.notifications.warn('No active GM found for the targeted attack armor decision. Armor will apply.');
    return false;
  }

  const requestId = foundry.utils.randomID();
  const result = new Promise(resolve => {
    TARGETING_ARMOR_REQUESTS.set(requestId, resolve);
    window.setTimeout(() => {
      if (!TARGETING_ARMOR_REQUESTS.has(requestId)) return;
      TARGETING_ARMOR_REQUESTS.delete(requestId);
      ui.notifications.warn('Targeted attack armor decision timed out. Armor will apply.');
      resolve(false);
    }, 30000);
  });

  game.socket.emit('system.vtm-v20', {
    action: 'targetingArmorRequest',
    requestId,
    requestingUserId: game.user.id,
    targetGmId: gm.id,
    attackerName: attacker.name,
    defenderName: defender.name,
    weaponName: atk.name,
    targeting,
  });

  return result;
}

export function bindCombatSocketHandlers() {
  game.socket.on('system.vtm-v20', async data => {
    if (!data) return;

    if (data.action === 'targetingArmorRequest') {
      if (!game.user.isGM || data.targetGmId !== game.user.id) return;
      const bypassArmor = await promptTargetingArmorChoice(data);
      game.socket.emit('system.vtm-v20', {
        action: 'targetingArmorResponse',
        requestId: data.requestId,
        requestingUserId: data.requestingUserId,
        bypassArmor,
      });
      return;
    }

    if (data.action === 'targetingArmorResponse') {
      if (data.requestingUserId !== game.user.id) return;
      const resolve = TARGETING_ARMOR_REQUESTS.get(data.requestId);
      if (!resolve) return;
      TARGETING_ARMOR_REQUESTS.delete(data.requestId);
      resolve(data.bypassArmor === true);
    }
  });
}

function signed(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : `${n}`;
}

function traitLabel(path) {
  if (!path) return '';
  if (path === 'willpower') return 'Willpower';
  if (path === 'humanity') return 'Humanity';
  const [, key] = path.split('.');
  if (!key) return path;
  return game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`);
}

function traitValue(actor, path) {
  if (!path) return 0;
  if (path === 'willpower') return actor.system.willpower?.max || 0;
  if (path === 'humanity') return actor.system.humanity || 0;
  const [category, key] = path.split('.');
  return actor.system[category]?.[key] || 0;
}

function woundImmune(path) {
  return path === 'willpower' || String(path || '').startsWith('virtues.');
}

const COVER_EFFECTS = {
  'vtm-cover-light': { label: 'light cover', penalty: 1 },
  'vtm-cover-good': { label: 'good cover', penalty: 2 },
  'vtm-cover-superior': { label: 'superior cover', penalty: 3 },
};

function collectStatusIds(doc, ids = new Set()) {
  if (!doc) return ids;

  for (const id of iterableValues(doc.statuses)) ids.add(id);

  for (const effect of iterableValues(doc.effects)) {
    if (effect.disabled) continue;
    for (const id of iterableValues(effect.statuses)) ids.add(id);

    const coreStatus = effect.getFlag?.('core', 'statusId') ?? effect.flags?.core?.statusId;
    if (coreStatus) ids.add(coreStatus);

    if (effect.statusId) ids.add(effect.statusId);
  }

  return ids;
}

function isBlinded(token, actor) {
  return hasStatus(BLINDED_STATUS_ID, token, token?.document, token?.actor, actor);
}

function isDazed(token, actor) {
  return hasStatus(DAZED_STATUS_ID, token, token?.document, token?.actor, actor);
}

function isStrugglingImmobilized(token, actor) {
  return hasStatus(STRUGGLING_IMMOBILIZED_STATUS_ID, token, token?.document, token?.actor, actor);
}

function isFullyImmobilized(token, actor) {
  return hasStatus(FULL_IMMOBILIZED_STATUS_ID, token, token?.document, token?.actor, actor);
}

function coverFor(token, actor) {
  const ids = new Set();
  collectStatusIds(token, ids);
  collectStatusIds(token?.document, ids);
  collectStatusIds(token?.actor, ids);
  collectStatusIds(actor, ids);

  let cover = null;
  for (const id of ids) {
    const current = COVER_EFFECTS[id];
    if (!current) continue;
    if (!cover || current.penalty > cover.penalty) cover = current;
  }
  return cover;
}

function coverDifficulty(attacker, attackerToken, target, atk) {
  const base = 6;
  const maneuverPenalty = Number(atk.difficultyMod) || 0;
  if (!atk.isRanged) {
    return {
      difficulty: Math.max(Math.min(base + maneuverPenalty, 10), 3),
      parts: maneuverPenalty ? [`maneuver ${signed(maneuverPenalty)}`] : [],
    };
  }

  const parts = [];
  let penalty = maneuverPenalty;
  if (maneuverPenalty) parts.push(`maneuver ${signed(maneuverPenalty)}`);

  const targetCover = coverFor(target, target?.actor);
  if (targetCover) {
    penalty += targetCover.penalty;
    parts.push(`target ${targetCover.label} +${targetCover.penalty}`);
  }

  const attackerCover = coverFor(attackerToken, attacker);
  if (attackerCover) {
    const returnFirePenalty = Math.max(attackerCover.penalty - 1, 0);
    if (returnFirePenalty > 0) {
      penalty += returnFirePenalty;
      parts.push(`attacker ${attackerCover.label} +${returnFirePenalty}`);
    }
  }

  return { difficulty: Math.max(Math.min(base + penalty, 10), 3), parts };
}

function targetingData(targeting) {
  if (!targeting || typeof targeting !== 'object') return null;
  const difficultyMod = Math.max(Number(targeting.difficultyMod) || 0, 0);
  const damageMod = Math.max(Number(targeting.damageMod) || 0, 0);
  if (!difficultyMod && !damageMod) return null;
  return {
    size: targeting.size || 'targeted',
    label: targeting.label || 'Targeted attack',
    difficultyMod,
    damageMod,
  };
}

// Damage formulas: "Str+2" means strength + 2 + net successes; "4" means 4 + net successes.
function calcDmgPool(formula, str, netSucc) {
  const f = (formula || '').trim().toLowerCase();
  let base;
  if (!f || f === 'str') base = str;
  else if (f.startsWith('str')) base = str + (parseInt(f.replace(/str\+?/, '')) || 0);
  else base = parseInt(f) || 0;
  return Math.max(base + netSucc, 1);
}

export function finalDamageAfterSoak(actor, amount, type) {
  const net = Math.max(amount, 0);
  const damageType = String(type || '').toLowerCase();
  return actor?.type === 'vampire' && damageType === 'bashing' ? Math.floor(net / 2) : net;
}

// Resolve actor through its token first (handles unlinked tokens with their own data)
function getActor(actorId, tokenId) {
  if (tokenId && canvas.tokens) {
    const tok = canvas.tokens.get(tokenId);
    if (tok?.actor) return tok.actor;
  }
  return game.actors.get(actorId);
}

function getToken(tokenId) {
  return tokenId && canvas.tokens ? canvas.tokens.get(tokenId) : null;
}

function attackPool(actor, atk) {
  const traits = Array.isArray(atk.poolTraits) && atk.poolTraits.length
    ? atk.poolTraits.filter(Boolean)
    : ['attributes.dexterity', atk.skill].filter(Boolean);
  const parts = traits.map(path => `${traitLabel(path)} ${traitValue(actor, path)}`);
  let total = traits.reduce((sum, path) => sum + traitValue(actor, path), 0);

  const accuracyMod = Number(atk.accuracyMod) || 0;
  if (accuracyMod) {
    total += accuracyMod;
    parts.push(`accuracy ${signed(accuracyMod)}`);
  }

  const wp = traits.some(woundImmune) ? 0 : (actor.system.woundPenalty || 0);
  if (wp) {
    total += wp;
    parts.push(`wound ${wp}`);
  }

  const ap = traits.includes('attributes.dexterity')
    ? Array.from(actor.items)
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((s, i) => s + (i.system.penalty || 0), 0)
    : 0;
  if (ap) {
    total += ap;
    parts.push(`armor ${ap}`);
  }

  return { pool: Math.max(total, 1), parts };
}

function dazeThreshold(actor) {
  const stamina = actor.system.attributes?.stamina || 0;
  return actor.type === 'mortal' ? stamina : stamina + 2;
}

async function applyDazed(actor) {
  const existing = CONFIG.statusEffects.find(effect => effect.id === DAZED_STATUS_ID);
  const icon = existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/star-swirl.svg';
  const name = existing?.name ?? existing?.label ?? 'Dazed';
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name,
    label: name,
    icon,
    img: icon,
    origin: 'status',
    statuses: [DAZED_STATUS_ID],
    flags: { core: { statusId: DAZED_STATUS_ID } },
  }]);
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

export async function rollAttack(attacker, atk, options = {}) {
  const target = game.user.targets.size ? game.user.targets.first() : null;
  const defender = target?.actor;
  const attackerToken = canvas.tokens?.placeables.find(t => t.actor === attacker);
  const cover = coverDifficulty(attacker, attackerToken, target, atk);
  const targeting = targetingData(options.targeting);
  const bypassArmor = await requestGmTargetingArmorChoice(attacker, defender, atk, targeting);
  const attackerBlinded = isBlinded(attackerToken, attacker);
  const targetBlinded = isBlinded(target, defender);
  const targetStrugglingImmobilized = isStrugglingImmobilized(target, defender);
  const targetFullyImmobilized = isFullyImmobilized(target, defender);

  const atkPool = attackPool(attacker, atk);
  const blindTargetBonus = targetBlinded ? 2 : 0;
  const strugglingImmobilizedBonus = targetStrugglingImmobilized ? 2 : 0;
  const pool = Math.max(atkPool.pool + blindTargetBonus + strugglingImmobilizedBonus, 1);
  const targetingDifficulty = targeting?.difficultyMod || 0;
  const baseDifficulty = Math.min(cover.difficulty + targetingDifficulty, 10);
  const difficulty = attackerBlinded ? Math.min(baseDifficulty + 2, 10) : baseDifficulty;
  const label = defender ? `${atk.name} -> ${defender.name}` : `${atk.name} Attack`;

  if (targetFullyImmobilized && defender) {
    const parts = [...atkPool.parts, 'target fully immobilized'];
    const contextParts = [...cover.parts];
    if (targeting) contextParts.push(`${targeting.label} +${targeting.difficultyMod} diff`);
    const sublabel = contextParts.length
      ? `${parts.join(' + ')} | ${contextParts.join(' | ')}`
      : parts.join(' + ');
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: attacker.img, actorName: attacker.name,
      portraitStyle: portraitStyle(attacker),
      targetImg: defender.img,
      targetPortraitStyle: portraitStyle(defender),
      label, sublabel,
      noDice: true, showDamageBtn: true,
      hitLabel: `${atk.name} hits automatically; ${defender.name} is fully immobilized.`,
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: html,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: { 'vtm-v20': { combat: {
        phase: 'defense',
        attackerId: attacker.id,
        attackerTokenId: attackerToken?.id || null,
        defenderTokenId: target.id,
        defenderId: defender.id,
        netSuccesses: 0,
        weaponName: atk.name,
        damageFormula: atk.damageFormula,
        damageType: atk.damageType,
        isRanged: atk.isRanged,
        targetingDamageMod: targeting?.damageMod || 0,
        targetingLabel: targeting?.label || null,
        bypassArmor,
      }}},
    });
    return;
  }

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, difficulty);

  const parts = [...atkPool.parts];
  if (blindTargetBonus) parts.push(`target blinded +${blindTargetBonus}`);
  if (strugglingImmobilizedBonus) parts.push(`target struggling immobilized +${strugglingImmobilizedBonus}`);
  const contextParts = [...cover.parts];
  if (targeting) contextParts.push(`${targeting.label} +${targeting.difficultyMod} diff`);
  if (attackerBlinded) contextParts.unshift('blinded diff +2');
  const sublabel = contextParts.length
    ? `${parts.join(' + ')} | ${contextParts.join(' | ')}`
    : parts.join(' + ');

  const canDef = res.outcome === 'success' && !!defender;
  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: attacker.img, actorName: attacker.name,
    portraitStyle: portraitStyle(attacker),
    targetImg: defender?.img || null,
    targetPortraitStyle: defender ? portraitStyle(defender) : '',
    label, sublabel,
    pool, difficulty, isAttack: true,
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
      targetingDamageMod: targeting?.damageMod || 0,
      targetingLabel: targeting?.label || null,
      bypassArmor,
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
  const defenderToken = getToken(c.defenderTokenId);
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
    targetingDamageMod: c.targetingDamageMod || 0,
    targetingLabel: c.targetingLabel || null,
    bypassArmor: c.bypassArmor === true,
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
  const difficulty = isBlinded(defenderToken, defender) ? 8 : 6;

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, difficulty);

  const net = c.attackSuccesses - res.total;
  const hit = net > 0;
  if (hit) base.netSuccesses = net;

  const sl = game.i18n.localize(`VTM.${def.skill.charAt(0).toUpperCase() + def.skill.slice(1)}`);
  const parts = [`Dex ${av}`, `${sl} ${sv}`];
  if (wp) parts.push(`wound ${wp}`);
  if (ap) parts.push(`armor ${ap}`);
  const sublabel = difficulty > 6 ? `${parts.join(' + ')} | blinded diff +2` : parts.join(' + ');

  const verbs = { dodge: 'dodges', block: 'blocks', parry: 'parries' };

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: defender.img, actorName: defender.name,
    portraitStyle: portraitStyle(defender),
    label: `${def.label} Defense`, sublabel,
    pool, difficulty, isAttack: false,
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
  const defenderToken = getToken(c.defenderTokenId);
  if (!attacker || !defender) return ui.notifications.error('Actor not found.');

  // Damage roll
  const str = attacker.system.attributes?.strength || 0;
  const targetingDamageMod = Math.max(Number(c.targetingDamageMod) || 0, 0);
  const dp = calcDmgPool(c.damageFormula, str, c.netSuccesses) + targetingDamageMod;
  const dmgRoll = new Roll(`${dp}d10`);
  await dmgRoll.evaluate();
  const dmg = evalPool(dmgRoll, 6);
  const dt = c.damageType || 'lethal';
  const damageType = String(dt).toLowerCase();
  const mortalLethalNoSoak = defender.type === 'mortal' && damageType === 'lethal';

  // Soak roll
  const sta = defender.system.attributes?.stamina || 0;
  const di = Array.from(defender.items);
  const fort = di.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
  const fl = fort?.system.level || 0;
  const armorRating = di.filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((s, i) => s + (i.system.rating || 0), 0);
  const ar = c.bypassArmor ? 0 : armorRating;
  const sp = mortalLethalNoSoak ? 0 : Math.max(sta + fl + ar, 1);
  let soakRoll = null;
  let soak = { dice: [], total: 0 };
  if (!mortalLethalNoSoak) {
    soakRoll = new Roll(`${sp}d10`);
    await soakRoll.evaluate();
    soak = evalPool(soakRoll, 6);
  }

  // Apply net damage. Mortals do not soak lethal damage; vampires halve bashing damage after soak, rounded down.
  const rawNet = Math.max(dmg.total - soak.total, 0);
  const net = finalDamageAfterSoak(defender, rawNet, dt);
  if (net > 0) await applyHealthDamage(defender, net, dt);
  const threshold = dazeThreshold(defender);
  const dazed = rawNet > 0 && rawNet > threshold;
  if (dazed && !isDazed(defenderToken, defender)) await applyDazed(defender);

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
  if (targetingDamageMod) dmgLabel += ` + ${targetingDamageMod} targeted`;
  const soakParts = [`Sta ${sta}`];
  if (mortalLethalNoSoak) {
    soakParts.splice(0, soakParts.length, 'Mortal cannot soak lethal damage');
  } else {
    if (fl) soakParts.push(`Fort ${fl}`);
    if (ar) soakParts.push(`Armor ${ar}`);
    else if (c.bypassArmor && armorRating) soakParts.push(`Armor ${armorRating} bypassed`);
  }

  const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
    attackerName: attacker.name, attackerImg: attacker.img,
    attackerPortraitStyle: portraitStyle(attacker),
    defenderName: defender.name, defenderImg: defender.img,
    defenderPortraitStyle: portraitStyle(defender),
    weaponName: c.weaponName, damageType: dt,
    dmgPool: dp, dmgLabel,
    dmgDice: dmg.dice, dmgSuccesses: dmg.total,
    soakPool: sp, soakLabel: soakParts.join(' + '),
    soakDice: soak.dice, soakSuccesses: soak.total, soakSkipped: mortalLethalNoSoak,
    netDamage: net, noDamage: net === 0,
    damageAdjustment: rawNet !== net ? `Vampire bashing damage halved: ${rawNet} to ${net}.` : null,
    dazedNotice: dazed ? `${defender.name} is dazed (${rawNet} damage successes exceeded ${threshold}).` : null,
    condition: cond, penalty: pen ? `${pen}` : null,
  });

  await showDice(dmgRoll, attacker);
  if (soakRoll) await showDice(soakRoll, defender);
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
