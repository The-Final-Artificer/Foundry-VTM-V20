// Standalone HTML export of a character sheet. Snapshots the rendered DOM,
// freezes it read-only, embeds css/fonts/images, and ships a tiny script for
// tabs, bio pages, and item description popups.

import { potenceLevel } from './discipline-effects.mjs';

const PAGE_SEP = '<!-- PAGE -->';

function esc(s) {
  return (s ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch failed: ${url}`);
  return r.text();
}

async function fetchB64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch failed: ${url}`);
  return b64(await r.arrayBuffer());
}

// Inputs and selects don't carry their live values through cloneNode,
// so walk the original and clone in parallel and swap in static text.
function freezeInputs(live, clone) {
  const liveEls = live.querySelectorAll('input, textarea, select');
  const cloneEls = clone.querySelectorAll('input, textarea, select');
  cloneEls.forEach((node, i) => {
    const src = liveEls[i];
    if (!src) return node.remove();
    let out;
    if (node.tagName === 'TEXTAREA') {
      out = document.createElement('div');
      out.className = 'frozen-block';
      out.textContent = src.value;
    } else if (node.tagName === 'SELECT') {
      out = document.createElement('span');
      out.className = 'frozen';
      out.textContent = src.selectedOptions[0]?.textContent.trim() || '';
    } else if (src.type === 'checkbox') {
      out = document.createElement('span');
      out.className = 'frozen';
      out.textContent = src.checked ? '✓' : '—';
    } else {
      out = document.createElement('span');
      out.className = 'frozen';
      out.textContent = src.value;
    }
    node.replaceWith(out);
  });
}

function stripControls(clone) {
  // Every button goes except bio page arrows
  clone.querySelectorAll('button').forEach(b => {
    if (!b.classList.contains('bio-arrow')) b.remove();
  });
  clone.querySelectorAll(
    '.bio-toolbar, .sheet-lock, .show-portrait, .portrait-edit, .spec-edit,' +
    '.item-controls, .item-create, .item-delete, .item-edit,' +
    '.blood-buff-drawer, .blood-budget-panel, .combat-drawer,' +
    '.targeting-drawer, .movement-drawer, .decl-timer-bar'
  ).forEach(n => n.remove());
  clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
  clone.querySelectorAll('[data-action]').forEach(n => n.removeAttribute('data-action'));
  clone.querySelectorAll('[draggable]').forEach(n => n.removeAttribute('draggable'));
}

// Swap every <img> src for a data URI so the file works offline
async function inlineImages(clone) {
  const cache = new Map();
  for (const img of clone.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    if (!cache.has(src)) {
      try {
        const r = await fetch(src);
        const blob = await r.blob();
        const uri = await new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        cache.set(src, uri);
      } catch {
        cache.set(src, src);
      }
    }
    img.src = cache.get(src);
  }
}

async function buildCss() {
  let css = await fetchText('systems/vtm-v20/styles/vtm-v20.css');
  try {
    const cinzel = await fetchB64('systems/vtm-v20/fonts/Cinzel.ttf');
    css = css.replace('../fonts/Cinzel.ttf', `data:font/ttf;base64,${cinzel}`);
  } catch { /* fallback serif */ }

  // FontAwesome for tab and arrow icons; degrade quietly if paths change
  let fa = '';
  try {
    fa = await fetchText('fonts/fontawesome/css/all.min.css');
    const solid = await fetchB64('fonts/fontawesome/webfonts/fa-solid-900.woff2');
    fa = fa.replaceAll('../webfonts/fa-solid-900.woff2', `data:font/woff2;base64,${solid}`);
    try {
      const regu = await fetchB64('fonts/fontawesome/webfonts/fa-regular-400.woff2');
      fa = fa.replaceAll('../webfonts/fa-regular-400.woff2', `data:font/woff2;base64,${regu}`);
    } catch {}
  } catch { fa = ''; }

  return fa + '\n' + css + '\n' + EXPORT_CSS;
}

function powerRows(powers, max) {
  const rows = [];
  for (let i = 1; i <= max; i++) {
    const p = powers[`lvl${i}`];
    if (!p?.name && !p?.desc) continue;
    rows.push(
      `<div class="pop-power"><div class="pop-power-head"><span class="pop-lvl">${'●'.repeat(i)}</span>` +
      `<b>${esc(p.name)}</b>${p.cost ? `<span class="pop-cost">${esc(p.cost)}</span>` : ''}` +
      (p.difficulty ? `<span class="pop-cost">diff ${p.difficulty}</span>` : '') +
      `</div><div class="pop-power-desc">${p.desc || ''}</div></div>`
    );
  }
  return rows.length ? `<div class="pop-powers">${rows.join('')}</div>` : '';
}

function itemPopup(item) {
  const sys = item.system;
  let meta = '';
  let extra = '';
  // Mirrors item-sheet visibility for players: discipline/path descriptions
  // are GM-only, and powers/levels only show up to the owned rating.
  let showDesc = true;
  switch (item.type) {
    case 'discipline':
    case 'path': {
      showDesc = false;
      meta = sys.level ? '●'.repeat(sys.level) : 'Not learned';
      const maxLvl = sys.level > 0 ? sys.level : 5;
      extra = powerRows(sys.powers || {}, maxLvl);
      break;
    }
    case 'background': {
      meta = sys.rating ? '●'.repeat(sys.rating) : '';
      const maxLvl = sys.rating > 0 ? sys.rating : 5;
      const lv = [];
      for (let i = 1; i <= maxLvl; i++) {
        const l = sys.levels?.[`lvl${i}`];
        if (!l?.name && !l?.desc) continue;
        lv.push(`<div class="pop-power"><div class="pop-power-head"><span class="pop-lvl">${'●'.repeat(i)}</span><b>${esc(l.name)}</b></div><div class="pop-power-desc">${l.desc || ''}</div></div>`);
      }
      if (lv.length) extra = `<div class="pop-powers">${lv.join('')}</div>`;
      if (sys.notes) extra += `<div class="pop-notes">${esc(sys.notes)}</div>`;
      break;
    }
    case 'merit':
    case 'flaw':
      meta = [sys.meritType, sys.cost ? `${Math.abs(sys.cost)} pt` : ''].filter(Boolean).join(' • ');
      break;
    case 'weapon':
      meta = [
        sys.damage ? `Damage ${sys.damage} ${sys.damageType}` : '',
        sys.difficulty ? `Diff ${sys.difficulty}` : '',
        sys.range ? `Range ${sys.range}` : '',
        sys.conceal ? `Conceal ${sys.conceal}` : '',
      ].filter(Boolean).join(' • ');
      break;
    case 'armor':
      meta = `Rating ${sys.rating} • Penalty ${sys.penalty}`;
      break;
    case 'ritual':
      meta = `Level ${sys.level} • ${sys.ritualType}`;
      break;
    case 'equipment':
      meta = `Qty ${sys.quantity} • Weight ${sys.weight}`;
      break;
    case 'container':
      meta = `Capacity ${sys.capacity} • Weight ${sys.weight}`;
      break;
  }
  return `<h2>${esc(item.name)}</h2>` +
    (meta ? `<div class="pop-meta">${meta}</div>` : '') +
    (showDesc && sys.description ? `<div class="pop-desc">${sys.description}</div>` : '') +
    extra;
}

// Enhanced Inventory rewires the inventory tab with its own grid, which won't
// survive outside Foundry. Rebuild the tab as the plain native list instead.
function inventoryHtml(actor) {
  const items = Array.from(actor.items);
  const equipIcon = it =>
    `<span class="item-equip ${it.system.equipped ? 'equipped' : ''}"><i class="${it.system.equipped ? 'fas fa-check-square' : 'far fa-square'}"></i></span>`;
  const row = (it, details) =>
    `<div class="item ${it.type === 'weapon' && !it.system.equipped ? 'stowed' : ''}" data-item-id="${it.id}">` +
    equipIcon(it) +
    `<span class="item-name">${esc(it.name)}</span>` +
    details.filter(Boolean).map(d => `<span class="item-detail">${d}</span>`).join('') +
    `</div>`;

  const weapons = items.filter(i => i.type === 'weapon').map(it => row(it, [
    `${esc(it.system.damage)} ${esc(it.system.damageType)}`,
    it.system.range ? `Range: ${esc(it.system.range)} yds` : '',
    it.system.capacity ? `Cap: ${esc(it.system.capacity)}` : '',
    it.system.rate ? `Rate: ${esc(it.system.rate)}` : '',
    it.system.weight ? `${it.system.weight} kg` : '',
  ])).join('');

  const armor = items.filter(i => i.type === 'armor').map(it => row(it, [
    `Rating ${it.system.rating}`,
    it.system.penalty ? `Pen ${it.system.penalty}` : '',
    it.system.weight ? `${it.system.weight} kg` : '',
  ])).join('');

  const equipment = items.filter(i => i.type === 'equipment').map(it => row(it, [
    it.system.quantity > 1 ? `x${it.system.quantity}` : '',
    it.system.weight ? `${it.system.weight} kg` : '',
  ])).join('');

  const containers = items.filter(i => i.type === 'container').map(it => row(it, [
    `Capacity ${it.system.capacity}`,
    it.system.weight ? `${it.system.weight} kg` : '',
  ])).join('');

  let weight = 0;
  for (const it of items) {
    const w = it.system.weight || 0;
    if (it.type === 'equipment') weight += w * (it.system.quantity || 1);
    else if (w > 0) weight += w;
  }
  const maxCarry = ((actor.system.attributes?.strength || 0) + potenceLevel(actor)) * 10;

  return `
    <div class="carrying-capacity"><i class="fas fa-weight-hanging"></i> Carrying: ${weight.toFixed(1)} / ${maxCarry} kg</div>
    <div class="inventory-columns">
      <div class="inventory-column"><h3>Weapons</h3><div class="item-list compact">${weapons}</div></div>
      <div class="inventory-column"><h3>Attire</h3><div class="item-list compact">${armor}</div></div>
      <div class="inventory-column">
        <h3>Equipment</h3><div class="item-list compact">${equipment}</div>
        ${containers ? `<h3>Containers</h3><div class="item-list compact">${containers}</div>` : ''}
      </div>
    </div>`;
}

const EXPORT_CSS = `
body.vtm-export { margin: 0; padding: 24px 10px; background: #0d0d0d; display: flex; justify-content: center; }
.vtm-export .export-root { width: 1100px; max-width: 97vw; }
.vtm-export .sheet-inner { height: auto; }
.vtm-export .sheet-body { overflow: visible; }
.vtm-export .tab.bio.active { height: 720px; }
.vtm-export .frozen { color: var(--vtm-text); font-size: 13px; }
.vtm-export .char-name .frozen { font-size: 23px; font-weight: 700; font-variant: small-caps; letter-spacing: 1px; color: var(--vtm-text-bright); display: block; }
.vtm-export .frozen-block { white-space: pre-wrap; font-size: 12px; color: var(--vtm-text); line-height: 1.5; padding: 2px 0; }
.vtm-export .rollable { cursor: default; }
.vtm-export .rollable:hover { color: inherit; text-shadow: none; }
.vtm-export [data-item-id] { cursor: pointer; }
.export-modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 50; }
.export-modal[hidden] { display: none; }
.export-modal-box { background: var(--vtm-surface); border: 1px solid var(--vtm-red-dim); border-radius: 6px; max-width: 580px; width: 90vw; max-height: 80vh; overflow-y: auto; padding: 18px 22px; position: relative; }
.export-modal-box h2 { color: var(--vtm-gold); font-size: 17px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px; }
.pop-meta { color: var(--vtm-red); font-size: 13px; margin-bottom: 8px; }
.pop-desc { font-size: 13px; line-height: 1.55; color: var(--vtm-text); }
.pop-powers { margin-top: 10px; border-top: 1px solid var(--vtm-border); padding-top: 8px; }
.pop-power { margin-bottom: 10px; }
.pop-power-head { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
.pop-lvl { color: var(--vtm-red); font-size: 9px; letter-spacing: 1px; }
.pop-cost { color: var(--vtm-text-dim); font-size: 11px; }
.pop-power-desc { font-size: 12px; color: var(--vtm-text-dim); line-height: 1.5; margin: 2px 0 0 2px; }
.pop-power-desc p { margin: 0 0 12px; }
.pop-power-desc p:last-child { margin-bottom: 0; }
.pop-power-desc p + p { padding-top: 10px; border-top: 1px solid var(--vtm-border); }
.pop-power-desc b, .pop-desc b { color: var(--vtm-gold); letter-spacing: 0.5px; }
.pop-desc p { margin: 0 0 10px; }
.pop-notes { margin-top: 8px; font-size: 12px; font-style: italic; color: var(--vtm-text-dim); white-space: pre-wrap; }
.export-modal-close { position: absolute; top: 8px; right: 10px; background: none; border: none; color: var(--vtm-text-dim); font-size: 15px; cursor: pointer; }
.export-modal-close:hover { color: var(--vtm-red); }
`;

// Runs inside the exported file. Kept dependency-free and dumb on purpose.
const EXPORT_SCRIPT = `
const DATA = JSON.parse(document.getElementById('sheet-data').textContent);

document.querySelectorAll('.sheet-tabs .item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sheet-tabs .item').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.sheet-body .tab').forEach(p =>
      p.classList.toggle('active', p.dataset.tab === tab.dataset.tab));
  });
});

document.querySelectorAll('.bio-subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.bio-subtab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.bio-section').forEach(s =>
      s.classList.toggle('active', s.dataset.bioField === tab.dataset.bioTab));
  });
});

document.querySelectorAll('.bio-section').forEach(section => {
  const pages = DATA.bio[section.dataset.bioField] || [''];
  const body = section.querySelector('.bio-body');
  const num = section.querySelector('.bio-page-num');
  const prev = section.querySelector('.bio-prev');
  const next = section.querySelector('.bio-next');
  let cur = 0;
  const show = () => {
    body.innerHTML = pages[cur];
    if (num) num.textContent = pages.length > 1 ? (cur + 1) + ' / ' + pages.length : '';
    if (prev) prev.disabled = cur <= 0;
    if (next) next.disabled = cur >= pages.length - 1;
  };
  prev?.addEventListener('click', () => { if (cur > 0) { cur--; show(); } });
  next?.addEventListener('click', () => { if (cur < pages.length - 1) { cur++; show(); } });
  show();
});

const modal = document.querySelector('.export-modal');
const modalContent = document.querySelector('.export-modal-content');
document.querySelectorAll('[data-item-id]').forEach(row => {
  row.addEventListener('click', e => {
    const html = DATA.items[row.dataset.itemId];
    if (!html) return;
    e.stopPropagation();
    modalContent.innerHTML = html;
    modal.hidden = false;
  });
});
const closeModal = () => { modal.hidden = true; };
document.querySelector('.export-modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
`;

export async function exportSheet(sheet) {
  const actor = sheet.document;
  const live = sheet.element.querySelector('.sheet-inner');
  if (!live) {
    ui.notifications.warn('Nothing to export.');
    return;
  }

  ui.notifications.info('Exporting sheet...');

  const clone = live.cloneNode(true);
  freezeInputs(live, clone);
  stripControls(clone);

  const invTab = clone.querySelector('.tab.inventory');
  if (invTab) invTab.innerHTML = inventoryHtml(actor);

  await inlineImages(clone);

  const css = await buildCss();

  const items = {};
  for (const item of actor.items) items[item.id] = itemPopup(item);

  const payload = {
    items,
    bio: {
      bio: (actor.system.bio || '').split(PAGE_SEP),
      notes: (actor.system.notes || '').split(PAGE_SEP),
    },
  };
  // </script> inside descriptions would end our script block early
  const json = JSON.stringify(payload).replace(/<\//g, '<\\/');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(actor.name)}</title>
<style>${css}</style>
</head>
<body class="vtm-export">
<div class="export-root vtm-v20 sheet actor vampire">
<section class="window-content">
${clone.outerHTML}
</section>
</div>
<div class="export-modal" hidden>
  <div class="export-modal-box">
    <button type="button" class="export-modal-close">✕</button>
    <div class="export-modal-content"></div>
  </div>
</div>
<script type="application/json" id="sheet-data">${json}</script>
<script>${EXPORT_SCRIPT}</script>
</body>
</html>`;

  const name = actor.name.replace(/[^\w\- ]+/g, '').trim() || 'character';
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);

  ui.notifications.info(`Exported ${actor.name}.html`);
}
