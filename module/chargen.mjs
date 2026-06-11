import { VTM } from './config.mjs';
import { TRAIT_DESCRIPTIONS } from './trait-descriptions.mjs';

const ATTR_POOLS = [7, 5, 3];
const ABIL_POOLS = [13, 9, 5];
const VIRTUE_POOL = 7;
const DISC_POOL = 3;
const BG_POOL = 5;
const FREEBIE_MAX = 15;
const MF_MAX = 7;

const FB_COST = {
  attribute: 5, ability: 2, discipline: 7,
  background: 1, virtue: 2, willpower: 1, humanity: 2,
};

function tLabel(key) {
  return game.i18n.localize('VTM.' + key.charAt(0).toUpperCase() + key.slice(1));
}

// Renders inside VampireSheet, not its own window
export class ChargenWizard {
  constructor(actor, sheet) {
    this.actor = actor;
    this.sheet = sheet;
    this.step = 0;
    this._tip = null;
    this._isFinishing = false;
    this._initState();
    this._preCreateItemHookId = Hooks.on('preCreateItem', item => {
      if (item.parent?.uuid !== this.actor.uuid || this._isFinishing) return;
      if (!this.handleDrop(item, null, item.toObject())) return;
      return false;
    });
    this._createItemHookId = Hooks.on('createItem', async item => {
      if (item.parent?.uuid !== this.actor.uuid) return;
      if (this._isFinishing || !this.handleDrop(item, null, item.toObject())) return;
      await item.delete();
    });
  }

  destroy() {
    if (this._tip) { this._tip.remove(); this._tip = null; }
    if (this._createItemHookId != null) {
      Hooks.off('createItem', this._createItemHookId);
      this._createItemHookId = null;
    }
    if (this._preCreateItemHookId != null) {
      Hooks.off('preCreateItem', this._preCreateItemHookId);
      this._preCreateItemHookId = null;
    }
  }

  _initState() {
    const d = this.d = {
      clan: '', nature: '', demeanor: '', concept: '', sire: '',
      attrPri: {},
      attr: {},
      abilPri: {},
      abil: {},
      disc: [],
      bg: [],
      virtues: { conscience: 1, selfControl: 1, courage: 1 },
      generation: 13,
      fb: {},
      useMeritsFlaws: false,
      meritsFlaws: [],
    };
    for (const keys of Object.values(VTM.attributes))
      for (const k of keys) d.attr[k] = 1;
    for (const keys of Object.values(VTM.abilities))
      for (const k of keys) d.abil[k] = 0;
  }


  // -- Data for template ------------------------------------------------

  getData() {
    const d = this.d;
    const ctx = { step: this.step, d, config: VTM };

    ctx.stepInfo = ['Concept', 'Attributes', 'Abilities', 'Advantages', 'Finishing Touches']
      .map((name, i) => ({ name, num: i + 1, active: i === this.step, done: i < this.step }));

    if (this.step === 1) {
      ctx.priorities = this._priorityOpts('attr');
      ctx.groups = this._attrGroups();
    }
    if (this.step === 2) {
      ctx.priorities = this._priorityOpts('abil');
      ctx.groups = this._abilGroups();
    }
    if (this.step === 3) {
      ctx.discRemaining = this._itemPool('disc');
      ctx.bgRemaining = this._itemPool('bg');
      ctx.virtueRemaining = this._virtuePool();
      const clanDisc = VTM.clanDisciplines[d.clan];
      ctx.clanDiscHint = clanDisc?.length ? clanDisc.join(', ') : null;
    }
    if (this.step === 4) {
      const gen = VTM.generationTable[d.generation] || {};
      const fb = d.fb;
      ctx.humanity = this._totalVal('virtues.conscience') + this._totalVal('virtues.selfControl') + (fb.humanity || 0);
      ctx.willpower = this._totalVal('virtues.courage') + (fb.willpower || 0);
      ctx.bloodPool = gen.maxBlood || 10;
      ctx.traitMax = gen.traitMax || 5;
      ctx.freebiesLeft = this._freebiesLeft();
      ctx.fbData = this._freebieData();

      if (d.useMeritsFlaws) {
        ctx.merits = d.meritsFlaws
          .map((m, i) => ({ ...m, idx: i }))
          .filter(m => m.cost >= 0);
        ctx.flaws = d.meritsFlaws
          .map((m, i) => ({ ...m, idx: i, absCost: Math.abs(m.cost) }))
          .filter(m => m.cost < 0);
        ctx.meritTotal = ctx.merits.reduce((s, m) => s + m.cost, 0);
        ctx.flawTotal = ctx.flaws.reduce((s, m) => s + m.absCost, 0);
      }
    }

    return ctx;
  }

  _totalVal(path) {
    const bonus = this.d.fb[path] || 0;
    if (path.startsWith('attr.')) return this.d.attr[path.slice(5)] + bonus;
    if (path.startsWith('abil.')) return this.d.abil[path.slice(5)] + bonus;
    if (path.startsWith('virtues.')) return this.d.virtues[path.slice(8)] + bonus;
    if (path.startsWith('disc.')) return (this.d.disc[parseInt(path.slice(5))]?.dots || 0) + bonus;
    if (path.startsWith('bg.')) return (this.d.bg[parseInt(path.slice(3))]?.dots || 0) + bonus;
    return 0;
  }

  _priorityOpts(type) {
    const isAttr = type === 'attr';
    const groupKeys = isAttr ? ['physical', 'social', 'mental'] : ['talents', 'skills', 'knowledges'];
    const pools = isAttr ? ATTR_POOLS : ABIL_POOLS;
    const pri = isAttr ? this.d.attrPri : this.d.abilPri;
    const taken = new Set(Object.values(pri).filter(v => v != null));

    return groupKeys.map(key => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      options: pools.map((p, i) => ({
        value: p,
        label: ['Primary', 'Secondary', 'Tertiary'][i] + ` (${p})`,
        selected: pri[key] === p,
        disabled: taken.has(p) && pri[key] !== p,
      })),
    }));
  }

  _attrGroups() {
    return Object.entries(VTM.attributes).map(([gk, keys]) => {
      const pool = this.d.attrPri[gk] ?? 0;
      const spent = keys.reduce((s, k) => s + (this.d.attr[k] - 1), 0);
      return {
        key: gk, label: gk.charAt(0).toUpperCase() + gk.slice(1),
        pool, remaining: pool - spent,
        traits: keys.map(k => ({ key: k, label: tLabel(k), value: this.d.attr[k] })),
      };
    });
  }

  _abilGroups() {
    return Object.entries(VTM.abilities).map(([gk, keys]) => {
      const pool = this.d.abilPri[gk] ?? 0;
      const spent = keys.reduce((s, k) => s + this.d.abil[k], 0);
      return {
        key: gk, label: gk.charAt(0).toUpperCase() + gk.slice(1),
        pool, remaining: pool - spent,
        traits: keys.map(k => ({ key: k, label: tLabel(k), value: this.d.abil[k] })),
      };
    });
  }

  _itemPool(type) {
    const max = type === 'disc' ? DISC_POOL : BG_POOL;
    return max - this.d[type].reduce((s, i) => s + i.dots, 0);
  }

  _virtuePool() {
    const v = this.d.virtues;
    return VIRTUE_POOL - (v.conscience - 1) - (v.selfControl - 1) - (v.courage - 1);
  }

  _freebiesLeft() {
    let spent = 0;
    for (const [path, val] of Object.entries(this.d.fb)) {
      if (!val) continue;
      spent += val * this._fbCost(path);
    }
    if (this.d.useMeritsFlaws) {
      spent += this.d.meritsFlaws.reduce((s, m) => s + m.cost, 0);
    }
    return FREEBIE_MAX - spent;
  }

  _fbCost(path) {
    if (path.startsWith('attr.')) return FB_COST.attribute;
    if (path.startsWith('abil.')) return FB_COST.ability;
    if (path.startsWith('disc.')) return FB_COST.discipline;
    if (path.startsWith('bg.')) return FB_COST.background;
    if (path.startsWith('virtues.')) return FB_COST.virtue;
    if (path === 'willpower') return FB_COST.willpower;
    if (path === 'humanity') return FB_COST.humanity;
    return 99;
  }

  _freebieData() {
    const fb = this.d.fb;
    const gen = VTM.generationTable[this.d.generation] || {};
    const tMax = gen.traitMax || 5;
    const left = this._freebiesLeft();

    const mk = (path, label, base, max, cost) => {
      const bonus = fb[path] || 0;
      return {
        path, label, base, bonus, total: base + bonus, max, cost,
        canAdd: (base + bonus) < max && left >= cost,
        canSub: bonus > 0,
      };
    };

    return {
      attrs: Object.entries(VTM.attributes).map(([gk, keys]) => ({
        label: gk.charAt(0).toUpperCase() + gk.slice(1),
        items: keys.map(k => mk(`attr.${k}`, tLabel(k), this.d.attr[k], tMax, FB_COST.attribute)),
      })),
      abils: Object.entries(VTM.abilities).map(([gk, keys]) => ({
        label: gk.charAt(0).toUpperCase() + gk.slice(1),
        items: keys.map(k => mk(`abil.${k}`, tLabel(k), this.d.abil[k], 5, FB_COST.ability)),
      })),
      discs: this.d.disc.map((x, i) =>
        mk(`disc.${i}`, x.name, x.dots, 5, FB_COST.discipline)),
      bgs: this.d.bg.map((x, i) =>
        mk(`bg.${i}`, x.name, x.dots, 5, FB_COST.background)),
      virtues: [
        mk('virtues.conscience', 'Conscience', this.d.virtues.conscience, 5, FB_COST.virtue),
        mk('virtues.selfControl', 'Self-Control', this.d.virtues.selfControl, 5, FB_COST.virtue),
        mk('virtues.courage', 'Courage', this.d.virtues.courage, 5, FB_COST.virtue),
      ],
      wp: mk('willpower', 'Willpower',
        this.d.virtues.courage + (fb['virtues.courage'] || 0), 10, FB_COST.willpower),
      hum: mk('humanity', 'Humanity',
        (this.d.virtues.conscience + (fb['virtues.conscience'] || 0)) +
        (this.d.virtues.selfControl + (fb['virtues.selfControl'] || 0)), 10, FB_COST.humanity),
    };
  }


  // -- Drag & drop from compendiums ------------------------------------

  handleDrop(item, uuid, itemData = null) {
    const sourceData = itemData || (item.toObject instanceof Function ? item.toObject() : null);
    if (this.step === 3) {
      if (item.type === 'discipline') {
        if (this.d.disc.some(d => d.name === item.name)) {
          ui.notifications.warn(`${item.name} is already added.`);
          return true;
        }
        this.d.disc.push({ name: item.name, dots: 0, uuid, itemData: sourceData });
        this.sheet.render();
        return true;
      } else if (item.type === 'background') {
        if (this.d.bg.some(b => b.name === item.name)) {
          ui.notifications.warn(`${item.name} is already added.`);
          return true;
        }
        this.d.bg.push({ name: item.name, dots: 0, uuid, itemData: sourceData });
        this.sheet.render();
        return true;
      }
    } else if (this.step === 4 && this.d.useMeritsFlaws && item.type === 'merit') {
      if (this.d.meritsFlaws.some(m => m.name === item.name)) {
        ui.notifications.warn(`${item.name} is already added.`);
        return true;
      }
      const cost = item.system.cost;
      if (cost >= 0) {
        const total = this.d.meritsFlaws.filter(m => m.cost >= 0).reduce((s, m) => s + m.cost, 0);
        if (total + cost > MF_MAX) {
          ui.notifications.warn(`Adding ${item.name} would exceed the ${MF_MAX}-point merit limit.`);
          return true;
        }
      } else {
        const total = this.d.meritsFlaws.filter(m => m.cost < 0).reduce((s, m) => s + Math.abs(m.cost), 0);
        if (total + Math.abs(cost) > MF_MAX) {
          ui.notifications.warn(`Adding ${item.name} would exceed the ${MF_MAX}-point flaw limit.`);
          return true;
        }
      }
      this.d.meritsFlaws.push({ name: item.name, cost, uuid, itemData: sourceData });
      this._renderKeepingContentBottom();
      return true;
    }
    return false;
  }

  _renderKeepingContentBottom() {
    const content = this.sheet.element?.querySelector('.chargen-content');
    if (content) {
      this._pendingScrollBottom = content.scrollHeight - content.scrollTop - content.clientHeight;
    }
    this.sheet.render();
  }


  // -- Event binding (vanilla DOM, no jQuery) ---------------------------

  activateListeners(el) {
    if (this._pendingScrollBottom != null) {
      const content = el.querySelector('.chargen-content');
      if (content) {
        content.scrollTop = content.scrollHeight - content.clientHeight - this._pendingScrollBottom;
      }
      this._pendingScrollBottom = null;
    }

    // Entrance fade on first render
    if (!this._animated) {
      this._animated = true;
      const wiz = el.querySelector('.chargen-wizard');
      if (wiz) {
        wiz.classList.add('chargen-entering');
        wiz.addEventListener('animationend', () => wiz.classList.remove('chargen-entering'), { once: true });
      }
    }

    el.querySelector('.chargen-back')?.addEventListener('click', () => { this.step--; this.sheet.render(); });
    el.querySelector('.chargen-next')?.addEventListener('click', () => this._next());
    el.querySelector('.chargen-finish')?.addEventListener('click', () => this._finish());

    switch (this.step) {
      case 0: this._listenConcept(el); break;
      case 1: this._listenPriority(el, 'attr'); this._listenDots(el, 'attr'); this._setupTraitTips(el, 'attr'); break;
      case 2: this._listenPriority(el, 'abil'); this._listenDots(el, 'abil'); this._setupTraitTips(el, 'abil'); break;
      case 3: this._listenAdvantages(el); break;
      case 4: this._listenFreebies(el); break;
    }
  }

  _listenConcept(el) {
    el.querySelectorAll('.chargen-form-grid select, .chargen-form-grid input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.name) this.d[input.name] = input.value;
      });
    });
  }

  _listenPriority(el, type) {
    el.querySelectorAll('.priority-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const group = sel.dataset.group;
        const val = parseInt(sel.value) || null;
        const pri = type === 'attr' ? this.d.attrPri : this.d.abilPri;
        const data = type === 'attr' ? this.d.attr : this.d.abil;
        const groups = type === 'attr' ? VTM.attributes : VTM.abilities;
        const base = type === 'attr' ? 1 : 0;

        // Snapshot pools before the change so we only reset what moved
        const before = {};
        for (const gk of Object.keys(groups)) before[gk] = pri[gk];

        if (val) {
          for (const k of Object.keys(pri)) {
            if (pri[k] === val) pri[k] = null;
          }
        }
        pri[group] = val;

        // Only reset dots for groups whose pool changed
        for (const [gk, keys] of Object.entries(groups)) {
          if (pri[gk] !== before[gk]) {
            for (const k of keys) data[k] = base;
          }
        }

        this.sheet.render();
      });
    });
  }

  _listenDots(el, type) {
    const isAttr = type === 'attr';
    const data = isAttr ? this.d.attr : this.d.abil;
    const pri = isAttr ? this.d.attrPri : this.d.abilPri;
    const groups = isAttr ? VTM.attributes : VTM.abilities;
    const base = isAttr ? 1 : 0;
    const cap = isAttr ? 5 : 3;

    el.querySelectorAll('.chargen-dots .dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const val = parseInt(dot.dataset.value);
        const row = dot.closest('.chargen-dots');
        const key = row.dataset.key;
        const gk = row.dataset.group;

        const cur = data[key];
        const next = val === cur ? val - 1 : val;
        if (next < base || next > cap) return;

        const pool = pri[gk] ?? 0;
        if (!pool) return;
        const gKeys = groups[gk];
        const spent = gKeys.reduce((s, k) => s + (data[k] - base), 0);
        const delta = (next - base) - (cur - base);
        if (spent + delta > pool || spent + delta < 0) return;

        data[key] = next;
        this._refreshDots(row, next);

        const counter = row.closest('.chargen-group').querySelector('.pool-count');
        if (counter) counter.textContent = pool - spent - delta;
      });
    });
  }

  _refreshDots(row, value) {
    row.querySelectorAll('.dot').forEach(d => {
      const v = parseInt(d.dataset.value);
      d.classList.toggle('filled', v <= value);
      d.classList.toggle('empty', v > value);
    });
  }

  _setupTraitTips(el, type) {
    if (this._tip) this._tip.remove();
    const tip = document.createElement('div');
    tip.className = 'trait-tooltip';
    document.body.appendChild(tip);
    this._tip = tip;
    let timer = null;

    const prefix = type === 'attr' ? 'attributes' : 'abilities';
    const vals = type === 'attr' ? this.d.attr : this.d.abil;

    const show = (target, key) => {
      const descs = TRAIT_DESCRIPTIONS[`${prefix}.${key}`];
      if (!descs) return;
      const val = vals[key];
      const desc = descs[val - (type === 'attr' ? 1 : 1)] ?? '';
      if (!desc) return;
      tip.textContent = desc;
      const rect = target.getBoundingClientRect();
      tip.style.left = rect.left + 'px';
      tip.style.top = (rect.bottom + 8) + 'px';
      tip.classList.add('visible');
      const box = tip.getBoundingClientRect();
      if (box.bottom > window.innerHeight) tip.style.top = (rect.top - box.height - 8) + 'px';
      if (box.right > window.innerWidth) tip.style.left = (window.innerWidth - box.width - 12) + 'px';
    };
    const hide = () => { clearTimeout(timer); timer = null; tip.classList.remove('visible'); };

    el.querySelectorAll('.chargen-trait').forEach(row => {
      const key = row.querySelector('.dot-row')?.dataset.key;
      if (!key) return;
      const name = row.querySelector('.trait-name');
      name.addEventListener('mouseenter', () => { timer = setTimeout(() => show(name, key), 400); });
      name.addEventListener('mouseleave', hide);
    });
  }

  _listenAdvantages(el) {
    el.querySelectorAll('.chargen-drop-hint').forEach(hint => {
      hint.addEventListener('dragover', ev => { ev.preventDefault(); hint.classList.add('drag-hover'); });
      hint.addEventListener('dragenter', ev => { ev.preventDefault(); hint.classList.add('drag-hover'); });
      hint.addEventListener('dragleave', () => hint.classList.remove('drag-hover'));
      hint.addEventListener('drop', () => hint.classList.remove('drag-hover'));
    });

    el.querySelectorAll('.disc-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.d.disc.splice(parseInt(btn.dataset.idx), 1);
        this.sheet.render();
      });
    });
    el.querySelectorAll('.disc-dots .dot').forEach(dot => {
      dot.addEventListener('click', ev => this._advDotClick(ev, 'disc', DISC_POOL));
    });

    el.querySelectorAll('.bg-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.d.bg.splice(parseInt(btn.dataset.idx), 1);
        this.sheet.render();
      });
    });
    el.querySelectorAll('.bg-dots .dot').forEach(dot => {
      dot.addEventListener('click', ev => this._advDotClick(ev, 'bg', BG_POOL));
    });

    el.querySelectorAll('.virtue-dots .dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const key = dot.closest('.virtue-dots').dataset.key;
        const val = parseInt(dot.dataset.value);
        const cur = this.d.virtues[key];
        const next = val === cur ? val - 1 : val;
        if (next < 1 || next > 5) return;

        const v = this.d.virtues;
        const otherSpent = Object.entries(v).reduce((s, [k, n]) => k === key ? s : s + (n - 1), 0);
        if (otherSpent + (next - 1) > VIRTUE_POOL) return;

        v[key] = next;
        this._refreshDots(dot.closest('.virtue-dots'), next);
        const counter = el.querySelector('.virtue-pool-count');
        if (counter) counter.textContent = VIRTUE_POOL - otherSpent - (next - 1);
      });
    });
  }

  _advDotClick(ev, type, maxPool) {
    const entry = ev.currentTarget.closest(`.${type}-entry`);
    const idx = parseInt(entry.dataset.idx);
    const val = parseInt(ev.currentTarget.dataset.value);
    const items = this.d[type];
    const cur = items[idx].dots;
    const next = val === cur ? val - 1 : val;
    if (next < 0 || next > 5) return;

    const otherTotal = items.reduce((s, d, i) => i === idx ? s : s + d.dots, 0);
    if (otherTotal + next > maxPool) return;

    items[idx].dots = next;
    this._refreshDots(ev.currentTarget.closest(`.${type}-dots`), next);
    const counter = ev.currentTarget.closest('.chargen-adv-section')?.querySelector(`.${type}-pool-count`);
    if (counter) counter.textContent = maxPool - otherTotal - next;
  }

  _listenFreebies(el) {
    el.querySelectorAll('.chargen-drop-hint').forEach(hint => {
      hint.addEventListener('dragover', ev => { ev.preventDefault(); hint.classList.add('drag-hover'); });
      hint.addEventListener('dragenter', ev => { ev.preventDefault(); hint.classList.add('drag-hover'); });
      hint.addEventListener('dragleave', () => hint.classList.remove('drag-hover'));
      hint.addEventListener('drop', () => hint.classList.remove('drag-hover'));
    });

    el.querySelector('[name="generation"]')?.addEventListener('change', ev => {
      this.d.generation = parseInt(ev.currentTarget.value) || 13;
      this.sheet.render();
    });

    el.querySelectorAll('.fb-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        const cost = this._fbCost(path);
        if (this._freebiesLeft() < cost) return;
        if (!this._canBumpFb(path)) return;
        this.d.fb[path] = (this.d.fb[path] || 0) + 1;
        this.sheet.render();
      });
    });

    el.querySelectorAll('.fb-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        if (!this.d.fb[path]) return;
        this.d.fb[path]--;
        if (!this.d.fb[path]) delete this.d.fb[path];
        this.sheet.render();
      });
    });

    // Merits & Flaws
    el.querySelector('[name="useMeritsFlaws"]')?.addEventListener('change', ev => {
      this.d.useMeritsFlaws = ev.currentTarget.checked;
      if (!this.d.useMeritsFlaws) this.d.meritsFlaws = [];
      this.sheet.render();
    });

    el.querySelectorAll('.mf-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.d.meritsFlaws.splice(idx, 1);
        this._renderKeepingContentBottom();
      });
    });
  }

  _canBumpFb(path) {
    const gen = VTM.generationTable[this.d.generation] || {};
    const tMax = gen.traitMax || 5;
    if (path.startsWith('attr.')) return this._totalVal(path) < tMax;
    if (path.startsWith('abil.')) return this._totalVal(path) < 5;
    if (path.startsWith('disc.')) return this._totalVal(path) < 5;
    if (path.startsWith('bg.')) return this._totalVal(path) < 5;
    if (path.startsWith('virtues.')) return this._totalVal(path) < 5;
    if (path === 'willpower') {
      const base = this.d.virtues.courage + (this.d.fb['virtues.courage'] || 0);
      return (base + (this.d.fb.willpower || 0)) < 10;
    }
    if (path === 'humanity') {
      const base = (this.d.virtues.conscience + (this.d.fb['virtues.conscience'] || 0))
                 + (this.d.virtues.selfControl + (this.d.fb['virtues.selfControl'] || 0));
      return (base + (this.d.fb.humanity || 0)) < 10;
    }
    return false;
  }


  // -- Navigation -------------------------------------------------------

  _next() {
    const err = this._validate();
    if (err) { ui.notifications.warn(err); return; }
    this.step++;
    if (this.step === 4) this.d.fb = {};
    this.sheet.render();
  }

  _validate() {
    const d = this.d;
    switch (this.step) {
      case 0:
        if (!d.clan) return 'Choose a Clan before proceeding.';
        if (!d.nature) return 'Choose a Nature before proceeding.';
        if (!d.demeanor) return 'Choose a Demeanor before proceeding.';
        return null;
      case 1: {
        const pri = d.attrPri;
        if (Object.values(pri).filter(v => v != null).length < 3)
          return 'Assign all three attribute priorities.';
        for (const [gk, keys] of Object.entries(VTM.attributes)) {
          const pool = pri[gk] ?? 0;
          const spent = keys.reduce((s, k) => s + (d.attr[k] - 1), 0);
          if (spent < pool) return `Spend all dots in ${gk} attributes.`;
        }
        return null;
      }
      case 2: {
        const pri = d.abilPri;
        if (Object.values(pri).filter(v => v != null).length < 3)
          return 'Assign all three ability priorities.';
        for (const [gk, keys] of Object.entries(VTM.abilities)) {
          const pool = pri[gk] ?? 0;
          const spent = keys.reduce((s, k) => s + d.abil[k], 0);
          if (spent < pool) return `Spend all dots in ${gk} abilities.`;
        }
        return null;
      }
      case 3: {
        if (!d.disc.length) return 'Drag at least one discipline from the compendium.';
        const discSpent = d.disc.reduce((s, x) => s + x.dots, 0);
        if (discSpent < DISC_POOL) return `Assign all ${DISC_POOL} discipline dots.`;
        if (!d.bg.length) return 'Drag at least one background from the compendium.';
        const bgSpent = d.bg.reduce((s, x) => s + x.dots, 0);
        if (bgSpent < BG_POOL) return `Assign all ${BG_POOL} background dots.`;
        const vSpent = (d.virtues.conscience - 1) + (d.virtues.selfControl - 1) + (d.virtues.courage - 1);
        if (vSpent < VIRTUE_POOL) return `Spend all ${VIRTUE_POOL} virtue dots.`;
        return null;
      }
      default: return null;
    }
  }


  // -- Apply to actor ---------------------------------------------------

  async _finish() {
    const d = this.d;
    const fb = d.fb;

    const update = {
      'system.clan': d.clan,
      'system.nature': d.nature,
      'system.demeanor': d.demeanor,
      'system.concept': d.concept,
      'system.sire': d.sire,
      'system.generation': d.generation,
    };

    for (const k of Object.values(VTM.attributes).flat())
      update[`system.attributes.${k}`] = d.attr[k] + (fb[`attr.${k}`] || 0);
    for (const k of Object.values(VTM.abilities).flat())
      update[`system.abilities.${k}`] = d.abil[k] + (fb[`abil.${k}`] || 0);

    const con = d.virtues.conscience + (fb['virtues.conscience'] || 0);
    const sc = d.virtues.selfControl + (fb['virtues.selfControl'] || 0);
    const cou = d.virtues.courage + (fb['virtues.courage'] || 0);
    update['system.virtues.conscience'] = con;
    update['system.virtues.selfControl'] = sc;
    update['system.virtues.courage'] = cou;

    update['system.humanity'] = con + sc + (fb.humanity || 0);
    const wpTotal = cou + (fb.willpower || 0);
    update['system.willpower.max'] = wpTotal;
    update['system.willpower.value'] = wpTotal;

    const gen = VTM.generationTable[d.generation];
    if (gen) update['system.blood.value'] = gen.maxBlood;

    await this.actor.update(update);

    // Build items from compendium UUIDs when available
    const items = [];
    for (let i = 0; i < d.disc.length; i++) {
      const x = d.disc[i];
      if (!x.name || x.dots <= 0) continue;
      const totalDots = x.dots + (fb[`disc.${i}`] || 0);
      if (x.uuid) {
        try {
          const src = await fromUuid(x.uuid);
          if (src) {
            const obj = src.toObject();
            obj.system.level = totalDots;
            delete obj._id;
            items.push(obj);
            continue;
          }
        } catch (_) { /* fall through */ }
      }
      if (x.itemData) {
        const obj = foundry.utils.deepClone(x.itemData);
        obj.system.level = totalDots;
        delete obj._id;
        items.push(obj);
        continue;
      }
      items.push({ name: x.name, type: 'discipline', system: { level: totalDots } });
    }
    for (let i = 0; i < d.bg.length; i++) {
      const x = d.bg[i];
      if (!x.name || x.dots <= 0) continue;
      const totalDots = x.dots + (fb[`bg.${i}`] || 0);
      if (x.uuid) {
        try {
          const src = await fromUuid(x.uuid);
          if (src) {
            const obj = src.toObject();
            obj.system.rating = totalDots;
            delete obj._id;
            items.push(obj);
            continue;
          }
        } catch (_) { /* fall through */ }
      }
      if (x.itemData) {
        const obj = foundry.utils.deepClone(x.itemData);
        obj.system.rating = totalDots;
        delete obj._id;
        items.push(obj);
        continue;
      }
      items.push({ name: x.name, type: 'background', system: { rating: totalDots } });
    }

    if (d.useMeritsFlaws) {
      for (const mf of d.meritsFlaws) {
        if (mf.uuid) {
          try {
            const src = await fromUuid(mf.uuid);
            if (src) {
              const obj = src.toObject();
              delete obj._id;
              items.push(obj);
              continue;
            }
          } catch (_) { /* fall through */ }
        }
        if (mf.itemData) {
          const obj = foundry.utils.deepClone(mf.itemData);
          delete obj._id;
          items.push(obj);
          continue;
        }
        items.push({ name: mf.name, type: 'merit', system: { cost: mf.cost } });
      }
    }

    const chargenItemTypes = new Set(['discipline', 'background', 'merit']);
    const existingItemIds = Array.from(this.actor.items)
      .filter(item => chargenItemTypes.has(item.type))
      .map(item => item.id);

    this._isFinishing = true;
    try {
      if (existingItemIds.length) {
        await this.actor.deleteEmbeddedDocuments('Item', existingItemIds);
      }
      if (items.length) {
        await this.actor.createEmbeddedDocuments('Item', items);
      }
    } finally {
      this._isFinishing = false;
    }

    ui.notifications.info(`${this.actor.name} created successfully.`);
    this.sheet._closeChargen();
  }
}
