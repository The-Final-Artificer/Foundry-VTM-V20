export function disciplineLevel(actor, name) {
  const key = String(name || '').toLowerCase();
  if (!actor || !key) return 0;

  const discipline = Array.from(actor.items ?? [])
    .find(item => item.type === 'discipline' && item.name?.toLowerCase() === key);

  return Math.max(Number(discipline?.system?.level) || 0, 0);
}

export function potenceLevel(actor) {
  return disciplineLevel(actor, 'potence');
}

export function celerityLevel(actor) {
  return disciplineLevel(actor, 'celerity');
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
  if (path === 'attributes.dexterity') {
    val += celerityLevel(actor);
  }
  return val;
}

// Effective Strength for damage formulas (Str, Str+2, etc.)
export function effectiveStrength(actor) {
  return effectiveTraitValue(actor, 'attributes.strength');
}
