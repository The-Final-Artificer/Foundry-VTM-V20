// Builds the slot catalog the Authentic Text parser matches against. Every
// name comes straight from the data files, so renames stay in sync.

import { DISCIPLINES, BACKGROUNDS, MERITS, FLAWS, RITUAL_CATEGORIES } from './compendiums.mjs';
import { PATHS } from './paths-data.mjs';
import { RITUALS } from './rituals-data.mjs';
import { ARCHETYPES } from './archetypes-data.mjs';
import { TRAIT_DESCRIPTIONS } from './trait-descriptions.mjs';

// Virtues, Willpower and Humanity keep their shipped text by design.
const TRAIT_EXCLUDE = new Set(['virtues.conscience', 'virtues.selfControl', 'virtues.courage', 'willpower', 'humanity']);

const traitName = key => {
  const last = key.split('.').pop();
  return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
};

const powerList = sys => Object.entries(sys?.powers || {})
  .map(([k, p]) => ({ name: p?.name || '', lvl: parseInt(k.replace('lvl', ''), 10) || 0 }))
  .filter(p => p.lvl >= 1);

export function buildCatalog() {
  return {
    archetypes: Object.keys(ARCHETYPES),
    disciplines: DISCIPLINES.map(d => ({ name: d.name, powers: powerList(d.system) })),
    paths: PATHS.map(p => ({ name: p.name, powers: powerList(p.system) })),
    rituals: RITUALS.map(r => ({ name: r.name, level: r.system?.level ?? 0, type: r.system?.ritualType || '' })),
    ritualcats: RITUAL_CATEGORIES.filter(c => !c.parent).map(c => c.name),
    backgrounds: BACKGROUNDS.map(b => ({
      name: b.name,
      levels: Object.entries(b.system?.levels || {}).map(([k, l]) => ({ key: k, name: l?.name || k })),
    })),
    merits: MERITS.map(m => ({ name: m.name, cost: m.system?.cost ?? 0 })),
    flaws: FLAWS.map(f => ({ name: f.name, cost: f.system?.cost ?? 0 })),
    traits: Object.keys(TRAIT_DESCRIPTIONS)
      .filter(k => !TRAIT_EXCLUDE.has(k))
      .map(k => ({ key: k, name: traitName(k) })),
  };
}

// Full slot list per category, used by the manager for coverage counts.
export function listSlots(catalog = buildCatalog()) {
  const slots = [];
  for (const n of catalog.archetypes) slots.push({ key: `archetype:${n}`, label: n, category: 'Archetypes' });
  for (const d of catalog.disciplines) {
    slots.push({ key: `discipline:${d.name}:intro`, label: `${d.name} (introduction)`, category: 'Disciplines' });
    for (const p of d.powers) {
      const slot = p.name || `lvl${p.lvl}`;
      slots.push({ key: `discipline:${d.name}:power:${slot}`, label: `${d.name}: ${p.name || 'level ' + p.lvl}`, category: 'Disciplines' });
    }
  }
  for (const pth of catalog.paths) {
    slots.push({ key: `path:${pth.name}:intro`, label: `${pth.name} (introduction)`, category: 'Paths' });
    for (const p of pth.powers) {
      const slot = p.name || `lvl${p.lvl}`;
      slots.push({ key: `path:${pth.name}:power:${slot}`, label: `${pth.name}: ${p.name || 'level ' + p.lvl}`, category: 'Paths' });
    }
  }
  for (const c of catalog.ritualcats) slots.push({ key: `ritualcat:${c}`, label: `${c} (folder text)`, category: 'Rituals' });
  for (const r of catalog.rituals) slots.push({ key: `ritual:${r.name}`, label: `${r.name} (level ${r.level})`, category: 'Rituals' });
  for (const b of catalog.backgrounds) {
    slots.push({ key: `background:${b.name}:intro`, label: `${b.name} (introduction)`, category: 'Backgrounds' });
    for (const l of b.levels) {
      slots.push({ key: `background:${b.name}:level:${l.key}`, label: `${b.name}: ${l.name}`, category: 'Backgrounds' });
    }
  }
  for (const m of catalog.merits) slots.push({ key: `merit:${m.name}`, label: m.name, category: 'Merits' });
  for (const f of catalog.flaws) slots.push({ key: `flaw:${f.name}`, label: f.name, category: 'Flaws' });
  for (const t of catalog.traits) slots.push({ key: `trait:${t.key}`, label: t.name, category: 'Attributes & Abilities' });
  return slots;
}
