// Parser for the Authentic Text feature. Takes a raw chapter paste (as a PDF
// reader extracts it) and splits it into the text slots this system uses,
// keyed by category and entry name. Pure module, no Foundry dependencies, so
// it can be tested standalone in node.

// ── normalization ─────────────────────────────────────────────────────────

const norm = s => String(s)
  .replace(/[’‘]/g, "'")
  .replace(/[“”]/g, '"')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[.:]+$/, '');

const normHead = s => norm(s).replace(/^the /, '');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── page junk ─────────────────────────────────────────────────────────────
// Running headers/footers land inline. When a page break cuts a word in half
// the junk is welded straight onto the fragment with no space, so a glued
// match means the halves get rejoined without one.

const JUNK = [
  /VAMPIRE\s+THE\s+MASQUERADE\s+20th\s+ANNIVERSARY\s+EDITION\s+\d{1,4}/g,
  /\d{1,4}\s+CHAPTER\s+[A-Z]+:(?:\s+[A-Z]+)+/g,
  /\d{1,4}\s+APPENDIX/g,
];

function stripJunk(text) {
  for (const re of JUNK) {
    let out = '';
    let last = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const before = text[m.index - 1] ?? ' ';
      let end = m.index + m[0].length;
      const gluedLeft = /[a-z]/.test(before);
      const gluedRight = /[a-z]/.test(text[end] ?? ' ');
      out += text.slice(last, m.index);
      if (gluedLeft || gluedRight) {
        while (end < text.length && /\s/.test(text[end])) end++;
        if (!gluedLeft) out = out.replace(/\s+$/, '');
      } else {
        const leftNl = out === '' || /\n[ \t]*$/.test(out);
        out = out.replace(/[ \t]+$/, '');
        while (end < text.length && /[ \t]/.test(text[end])) end++;
        const rightNl = text[end] === '\n';
        if (leftNl && rightNl) end++;
        else if (!leftNl && !rightNl) out += ' ';
      }
      last = end;
    }
    out += text.slice(last);
    text = out;
  }
  return text;
}

// Soft hyphens were eaten by the reader already; one surviving at line end is
// a real compound hyphen, so join keeping it.
const fixHyphens = text => text.replace(/-\n[ \t]*/g, '-');

// The chapter epigraph: a quoted line with a dash attribution, dropped inline.
const stripEpigraph = text =>
  text.replace(/^["“][^\n]{10,200}\n(?:[^\n]{0,120}\n)?-\s[^\n]+\n/m, '');

// ── floating boxes ────────────────────────────────────────────────────────
// Sidebars land at their page position, sometimes mid sentence. Boxes sitting
// between sections fall out via the heading rules; mid-text ones need
// explicit start/end excision here. route appends the block to a slot.

const MIDTEXT_BOXES = [
  { title: 'Aura Colors', startRe: /^Aura Colors$/m, endRe: /Rainbow highlights in aura[^\n]*\n?/, route: null },
  { title: 'Telepathic ranges', startRe: /^Auspex Rating\s+No\. of Targets[^\n]*$/m, endRe: /^Auspex 9[^\n]*\n?/m, route: null },
  { title: 'Other Warding Circle Rituals', startRe: /^Other Warding Circle Rituals$/m, endRe: /same as for Warding\s+Circle versus Ghouls\.\s*\n?/, route: 'ritual:Warding Circle versus Ghouls' },
];

function extractMidtextBoxes(text) {
  const boxes = [];
  for (const box of MIDTEXT_BOXES) {
    const s = text.search(box.startRe);
    if (s === -1) continue;
    const endM = box.endRe.exec(text.slice(s));
    if (!endM) continue;
    const e = s + endM.index + endM[0].length;
    boxes.push({ title: box.title, route: box.route, text: text.slice(s, e).trim() });
    text = text.slice(0, s).replace(/[ \t]+$/, '') + '\n' + text.slice(e);
  }
  return { text, boxes };
}

// Boxes between an intro and the first power/ladder: their title line closes
// the open capture and the block runs to the next real heading.
const SIDEBAR_TITLES = new Set([
  'storytelling animals', 'advancing disciplines', 'whither mortis?',
  'whither mortis', 'zombie statistics', 'specialties', 'seeing the unseen',
]);

const SIDEBAR_ROUTES = {
  'zombie statistics': 'path:The Bone Path:power:Shambling Hordes',
  'whither mortis': 'path:The Corpse in the Monster:intro',
  'whither mortis?': 'path:The Corpse in the Monster:intro',
};

// Section markers that carry no capturable text of their own.
const SECTION_MARKERS = new Set([
  'backgrounds', 'personality archetypes', 'nature and demeanor', 'attributes',
  'abilities', 'physical', 'social', 'mental', 'talents', 'skills', 'knowledges',
  'merits and flaws', 'supernatural', 'thaumaturgical paths', 'rituals',
]);

const CATCHALLS = new Set(['hobby talent', 'professional skill', 'expert knowledge']);

const LEVEL_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };

// ── reflow and output formatting ──────────────────────────────────────────

const ROW_RE = /^(?:•\s|Botch\b|Failure\b|\d+\+?\s+success(?:es)?\b|Successes\s+(?:Result|Information)\b|Health Level\b|Blood Spent\b)/;
const BREAK_RE = /^(?:System:|[—–]\s)/;

function reflow(lines) {
  const out = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { out.push({ blank: true, text: '' }); continue; }
    if (ROW_RE.test(t)) { out.push({ row: true, text: t }); continue; }
    const prev = out[out.length - 1];
    if (prev && !prev.blank && !BREAK_RE.test(t)) {
      if (prev.row) {
        // continue a wrapped row only while it looks unfinished
        if (!/[.!?)]$/.test(prev.text) || /^[a-z]/.test(t)) { prev.text += ' ' + t; continue; }
      } else {
        prev.text += ' ' + t;
        continue;
      }
    }
    out.push({ row: false, text: t });
  }
  return out;
}

function toHtml(lines) {
  const paras = [];
  let cur = null;
  let sawSystem = false;
  for (const l of reflow(lines)) {
    if (l.blank) { cur = null; continue; }
    let text = l.text;
    const sysM = !sawSystem && text.match(/^System:\s*/);
    if (sysM) {
      sawSystem = true;
      cur = { system: true, parts: [] };
      paras.push(cur);
      text = text.slice(sysM[0].length);
      if (text) cur.parts.push({ row: false, text });
      continue;
    }
    if (!cur) { cur = { system: false, parts: [] }; paras.push(cur); }
    cur.parts.push({ row: !!l.row, text });
  }
  return paras.map(p => {
    let html = '';
    p.parts.forEach((part, idx) => {
      const t = esc(part.text);
      if (idx === 0) html += t;
      else html += (part.row || p.parts[idx - 1].row ? '<br>' : ' ') + t;
    });
    return `<p>${p.system ? '<b>System:</b> ' : ''}${html}</p>`;
  }).join('');
}

function toPlain(lines) {
  return reflow(lines).filter(l => !l.blank).map(l => l.text).join('\n')
    .replace(/\n(?!•)/g, ' ').trim();
}

// ── catalog lookups ───────────────────────────────────────────────────────

function buildLookups(catalog) {
  const map = (arr, get = x => x) => {
    const m = new Map();
    for (const x of arr) m.set(normHead(typeof x === 'string' ? x : x.name), get(x));
    return m;
  };
  return {
    archetypes: map(catalog.archetypes),
    disciplines: map(catalog.disciplines),
    paths: map(catalog.paths),
    rituals: map(catalog.rituals),
    ritualcats: map(catalog.ritualcats),
    backgrounds: map(catalog.backgrounds),
    merits: map(catalog.merits),
    flaws: map(catalog.flaws),
    traits: map(catalog.traits),
  };
}

// ── main parse ────────────────────────────────────────────────────────────

export function parseAuthenticText(raw, catalog) {
  const lk = buildLookups(catalog);
  let text = stripEpigraph(fixHyphens(stripJunk(String(raw).replace(/\r\n?/g, '\n'))));
  const mid = extractMidtextBoxes(text);
  text = mid.text;
  const lines = text.split('\n');

  const captures = new Map();
  const skipped = [];
  const leftovers = [];
  const pendingRoutes = [];
  const containersSeen = [];
  for (const b of mid.boxes) {
    if (b.route) pendingRoutes.push({ key: b.route, title: b.title, text: b.text });
    else leftovers.push({ title: b.title, text: b.text });
  }

  let target = null;
  let leftoverBuf = null;
  let container = null;
  let ritualType = null;
  let ritualLevel = 0;
  let archMode = false;

  const closeLeftover = () => {
    if (!leftoverBuf) return;
    const body = leftoverBuf.lines.join('\n').trim();
    if (body) {
      if (leftoverBuf.route) pendingRoutes.push({ key: leftoverBuf.route, title: leftoverBuf.title, text: body });
      else leftovers.push({ title: leftoverBuf.title, text: body });
    }
    leftoverBuf = null;
  };
  const openLeftover = (title, route = null) => {
    closeLeftover();
    target = null;
    leftoverBuf = { title, route, lines: [] };
  };
  const openCapture = (key, label, kind, extra = {}) => {
    closeLeftover();
    const cap = { key, label, kind, lines: [], notes: [], ...extra };
    captures.set(key, cap);
    target = cap;
    return cap;
  };

  const bulletInfo = line => {
    const m = line.match(/^(•+(?:[ \t]+•+)*)[ \t]*(.*)$/);
    return m ? { dots: (m[1].match(/•/g) || []).length, rest: m[2] } : null;
  };
  const joinTwo = i => (lines[i].trim() + ' ' + (lines[i + 1] || '').trim()).trim();

  // resolve a name against a lookup, allowing headings wrapped over two lines
  const matchIn = (mapObj, i) => {
    const t = lines[i].trim();
    if (!t || t.length > 70) return null;
    const one = mapObj.get(normHead(t));
    if (one !== undefined) return { val: one, consumed: 1 };
    const next = (lines[i + 1] || '').trim();
    if (next && t.length + next.length < 75) {
      const two = mapObj.get(normHead(t + ' ' + next));
      if (two !== undefined) return { val: two, consumed: 2 };
    }
    return null;
  };

  const meritHead = i => {
    const tryStr = (s, consumed) => {
      const m = s.match(/^(.{2,60}?)\s*\(\s*(\d[\d\sorto.-]*?)\s*pts?\.?\s*(Merit|Flaw)\s*\)$/i);
      if (!m) return null;
      const kind = m[3].toLowerCase() === 'merit' ? 'merit' : 'flaw';
      const entry = (kind === 'merit' ? lk.merits : lk.flaws).get(normHead(m[1]));
      return entry ? { consumed, kind, entry, cost: parseInt(m[2], 10) } : null;
    };
    const one = lines[i].trim();
    if (/\)$/.test(one)) { const r = tryStr(one, 1); if (r) return r; }
    const next = (lines[i + 1] || '').trim();
    if (next && /^\(.*\)$/.test(next)) { const r = tryStr(one + ' ' + next, 2); if (r) return r; }
    return null;
  };

  // ── lookahead validators against prose false positives ──────────────────
  const seesBulletPower = (i, powers, limit = 130) => {
    if (!powers?.length) return false;
    const unnamed = powers.every(p => !p.name);
    for (let j = i + 1; j < Math.min(lines.length, i + limit); j++) {
      const b = bulletInfo(lines[j].trim());
      if (!b) continue;
      if (unnamed && b.dots >= 1 && b.dots <= 5) return true;
      for (const p of powers) {
        if (p.name && normHead(b.rest).startsWith(normHead(p.name))) return true;
      }
    }
    return false;
  };
  const seesPathName = (i, limit = 220) => {
    for (let j = i + 1; j < Math.min(lines.length, i + limit); j++) {
      if (matchIn(lk.paths, j)) return true;
    }
    return false;
  };
  const seesLadder = (i, limit = 45) => {
    for (let j = i + 1; j < Math.min(lines.length, i + limit); j++) {
      const b = bulletInfo(lines[j].trim());
      if (b && b.dots >= 1 && b.dots <= 5) return true;
      // sidebars may sit between a heading and its ladder; they don't disprove one
      if (j > i + 1 && isAnyHeading(j) && !SIDEBAR_TITLES.has(normHead(lines[j].trim()))) return false;
    }
    return false;
  };
  const seesRegain = (i, limit = 90) => {
    for (let j = i + 1; j < Math.min(lines.length, i + limit); j++) {
      const t = lines[j].trim();
      if (/^[—–-]\s?/.test(t) && /willpower/i.test(lines.slice(j, j + 6).join(' '))) return true;
      if (j > i + 2 && lk.archetypes.has(normHead(t))) return false;
    }
    return false;
  };
  const isAnyHeading = i => {
    const t = lines[i].trim();
    if (!t || t.length > 70) return false;
    const n = normHead(t);
    return lk.disciplines.has(n) || lk.paths.has(n) || lk.rituals.has(n)
      || lk.backgrounds.has(n) || lk.archetypes.has(n) || lk.traits.has(n)
      || lk.ritualcats.has(n) || SIDEBAR_TITLES.has(n) || SECTION_MARKERS.has(n)
      || CATCHALLS.has(n) || /^Level (One|Two|Three|Four|Five) Rituals$/i.test(t)
      || !!meritHead(i);
  };

  const pushContent = line => {
    if (leftoverBuf) { leftoverBuf.lines.push(line); return; }
    if (container?.kind === 'trait' && target?.curDot) {
      target.ladder[target.curDot - 1].lines.push(line.trim());
      return;
    }
    if (container?.kind === 'background' && container.lastLevel === 5
      && target?.kind === 'background-level' && line.trim()) {
      // prose after the five dot entry returns to the intro
      target = captures.get(`background:${container.data.name}:intro`);
      target.lines.push('', line.trim());
      return;
    }
    if (target) target.lines.push(line);
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const t = rawLine.trim();
    if (!t) { pushContent(''); i++; continue; }
    const n1 = normHead(t);

    const lvlM = t.match(/^Level (One|Two|Three|Four|Five) Rituals$/i);
    if (lvlM) {
      ritualLevel = LEVEL_WORDS[lvlM[1].toLowerCase()];
      if (!ritualType) ritualType = 'any';
      closeLeftover(); target = null;
      i++; continue;
    }

    const mh = meritHead(i);
    if (mh) {
      container = null; archMode = false;
      const cap = openCapture(`${mh.kind}:${mh.entry.name}`, mh.entry.name, mh.kind);
      if (Number.isFinite(mh.entry.cost) && Math.abs(mh.entry.cost) !== mh.cost) {
        cap.notes.push(`book cost ${mh.cost}, system cost ${Math.abs(mh.entry.cost)}`);
      }
      i += mh.consumed; continue;
    }

    if (SIDEBAR_TITLES.has(n1)) {
      openLeftover(t, SIDEBAR_ROUTES[n1] || null);
      i++; continue;
    }

    if (CATCHALLS.has(n1)) {
      skipped.push({ name: t, reason: 'no slot in system' });
      openLeftover(t);
      i++; continue;
    }

    if (SECTION_MARKERS.has(n1)) {
      // a bare "Rituals" heading inside a discipline chapter opens the
      // thaumaturgical ritual section rather than the Rituals Background
      if (n1 === 'rituals') {
        const isSection = lines.slice(i + 1, i + 45).some(l =>
          /^Level (One|Two|Three|Four|Five) Rituals$/i.test(l.trim())
          || lk.rituals.has(normHead(l.trim())));
        if (isSection) {
          const catName = lk.ritualcats.get('thaumaturgical rituals') ? 'Thaumaturgical Rituals' : null;
          ritualType = 'thaumaturgical';
          ritualLevel = 0;
          container = null; archMode = false;
          if (catName) openCapture(`ritualcat:${catName}`, catName, 'ritualcat');
          else { closeLeftover(); target = null; }
          i++; continue;
        }
        if (lk.backgrounds.has('rituals') && seesLadder(i)) {
          const b = lk.backgrounds.get('rituals');
          container = { kind: 'background', data: b, lastLevel: 0 };
          archMode = false;
          containersSeen.push(container.seen = { type: 'background', name: b.name, levels: [] });
          openCapture(`background:${b.name}:intro`, `${b.name} (introduction)`, 'background-intro');
          i++; continue;
        }
      }
      closeLeftover(); target = null;
      i++; continue;
    }

    const rc = matchIn(lk.ritualcats, i);
    if (rc) {
      ritualType = /necromantic/i.test(rc.val) ? 'necromantic' : 'thaumaturgical';
      ritualLevel = 0;
      container = null; archMode = false;
      openCapture(`ritualcat:${rc.val}`, rc.val, 'ritualcat');
      i += rc.consumed; continue;
    }

    const dm = matchIn(lk.disciplines, i);
    if (dm && (seesBulletPower(i + dm.consumed - 1, dm.val.powers) || (!dm.val.powers.length && seesPathName(i + dm.consumed - 1)))) {
      container = { kind: 'discipline', data: dm.val };
      archMode = false; ritualType = null; ritualLevel = 0;
      containersSeen.push(container.seen = { type: 'discipline', name: dm.val.name, powers: [] });
      openCapture(`discipline:${dm.val.name}:intro`, `${dm.val.name} (introduction)`, 'discipline-intro');
      i += dm.consumed; continue;
    }

    const pm = matchIn(lk.paths, i);
    if (pm && seesBulletPower(i + pm.consumed - 1, pm.val.powers, 90)) {
      container = { kind: 'path', data: pm.val };
      archMode = false;
      containersSeen.push(container.seen = { type: 'path', name: pm.val.name, powers: [] });
      openCapture(`path:${pm.val.name}:intro`, `${pm.val.name} (introduction)`, 'path-intro');
      i += pm.consumed; continue;
    }

    if (ritualType) {
      const rm = matchIn(lk.rituals, i);
      if (rm && (ritualType === 'any' || !rm.val.type || rm.val.type === ritualType)) {
        container = null;
        const cap = openCapture(`ritual:${rm.val.name}`, rm.val.name, 'ritual');
        if (ritualLevel && rm.val.level && rm.val.level !== ritualLevel) {
          cap.notes.push(`parsed under level ${ritualLevel}, system says level ${rm.val.level}`);
        }
        i += rm.consumed; continue;
      }
    }

    if (lk.backgrounds.has(n1) && seesLadder(i)) {
      const b = lk.backgrounds.get(n1);
      container = { kind: 'background', data: b, lastLevel: 0 };
      archMode = false;
      containersSeen.push(container.seen = { type: 'background', name: b.name, levels: [] });
      openCapture(`background:${b.name}:intro`, `${b.name} (introduction)`, 'background-intro');
      i++; continue;
    }

    if (lk.traits.has(n1) && seesLadder(i, 60)) {
      const tr = lk.traits.get(n1);
      container = { kind: 'trait', data: tr, done: false };
      archMode = false;
      openCapture(`trait:${tr.key}`, tr.name, 'trait', { ladder: [] });
      i++; continue;
    }

    if (lk.archetypes.has(n1) && (archMode || seesRegain(i))) {
      archMode = true;
      container = null;
      const name = lk.archetypes.get(n1);
      openCapture(`archetype:${name}`, name, 'archetype');
      i++; continue;
    }

    const b = bulletInfo(t);
    if (b) {
      if (container?.kind === 'background' && b.dots >= 1 && b.dots <= 5) {
        container.lastLevel = b.dots;
        container.seen.levels.push(b.dots);
        const lvlKey = `lvl${b.dots}`;
        const lvlName = container.data.levels?.find(l => l.key === lvlKey)?.name || lvlKey;
        const cap = openCapture(`background:${container.data.name}:level:${lvlKey}`,
          `${container.data.name}: ${lvlName}`, 'background-level');
        if (b.rest) cap.lines.push(b.rest);
        i++; continue;
      }
      if (container?.kind === 'trait' && !container.done && b.dots >= 1 && b.dots <= 5) {
        closeLeftover();
        target = captures.get(`trait:${container.data.key}`);
        target.ladder[b.dots - 1] = { lines: b.rest ? [b.rest] : [] };
        target.curDot = b.dots;
        i++; continue;
      }
      if (container?.kind === 'discipline' || container?.kind === 'path') {
        const powers = container.data.powers || [];
        if (b.dots > 5) {
          const label = b.rest || `level ${b.dots} power`;
          skipped.push({ name: label, reason: `level ${b.dots}, no slot in system` });
          openLeftover(label);
          i++; continue;
        }
        const named = powers.filter(p => p.name);
        let matched = null;
        let remainder = '';
        for (const p of named) {
          const pn = normHead(p.name);
          const rn = normHead(b.rest);
          if (rn === pn) { matched = p; break; }
          if (rn.startsWith(pn + ' ') || rn.startsWith(pn + ':') || rn.startsWith(pn + ' (')) {
            matched = p;
            remainder = b.rest.slice(p.name.length).replace(/^[\s:]+/, '');
            break;
          }
        }
        if (!matched && !named.length && b.dots >= 1 && b.dots <= 5) {
          matched = powers.find(p => p.lvl === b.dots) || { name: '', lvl: b.dots };
          remainder = b.rest;
        }
        if (matched) {
          const kind = container.kind;
          const slot = matched.name || `lvl${matched.lvl}`;
          container.seen.powers.push(slot);
          const cap = openCapture(`${kind}:${container.data.name}:power:${slot}`,
            `${container.data.name}: ${matched.name || 'level ' + matched.lvl}`, `${kind}-power`);
          if (matched.lvl && matched.lvl !== b.dots) {
            cap.notes.push(`book shows ${b.dots} dots, system level ${matched.lvl}`);
          }
          if (remainder) cap.lines.push(remainder);
          i++; continue;
        }
      }
      // plain in-text bullet list line
      pushContent(t);
      i++; continue;
    }

    if (container?.kind === 'trait' && target?.curDot && /^(Possessed by|Specialties):/i.test(t)) {
      container.done = true;
      openLeftover(`${container.data.name} extras`);
      leftoverBuf.lines.push(t);
      i++; continue;
    }

    pushContent(rawLine);
    i++;
  }
  closeLeftover();

  // ── formatting ──────────────────────────────────────────────────────────
  const results = [];
  for (const cap of captures.values()) {
    if (cap.kind === 'trait') {
      const ladder = (cap.ladder || []).map(e => (e ? toPlain(e.lines) : ''));
      const missing = ladder.filter(x => !x).length;
      if (missing) cap.notes.push(`${missing} of 5 rating lines missing`);
      if (cap.lines.join(' ').trim()) leftovers.push({ title: `${cap.label} description`, text: cap.lines.join('\n').trim() });
      results.push({ ...cap, ladder, text: ladder.join('\n'), status: cap.notes.length ? 'warn' : 'ok' });
      continue;
    }
    let out;
    if (cap.kind === 'archetype') {
      out = formatArchetype(cap.lines);
      if (!out.includes('\n\n• ')) cap.notes.push('no Willpower regain line found');
    } else {
      out = toHtml(cap.lines);
    }
    if (out.replace(/<[^>]+>/g, '').trim().length < 40) cap.notes.push('captured text is very short');
    results.push({ ...cap, text: out, status: cap.notes.length ? 'warn' : 'ok' });
  }

  for (const r of pendingRoutes) {
    const hit = results.find(c => c.key === r.key);
    const bodyLines = r.text.split('\n').filter(l => normHead(l) !== normHead(r.title));
    const html = `<p><b>${esc(r.title.replace(/[?:\s]*$/, ''))}:</b> ${esc(toPlain(bodyLines))}</p>`;
    if (hit) hit.text += html;
    else leftovers.push({ title: r.title, text: r.text });
  }

  return { captures: results, skipped, leftovers, containersSeen };
}

function formatArchetype(lines) {
  const trimmed = lines.map(l => l.trim());
  let split = -1;
  for (let j = trimmed.length - 1; j >= 0; j--) {
    if (/^[—–-]\s?/.test(trimmed[j])
      && /willpower/i.test(trimmed.slice(j, j + 6).join(' ').slice(0, 300))) { split = j; break; }
  }
  if (split === -1) return toPlain(lines);
  const body = toPlain(trimmed.slice(0, split));
  const regainLines = trimmed.slice(split);
  regainLines[0] = regainLines[0].replace(/^[—–-]\s?/, '');
  return `${body}\n\n• ${toPlain(regainLines)}`;
}
