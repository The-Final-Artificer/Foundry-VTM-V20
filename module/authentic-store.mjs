// Storage and application of Authentic Text overrides. The override map lives
// in a world setting keyed by slot (see authentic-catalog.mjs); compendium
// items pick overrides up at build time, archetype popups and trait tooltips
// read them live.

export function registerAuthenticSettings() {
  game.settings.register('vtm-v20', 'authenticText', {
    scope: 'world', config: false, type: Object, default: {},
  });
  game.settings.register('vtm-v20', 'authenticTextRev', {
    scope: 'world', config: false, type: Number, default: 0,
  });
  game.settings.register('vtm-v20', 'authenticTextApplied', {
    scope: 'world', config: false, type: Number, default: 0,
  });
}

export const getOverrides = () => game.settings.get('vtm-v20', 'authenticText') || {};
export const getRev = () => game.settings.get('vtm-v20', 'authenticTextRev') || 0;
export const getAppliedRev = () => game.settings.get('vtm-v20', 'authenticTextApplied') || 0;

export async function setOverrides(map) {
  await game.settings.set('vtm-v20', 'authenticText', map);
  await game.settings.set('vtm-v20', 'authenticTextRev', getRev() + 1);
}

export const markApplied = () => game.settings.set('vtm-v20', 'authenticTextApplied', getRev());

// ── live consumers ────────────────────────────────────────────────────────

export function archetypeAuthentic(name) {
  const raw = getOverrides()[`archetype:${name}`];
  if (!raw) return null;
  const cut = raw.lastIndexOf('\n\n• ');
  if (cut === -1) return { body: raw.trim(), regain: '' };
  return { body: raw.slice(0, cut).trim(), regain: raw.slice(cut + 4).trim() };
}

export function traitAuthentic(key) {
  const raw = getOverrides()[`trait:${key}`];
  return raw ? raw.split('\n').filter(l => l.trim()) : null;
}

// ── compendium build application ──────────────────────────────────────────
// Returns a replacement item when an override touches it, otherwise null.
// Cloning matters: the source arrays are module constants shared between
// rebuilds, so they must never be mutated.

export function applyAuthentic(kind, item, ov) {
  const jobs = [];
  const name = item.name;
  if (kind === 'discipline' || kind === 'path') {
    const intro = ov[`${kind}:${name}:intro`];
    if (intro) jobs.push(it => { it.system.description = intro; });
    for (const [lvlKey, power] of Object.entries(item.system?.powers || {})) {
      const slot = power?.name || lvlKey;
      const text = ov[`${kind}:${name}:power:${slot}`];
      if (text) jobs.push(it => { it.system.powers[lvlKey].desc = text; });
    }
  } else if (kind === 'background') {
    const intro = ov[`background:${name}:intro`];
    if (intro) jobs.push(it => { it.system.description = intro; });
    for (const lvlKey of Object.keys(item.system?.levels || {})) {
      const text = ov[`background:${name}:level:${lvlKey}`];
      if (text) jobs.push(it => { it.system.levels[lvlKey].desc = text; });
    }
  } else if (kind === 'merit' || kind === 'flaw' || kind === 'ritual') {
    const text = ov[`${kind}:${name}`];
    if (text) jobs.push(it => { it.system.description = text; });
  }
  if (!jobs.length) return null;
  const clone = foundry.utils.deepClone(item);
  for (const job of jobs) job(clone);
  return clone;
}
