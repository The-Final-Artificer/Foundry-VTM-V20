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

// Shape-changes that rewrite attributes on the sheet and keep the originals
// in a flag of the same name
const FORM_FLAGS = [
  ['horridForm', 'Horrid Form'],
  ['batForm', 'Bat Form'],
  ['skinOfTheAdder', 'Skin of the Adder'],
];

// Which disciplines are feeding a trait right now, and by how much. The one
// source both the math and the roll displays read, so a discipline that
// should show up and doesn't is visibly missing. `baked` entries already
// live in the stored attribute and are listed for display only.
export function traitBoosts(actor, path) {
  const out = [];
  if (!actor || !path?.startsWith?.('attributes.')) return out;
  const attr = path.split('.')[1];
  // Passive potence adds dice to Strength. When activated, the bonus comes
  // as auto-successes instead, so it's excluded here.
  if (attr === 'strength' && !isDisciplineActive(actor, 'potence')) {
    const n = potenceLevel(actor);
    if (n) out.push({ label: 'Potence', value: n });
  }
  // Extra Actions redirects the dots into speed: no passive dice while active.
  // Under RAW, each extra action bought eats one dot of the passive instead.
  if (attr === 'dexterity' && !actor.getFlag?.('vtm-v20', 'celerityActions')) {
    const rawSpent = actor.getFlag?.('vtm-v20', 'celerityRawActions') || 0;
    const n = Math.max(celerityLevel(actor) - rawSpent, 0);
    if (n) out.push({ label: 'Celerity', value: n });
  }
  const cur = actor.system?.attributes?.[attr] ?? 0;
  for (const [flag, label] of FORM_FLAGS) {
    const saved = actor.getFlag?.('vtm-v20', flag);
    if (saved && typeof saved === 'object' && saved[attr] !== undefined && saved[attr] !== cur) {
      out.push({ label, value: cur - saved[attr], baked: true });
    }
  }
  return out;
}

// A trait split the way roll displays print it: the character's own dots,
// the discipline parts listed apart. Item bonuses have their own line.
export function naturalTraitValue(actor, path) {
  const boosted = traitBoosts(actor, path).reduce((sum, b) => sum + b.value, 0);
  return effectiveTraitValue(actor, path) - itemTraitBonus(actor, path) - boosted;
}

// Trait value with passive discipline bonuses baked in.
export function effectiveTraitValue(actor, path) {
  let val = baseTraitValue(actor, path);
  for (const b of traitBoosts(actor, path)) if (!b.baked) val += b.value;
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
