// Combat resolution: attack rolls, defense choices, damage + soak, auto-apply
import { showDice, isEncumbered, promptRollAdjust, unbalancedPenalty } from './dice.mjs';
import {
  statusIconVisibility,
  BLINDED_STATUS_ID,
  CLINCHED_STATUS_ID,
  DAZED_STATUS_ID,
  PRONE_STATUS_ID,
  KNOCKDOWN_STATUS_ID,
  INCAPACITATED_STATUS_ID,
  FULL_IMMOBILIZED_STATUS_ID,
  STRUGGLING_IMMOBILIZED_STATUS_ID,
  hasStatus,
  iterableValues,
} from './status-effects.mjs';
import { disciplineLevel, isStrengthDamageFormula, effectiveTraitValue, effectiveStrength, potenceAutoSuccesses, usesStrengthTrait } from './discipline-effects.mjs';
import { trackSize, countDamage, rebuildTrack } from './health-track.mjs';

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
  const hadSuccess = succ > 0;
  succ -= ones;
  let outcome = 'failure';
  if (succ > 0) outcome = 'success';
  else if (ones > 0 && !hadSuccess) outcome = 'botch';
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
      return;
    }

    if (['clinchSet', 'clinchClear', 'holdSet', 'holdClear'].includes(data.action)) {
      if (game.user.id !== firstActiveGm()?.id) return;
      if (data.action === 'clinchSet') await applyClinchPairLocal(data);
      else if (data.action === 'clinchClear') await clearClinchPairLocal(data);
      else if (data.action === 'holdSet') await applyHoldPairLocal(data);
      else await clearHoldPairLocal(data);
      return;
    }

    if (data.action === 'clinchReleaseRequest') {
      if (data.targetUserId !== game.user.id) return;
      const release = await promptClinchRelease(data);
      game.socket.emit('system.vtm-v20', {
        action: 'clinchReleaseResponse',
        requestId: data.requestId,
        requestingUserId: data.requestingUserId,
        release,
      });
      return;
    }

    if (data.action === 'clinchReleaseResponse') {
      if (data.requestingUserId !== game.user.id) return;
      const resolve = CLINCH_RELEASE_REQUESTS.get(data.requestId);
      if (!resolve) return;
      CLINCH_RELEASE_REQUESTS.delete(data.requestId);
      resolve(data.release === true);
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

const traitValue = effectiveTraitValue;

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
  const parts = [];
  let penalty = maneuverPenalty;
  if (maneuverPenalty) parts.push(`maneuver ${signed(maneuverPenalty)}`);

  // Bat Form: all attacks against the bat are +2 difficulty
  if (target?.actor?.getFlag('vtm-v20', 'batForm')) {
    penalty += 2;
    parts.push('Bat Form +2');
  }

  if (!atk.isRanged) {
    return { difficulty: Math.max(Math.min(base + penalty, 10), 3), parts };
  }

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

  if (target?.actor?.getFlag('vtm-v20', 'shadowPlay')) {
    penalty += 1;
    parts.push('Shadow Play +1');
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
    headshot: !!targeting.headshot,
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

export function computeSoakPool(actor, { dmgType, fireOrSunlight = false, bypassArmor = false } = {}) {
  const stamina = effectiveTraitValue(actor, 'attributes.stamina');
  const items = Array.from(actor.items);
  const fort = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
  const fortLevel = fort?.system.level || 0;
  const armorRating = items.filter(i => i.type === 'armor' && i.system.equipped)
    .reduce((s, i) => s + (i.system.rating || 0), 0);

  const skinAdder = !!actor.getFlag('vtm-v20', 'skinOfTheAdder');
  const isAgg = dmgType === 'aggravated';
  const isKindred = actor.type === 'vampire';
  const isMortalLethal = actor.type === 'mortal' && dmgType === 'lethal';

  let useStamina = true;
  let armor = (bypassArmor || (isAgg && isKindred && fireOrSunlight)) ? 0 : armorRating;

  if (isAgg && isKindred) {
    useStamina = skinAdder && !fireOrSunlight;
  }

  const pool = isMortalLethal ? 0 : Math.max((useStamina ? stamina : 0) + fortLevel + armor, 1);
  const canSoak = !isMortalLethal && !(isAgg && isKindred && !fortLevel && !skinAdder);
  const difficulty = skinAdder ? 5 : 6;

  const parts = [];
  if (isMortalLethal) {
    parts.push('Mortal cannot soak lethal damage');
  } else if (isAgg && isKindred && !canSoak) {
    parts.push('No Fortitude, cannot soak aggravated damage');
  } else if (isAgg && isKindred) {
    if (useStamina) parts.push(`Sta ${stamina} (Skin of the Adder)`);
    if (fortLevel) parts.push(`Fort ${fortLevel}`);
    if (armor) parts.push(`Armor ${armor}`);
    else if (fireOrSunlight && armorRating) parts.push(`Armor ${armorRating} (fire/sunlight, no protection)`);
    else if (bypassArmor && armorRating) parts.push(`Armor ${armorRating} bypassed`);
  } else {
    parts.push(`Sta ${stamina}`);
    if (fortLevel) parts.push(`Fort ${fortLevel}`);
    if (armor) parts.push(`Armor ${armor}`);
    else if (bypassArmor && armorRating) parts.push(`Armor ${armorRating} bypassed`);
  }
  if (skinAdder) parts.push('diff 5 (Skin of the Adder)');

  return { pool, parts, difficulty, canSoak };
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

  const autoSucc = usesStrengthTrait(...traits) ? potenceAutoSuccesses(actor) : 0;
  if (autoSucc) parts.push(`Potence +${autoSucc} auto`);

  return { pool: Math.max(total, 1), parts, autoSuccesses: autoSucc };
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
    ...statusIconVisibility(),
    flags: { core: { statusId: DAZED_STATUS_ID } },
  }]);
}

function isIncapacitated(actor) {
  return actor.system.health?.levels?.incapacitated > 0;
}

export async function checkIncapacitated(actor) {
  if (isIncapacitated(actor)) await applyIncapacitated(actor);
}

async function applyIncapacitated(actor) {
  if (hasStatus(INCAPACITATED_STATUS_ID, actor)) return;
  const existing = CONFIG.statusEffects.find(e => e.id === INCAPACITATED_STATUS_ID);
  const icon = existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/incapacitated.svg';
  const name = existing?.name ?? 'Incapacitated';
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name, label: name, icon, img: icon,
    origin: 'status',
    statuses: [INCAPACITATED_STATUS_ID],
    ...statusIconVisibility(),
    flags: { core: { statusId: INCAPACITATED_STATUS_ID } },
  }]);

  // Mark combatant as defeated so they're skipped in init/declaration/resolution
  const combat = game.combat;
  if (combat) {
    const combatant = combat.combatants.find(c => c.actorId === actor.id);
    if (combatant && !combatant.defeated) {
      await combatant.update({ defeated: true });
      ui.notifications.warn(`${actor.name} is incapacitated and out of combat.`);
    }
  }
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
  // Bite: choose between tearing flesh and the Kiss before anything rolls
  let biteKiss = false;
  if (atk.bite) {
    const mode = await new Promise(resolve => {
      new Dialog({
        title: `${attacker.name}: Bite`,
        content: '<p style="margin:8px 0;color:#ddd;">Only in a clinch, hold, or tackle.</p>',
        buttons: {
          attack: { icon: '<i class="fas fa-tooth"></i>', label: 'Attack', callback: () => resolve('attack') },
          kiss: { icon: '<i class="fas fa-tint"></i>', label: 'Kiss', callback: () => resolve('kiss') },
        },
        default: 'attack',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 340 }).render(true);
    });
    if (!mode) return false;
    biteKiss = mode === 'kiss';
  }

  // Sweep: legs (Dex + Brawl, Str) or an equipped melee weapon (Dex + Melee,
  // weapon damage). Same trip either way.
  if (atk.sweep) {
    const weapon = Array.from(attacker.items).find(i => i.type === 'weapon' && i.system.equipped && !i.system.range);
    let mode = 'legs';
    if (weapon) {
      mode = await new Promise(resolve => {
        new Dialog({
          title: `${attacker.name}: Sweep`,
          content: '<p style="margin:8px 0;color:#ddd;">Sweep with your legs, or with a weapon?</p>',
          buttons: {
            legs: { icon: '<i class="fas fa-shoe-prints"></i>', label: 'Legs (Dex + Brawl)', callback: () => resolve('legs') },
            weapon: { icon: '<i class="fas fa-broom"></i>', label: `${weapon.name} (Dex + Melee)`, callback: () => resolve('weapon') },
          },
          default: 'legs',
          close: () => resolve(null),
        }, { classes: ['vtm-v20', 'dialog'], width: 380 }).render(true);
      });
      if (!mode) return false;
    }
    atk = mode === 'weapon'
      ? { ...atk, skill: 'abilities.melee', damageFormula: weapon.system.damage || 'Str', damageType: weapon.system.damageType || 'bashing', name: `Sweep (${weapon.name})` }
      : { ...atk, skill: 'abilities.brawl', damageFormula: 'Str', damageType: 'bashing' };
  }

  // Fire mode (picked on the sheet): burst is a flat +2 dice at +1 difficulty,
  // full auto adds half the rounds fired (rounded) at +2. Free dice, same as
  // the flank bonus: no Celerity cap, no pool split.
  const fireMode = atk.isRanged ? (options.fireMode || null) : null;
  const fireRounds = fireMode === 'auto' ? Math.max(options.fireRounds || 2, 2) : fireMode === 'burst' ? 3 : 0;
  const fireBonus = fireMode === 'auto' ? Math.round(fireRounds / 2) : fireMode === 'burst' ? 2 : 0;
  const fireDiff = fireMode === 'auto' ? 2 : fireMode === 'burst' ? 1 : 0;
  if (fireMode) {
    const tag = fireMode === 'auto' ? `Full Auto, ${fireRounds} rounds` : 'Three-Round Burst';
    atk = { ...atk, name: `${atk.name} (${tag})` };
  }

  const target = game.user.targets.size ? game.user.targets.first() : null;
  const defender = target?.actor;
  const attackerToken = canvas.tokens?.placeables.find(t => t.actor === attacker);
  const cover = coverDifficulty(attacker, attackerToken, target, atk);
  let targeting = targetingData(options.targeting);
  if (fireMode === 'auto' && targeting) {
    ui.notifications.warn("Can't target a specific area while auto firing.");
    targeting = null;
  }
  const attackerBlinded = isBlinded(attackerToken, attacker);
  const targetBlinded = isBlinded(target, defender);
  const targetStrugglingImmobilized = isStrugglingImmobilized(target, defender);
  const targetFullyImmobilized = isFullyImmobilized(target, defender);

  const atkPool = attackPool(attacker, atk);
  const blindTargetBonus = targetBlinded ? 2 : 0;
  const strugglingImmobilizedBonus = targetStrugglingImmobilized ? 2 : 0;
  // Position bonus: flank +1, rear +2. Added on top of the declared allocation
  // in resolution, so it never counts against the pool split or Celerity cap.
  const flankMode = attacker.getFlag('vtm-v20', 'flankMode');
  const flankBonus = flankMode === 'rear' ? 2 : (flankMode === 'flank' ? 1 : 0);
  const flankLabel = flankMode === 'rear' ? 'rear +2' : 'flank +1';

  // Fended off by a longer weapon: closing in costs a die. Rides on top of
  // the declared allocation like the flank bonus, so the Celerity cap and
  // pool split are untouched.
  const lengthPenalty = (!atk.isRanged && attacker.getFlag('vtm-v20', 'weaponLength')) ? 1 : 0;

  const computedPool = Math.max(atkPool.pool + blindTargetBonus + strugglingImmobilizedBonus, 1);
  let pool = Math.max((options.poolOverride ? Math.max(options.poolOverride, 1) : computedPool) + flankBonus + fireBonus - lengthPenalty, 1);
  const targetingDifficulty = targeting?.difficultyMod || 0;
  const encumbranceDiff = isEncumbered(attacker) ? 1 : 0;
  // Multiple opponents in close combat: +1 difficulty per extra foe, max +4
  const multiOpp = atk.isRanged ? 0 : Math.min(attacker.getFlag('vtm-v20', 'multiOpp') || 0, 4);
  const atkUnbalanced = unbalancedPenalty(attacker);
  // Shooting distance: point blank drops the shot to difficulty 4, maximum
  // range pushes it to 8. Short range is the plain 6, ranged attacks only.
  const rangeMode = atk.isRanged ? attacker.getFlag('vtm-v20', 'rangeMode') : null;
  const rangeDiff = rangeMode === 'pointblank' ? -2 : rangeMode === 'max' ? 2 : 0;
  const rangeLabel = rangeMode === 'pointblank' ? 'point blank -2 diff' : 'max range +2 diff';
  // Off hand: +1 difficulty, waived by the Ambidextrous merit
  const offHandDiff = (atk.offHand && !Array.from(attacker.items).some(i => i.type === 'merit' && /ambidext/i.test(i.name))) ? 1 : 0;
  const baseDifficulty = Math.min(cover.difficulty + targetingDifficulty + encumbranceDiff + multiOpp + atkUnbalanced + fireDiff + rangeDiff + offHandDiff, 10);
  let difficulty = attackerBlinded ? Math.min(baseDifficulty + 2, 10) : baseDifficulty;
  const label = defender ? `${atk.name} -> ${defender.name}` : `${atk.name} Attack`;

  // Right-click adjustment: bonus dice and manual difficulty before the roll.
  // Cancelling aborts the whole attack, so the caller must not mark it spent.
  let adjustMod = 0;
  let manualDiff = false;
  if (options.adjust && !(targetFullyImmobilized && defender)) {
    const poolBits = [...atkPool.parts];
    if (blindTargetBonus) poolBits.push(`target blinded +${blindTargetBonus}`);
    if (strugglingImmobilizedBonus) poolBits.push(`target struggling +${strugglingImmobilizedBonus}`);
    if (flankBonus) poolBits.push(flankLabel);
    if (lengthPenalty) poolBits.push('weapon length -1');
    if (fireBonus) poolBits.push(fireMode === 'auto' ? `full auto +${fireBonus}` : 'burst +2');
    const poolLabel = options.poolOverride
      ? ['declared allocation', flankBonus ? flankLabel : '', fireBonus ? (fireMode === 'auto' ? `full auto +${fireBonus}` : 'burst +2') : '', lengthPenalty ? 'weapon length -1' : '', options.poolNote].filter(Boolean).join(', ')
      : poolBits.join(' + ');
    const diffNotes = cover.parts.map(p => `${p} diff`);
    if (targeting) diffNotes.push(`${targeting.label} +${targeting.difficultyMod} diff`);
    if (multiOpp) diffNotes.push(`outnumbered +${multiOpp} diff`);
    if (atkUnbalanced) diffNotes.push('unbalanced +1 diff');
    if (encumbranceDiff) diffNotes.push('encumbered +1 diff');
    if (fireDiff) diffNotes.push(fireMode === 'auto' ? 'full auto +2 diff' : 'burst +1 diff');
    if (rangeDiff) diffNotes.push(rangeLabel);
    if (offHandDiff) diffNotes.push('off hand +1 diff');
    if (attackerBlinded) diffNotes.push('blinded +2 diff');

    const adj = await promptRollAdjust({
      title: `Attack: ${atk.name}`,
      pool, poolLabel, difficulty, diffNotes,
    });
    if (!adj) return false;
    adjustMod = adj.mod;
    if (adjustMod) pool = Math.max(pool + adjustMod, 1);
    if (adj.difficulty !== difficulty) {
      difficulty = adj.difficulty;
      manualDiff = true;
    }
  }

  const bypassArmor = await requestGmTargetingArmorChoice(attacker, defender, atk, targeting);

  if (targetFullyImmobilized && defender) {
    const parts = [...atkPool.parts, 'target fully immobilized'];
    const contextParts = [...cover.parts];
    if (targeting) contextParts.push(`${targeting.label} +${targeting.difficultyMod} diff`);
    if (encumbranceDiff) contextParts.push('encumbered +1 diff');
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
      damageBtnLabel: atk.hold ? 'Apply Hold' : null,
      hitLabel: `${atk.name} hits automatically; ${defender.name} is fully immobilized.`,
    });
    if (attacker.getFlag('vtm-v20', 'wpSpent')) await attacker.unsetFlag('vtm-v20', 'wpSpent');
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: { 'vtm-v20': { combat: {
        phase: 'defense',
        attackerId: attacker.id,
        attackerTokenId: attackerToken?.id || null,
        defenderTokenId: target.id,
        defenderId: defender.id,
        netSuccesses: 0,
        attackSuccesses: 0,
        weaponName: atk.name,
        damageFormula: atk.damageFormula,
        damageType: atk.damageType,
        isBite: !!atk.bite, biteKiss, isClinch: !!atk.clinch, isDisarm: !!atk.disarm, isHold: !!atk.hold, isSweep: !!atk.sweep, isTackle: !!atk.tackle,
        attackSkill: atk.skill || null,
        isRanged: atk.isRanged,
        isFirearm: !!atk.firearm,
        targetingDamageMod: targeting?.damageMod || 0,
        targetingLabel: targeting?.label || null,
        targetingHeadshot: targeting?.headshot || false,
        bypassArmor,
      }}},
    });
    return;
  }

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, difficulty);
  let atkAuto = atkPool.autoSuccesses || 0;

  // WP spend: +1 auto-success on attack
  let wpUsed = false;
  if (attacker.getFlag('vtm-v20', 'wpSpent')) {
    atkAuto += 1;
    wpUsed = true;
    await attacker.unsetFlag('vtm-v20', 'wpSpent');
  }

  const atkTotal = res.total + atkAuto;
  let atkOutcome = res.outcome;
  if (atkTotal > 0 && atkOutcome !== 'success') atkOutcome = 'success';
  else if (atkAuto > 0 && atkOutcome === 'botch') atkOutcome = 'failure';

  const parts = [...atkPool.parts];
  if (blindTargetBonus) parts.push(`target blinded +${blindTargetBonus}`);
  if (strugglingImmobilizedBonus) parts.push(`target struggling immobilized +${strugglingImmobilizedBonus}`);
  if (flankBonus) parts.push(flankLabel);
  if (lengthPenalty) parts.push('weapon length -1');
  if (fireBonus) parts.push(fireMode === 'auto' ? `full auto +${fireBonus}` : 'burst +2');
  if (adjustMod) parts.push(`bonus ${signed(adjustMod)}`);
  const contextParts = [...cover.parts];
  if (targeting) contextParts.push(`${targeting.label} +${targeting.difficultyMod} diff`);
  if (multiOpp) contextParts.push(`outnumbered +${multiOpp} diff`);
  if (atkUnbalanced) contextParts.push('unbalanced +1 diff');
  if (encumbranceDiff) contextParts.push('encumbered +1 diff');
  if (fireDiff) contextParts.push(fireMode === 'auto' ? 'full auto +2 diff' : 'burst +1 diff');
  if (rangeDiff) contextParts.push(rangeLabel);
  if (offHandDiff) contextParts.push('off hand +1 diff');
  if (attackerBlinded) contextParts.unshift('blinded diff +2');
  if (manualDiff) contextParts.push(`diff set to ${difficulty}`);
  const sublabel = contextParts.length
    ? `${parts.join(' + ')} | ${contextParts.join(' | ')}`
    : parts.join(' + ');

  const autoLabels = [];
  if (atkPool.autoSuccesses) autoLabels.push(`${atkPool.autoSuccesses} Potence`);
  if (wpUsed) autoLabels.push('1 WP');
  const autoLabel = autoLabels.join(' + ');

  const canDef = atkOutcome === 'success' && !!defender;
  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: attacker.img, actorName: attacker.name,
    portraitStyle: portraitStyle(attacker),
    targetImg: defender?.img || null,
    targetPortraitStyle: defender ? portraitStyle(defender) : '',
    label, sublabel,
    pool, difficulty, isAttack: true,
    dice: res.dice, total: atkTotal, outcome: atkOutcome,
    autoSuccesses: atkAuto, autoLabel, diceTotal: res.total,
    canDefend: canDef, targetName: defender?.name,
    poolNote: options.poolNote || '',
  });

  const flags = {};
  if (canDef) {
    flags['vtm-v20'] = { combat: {
      phase: 'attack',
      attackerId: attacker.id,
      attackerTokenId: attackerToken?.id || null,
      defenderTokenId: target.id,
      defenderId: defender.id,
      attackSuccesses: atkTotal,
      weaponName: atk.name,
      damageFormula: atk.damageFormula,
      damageType: atk.damageType,
      isBite: !!atk.bite, biteKiss, isClinch: !!atk.clinch, isDisarm: !!atk.disarm, isHold: !!atk.hold, isSweep: !!atk.sweep, isTackle: !!atk.tackle,
      attackSkill: atk.skill || null,
      isRanged: atk.isRanged,
      isFirearm: !!atk.firearm,
      targetingDamageMod: targeting?.damageMod || 0,
      targetingLabel: targeting?.label || null,
      targetingHeadshot: targeting?.headshot || false,
      bypassArmor,
    }};
  }

  await showDice(roll, attacker);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER, flags,
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

  // Available defense types (ranged attacks can only be dodged). Lethal and
  // aggravated attacks can only be blocked with Fortitude or armor (V20 p.274).
  const types = { dodge: { label: 'Dodge', attr: 'dexterity', skill: 'athletics' } };
  const dmgType = String(c.damageType || '').toLowerCase();
  let blockNote = '';
  if (!c.isRanged) {
    const canBlock = dmgType === 'bashing'
      || disciplineLevel(defender, 'fortitude') > 0
      || Array.from(defender.items).some(i => i.type === 'armor' && i.system.equipped && (i.system.rating || 0) > 0);
    if (canBlock) types.block = { label: 'Block', attr: 'dexterity', skill: 'brawl' };
    else blockNote = `<p style="font-size:11px;color:#999;margin:4px 0;">Block unavailable: ${dmgType} damage cannot be blocked without Fortitude or armor.</p>`;
    types.parry = { label: 'Parry', attr: 'dexterity', skill: 'melee' };
  }

  const combat = game.combat;
  const combatant = combat?.combatants.find(cb => cb.actor?.id === defender.id);
  const decl = combatant?.getFlag('vtm-v20', 'declaration');
  const isFullDef = decl?.fullDefense;
  const sheet = defender.sheet;

  // Find declared defense actions that still have dice remaining
  const declaredDefenses = [];
  const abortableActions = [];
  if (decl?.actions) {
    const usedIndices = new Set();
    if (sheet?._resExecuted) {
      for (const i of sheet._resExecuted) usedIndices.add(i);
    }
    decl.actions.forEach((a, i) => {
      if (a.defense && types[a.defense]) {
        const alloc = a.alloc || 1;
        const spent = sheet?._resDefenseSpent?.get(i) || 0;
        const remaining = alloc - spent;
        if (remaining > 0) {
          declaredDefenses.push({ idx: i, defense: a.defense, alloc, spent, remaining });
        }
      } else if (!usedIndices.has(i) && (a.attackId || (!a.defense && !a.fullDefense))) {
        let name = a.text || 'Action';
        if (a.attackId && sheet?._getAttackById) {
          const resolved = sheet._getAttackById(a.attackId);
          if (resolved?.name) name = resolved.name;
        }
        abortableActions.push({ idx: i, name, alloc: a.alloc || 1 });
      }
    });
  }

  // Build the dialog buttons
  let choice, pool;

  // Locked in a clinch or a hold: no actions of any kind, defenses included
  const inClinch = !!(defender.getFlag('vtm-v20', 'clinch') || defender.getFlag('vtm-v20', 'held'));
  if (inClinch) {
    choice = null;
  } else if (isFullDef) {
    // Full defense: pick any available defense type, pool = full trait pool minus cumulative penalty
    const defCount = sheet?._resFullDefCount || 0;
    const btnEntries = Object.entries(types).map(([key, d]) => {
      const a = effectiveTraitValue(defender, `attributes.${d.attr}`);
      const s = defender.system.abilities?.[d.skill] || 0;
      const sl = game.i18n.localize(`VTM.${d.skill.charAt(0).toUpperCase() + d.skill.slice(1)}`);
      const effectivePool = Math.max(a + s - defCount, 1);
      return [key, `${d.label} (Dex + ${sl}) [${effectivePool} dice]`];
    });
    btnEntries.push(['none', 'No Defense']);

    const result = await new Promise(resolve => {
      const btns = {};
      for (const [k, lbl] of btnEntries)
        btns[k] = { label: lbl, callback: () => resolve(k === 'none' ? null : k) };
      new Dialog({
        title: `${defender.name}: Full Defense`,
        content: `<p style="margin:8px 0;color:#ddd;">Defend against ${c.weaponName}?${defCount ? ` (defense #${defCount + 1}, -${defCount} dice)` : ''}</p>${blockNote}`,
        buttons: btns, default: 'dodge',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-defense-dialog'], width: 400 }).render(true);
    });

    choice = result;
    if (choice) {
      const def = types[choice];
      const av = effectiveTraitValue(defender, `attributes.${def.attr}`);
      const sv = defender.system.abilities?.[def.skill] || 0;
      const wpen = defender.system.woundPenalty || 0;
      const ap = Array.from(defender.items)
        .filter(i => i.type === 'armor' && i.system.equipped)
        .reduce((s, i) => s + (i.system.penalty || 0), 0);
      pool = Math.max(av + sv + wpen + ap - defCount, 1);
      if (sheet) sheet._resFullDefCount = defCount + 1;
    }

  } else if (declaredDefenses.length || abortableActions.length) {
    // Has declared defenses or actions that can be aborted.
    // Loop so that a failed/cancelled abort brings the player back to pick again.
    const failedAborts = new Set();
    let picking = true;
    while (picking) {
      picking = false;

      const btnEntries = [];
      for (const dd of declaredDefenses) {
        const d = types[dd.defense];
        btnEntries.push([`decl-${dd.idx}`, `${d.label} [${dd.remaining}/${dd.alloc} dice remaining]`]);
      }
      for (const ab of abortableActions) {
        if (sheet?._resExecuted?.has(ab.idx)) continue;
        if (failedAborts.has(ab.idx)) continue;
        btnEntries.push([`abort-${ab.idx}`, `Abort "${ab.name}" to defend (WP roll)`]);
      }
      btnEntries.push(['none', 'No Defense']);

      // Nothing left besides "No Defense", skip the dialog
      if (btnEntries.length === 1) { choice = null; break; }

      const result = await new Promise(resolve => {
        const btns = {};
        for (const [k, lbl] of btnEntries)
          btns[k] = { label: lbl, callback: () => resolve(k) };
        new Dialog({
          title: `${defender.name}: Choose Defense`,
          content: `<p style="margin:8px 0;color:#ddd;">Defend against ${c.weaponName}?</p>${blockNote}`,
          buttons: btns, default: btnEntries[0]?.[0],
          close: () => resolve('none'),
        }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-defense-dialog'], width: 400 }).render(true);
      });

      if (result === 'none') {
        choice = null;
      } else if (result.startsWith('decl-')) {
        const idx = parseInt(result.replace('decl-', ''));
        const dd = declaredDefenses.find(d => d.idx === idx);
        choice = dd.defense;

        // Ask how many dice to spend from this defense's remaining pool
        if (dd.remaining === 1) {
          pool = 1;
        } else {
          pool = await new Promise(resolve => {
            let html = `<div style="margin:8px 0;color:#ddd;">`;
            html += `<p>How many dice to use? (${dd.remaining} remaining)</p>`;
            html += `<input type="range" min="1" max="${dd.remaining}" value="${dd.remaining}" class="def-dice-slider" style="width:100%;" />`;
            html += `<div style="text-align:center;font-size:18px;font-weight:bold;color:var(--vtm-gold,#c9a959);" class="def-dice-val">${dd.remaining}</div>`;
            html += `</div>`;
            new Dialog({
              title: `${defender.name}: ${types[dd.defense].label} Dice`,
              content: html,
              buttons: { ok: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll', callback: dlg => resolve(parseInt(dlg[0].querySelector('.def-dice-slider').value)) } },
              default: 'ok',
              render: dlg => {
                const slider = dlg.find('.def-dice-slider');
                const val = dlg.find('.def-dice-val');
                slider.on('input', () => val.text(slider.val()));
              },
              close: () => resolve(dd.remaining),
            }, { classes: ['vtm-v20', 'dialog'], width: 300 }).render(true);
          });
        }

        if (sheet) {
          const prev = sheet._resDefenseSpent.get(idx) || 0;
          sheet._resDefenseSpent.set(idx, prev + pool);
          sheet._resSpent.set(idx, (sheet._resSpent.get(idx) || 0) + pool);
        }
      } else if (result.startsWith('abort-')) {
        const idx = parseInt(result.replace('abort-', ''));
        const aborted = abortableActions.find(a => a.idx === idx);

        const wpChoice = await new Promise(resolve => {
          new Dialog({
            title: `${defender.name}: Abort to Defense`,
            content: `<p style="margin:8px 0;color:#ddd;">Aborting "${aborted.name}" requires a Willpower check.</p>`,
            buttons: {
              roll: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll Willpower (diff 6)', callback: () => resolve('roll') },
              spend: { icon: '<i class="fas fa-fire"></i>', label: 'Spend 1 Willpower', callback: () => resolve('spend') },
              cancel: { label: 'Cancel', callback: () => resolve('cancel') },
            },
            default: 'roll',
            close: () => resolve('cancel'),
          }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
        });

        if (wpChoice === 'cancel') { picking = true; continue; }

        if (wpChoice === 'spend') {
          const curWp = defender.system.willpower?.current ?? defender.system.willpower?.max ?? 0;
          if (curWp < 1) {
            ui.notifications.warn(`${defender.name} has no Willpower to spend.`);
            picking = true;
            continue;
          }
          await defender.update({ 'system.willpower.current': curWp - 1 });
          ui.notifications.info(`${defender.name} spends 1 Willpower to abort to defense.`);
        } else {
          const wpMax = defender.system.willpower?.max || 1;
          const wpRoll = new Roll(`${wpMax}d10`);
          await wpRoll.evaluate();
          const wpRes = evalPool(wpRoll, 6);
          await showDice(wpRoll, defender);

          const wpHtml = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
            actorImg: defender.img, actorName: defender.name,
            portraitStyle: portraitStyle(defender),
            label: 'Willpower: Abort to Defense', sublabel: `Willpower ${wpMax}`,
            pool: wpMax, difficulty: 6, isAttack: false,
            dice: wpRes.dice, total: wpRes.total, outcome: wpRes.outcome,
            defendedLabel: wpRes.outcome === 'success' ? `${defender.name} aborts to defense!` : null,
            hitLabel: wpRes.outcome !== 'success' ? `Abort failed. ${defender.name} cannot defend.` : null,
          });
          await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: defender }),
            content: wpHtml, style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          });

          if (wpRes.outcome !== 'success') {
            // Failed: this abort is burned, loop back for remaining options
            failedAborts.add(idx);
            picking = true;
            continue;
          }
        }

        // Abort succeeded: compute actual defense pools from traits
        const wpen = defender.system.woundPenalty || 0;
        const abortAp = Array.from(defender.items)
          .filter(i => i.type === 'armor' && i.system.equipped)
          .reduce((s, i) => s + (i.system.penalty || 0), 0);
        const dexVal = effectiveTraitValue(defender, 'attributes.dexterity');

        const defBtns = Object.entries(types).map(([key, d]) => {
          const sv = defender.system.abilities?.[d.skill] || 0;
          const dp = Math.max(dexVal + sv + wpen + abortAp, 1);
          const sl = game.i18n.localize(`VTM.${d.skill.charAt(0).toUpperCase() + d.skill.slice(1)}`);
          return [key, `${d.label} (Dex + ${sl}) [${dp} dice]`, dp];
        });

        const picked = await new Promise(resolve => {
          const btns = {};
          for (const [k, lbl] of defBtns)
            btns[k] = { label: lbl, callback: () => resolve(k) };
          new Dialog({
            title: `${defender.name}: Choose Defense Maneuver`,
            content: `<p style="margin:8px 0;color:#ddd;">Pick your defensive maneuver:</p>${blockNote}`,
            buttons: btns, default: 'dodge',
            close: () => resolve('dodge'),
          }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-defense-dialog'], width: 400 }).render(true);
        });

        choice = picked;
        pool = defBtns.find(b => b[0] === picked)?.[2] || 1;

        if (sheet) {
          sheet._resExecuted.add(idx);
          sheet._resSpent.set(idx, pool);
        }
      }
    }

  } else if (decl?.actions) {
    // Has a declaration but no defenses and nothing to abort: no defense allowed
    choice = null;

  } else {
    // No active declaration system: free-form choice (outside structured combat)
    const btnEntries = Object.entries(types).map(([key, d]) => {
      const a = effectiveTraitValue(defender, `attributes.${d.attr}`);
      const s = defender.system.abilities?.[d.skill] || 0;
      const sl = game.i18n.localize(`VTM.${d.skill.charAt(0).toUpperCase() + d.skill.slice(1)}`);
      return [key, `${d.label} (Dex + ${sl}) [${a + s}]`];
    });
    btnEntries.push(['none', 'No Defense']);

    choice = await new Promise(resolve => {
      const btns = {};
      for (const [k, lbl] of btnEntries)
        btns[k] = { label: lbl, callback: () => resolve(k === 'none' ? null : k) };
      new Dialog({
        title: `${defender.name}: Choose Defense`,
        content: `<p style="margin:8px 0;color:#ddd;">Defend against ${c.weaponName}?</p>${blockNote}`,
        buttons: btns, default: 'dodge',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog', 'vtm-defense-dialog'], width: 400 }).render(true);
    });

    if (choice) {
      const def = types[choice];
      const av = effectiveTraitValue(defender, `attributes.${def.attr}`);
      const sv = defender.system.abilities?.[def.skill] || 0;
      const wpen = defender.system.woundPenalty || 0;
      const ap = Array.from(defender.items)
        .filter(i => i.type === 'armor' && i.system.equipped)
        .reduce((s, i) => s + (i.system.penalty || 0), 0);
      pool = Math.max(av + sv + wpen + ap, 1);
    }
  }

  // Disable the defend button on the original attack message
  await resolveMessage(msg);

  const base = {
    phase: 'defense', attackerId: c.attackerId, attackerTokenId: c.attackerTokenId,
    defenderId: c.defenderId, defenderTokenId: c.defenderTokenId, weaponName: c.weaponName,
    damageFormula: c.damageFormula, damageType: c.damageType, isRanged: c.isRanged, isFirearm: c.isFirearm || false,
    attackSuccesses: c.attackSuccesses, attackSkill: c.attackSkill || null,
    targetingDamageMod: c.targetingDamageMod || 0,
    targetingLabel: c.targetingLabel || null,
    targetingHeadshot: c.targetingHeadshot || false,
    bypassArmor: c.bypassArmor === true,
    isBite: c.isBite === true, biteKiss: c.biteKiss === true, isClinch: c.isClinch === true,
    isDisarm: c.isDisarm === true, isHold: c.isHold === true, isSweep: c.isSweep === true, isTackle: c.isTackle === true,
  };

  // No defense chosen: attack lands with full successes
  if (!choice) {
    base.netSuccesses = c.attackSuccesses;
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: defender.img, actorName: defender.name,
      portraitStyle: portraitStyle(defender),
      label: 'No Defense', sublabel: inClinch ? 'Locked in a grapple' : '',
      damageBtnLabel: c.isHold ? 'Apply Hold' : null,
      noDice: true, showDamageBtn: true,
      hitLabel: `${c.weaponName} hits with ${c.attackSuccesses} net success${c.attackSuccesses > 1 ? 'es' : ''}!`,
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: html, style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: { 'vtm-v20': { combat: base } },
    });
    return;
  }

  // Roll defense with the determined pool
  const def = types[choice];
  const defBlinded = isBlinded(defenderToken, defender);
  const defEncumbered = isEncumbered(defender);
  const defMultiOpp = c.isRanged ? 0 : Math.min(defender.getFlag('vtm-v20', 'multiOpp') || 0, 4);
  const defUnbalanced = unbalancedPenalty(defender);
  const difficulty = Math.min(6 + (defBlinded ? 2 : 0) + (defEncumbered ? 1 : 0) + defMultiOpp + defUnbalanced, 10);

  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, difficulty);

  let defTotal = res.total;
  let defOutcome = res.outcome;
  let wpUsed = false;
  if (defender.getFlag('vtm-v20', 'wpSpent')) {
    defTotal += 1;
    wpUsed = true;
    if (defTotal > 0 && defOutcome !== 'success') defOutcome = 'success';
    await defender.unsetFlag('vtm-v20', 'wpSpent');
  }

  const net = c.attackSuccesses - defTotal;
  const hit = net > 0;
  if (hit) base.netSuccesses = net;

  const sl = game.i18n.localize(`VTM.${def.skill.charAt(0).toUpperCase() + def.skill.slice(1)}`);
  const defContext = [];
  if (defBlinded) defContext.push('blinded +2 diff');
  if (defEncumbered) defContext.push('encumbered +1 diff');
  if (defMultiOpp) defContext.push(`outnumbered +${defMultiOpp} diff`);
  if (defUnbalanced) defContext.push('unbalanced +1 diff');
  const sublabel = defContext.length ? `${pool} dice | ${defContext.join(' | ')}` : `${pool} dice`;

  const defAutoSuccesses = wpUsed ? 1 : 0;
  const defAutoLabel = wpUsed ? '1 WP' : '';
  const verbs = { dodge: 'dodges', block: 'blocks', parry: 'parries' };

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: defender.img, actorName: defender.name,
    portraitStyle: portraitStyle(defender),
    label: `${def.label} Defense`, sublabel,
    pool, difficulty, isAttack: false,
    dice: res.dice, total: defTotal, outcome: defOutcome,
    autoSuccesses: defAutoSuccesses, autoLabel: defAutoLabel, diceTotal: res.total,
    showDamageBtn: hit,
    damageBtnLabel: c.isHold ? 'Apply Hold' : null,
    hitLabel: hit ? `${c.weaponName} hits with ${net} net success${net > 1 ? 'es' : ''}!` : null,
    defendedLabel: !hit ? `${defender.name} ${verbs[choice]} the attack!` : null,
  });

  await showDice(roll, defender);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: hit ? { 'vtm-v20': { combat: base } } : {},
  });

  // Parry riposte (V20 p.274): out-parrying a Brawl attack with a lethal
  // weapon hurts the attacker
  if (choice === 'parry' && c.attackSkill === 'abilities.brawl' && defTotal > c.attackSuccesses) {
    const extra = defTotal - c.attackSuccesses;
    const candidates = Array.from(defender.items).filter(i =>
      i.type === 'weapon' && i.system.equipped && !i.system.range
      && ['lethal', 'aggravated'].includes(String(i.system.damageType || '').toLowerCase()));
    let weapon = candidates[0] || null;
    if (candidates.length > 1) {
      weapon = await new Promise(resolve => {
        const btns = {};
        for (const w of candidates) btns[w.id] = { label: w.name, callback: () => resolve(w) };
        new Dialog({
          title: `${defender.name}: Riposte`,
          content: '<p style="margin:8px 0;color:#ddd;">Which weapon was the parry made with?</p>',
          buttons: btns, default: candidates[0].id,
          close: () => resolve(candidates[0]),
        }, { classes: ['vtm-v20', 'dialog'], width: 340 }).render(true);
      });
    }
    if (weapon) await parryRiposte(c, defender, weapon, extra);
  }

  // Re-render the sheet to update resolution state
  if (sheet) sheet.render();
}

// Roll a ready-made damage pool against a target with normal soak: used by
// the parry riposte and the clinch, where no attack roll precedes the damage.
async function resolveDirectDamage(source, target, targetToken, { weaponName, dmgLabel, dp, dmgAuto, dt }) {
  const dmgRoll = new Roll(`${dp}d10`);
  await dmgRoll.evaluate();
  const dmg = evalPool(dmgRoll, 6);
  const dmgTotal = dmg.total + dmgAuto;

  const soakData = computeSoakPool(target, { dmgType: dt });
  let soakRoll = null;
  let soak = { dice: [], total: 0 };
  if (soakData.canSoak) {
    soakRoll = new Roll(`${Math.max(soakData.pool, 1)}d10`);
    await soakRoll.evaluate();
    soak = evalPool(soakRoll, soakData.difficulty);
  }

  const rawNet = Math.max(dmgTotal - soak.total, 0);
  const net = finalDamageAfterSoak(target, rawNet, dt);
  if (net > 0) await applyHealthDamage(target, net, dt);
  await checkIncapacitated(target);
  const threshold = dazeThreshold(target);
  const dazed = rawNet > 0 && rawNet > threshold;
  if (dazed && !isDazed(targetToken, target)) await applyDazed(target);

  // Same armor-destruction rule as regular damage
  let armorDestroyedNotice = null;
  const broken = Array.from(target.items).filter(i =>
    i.type === 'armor' && i.system.equipped && i.system.rating > 0 && dmgTotal >= i.system.rating * 2);
  if (broken.length) {
    const names = broken.map(i => i.name).join(' and ');
    armorDestroyedNotice = `${names} destroyed! ${dmgTotal} damage successes reached twice the armor's rating.`;
  }

  const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
    attackerName: source.name, attackerImg: source.img,
    attackerPortraitStyle: portraitStyle(source),
    defenderName: target.name, defenderImg: target.img,
    defenderPortraitStyle: portraitStyle(target),
    weaponName, damageType: dt,
    dmgPool: dp, dmgLabel,
    dmgDice: dmg.dice, dmgSuccesses: dmgTotal,
    dmgAutoSuccesses: dmgAuto, dmgDiceTotal: dmg.total,
    soakPool: soakData.pool, soakLabel: soakData.parts.join(' + '),
    soakDice: soak.dice, soakSuccesses: soak.total, soakSkipped: !soakData.canSoak,
    netDamage: net, noDamage: net === 0,
    damageAdjustment: rawNet !== net ? `Vampire bashing damage halved: ${rawNet} to ${net}.` : null,
    dazedNotice: dazed ? `${target.name} is dazed (${rawNet} damage successes exceeded ${threshold}).` : null,
    armorDestroyedNotice,
    condition: getCondition(target),
    penalty: target.system.woundPenalty ? `${target.system.woundPenalty}` : null,
  });

  await showDice(dmgRoll, source);
  if (soakRoll) await showDice(soakRoll, target);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// The attacker ran their fist into the defender's blade: weapon base damage
// plus the extra parry successes, soaked like any other damage.
async function parryRiposte(c, defender, weapon, extra) {
  const attacker = getActor(c.attackerId, c.attackerTokenId);
  const attackerToken = getToken(c.attackerTokenId);
  if (!attacker) return;

  const str = effectiveStrength(defender);
  const strFormula = isStrengthDamageFormula(weapon.system.damage);
  const dmgAuto = strFormula ? potenceAutoSuccesses(defender) : 0;
  const dmgWoundPen = strFormula ? (defender.system.woundPenalty || 0) : 0;
  const base = calcDmgPool(weapon.system.damage, str, 0);
  const dp = Math.max(base + extra + dmgWoundPen, 1);
  const dt = String(weapon.system.damageType || 'lethal').toLowerCase();

  let dmgLabel = `Base ${base} + ${extra} parry`;
  if (dmgWoundPen) dmgLabel += ` wound ${dmgWoundPen}`;
  if (dmgAuto) dmgLabel += ` + Potence ${dmgAuto} auto`;

  await resolveDirectDamage(defender, attacker, attackerToken, {
    weaponName: `Riposte: ${weapon.name}`, dmgLabel, dp, dmgAuto, dt,
  });
}

// ── Clinch ─────────────────────────────────────────────────────────

const CLINCH_RELEASE_REQUESTS = new Map();

function clinchStatusEffect() {
  const existing = CONFIG.statusEffects.find(e => e.id === CLINCHED_STATUS_ID);
  return {
    name: existing?.name ?? 'Clinched',
    img: existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/grab-status.svg',
    origin: 'status',
    statuses: [CLINCHED_STATUS_ID],
    ...statusIconVisibility(),
  };
}

function clinchEffectIds(actor) {
  return Array.from(actor.effects)
    .filter(e => e.statuses?.has?.(CLINCHED_STATUS_ID))
    .map(e => e.id);
}

async function applyClinchPairLocal({ aId, aTok, bId, bTok }) {
  const a = getActor(aId, aTok);
  const b = getActor(bId, bTok);
  if (!a || !b) return;
  await a.setFlag('vtm-v20', 'clinch', { actorId: bId, tokenId: bTok ?? null });
  await b.setFlag('vtm-v20', 'clinch', { actorId: aId, tokenId: aTok ?? null });
  for (const x of [a, b]) {
    if (!clinchEffectIds(x).length) await x.createEmbeddedDocuments('ActiveEffect', [clinchStatusEffect()]);
  }
}

async function clearClinchPairLocal({ aId, aTok, bId, bTok }) {
  for (const [id, tok] of [[aId, aTok], [bId, bTok]]) {
    const x = getActor(id, tok);
    if (!x) continue;
    if (x.getFlag('vtm-v20', 'clinch')) await x.unsetFlag('vtm-v20', 'clinch');
    const fx = clinchEffectIds(x);
    if (fx.length) await x.deleteEmbeddedDocuments('ActiveEffect', fx);
  }
}

// Flag + status updates touch both actors, so non-GM clients route through the GM
async function setClinchPair(data) {
  if (game.user.isGM) return applyClinchPairLocal(data);
  if (!firstActiveGm()) return ui.notifications.warn('No GM online to establish the clinch.');
  game.socket.emit('system.vtm-v20', { action: 'clinchSet', ...data });
}

async function clearClinchPair(data) {
  if (game.user.isGM) return clearClinchPairLocal(data);
  if (!firstActiveGm()) return ui.notifications.warn('No GM online to clear the clinch.');
  game.socket.emit('system.vtm-v20', { action: 'clinchClear', ...data });
}

// One side's Clinched status was removed by hand: tidy up both sides
export async function clearClinchForActor(actor) {
  const clinch = actor.getFlag('vtm-v20', 'clinch');
  if (!clinch) return;
  await actor.unsetFlag('vtm-v20', 'clinch');
  const own = clinchEffectIds(actor);
  if (own.length) await actor.deleteEmbeddedDocuments('ActiveEffect', own);
  const opp = getActor(clinch.actorId, clinch.tokenId);
  if (opp?.getFlag('vtm-v20', 'clinch')) {
    await opp.unsetFlag('vtm-v20', 'clinch');
    const fx = clinchEffectIds(opp);
    if (fx.length) await opp.deleteEmbeddedDocuments('ActiveEffect', fx);
  }
}

function clinchController(actor) {
  const owners = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, 'OWNER'));
  return owners[0] || firstActiveGm();
}

async function promptClinchRelease({ escaperName, holderName, what = 'clinch' }) {
  const word = what === 'hold' ? 'hold' : 'clinch';
  return new Promise(resolve => {
    new Dialog({
      title: `${holderName}: ${word === 'hold' ? 'Hold' : 'Clinch'}`,
      content: `<p style="margin:8px 0;color:#ddd;"><b>${escaperName}</b> tries to break out of the ${word}. Let them go?</p>`,
      buttons: {
        release: { icon: '<i class="fas fa-hand-peace"></i>', label: 'Release', callback: () => resolve(true) },
        hold: { icon: '<i class="fas fa-hand-back-fist"></i>', label: 'Hold On (resisted roll)', callback: () => resolve(false) },
      },
      default: 'hold',
      close: () => resolve(false),
    }, { classes: ['vtm-v20', 'dialog'], width: 380 }).render(true);
  });
}

async function requestClinchRelease(escaper, holder, what = 'clinch') {
  const controller = clinchController(holder);
  if (!controller) return false;
  if (controller.id === game.user.id) {
    return promptClinchRelease({ escaperName: escaper.name, holderName: holder.name, what });
  }

  const requestId = foundry.utils.randomID();
  const result = new Promise(resolve => {
    CLINCH_RELEASE_REQUESTS.set(requestId, resolve);
    window.setTimeout(() => {
      if (!CLINCH_RELEASE_REQUESTS.has(requestId)) return;
      CLINCH_RELEASE_REQUESTS.delete(requestId);
      resolve(false);
    }, 30000);
  });

  game.socket.emit('system.vtm-v20', {
    action: 'clinchReleaseRequest',
    requestId,
    requestingUserId: game.user.id,
    targetUserId: controller.id,
    escaperName: escaper.name,
    holderName: holder.name,
    what,
  });

  return result;
}

// Automatic Strength damage against the clinch partner: no attack roll, no defense
export async function clinchInflictDamage(actor) {
  const clinch = actor.getFlag('vtm-v20', 'clinch');
  const opp = clinch ? getActor(clinch.actorId, clinch.tokenId) : null;
  if (!opp) return ui.notifications.warn('No clinch opponent found.');
  const oppToken = getToken(clinch.tokenId);

  const str = effectiveStrength(actor);
  const dmgAuto = potenceAutoSuccesses(actor);
  const wp = actor.system.woundPenalty || 0;
  const dp = Math.max(str + wp, 1);
  let dmgLabel = `Str ${str}`;
  if (wp) dmgLabel += ` wound ${wp}`;
  if (dmgAuto) dmgLabel += ` + Potence ${dmgAuto} auto`;

  await resolveDirectDamage(actor, opp, oppToken, {
    weaponName: 'Clinch', dmgLabel, dp, dmgAuto, dt: 'bashing',
  });
}

// Resisted Str + Brawl escape. Each side rolls against a difficulty set by the
// opponent's Str + Brawl; the holder's successes cancel the escaper's and only
// a positive margin breaks the hold. The holder may also simply let go.
export async function clinchEscape(actor, { poolOverride = null } = {}) {
  const clinch = actor.getFlag('vtm-v20', 'clinch');
  const opp = clinch ? getActor(clinch.actorId, clinch.tokenId) : null;
  if (!opp) return ui.notifications.warn('No clinch opponent found.');

  const tok = canvas.tokens?.placeables.find(t => t.actor === actor);
  const pair = { aId: actor.id, aTok: tok?.id ?? null, bId: clinch.actorId, bTok: clinch.tokenId };

  const released = await requestClinchRelease(actor, opp);
  if (released) {
    await clearClinchPair(pair);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${opp.name} releases ${actor.name} from the clinch.</span></div></div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
    return;
  }

  const escaped = await rollResistedStrBrawl(actor, opp, {
    poolOverride, title: 'Escape Clinch', continueText: 'The clinch continues.',
  });
  if (escaped) await clearClinchPair(pair);
}

// Resisted Str + Brawl: each side rolls against the other's Str + Brawl as
// difficulty, successes cancel, and only a positive margin wins.
async function rollResistedStrBrawl(actor, opp, { poolOverride = null, title, continueText } = {}) {
  const myStr = effectiveTraitValue(actor, 'attributes.strength');
  const myBrawl = actor.system.abilities?.brawl || 0;
  const oppStr = effectiveTraitValue(opp, 'attributes.strength');
  const oppBrawl = opp.system.abilities?.brawl || 0;
  const myWound = actor.system.woundPenalty || 0;
  const oppWound = opp.system.woundPenalty || 0;

  const myPool = Math.max(poolOverride ?? (myStr + myBrawl + myWound), 1);
  const oppPool = Math.max(oppStr + oppBrawl + oppWound, 1);
  const myDiff = Math.min(Math.max(oppStr + oppBrawl, 3), 10);
  const oppDiff = Math.min(Math.max(myStr + myBrawl, 3), 10);

  const myRoll = new Roll(`${myPool}d10`);
  await myRoll.evaluate();
  const oppRoll = new Roll(`${oppPool}d10`);
  await oppRoll.evaluate();
  const mine = evalPool(myRoll, myDiff);
  const theirs = evalPool(oppRoll, oppDiff);

  let myAuto = potenceAutoSuccesses(actor);
  let wpUsed = false;
  if (actor.getFlag('vtm-v20', 'wpSpent')) {
    myAuto += 1;
    wpUsed = true;
    await actor.unsetFlag('vtm-v20', 'wpSpent');
  }
  const oppAuto = potenceAutoSuccesses(opp);

  const myTotal = mine.total + myAuto;
  const oppTotal = theirs.total + oppAuto;
  const net = myTotal - oppTotal;
  const escaped = net > 0;

  let escLabel = `Str ${myStr} + Brawl ${myBrawl}`;
  if (myWound && poolOverride === null) escLabel += ` wound ${myWound}`;
  if (poolOverride !== null) escLabel = 'declared allocation';
  if (wpUsed) escLabel += ' + 1 WP';
  let holdLabel = `Str ${oppStr} + Brawl ${oppBrawl}`;
  if (oppWound) holdLabel += ` wound ${oppWound}`;

  const html = await renderTemplate('systems/vtm-v20/templates/resisted-card.hbs', {
    title,
    escaperName: actor.name, escaperImg: actor.img, escaperPortraitStyle: portraitStyle(actor),
    holderName: opp.name, holderImg: opp.img, holderPortraitStyle: portraitStyle(opp),
    escLabel, escPool: myPool, escDiff: myDiff,
    escDice: mine.dice, escDiceTotal: mine.total, escAuto: myAuto, escTotal: myTotal,
    holdLabel, holdPool: oppPool, holdDiff: oppDiff,
    holdDice: theirs.dice, holdDiceTotal: theirs.total, holdAuto: oppAuto, holdTotal: oppTotal,
    escaped, net, continueText,
  });

  await showDice(myRoll, actor);
  await showDice(oppRoll, opp);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });

  return escaped;
}

// ── Hold ───────────────────────────────────────────────────────────
// One-sided grapple: only the target is pinned, marked with the existing
// Struggling Immobilization status. The holder stays free to act.

async function applyHoldPairLocal({ holderId, holderTok, targetId, targetTok }) {
  const holder = getActor(holderId, holderTok);
  const target = getActor(targetId, targetTok);
  if (!holder || !target) return;
  await holder.setFlag('vtm-v20', 'holding', { actorId: targetId, tokenId: targetTok ?? null });
  await target.setFlag('vtm-v20', 'held', { actorId: holderId, tokenId: holderTok ?? null });
  const has = Array.from(target.effects).some(e => e.statuses?.has?.(STRUGGLING_IMMOBILIZED_STATUS_ID));
  if (!has) {
    const existing = CONFIG.statusEffects.find(e => e.id === STRUGGLING_IMMOBILIZED_STATUS_ID);
    await target.createEmbeddedDocuments('ActiveEffect', [{
      name: existing?.name ?? 'Struggling Immobilization',
      img: existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/nailed-foot.svg',
      origin: 'status',
      statuses: [STRUGGLING_IMMOBILIZED_STATUS_ID],
      ...statusIconVisibility(),
    }]);
  }
}

async function clearHoldPairLocal({ holderId, holderTok, targetId, targetTok }) {
  const holder = getActor(holderId, holderTok);
  const target = getActor(targetId, targetTok);
  if (holder?.getFlag('vtm-v20', 'holding')) await holder.unsetFlag('vtm-v20', 'holding');
  if (target) {
    if (target.getFlag('vtm-v20', 'held')) await target.unsetFlag('vtm-v20', 'held');
    const fx = Array.from(target.effects)
      .filter(e => e.statuses?.has?.(STRUGGLING_IMMOBILIZED_STATUS_ID))
      .map(e => e.id);
    if (fx.length) await target.deleteEmbeddedDocuments('ActiveEffect', fx);
  }
}

async function setHoldPair(data) {
  if (game.user.isGM) return applyHoldPairLocal(data);
  if (!firstActiveGm()) return ui.notifications.warn('No GM online to establish the hold.');
  game.socket.emit('system.vtm-v20', { action: 'holdSet', ...data });
}

async function clearHoldPair(data) {
  if (game.user.isGM) return clearHoldPairLocal(data);
  if (!firstActiveGm()) return ui.notifications.warn('No GM online to clear the hold.');
  game.socket.emit('system.vtm-v20', { action: 'holdClear', ...data });
}

// Manual status removal or combat end: free the target from either side
export async function clearHoldForActor(actor) {
  const held = actor.getFlag('vtm-v20', 'held');
  if (held) {
    const tok = canvas.tokens?.placeables.find(t => t.actor === actor);
    return clearHoldPairLocal({
      holderId: held.actorId, holderTok: held.tokenId,
      targetId: actor.id, targetTok: tok?.id ?? null,
    });
  }
  const holding = actor.getFlag('vtm-v20', 'holding');
  if (holding) {
    const tok = canvas.tokens?.placeables.find(t => t.actor === actor);
    return clearHoldPairLocal({
      holderId: actor.id, holderTok: tok?.id ?? null,
      targetId: holding.actorId, targetTok: holding.tokenId,
    });
  }
}

// The pinned character's only action: break out or beg for release
export async function holdEscape(actor, { poolOverride = null } = {}) {
  const held = actor.getFlag('vtm-v20', 'held');
  const holder = held ? getActor(held.actorId, held.tokenId) : null;
  if (!holder) return ui.notifications.warn('No one is holding this character.');

  const tok = canvas.tokens?.placeables.find(t => t.actor === actor);
  const pair = {
    holderId: held.actorId, holderTok: held.tokenId,
    targetId: actor.id, targetTok: tok?.id ?? null,
  };

  const released = await requestClinchRelease(actor, holder, 'hold');
  if (released) {
    await clearHoldPair(pair);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${holder.name} releases ${actor.name} from the hold.</span></div></div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
    return;
  }

  const escaped = await rollResistedStrBrawl(actor, holder, {
    poolOverride, title: 'Break Hold', continueText: 'The hold continues.',
  });
  if (escaped) await clearHoldPair(pair);
}

// Overcoming the Kiss takes Self-Control/Instinct at difficulty 8. Vampires
// riding low on blood roll fewer dice, same cap as other Self-Control checks.
async function rollKissResist(defender, virtueLabel) {
  let pool = defender.system.virtues?.selfControl || 0;
  let capped = false;
  if (defender.type === 'vampire') {
    const bp = defender.system.blood?.value || 0;
    if (bp < pool) { pool = bp; capped = true; }
  }
  pool = Math.max(pool, 1);
  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, 8);

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: defender.img, actorName: defender.name,
    portraitStyle: portraitStyle(defender),
    label: 'Resist the Kiss',
    sublabel: `${virtueLabel} ${pool}${capped ? ' | capped by blood pool' : ''}`,
    pool, difficulty: 8, isAttack: false,
    dice: res.dice, total: res.total, outcome: res.outcome,
    defendedLabel: res.outcome === 'success' ? `${defender.name} steels themselves against the Kiss!` : null,
    hitLabel: res.outcome !== 'success' ? `${defender.name} succumbs to the ecstasy of the Kiss.` : null,
  });
  await showDice(roll, defender);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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

  // Hold inflicts no damage: the hit pins the target until they break free
  if (c.isHold) {
    await setHoldPair({
      holderId: c.attackerId, holderTok: c.attackerTokenId,
      targetId: c.defenderId, targetTok: c.defenderTokenId,
    });
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: attacker.img, actorName: attacker.name,
      portraitStyle: portraitStyle(attacker),
      targetImg: defender.img, targetPortraitStyle: portraitStyle(defender),
      label: 'Hold', sublabel: '',
      noDice: true,
      hitLabel: `${attacker.name} holds ${defender.name}! ${defender.name} can take no action except trying to break free.`,
    });
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
    return;
  }

  // Damage roll
  const str = effectiveStrength(attacker);
  const dmgAuto = isStrengthDamageFormula(c.damageFormula) ? potenceAutoSuccesses(attacker) : 0;
  const targetingDamageMod = Math.max(Number(c.targetingDamageMod) || 0, 0);
  const horridBonus = (!c.isRanged && attacker.getFlag('vtm-v20', 'horridForm') && c.attackSkill === 'abilities.brawl') ? 1 : 0;
  const dmgWoundPen = isStrengthDamageFormula(c.damageFormula) ? (attacker.system.woundPenalty || 0) : 0;
  const dp = Math.max(calcDmgPool(c.damageFormula, str, c.netSuccesses) + targetingDamageMod + horridBonus + dmgWoundPen, 1);
  const dmgRoll = new Roll(`${dp}d10`);
  await dmgRoll.evaluate();
  const dmg = evalPool(dmgRoll, 6);
  const dmgDiceTotal = dmg.total;
  const dmgTotal = dmgDiceTotal + dmgAuto;
  let dt = c.damageType || 'lethal';
  // V20: gunfire only bruises the dead. Bullets are bashing against Kindred
  // unless the shot was aimed at the head.
  const headShot = !!c.targetingHeadshot;
  const firearmDowngrade = !!c.isFirearm && defender.type === 'vampire'
    && String(dt).toLowerCase() === 'lethal' && !headShot;
  if (firearmDowngrade) dt = 'bashing';
  const firearmNote = firearmDowngrade
    ? 'Gunfire is bashing against Kindred.'
    : (c.isFirearm && defender.type === 'vampire' && headShot ? 'Head shot: bullets stay lethal.' : null);
  const damageType = String(dt).toLowerCase();

  // Disarm: the damage roll is measured against the target's effective
  // Strength instead of being soaked. Beat it and the weapon is gone; either
  // way nobody gets hurt.
  if (c.isDisarm) {
    const targetStr = effectiveTraitValue(defender, 'attributes.strength');
    const disarmed = dmgTotal > targetStr;

    const df = (c.damageFormula || '').trim().toLowerCase();
    let dLabel;
    if (!df || df.startsWith('str')) {
      const bonus = df.startsWith('str') ? (parseInt(df.replace(/str\+?/, '')) || 0) : 0;
      dLabel = (bonus ? `Str ${str} + ${bonus}` : `Str ${str}`) + ` + ${c.netSuccesses} net`;
    } else {
      dLabel = `Base ${parseInt(df) || 0} + ${c.netSuccesses} net`;
    }
    if (dmgWoundPen) dLabel += ` wound ${dmgWoundPen}`;
    if (dmgAuto) dLabel += ` + Potence ${dmgAuto} auto`;

    const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
      attackerName: attacker.name, attackerImg: attacker.img,
      attackerPortraitStyle: portraitStyle(attacker),
      defenderName: defender.name, defenderImg: defender.img,
      defenderPortraitStyle: portraitStyle(defender),
      weaponName: c.weaponName, damageType: '',
      dmgPool: dp, dmgLabel: dLabel,
      dmgDice: dmg.dice, dmgSuccesses: dmgTotal,
      dmgAutoSuccesses: dmgAuto, dmgDiceTotal,
      soakSkipped: true, soakLabel: `Effective Strength ${targetStr}`,
      disarmMode: true, disarmSuccess: disarmed, disarmStr: targetStr,
      condition: getCondition(defender),
      penalty: defender.system.woundPenalty ? `${defender.system.woundPenalty}` : null,
    });

    await showDice(dmgRoll, attacker);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
    return;
  }

  // Soak roll
  const isAgg = damageType === 'aggravated';
  const isKindred = defender.type === 'vampire';
  let fireOrSunlight = false;

  if (isAgg && isKindred && !c.isBite) {
    fireOrSunlight = await new Promise(resolve => {
      new Dialog({
        title: 'Aggravated Damage Source',
        content: `<p style="margin:8px 0">Is this aggravated damage from <b>sunlight or fire</b>?</p>
          <p style="font-size:11px;color:#999">If yes, armor will not protect against this damage.</p>`,
        buttons: {
          yes: { icon: '<i class="fas fa-fire"></i>', label: 'Sunlight / Fire', callback: () => resolve(true) },
          no: { icon: '<i class="fas fa-paw"></i>', label: 'Teeth / Claws / Other', callback: () => resolve(false) },
        },
        default: 'no',
        close: () => resolve(false),
      }, { classes: ['vtm-v20', 'dialog'], width: 340 }).render(true);
    });
  }

  const soakData = computeSoakPool(defender, { dmgType: damageType, fireOrSunlight, bypassArmor: !!c.bypassArmor });
  const sp = soakData.pool;

  let soakRoll = null;
  let soak = { dice: [], total: 0 };
  if (soakData.canSoak) {
    soakRoll = new Roll(`${Math.max(sp, 1)}d10`);
    await soakRoll.evaluate();
    soak = evalPool(soakRoll, soakData.difficulty);
  }

  const rawNet = Math.max(dmgTotal - soak.total, 0);
  const net = finalDamageAfterSoak(defender, rawNet, dt);
  // The Kiss never wounds: it either takes hold (resist button) or fails to
  // penetrate. Mortals get no resist option, they are helpless in its ecstasy.
  const kissMode = c.biteKiss === true;
  const kissPenetrated = kissMode && rawNet > 0;
  const kissCanResist = kissPenetrated && defender.type === 'vampire';
  const threshold = dazeThreshold(defender);
  let dazed = false;
  if (!kissMode) {
    if (net > 0) await applyHealthDamage(defender, net, dt);
    await checkIncapacitated(defender);
    dazed = rawNet > 0 && rawNet > threshold;
    if (dazed && !isDazed(defenderToken, defender)) await applyDazed(defender);
  }

  // Bone Quills: melee attackers take their Str in lethal unless they scored 3+ attack successes
  let quillsNotice = null;
  const defenderQuills = !c.isRanged && defender.getFlag('vtm-v20', 'boneQuills');
  if (defenderQuills) {
    const atkSucc = c.attackSuccesses ?? 0;
    if (atkSucc < 3) {
      const atkStr = effectiveStrength(attacker);
      await applyHealthDamage(attacker, atkStr, 'lethal');
      quillsNotice = `Bone Quills: ${attacker.name} takes ${atkStr} lethal (Str) from defensive quills.`;
    } else {
      quillsNotice = `Bone Quills: ${attacker.name} scored 3+ attack successes, avoids quill damage.`;
    }
  }

  // Armor breaks when the damage rolled in one attack reaches twice its rating.
  // Skipped when the armor never engaged (bypassed, or fire/sunlight vs Kindred).
  let armorDestroyedNotice = null;
  const armorEngaged = !c.bypassArmor && !(isAgg && isKindred && fireOrSunlight);
  if (armorEngaged) {
    const broken = Array.from(defender.items).filter(i =>
      i.type === 'armor' && i.system.equipped && i.system.rating > 0 && dmgTotal >= i.system.rating * 2);
    if (broken.length) {
      const names = broken.map(i => i.name).join(' and ');
      armorDestroyedNotice = `${names} destroyed! ${dmgTotal} damage successes reached twice the armor's rating.`;
    }
  }

  const cond = getCondition(defender);
  const pen = defender.system.woundPenalty || 0;

  const f = (c.damageFormula || '').trim().toLowerCase();
  // A clinch that connects locks both combatants together
  if (c.isClinch) {
    await setClinchPair({
      aId: c.attackerId, aTok: c.attackerTokenId,
      bId: c.defenderId, bTok: c.defenderTokenId,
    });
  }

  // A landed sweep forces the knockdown save even if the damage soaked
  if (c.isSweep) await knockdownSave(defender);

  // Tackle sends both combatants tumbling: each saves at diff 7, and the
  // target who keeps their footing is still unbalanced next round
  if (c.isTackle) {
    await knockdownSave(defender, { difficulty: 7, unbalancedOnSuccess: true });
    await knockdownSave(attacker, { difficulty: 7 });
  }

  let dmgLabel;
  if (!f || f === 'str' || f.startsWith('str')) {
    const bonus = f.startsWith('str') ? (parseInt(f.replace(/str\+?/, '')) || 0) : 0;
    dmgLabel = bonus ? `Str ${str} + ${bonus}` : `Str ${str}`;
    dmgLabel += ` + ${c.netSuccesses} net`;
  } else {
    dmgLabel = `Base ${parseInt(f) || 0} + ${c.netSuccesses} net`;
  }
  if (horridBonus) dmgLabel += ' + 1 Horrid Form';
  if (targetingDamageMod) dmgLabel += ` + ${targetingDamageMod} targeted`;
  if (dmgWoundPen) dmgLabel += ` wound ${dmgWoundPen}`;
  if (dmgAuto) dmgLabel += ` + Potence ${dmgAuto} auto`;
  const soakParts = soakData.parts;

  const html = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
    attackerName: attacker.name, attackerImg: attacker.img,
    attackerPortraitStyle: portraitStyle(attacker),
    defenderName: defender.name, defenderImg: defender.img,
    defenderPortraitStyle: portraitStyle(defender),
    weaponName: c.weaponName, damageType: dt,
    dmgPool: dp, dmgLabel,
    dmgDice: dmg.dice, dmgSuccesses: dmgTotal,
    dmgAutoSuccesses: dmgAuto, dmgDiceTotal,
    soakPool: sp, soakLabel: soakParts.join(' + '),
    soakDice: soak.dice, soakSuccesses: soak.total, soakSkipped: !soakData.canSoak,
    netDamage: net, noDamage: net === 0,
    damageAdjustment: rawNet !== net ? `Vampire bashing damage halved: ${rawNet} to ${net}.` : null,
    dazedNotice: dazed ? `${defender.name} is dazed (${rawNet} damage successes exceeded ${threshold}).` : null,
    firearmNote,
    quillsNotice,
    armorDestroyedNotice,
    kissMode, kissPenetrated, kissCanResist,
    condition: cond, penalty: pen ? `${pen}` : null,
  });

  await showDice(dmgRoll, attacker);
  if (soakRoll) await showDice(soakRoll, defender);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: kissCanResist ? { 'vtm-v20': { combat: {
      phase: 'kiss-resist',
      defenderId: c.defenderId,
      defenderTokenId: c.defenderTokenId,
      resolved: false,
    } } } : {},
  });
}


// ── Health Damage Application ───────────────────────────────────────

export async function applyHealthDamage(actor, amount, type) {
  const sys = actor.system;
  const cap = trackSize(sys);
  let { bash, leth, agg } = countDamage(sys);

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
  await actor.update(rebuildTrack(sys, { bash, leth, agg }));
}


// ── Sweep & Knockdown ──────────────────────────────────────────────

function statusEffectData(id, fallbackName, fallbackImg) {
  const existing = CONFIG.statusEffects.find(e => e.id === id);
  return {
    name: existing?.name ?? fallbackName,
    img: existing?.img ?? existing?.icon ?? fallbackImg,
    origin: 'status',
    statuses: [id],
    ...statusIconVisibility(),
  };
}

// Reflexive Dex + Athletics save against the trip, auto-rolled like soak.
// Tackle targets who keep their footing are still unbalanced next round.
async function knockdownSave(victim, { difficulty = 8, unbalancedOnSuccess = false } = {}) {
  const dex = effectiveTraitValue(victim, 'attributes.dexterity');
  const ath = victim.system.abilities?.athletics || 0;
  const wp = victim.system.woundPenalty || 0;
  const pool = Math.max(dex + ath + wp, 1);
  const roll = new Roll(`${pool}d10`);
  await roll.evaluate();
  const res = evalPool(roll, difficulty);
  const kept = res.outcome === 'success';

  if (!kept) {
    const has = id => Array.from(victim.effects).some(e => e.statuses?.has?.(id));
    const toAdd = [];
    if (!has(PRONE_STATUS_ID)) toAdd.push(statusEffectData(PRONE_STATUS_ID, 'Prone', 'systems/vtm-v20/VTM icons/prone.svg'));
    if (!has(KNOCKDOWN_STATUS_ID)) toAdd.push(statusEffectData(KNOCKDOWN_STATUS_ID, 'Knockdown', 'systems/vtm-v20/VTM icons/falling-status.svg'));
    if (toAdd.length) await victim.createEmbeddedDocuments('ActiveEffect', toAdd);
  }

  let keptLabel = `${victim.name} keeps their footing!`;
  if (kept && unbalancedOnSuccess) {
    if (game.combat) await victim.setFlag('vtm-v20', 'unbalancedRound', game.combat.round + 1);
    keptLabel += ' Still unbalanced: +1 difficulty to actions next round.';
  }

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: victim.img, actorName: victim.name,
    portraitStyle: portraitStyle(victim),
    label: 'Knockdown Save', sublabel: `Dex ${dex} + Athletics ${ath}${wp ? ` wound ${wp}` : ''}`,
    pool, difficulty, isAttack: false,
    dice: res.dice, total: res.total, outcome: res.outcome,
    defendedLabel: kept ? keptLabel : null,
    hitLabel: kept ? null : `${victim.name} is knocked down!`,
  });
  await showDice(roll, victim);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: victim }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// A successful Get Up clears Prone. Standing after a knockdown costs -2
// initiative on the next round's roll (consumed by the initiative reroll).
export async function standUp(actor) {
  const effects = Array.from(actor.effects);
  const proneIds = effects.filter(e => e.statuses?.has?.(PRONE_STATUS_ID)).map(e => e.id);
  if (!proneIds.length) return;
  const kdIds = effects.filter(e => e.statuses?.has?.(KNOCKDOWN_STATUS_ID)).map(e => e.id);
  await actor.deleteEmbeddedDocuments('ActiveEffect', [...proneIds, ...kdIds]);
  if (kdIds.length) {
    await actor.setFlag('vtm-v20', 'nextRoundInitPenalty', 2);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vtm-roll"><div class="roll-meta"><i class="fas fa-person-arrow-up-from-line"></i> ${actor.name} regains footing after the knockdown: -2 initiative next round.</div></div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }
}


// ── Chat Button Wiring ─────────────────────────────────────────────
// Called from renderChatMessageHTML hook in vtm-v20.mjs

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

  if (c.phase === 'kiss-resist') {
    const btn = el.querySelector('.kiss-resist-btn');
    if (!btn) return;
    if (c.resolved) { btn.remove(); return; }

    const defender = getActor(c.defenderId, c.defenderTokenId);
    if (!defender || (!defender.isOwner && !game.user.isGM)) { btn.remove(); return; }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const vFlags = defender.getFlag('vtm-v20', 'virtueLabels');
      const scLabel = vFlags?.selfControl || game.i18n.localize('VTM.SelfControl');

      const choice = await new Promise(resolve => {
        new Dialog({
          title: `${defender.name}: Resist the Kiss`,
          content: '<p style="margin:8px 0;color:#ddd;">Fight through the ecstasy of the Kiss?</p>',
          buttons: {
            roll: { icon: '<i class="fas fa-dice-d20"></i>', label: `Roll ${scLabel} (diff 8)`, callback: () => resolve('roll') },
            none: { icon: '<i class="fas fa-heart"></i>', label: 'No Resistance', callback: () => resolve('none') },
          },
          default: 'roll',
          close: () => resolve(null),
        }, { classes: ['vtm-v20', 'dialog'], width: 380 }).render(true);
      });
      if (!choice) { btn.disabled = false; return; }

      if (msg.isAuthor || game.user.isGM) {
        await msg.update({ 'flags.vtm-v20.combat.resolved': true });
      } else {
        game.socket.emit('system.vtm-v20', { action: 'resolveMsg', msgId: msg.id });
      }

      if (choice === 'roll') {
        await rollKissResist(defender, scLabel);
      } else {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: defender }),
          content: `<div class="vtm-roll"><div class="roll-result"><span class="result-fail">${defender.name} offers no resistance, lost in the ecstasy of the Kiss.</span></div></div>`,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        });
      }
    });
  }
}
