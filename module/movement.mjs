// Carrying capacity and movement rates, derived on the actor so both the
// sheet and token bars read the same numbers.
import { celerityLevel, potenceLevel } from './discipline-effects.mjs';

export function computeCarry(actor) {
  const str = (actor.system.attributes?.strength || 0) + potenceLevel(actor);
  const maxCarry = str * 10;
  let weight = 0;
  const eiActive = game.modules?.get('enhanced-inventory')?.active;
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
  weight = Math.round(weight * 10) / 10;
  const overweight = Math.max(weight - maxCarry, 0);
  return {
    weight, maxCarry,
    encumbered: overweight > 0,
    cannotMove: maxCarry > 0 && weight >= maxCarry * 2,
    moveHalves: overweight > 0 ? Math.floor(overweight / 10) : 0,
  };
}

// Movement (V20 p.258) - raw Dex for the base rates, plus flat Celerity yards
// per the DAV20 reading. Wolf form doubles the enhanced speed, Movement Burst
// (1 blood) multiplies speed by 1 + Celerity on top.
export function computeMovement(actor) {
  const sys = actor.system;
  const carry = computeCarry(actor);
  const rawDex = sys.attributes?.dexterity || 0;
  const cel = celerityLevel(actor);
  const burstMult = actor.getFlag('vtm-v20', 'celerityBurst') ? cel + 1 : 1;
  const wolfMult = actor.getFlag('vtm-v20', 'wolfForm') ? 2 : 1;
  let walk = (7 + cel) * burstMult * wolfMult,
      jog = (12 + rawDex + cel) * burstMult * wolfMult,
      run = (20 + (3 * rawDex) + cel) * burstMult * wolfMult;
  if (carry.cannotMove) {
    walk = 0; jog = 0; run = 0;
  } else if (carry.moveHalves > 0) {
    const div = Math.pow(2, carry.moveHalves);
    walk = Math.max(Math.floor(walk / div), 1);
    jog = Math.max(Math.floor(jog / div), 1);
    run = Math.max(Math.floor(run / div), 1);
  }
  const hobble = carry.cannotMove ? 0 : 3;
  const crawl = carry.cannotMove ? 0 : 1;

  // Worst filled health level limits the pace (unless wounds are ignored)
  const keys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];
  let worst = null;
  for (let i = keys.length - 1; i >= 0; i--) {
    if (sys.health.levels[keys[i]] > 0) { worst = keys[i]; break; }
  }
  let curLabel = 'Run', curValue = run;
  if (!actor.getFlag('vtm-v20', 'wpIgnoreWounds')) {
    switch (worst) {
      case 'incapacitated': curLabel = 'None'; curValue = 0; break;
      case 'crippled': curLabel = 'Crawl'; curValue = crawl; break;
      case 'mauled': curLabel = 'Hobble'; curValue = hobble; break;
      case 'wounded': curLabel = 'Walk'; curValue = walk; break;
      case 'injured': curLabel = 'Jog'; curValue = jog; break;
    }
  }

  // Token display: jog / run, both capped by what the wounds allow.
  // max stays at least 1 so the canvas bar math never divides by zero.
  const tokenMove = Math.min(curValue, jog);
  return {
    walk, jog, run, hobble, crawl, curLabel, curValue,
    current: { value: tokenMove, max: Math.max(curValue, 1) },
  };
}
