// Paste-in importer for printed stat blocks. Handles the old first and
// second edition layout (Milwaukee by Night, the By Night city books) and
// the Revised/V20 layout (Clan, Morality, separate path lines, the core
// book's Attributes/Abilities templates).
import { DISCIPLINES, BACKGROUNDS, MERITS, FLAWS } from './compendiums.mjs';
import { PATHS } from './paths-data.mjs';
import { RITUALS } from './rituals-data.mjs';

const ATTR_KEYS = ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'appearance', 'perception', 'intelligence', 'wits'];

const ABILITY_KEYS = {
  alertness: 'alertness', athletics: 'athletics', awareness: 'awareness', brawl: 'brawl',
  empathy: 'empathy', expression: 'expression', intimidation: 'intimidation', leadership: 'leadership',
  streetwise: 'streetwise', subterfuge: 'subterfuge',
  'animal ken': 'animalKen', crafts: 'crafts', drive: 'drive', etiquette: 'etiquette',
  firearms: 'firearms', larceny: 'larceny', melee: 'melee', performance: 'performance',
  stealth: 'stealth', survival: 'survival',
  academics: 'academics', computer: 'computer', finance: 'finance', investigation: 'investigation',
  law: 'law', medicine: 'medicine', occult: 'occult', politics: 'politics',
  science: 'science', technology: 'technology',
};

const ABILITY_COLUMN = {
  alertness: 'talents', athletics: 'talents', awareness: 'talents', brawl: 'talents',
  empathy: 'talents', expression: 'talents', intimidation: 'talents', leadership: 'talents',
  streetwise: 'talents', subterfuge: 'talents',
  animalKen: 'skills', crafts: 'skills', drive: 'skills', etiquette: 'skills',
  firearms: 'skills', larceny: 'skills', melee: 'skills', performance: 'skills',
  stealth: 'skills', survival: 'skills',
  academics: 'knowledges', computer: 'knowledges', finance: 'knowledges', investigation: 'knowledges',
  law: 'knowledges', medicine: 'knowledges', occult: 'knowledges', politics: 'knowledges',
  science: 'knowledges', technology: 'knowledges',
};

// Other names books use for a path, keyed the way pathKey() reduces them
const PATH_ALIASES = {
  'taste of blood': 'blood',
  'lure of flame': 'lure of flames',
  countermagic: 'thaumaturgical countermagic',
};

// Abilities V20 absorbed into the core mechanics; the dots mean nothing now
// (dodging is Dex + Athletics), so they are dropped rather than kept as customs
const DROPPED_ABILITIES = new Set(['dodge']);

// Abilities V20 folded into one of the thirty: carry the dots over with a
// specialty (p. 108: Politics covers navigating bureaucracies)
const ABILITY_MERGES = {
  bureaucracy: { key: 'politics', spec: 'Bureaucracy' },
};

// Second edition Sabbat virtues and the path virtues that replaced them
const VIRTUES = {
  conscience: { key: 'conscience' },
  conviction: { key: 'conscience', label: 'Conviction' },
  callousness: { key: 'conscience', label: 'Conviction' },
  'self-control': { key: 'selfControl' },
  'self control': { key: 'selfControl' },
  selfcontrol: { key: 'selfControl' },
  instinct: { key: 'selfControl', label: 'Instinct' },
  instincts: { key: 'selfControl', label: 'Instinct' },
  courage: { key: 'courage' },
  morale: { key: 'courage' },
};

// Labels that may also start in the middle of a line: text copied out of the
// older scans runs them together ("Humanity: 7 Willpower: 9 Image: ...")
const KNOWN_LABELS = [
  'Name', 'Clan', 'Sire', 'Nature', 'Demeanor', 'Concept', 'Chronicle', 'Player', 'Generation', 'Embrace', 'Apparent Age',
  'Physical', 'Social', 'Mental', 'Attributes', 'Talents', 'Skills', 'Knowledges', 'Abilities', 'Secondary Abilities',
  'Disciplines', 'Equivalent Disciplines', 'Thaumaturgical Paths', 'Thaumaturgy Paths', 'Necromantic Paths', 'Necromancy Paths',
  'Rituals', 'Backgrounds', 'Background', 'Virtues', 'Morality', 'Humanity', 'Willpower', 'Blood Pool',
  'Merits/Flaws', 'Merits', 'Flaws', 'Derangements', 'Derangement',
  'Image', 'Roleplaying Hints', 'Haven', 'Influence', 'Secrets', 'Notes', 'Note', 'Equipment',
];
const KNOWN_RE = new RegExp(
  `(\\s)(${KNOWN_LABELS
    .map(l => l.replace(/\//g, '\\s*\\/\\s*').replace(/ /g, '\\s*'))
    .sort((a, b) => b.length - a.length)
    .join('|')}):\\s`, 'gi');

// V20's catch-all abilities: "Hobby Talent (Poker) 2" is a custom Talent named Poker
const CATCHALL_ABILITIES = { 'hobby talent': 'talents', 'professional skill': 'skills', 'expert knowledge': 'knowledges' };

// Name, optional (specialty), rating. The gap before the rating is optional
// because scanned books often lose it ("Dexterity3", "Charisma.3").
const PAIR_RE = /([A-Za-z][A-Za-z'’ \-]*?)(?:\s*\(([^)]*)\))?[\s.]*(\d+)/g;

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bdefence\b/g, 'defense')
    .replace(/\bthe\b/g, ' ')
    .replace(/[^a-z' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function titleCase(s) {
  return String(s).trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

// "Animal Ken 2, Etiquette 5" (separators vary, typos included) into
// { name, spec, value } entries; parens before the number become specialties
function pairScan(text) {
  const out = [];
  PAIR_RE.lastIndex = 0;
  let m;
  while ((m = PAIR_RE.exec(text)) !== null) {
    out.push({ name: m[1].trim(), spec: m[2]?.trim() || '', value: parseInt(m[3], 10) });
  }
  return out;
}

// A list of rated traits, as opposed to prose that happens to hold numbers.
// Revised and V20 books open each character with a "Background:" paragraph
// while the oldest books use that same label for the Backgrounds line.
function isTraitList(text) {
  const pairs = pairScan(text);
  if (!pairs.length || pairs.some(p => p.value > 10)) return false;
  // side notes like "Allies 5 (mortal family)" don't make it prose
  const bare = text.replace(/\([^)]*\)/g, '');
  PAIR_RE.lastIndex = 0;
  const leftover = bare.replace(PAIR_RE, '').replace(/\band\b|[\s,.;]/gi, '');
  return leftover.length <= Math.max(12, bare.replace(/[\s,.;]/g, '').length * 0.4);
}

// Split one logical entry wherever a known label starts mid-line
function splitKnown(text) {
  const cuts = [];
  KNOWN_RE.lastIndex = 0;
  let m;
  while ((m = KNOWN_RE.exec(text)) !== null) {
    const start = m.index + m[1].length;
    // lowercase hits are prose, not labels
    if (/[A-Z]/.test(text[start])) cuts.push(start);
  }
  if (!cuts.length) return [text];
  const out = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(text.slice(prev, c));
    prev = c;
  }
  out.push(text.slice(prev));
  return out.map(s => s.trim().replace(/,$/, '')).filter(Boolean);
}

// Rebuild logical entries: a line that doesn't start with a "Label:" is a
// wrap of the previous one, and one physical line can hold several labels
function toEntries(text) {
  const joined = [];
  let nameCandidate = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[A-Za-z][A-Za-z'’ .\-/&()]{0,40}:\s*/.test(line)) joined.push(line);
    else if (joined.length) joined[joined.length - 1] += ` ${line}`;
    else if (!nameCandidate) nameCandidate = line;
  }
  const entries = [];
  for (const entry of joined) {
    // "Cha- risma" and "Coun- termagic" are line-wrap hyphens, not real ones
    const clean = entry.replace(/([A-Za-z])-\s+(?=[a-z])/g, '$1');
    for (const known of splitKnown(clean)) {
      for (const piece of known.split(/,\s*(?=[A-Z][A-Za-z' ]{1,24}:\s)/)) {
        const idx = piece.indexOf(':');
        if (idx < 0) continue;
        // "Attributes (human form):" is still the Attributes line
        const label = norm(piece.slice(0, idx).replace(/\([^)]*\)/g, ''));
        entries.push({ label, value: piece.slice(idx + 1).trim() });
      }
    }
  }
  if (nameCandidate && nameCandidate === nameCandidate.toUpperCase()) {
    nameCandidate = titleCase(nameCandidate.toLowerCase());
  }
  return { entries, nameCandidate };
}

function findByName(list, name) {
  const n = norm(name);
  return list.find(e => norm(e.name) === n) ?? null;
}

// "Path of Blood", "The Sepulchre Path", "Lure of Flames": compare on the
// distinctive part so the usual ways of writing a path all meet
function pathKey(name) {
  const n = norm(name);
  return (PATH_ALIASES[n] ?? n).replace(/^path of /, '').replace(/ path$/, '');
}

function findPath(name) {
  const key = pathKey(name);
  return PATHS.find(p => pathKey(p.name) === key) ?? null;
}

export function parseStatBlock(text) {
  const { entries, nameCandidate } = toEntries(text);
  const res = {
    name: nameCandidate,
    system: { attributes: {}, abilities: {}, virtues: {} },
    customAbilities: [],
    specialties: {},
    virtueLabels: null,
    morality: null,
    items: [],
    bioLines: [],
    report: { customs: [], looseItems: [], unmatchedRituals: [], bioLabels: [], dropped: [], merged: [], notes: [] },
  };

  const toBio = (label, value) => {
    res.bioLines.push(`<p><b>${esc(titleCase(label))}:</b> ${esc(value)}</p>`);
    res.report.bioLabels.push(titleCase(label));
  };

  const addAbility = (entry, column) => {
    const n = norm(entry.name);
    if (DROPPED_ABILITIES.has(n)) {
      res.report.dropped.push(`${titleCase(entry.name)} ${entry.value}`);
      return;
    }
    const merge = ABILITY_MERGES[n];
    if (merge) {
      res.system.abilities[merge.key] = Math.max(res.system.abilities[merge.key] ?? 0, entry.value);
      (res.specialties[`abilities--${merge.key}`] ??= []).push({ name: merge.spec, desc: '' });
      res.report.merged.push(`${titleCase(entry.name)} ${entry.value} into ${titleCase(merge.key)}`);
      return;
    }
    const key = ABILITY_KEYS[n];
    if (key) {
      // Max, not overwrite: a merged ability may already have raised this key
      res.system.abilities[key] = Math.max(res.system.abilities[key] ?? 0, entry.value);
      if (entry.spec) {
        res.specialties[`abilities--${key}`] = entry.spec.split(/[,/]/).map(s => ({ name: s.trim(), desc: '' })).filter(s => s.name);
      }
      return;
    }
    // "Any three at 2" and stray prose are not abilities
    if (/^(any|all|none)\b/i.test(entry.name) || entry.name.split(/\s+/).length > 4) {
      res.report.notes.push(`Not read as an ability: ${entry.name} ${entry.value}`);
      return;
    }
    let pretty = titleCase(entry.name);
    if (CATCHALL_ABILITIES[n] && entry.spec) {
      pretty = titleCase(entry.spec);
      column = CATCHALL_ABILITIES[n];
    } else if (entry.spec.length > 30) {
      // sixteen languages don't fit in a trait name
      res.bioLines.push(`<p><b>${esc(pretty)}:</b> ${esc(entry.spec)}</p>`);
    } else if (entry.spec) {
      pretty = `${pretty} (${entry.spec})`;
    }
    res.customAbilities.push({ name: pretty, group: column, rating: entry.value });
    res.report.customs.push(`${pretty} ${entry.value}`);
  };

  const addPath = (entry, category) => {
    const data = findPath(entry.name);
    if (data) {
      const system = foundry.utils.deepClone(data.system);
      system.level = entry.value;
      res.items.push({ name: data.name, type: 'path', img: data.img, system });
    } else {
      res.items.push({ name: titleCase(entry.name), type: 'path', img: 'icons/svg/book.svg', system: { level: entry.value, category } });
      res.report.looseItems.push(`${titleCase(entry.name)} (path, no V20 match)`);
    }
  };

  const addBackgrounds = value => {
    for (const entry of pairScan(value)) {
      const data = findByName(BACKGROUNDS, entry.name);
      if (data) {
        const system = foundry.utils.deepClone(data.system);
        system.rating = entry.value;
        res.items.push({ name: data.name, type: 'background', img: data.img, system });
      } else {
        res.items.push({ name: titleCase(entry.name), type: 'background', img: 'icons/svg/mystery-man.svg', system: { rating: entry.value } });
        res.report.looseItems.push(`${titleCase(entry.name)} (background, no V20 match)`);
      }
    }
  };

  for (const { label, value } of entries) {
    if (!label) continue;

    if (['sire', 'nature', 'demeanor', 'concept', 'chronicle', 'player', 'clan'].includes(label)) {
      res.system[label] = value;
    } else if (label === 'apparent age') {
      res.system.apparentAge = value;
    } else if (label === 'generation') {
      const g = parseInt(value, 10);
      if (!Number.isNaN(g)) res.system.generation = Math.min(Math.max(g, 3), 15);
    } else if (['physical', 'social', 'mental', 'attributes'].includes(label)) {
      for (const entry of pairScan(value)) {
        const key = norm(entry.name).replace(/[' ]/g, '');
        if (ATTR_KEYS.includes(key)) res.system.attributes[key] = entry.value;
      }
    } else if (['talents', 'skills', 'knowledges'].includes(label)) {
      for (const entry of pairScan(value)) addAbility(entry, label);
    } else if (label === 'abilities' || label === 'secondary abilities') {
      for (const entry of pairScan(value)) {
        const key = ABILITY_KEYS[norm(entry.name)];
        addAbility(entry, key ? ABILITY_COLUMN[key] : 'skills');
      }
    } else if (label === 'virtues') {
      for (const entry of pairScan(value)) {
        const v = VIRTUES[norm(entry.name)];
        if (!v) continue;
        res.system.virtues[v.key] = entry.value;
        if (v.label) (res.virtueLabels ??= {})[v.key] = v.label;
      }
    } else if (label === 'humanity' || label === 'humanity path' || label === 'path rating') {
      const h = parseInt(value, 10);
      if (!Number.isNaN(h)) res.system.humanity = Math.min(Math.max(h, 0), 10);
    } else if (label === 'morality') {
      // "Humanity 7" or "Path of Night 6"
      const m = value.match(/^(.*?)\s*(\d+)/);
      if (m) {
        res.system.humanity = Math.min(Math.max(parseInt(m[2], 10), 0), 10);
        res.morality = { name: m[1].trim() || 'Humanity', rating: res.system.humanity };
      } else {
        toBio(label, value);
      }
    } else if (label === 'willpower') {
      const nums = value.match(/\d+/g)?.map(Number) ?? [];
      if (nums.length) {
        const wp = Math.min(nums[nums.length - 1], 10);
        res.system.willpower = { value: wp, max: wp };
      }
    } else if (label.startsWith('blood pool')) {
      // "20", "14/20" (current/max) or V20's "20/4" (pool/per turn)
      const nums = value.match(/\d+/g)?.map(Number) ?? [];
      if (nums.length) {
        const max = (nums.length > 1 && !label.includes('per turn')) ? nums[1] : nums[0];
        res.system.blood = { value: nums[0], max };
      }
    } else if (label === 'disciplines' || label === 'equivalent disciplines') {
      const re = /([A-Za-z][A-Za-z'’ \-]*?)[\s.]*(\d+)(?:\s*\(([^)]*)\))?/g;
      let m;
      while ((m = re.exec(value)) !== null) {
        const dName = m[1].trim();
        const level = parseInt(m[2], 10);
        const data = findByName(DISCIPLINES, dName);
        if (data) {
          const system = foundry.utils.deepClone(data.system);
          system.level = level;
          res.items.push({ name: data.name, type: 'discipline', img: data.img, system });
        } else if (findPath(dName)) {
          // some books list a path straight in the Disciplines line
          addPath({ name: dName, value: level }, 'thaumaturgical');
        } else {
          res.items.push({ name: titleCase(dName), type: 'discipline', img: 'icons/svg/daze.svg', system: { level } });
          res.report.looseItems.push(`${titleCase(dName)} (discipline, no V20 match)`);
        }
        if (m[3]) {
          const category = norm(dName) === 'necromancy' ? 'necromantic' : 'thaumaturgical';
          for (const p of pairScan(m[3])) addPath(p, category);
        }
      }
    } else if (/^(thaumaturg\w*|necroman\w*) paths?$/.test(label)) {
      const category = label.startsWith('necro') ? 'necromantic' : 'thaumaturgical';
      for (const p of pairScan(value)) addPath(p, category);
    } else if (label === 'rituals') {
      for (const piece of value.split(/,|\band\b/)) {
        const name = piece.trim().replace(/[.]+$/, '');
        if (!name) continue;
        const data = findByName(RITUALS, name);
        if (data) {
          res.items.push({ name: data.name, type: 'ritual', img: data.img, system: foundry.utils.deepClone(data.system) });
        } else if (name.split(/\s+/).length > 6 || /\bany others?\b|\byou feel\b/i.test(name)) {
          res.bioLines.push(`<p><b>Rituals note:</b> ${esc(name)}</p>`);
        } else {
          res.report.unmatchedRituals.push(name);
        }
      }
    } else if (label === 'background' || label === 'backgrounds') {
      if (isTraitList(value)) addBackgrounds(value);
      else if (!/^none\.?$/i.test(value)) toBio(label, value);
    } else if (['merits', 'flaws', 'merit', 'flaw', 'merits flaws', 'merits and flaws'].includes(label)) {
      const missing = [];
      for (const piece of value.replace(/\([^)]*\)/g, '').split(/[,;]/)) {
        const name = piece.trim().replace(/[.]+$/, '');
        if (!name || /^none$/i.test(name)) continue;
        const data = findByName(MERITS, name) ?? findByName(FLAWS, name);
        if (data) res.items.push({ name: data.name, type: 'merit', img: data.img, system: foundry.utils.deepClone(data.system) });
        else missing.push(name);
      }
      if (missing.length) toBio(label, missing.join(', '));
    } else if (label === 'name') {
      res.name = value;
    } else {
      // Embrace, haven, derangements, gear, whatever else: keep it in the bio
      toBio(label, value);
    }
  }

  return res;
}

// The system's own name for a path, or null when the block's path is unknown
function resolvePath(name) {
  const n = norm(name);
  if (n === 'humanity') return 'Humanity';
  const builtin = Object.keys(CONFIG.VTM?.paths ?? {}).find(k => norm(k) === n || norm(k) === `path of ${n}`);
  if (builtin) return builtin;
  return game.items?.find(i => i.type === 'enlightenment' && norm(i.name) === n)?.name ?? null;
}

// Parse results that depend on the running world, shared by both import modes
function resolveMorality(parsed, sys, bioLines) {
  if (!parsed.morality) return;
  const path = resolvePath(parsed.morality.name);
  if (path) {
    sys.pathName = path;
  } else {
    bioLines.push(`<p><b>Morality:</b> ${esc(parsed.morality.name)} ${parsed.morality.rating}</p>`);
    parsed.report.notes.push(`${parsed.morality.name} is not in the path list: rating kept, path noted in Bio`);
  }
}

async function whisperReport(actor, parsed, lead) {
  const r = parsed.report;
  const lines = [`<p><b>${lead}:</b> @UUID[${actor.uuid}]{${esc(actor.name)}} with ${parsed.items.length} items.</p>`];
  if (r.customs.length) lines.push(`<p><b>Kept as custom abilities</b> (not in V20's thirty): ${esc(r.customs.join(', '))}</p>`);
  if (r.dropped.length) lines.push(`<p><b>Dropped</b> (no use in V20): ${esc(r.dropped.join(', '))}</p>`);
  if (r.merged.length) lines.push(`<p><b>Merged</b> (V20 folded these in, specialty added): ${esc(r.merged.join(', '))}</p>`);
  if (r.looseItems.length) lines.push(`<p><b>Created without V20 data:</b> ${esc(r.looseItems.join(', '))}</p>`);
  if (r.unmatchedRituals.length) lines.push(`<p><b>Rituals not found, skipped:</b> ${esc(r.unmatchedRituals.join(', '))}</p>`);
  if (r.bioLabels.length) lines.push(`<p><b>Moved to Bio:</b> ${esc([...new Set(r.bioLabels)].join(', '))}</p>`);
  if (r.notes.length) lines.push(`<p><b>Notes:</b> ${esc(r.notes.join('; '))}</p>`);
  await ChatMessage.create({
    user: game.user.id,
    content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">Stat Block Import</span></div>${lines.join('')}</div>`,
    whisper: game.users.filter(u => u.isGM).map(u => u.id),
  });
}

async function createFromParse(parsed, { name, clan } = {}) {
  const sys = foundry.utils.deepClone(parsed.system);
  const bioLines = [...parsed.bioLines];
  if (clan) sys.clan = clan;
  resolveMorality(parsed, sys, bioLines);
  if (bioLines.length) sys.bio = bioLines.join('');
  if (parsed.customAbilities.length) {
    sys.customAbilities = parsed.customAbilities.map(a => ({ ...a, id: foundry.utils.randomID() }));
  }
  // Fill the tank to the generation's cap; derived data holds the real max
  const gen = sys.generation ?? 13;
  const maxBlood = CONFIG.VTM?.generationTable?.[gen]?.maxBlood ?? 10;
  sys.blood ??= { value: maxBlood, max: maxBlood };

  const flags = {};
  if (Object.keys(parsed.specialties).length) flags.specialties = parsed.specialties;
  if (parsed.virtueLabels) flags.virtueLabels = parsed.virtueLabels;

  const actor = await Actor.create({
    name: name || parsed.name || 'Imported Character',
    type: 'vampire',
    system: sys,
    items: parsed.items,
    flags: Object.keys(flags).length ? { 'vtm-v20': flags } : {},
  }, { renderSheet: true });

  await whisperReport(actor, parsed, 'Imported');
  return actor;
}

// Pour a stat block into a character that already exists. What the block
// states overwrites; whatever it doesn't mention is left alone.
async function applyToActor(actor, parsed) {
  const sys = foundry.utils.deepClone(parsed.system);
  const bioLines = [...parsed.bioLines];
  resolveMorality(parsed, sys, bioLines);

  if (parsed.customAbilities.length) {
    const list = (actor.system.customAbilities ?? []).map(a => ({ ...a }));
    for (const c of parsed.customAbilities) {
      const hit = list.find(a => a.group === c.group && norm(a.name) === norm(c.name));
      if (hit) hit.rating = c.rating;
      else list.push({ ...c, id: foundry.utils.randomID() });
    }
    sys.customAbilities = list;
  }

  const oldBio = actor.system.bio || '';
  const fresh = bioLines.filter(l => !oldBio.includes(l));
  if (fresh.length) sys.bio = oldBio + fresh.join('');

  // Mortals have no virtues or generation, ghouls no clan: keep to this type's fields
  const fields = actor.system.schema?.fields;
  if (fields) {
    for (const k of Object.keys(sys)) if (!(k in fields)) delete sys[k];
  }

  const update = { system: sys };
  if (Object.keys(parsed.specialties).length) {
    update['flags.vtm-v20.specialties'] = { ...(actor.getFlag('vtm-v20', 'specialties') || {}), ...parsed.specialties };
  }
  if (parsed.virtueLabels) {
    update['flags.vtm-v20.virtueLabels'] = {
      conscience: 'Conscience', selfControl: 'Self-Control',
      ...(actor.getFlag('vtm-v20', 'virtueLabels') || {}), ...parsed.virtueLabels,
    };
  }
  await actor.update(update);

  // Items the character already has get their rating; the rest are added
  const creates = [], updates = [];
  for (const it of parsed.items) {
    const have = actor.items.find(i => i.type === it.type && norm(i.name) === norm(it.name));
    if (!have) creates.push(it);
    else if (it.type === 'background') updates.push({ _id: have.id, 'system.rating': it.system.rating });
    else if (it.type === 'discipline' || it.type === 'path') updates.push({ _id: have.id, 'system.level': it.system.level });
  }
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
  if (creates.length) await actor.createEmbeddedDocuments('Item', creates);

  await whisperReport(actor, parsed, 'Stat block applied to');
  return actor;
}

// With an actor the block is applied to it; without one a new vampire is made
export function importStatBlockDialog({ actor = null } = {}) {
  const fields = actor ? '' : `
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        <input type="text" class="sbi-name" placeholder="Character name" style="flex:1;" />
        <input type="text" class="sbi-clan" placeholder="Clan (optional)" style="width:140px;" />
      </div>`;
  const hint = actor
    ? 'What the block states overwrites this character; anything it does not mention is left alone. A report is whispered after the import.'
    : 'Abilities V20 dropped (Acting, Music...) become custom abilities. Unrecognized lines land in the Bio. A report is whispered after the import.';
  const content = `
    <div class="statblock-import">${fields}
      <textarea class="sbi-text" rows="16" style="width:100%;font-family:monospace;font-size:11px;"
        placeholder="Paste the printed stat block here, e.g.&#10;Clan: ...&#10;Physical: Strength 3, Dexterity 3, Stamina 4&#10;...&#10;Morality: Humanity 6&#10;Willpower: 8"></textarea>
      <p style="font-size:11px;color:#999;margin:6px 0 0;">${hint}</p>
    </div>`;

  new Dialog({
    title: actor ? `${actor.name}: Import Stat Block` : 'Import Stat Block',
    content,
    buttons: {
      import: {
        icon: '<i class="fas fa-file-import"></i>', label: 'Import',
        callback: async dlg => {
          const el = dlg[0];
          const text = el.querySelector('.sbi-text').value;
          if (!text.trim()) return void ui.notifications.warn('Nothing to import.');
          try {
            const parsed = parseStatBlock(text);
            if (actor) {
              await applyToActor(actor, parsed);
            } else {
              await createFromParse(parsed, {
                name: el.querySelector('.sbi-name').value.trim(),
                clan: el.querySelector('.sbi-clan').value.trim(),
              });
            }
          } catch (err) {
            console.error('VtM V20 | Stat block import failed', err);
            ui.notifications.error('Import failed. Check the console for details.');
          }
        },
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel' },
    },
    default: 'import',
  }, { classes: ['vtm-v20', 'dialog'], width: 520 }).render(true);
}

export function registerStatblockImport() {
  Hooks.on('renderActorDirectory', (app, html) => {
    if (!game.user.isGM) return;
    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el || el.querySelector('.statblock-import-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'statblock-import-btn';
    btn.innerHTML = '<i class="fas fa-file-import"></i> Import Stat Block';
    const footer = el.querySelector('.directory-footer') ?? el;
    footer.append(btn);
    btn.addEventListener('click', () => importStatBlockDialog());
  });
}
