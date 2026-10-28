// V20 p. 142: an elder level of Celerity, Fortitude, or Potence spent on an
// alternate power forfeits that level's plain benefit (the die, soak, success,
// and extra-action capacity), so known alternates subtract from the level the
// engines read. Levels 1-5 are never tradeable.
export function physicalLevel(item) {
  const lvl = Math.max(Number(item?.system?.level) || 0, 0);
  if (lvl <= 5) return lvl;
  const traded = (item.system.elderPowers || []).filter(p => p?.known && p.level <= lvl).length;
  return Math.max(lvl - traded, 5);
}

const PHYSICAL_DISCS = new Set(['celerity', 'fortitude', 'potence']);

export function disciplineLevel(actor, name) {
  const key = String(name || '').toLowerCase();
  if (!actor || !key) return 0;

  const discipline = Array.from(actor.items ?? [])
    .find(item => item.type === 'discipline' && item.name?.toLowerCase() === key);

  if (PHYSICAL_DISCS.has(key)) return physicalLevel(discipline);
  return Math.max(Number(discipline?.system?.level) || 0, 0);
}

export function potenceLevel(actor) {
  return disciplineLevel(actor, 'potence');
}

export function celerityLevel(actor) {
  return disciplineLevel(actor, 'celerity');
}

// Which Celerity ruleset the world runs: the enhanced homebrew kit (default)
// or RAW V20. Settings may not be registered yet during early data prep.
export function celerityRawMode() {
  try { return game.settings.get('vtm-v20', 'celerityMode') === 'raw'; }
  catch { return false; }
}

export function isDisciplineActive(actor, name) {
  const active = actor?.getFlag('vtm-v20', 'activeDisciplines') || [];
  return active.includes(String(name || '').toLowerCase());
}

export function potenceAutoSuccesses(actor) {
  return isDisciplineActive(actor, 'potence') ? potenceLevel(actor) : 0;
}

export function usesStrengthTrait(...paths) {
  return paths.some(path => path === 'attributes.strength');
}

export function isStrengthDamageFormula(formula) {
  const raw = String(formula || '').trim().toLowerCase();
  return !raw || raw === 'str' || raw.startsWith('str');
}

// Flat dice bonuses granted by items (an occult charm adding +1 to Larceny).
// Gear counts while equipped; merits and flaws always apply.
export function itemTraitBonus(actor, path) {
  if (!path || !actor?.items) return 0;
  let sum = 0;
  for (const it of actor.items) {
    const list = it.system?.bonuses;
    if (!list?.length) continue;
    if (it.system.equipped === false) continue;
    for (const b of list) if (b.trait === path) sum += Number(b.value) || 0;
  }
  return sum;
}

// Raw trait value straight from the actor, no discipline bonuses
export function baseTraitValue(actor, path) {
  if (!path || !actor?.system) return 0;
  if (path === 'willpower') return actor.system.willpower?.max || 0;
  if (path === 'humanity') return actor.system.humanity || 0;
  const [category, key] = path.split('.');
  return actor.system[category]?.[key] || 0;
}

// Trait value with passive discipline bonuses baked in.
// Passive potence adds dice to Strength. When activated, the bonus
// comes as auto-successes instead, so it's excluded here.
export function effectiveTraitValue(actor, path) {
  let val = baseTraitValue(actor, path);
  if (path === 'attributes.strength' && !isDisciplineActive(actor, 'potence')) {
    val += potenceLevel(actor);
  }
  // Extra Actions redirects the dots into speed: no passive dice while active.
  // Under RAW, each extra action bought eats one dot of the passive instead.
  if (path === 'attributes.dexterity' && !actor.getFlag?.('vtm-v20', 'celerityActions')) {
    const rawSpent = actor.getFlag?.('vtm-v20', 'celerityRawActions') || 0;
    val += Math.max(celerityLevel(actor) - rawSpent, 0);
  }
  const attr = path.split('.').pop();
  if (['strength', 'dexterity', 'stamina'].includes(attr)) {
    val += (actor.getFlag('vtm-v20', 'bloodBuffs')?.[attr] || 0);
  }
  val += itemTraitBonus(actor, path);
  return val;
}

// Effective Strength for damage formulas (Str, Str+2, etc.)
export function effectiveStrength(actor) {
  return effectiveTraitValue(actor, 'attributes.strength');
}
