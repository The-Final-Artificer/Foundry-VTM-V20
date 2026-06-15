import { VTM } from './config.mjs';
import { showDice } from './dice.mjs';
import { TRAIT_DESCRIPTIONS } from './trait-descriptions.mjs';
import { ChargenWizard } from './chargen.mjs';
import { applyHealthDamage, checkIncapacitated, finalDamageAfterSoak, getCondition } from './combat.mjs';
import { blindedDifficulty } from './status-effects.mjs';
import { isDisciplineActive, potenceAutoSuccesses, effectiveTraitValue, effectiveStrength, usesStrengthTrait } from './discipline-effects.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

function parseAmmoCapacity(capacity) {
  const parts = String(capacity || '').match(/\d+(?:\s*\+\s*\d+)?/g);
  if (!parts?.length) return null;
  const totals = parts.map(part => part.split('+')
    .reduce((sum, n) => sum + (parseInt(n.trim(), 10) || 0), 0));
  return Math.max(...totals);
}

function ammoRemaining(system) {
  const ammo = String(system.ammo ?? '').trim();
  if (/^\d+$/.test(ammo)) return parseInt(ammo, 10);
  return parseAmmoCapacity(system.capacity);
}

function ammoLabel(system) {
  const capacity = String(system.capacity || '').trim();
  if (!capacity) return '';
  const remaining = ammoRemaining(system);
  return remaining === null ? '' : `${remaining} / ${capacity}`;
}

function signed(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : `${n}`;
}

function traitLabel(path) {
  if (!path) return '';
  if (path === 'willpower') return 'Willpower';
  if (path === 'humanity') return 'Humanity';
  const [, key] = path.split('.');
  if (!key) return path;
  return game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`);
}

function traitValue(system, path) {
  if (!path) return 0;
  if (path === 'willpower') return system.willpower?.max || 0;
  if (path === 'humanity') return system.humanity || 0;
  const [category, key] = path.split('.');
  return system[category]?.[key] || 0;
}

function damageDisplay(formula, strength, autoSucc = 0) {
  const raw = String(formula || '').trim();
  const lower = raw.toLowerCase();
  const autoText = autoSucc ? ` +${autoSucc} auto` : '';
  if (!raw || lower === 'str') return `Str (${strength})${autoText}`;
  if (lower.startsWith('str')) {
    const bonus = parseInt(lower.replace(/str\+?/, ''), 10) || 0;
    return bonus ? `Str${signed(bonus)} (${strength + bonus})${autoText}` : `Str (${strength})${autoText}`;
  }
  return raw;
}

function poolDisplay(actor, primary, secondary, accuracyMod = 0) {
  const traits = [primary, secondary].filter(Boolean);
  const parts = traits.map(path => traitLabel(path));
  const total = traits.reduce((sum, path) => sum + effectiveTraitValue(actor, path), 0) + (Number(accuracyMod) || 0);
  if (accuracyMod) parts.push(`Accuracy ${signed(accuracyMod)}`);
  return `${parts.join(' + ')} (${total})`;
}

export class VampireSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["vtm-v20", "sheet", "actor", "vampire"],
    position: { width: 1100, height: 920 },
    window: {
      resizable: true,
      controls: [
        { icon: "fas fa-magic", label: "Chargen", action: "toggleChargen" },
      ]
    },
    form: { submitOnChange: true },
    dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
    actions: {
      toggleChargen: VampireSheet.#onToggleChargen,
      declQuickAdd: VampireSheet.#onDeclQuickAdd,
      declQuickRemove: VampireSheet.#onDeclQuickRemove,
      declFullDefense: VampireSheet.#onDeclFullDefense,
      declAddAction: VampireSheet.#onDeclAddAction,
      declCancelCapture: VampireSheet.#onDeclCancelCapture,
      declRemoveAction: VampireSheet.#onDeclRemoveAction,
      declRemoveReload: VampireSheet.#onDeclRemoveReload,
      declConfirm: VampireSheet.#onDeclConfirm,
      resExecute: VampireSheet.#onResExecute,
      resFinish: VampireSheet.#onResFinish,
      toggleCompact: VampireSheet.#onToggleCompact,
    }
  };

  static PARTS = {
    sheet: { template: "systems/vtm-v20/templates/vampire-sheet.hbs" }
  };

  _tab = "stats";
  _compactMode = false;
  _fullSize = null;
  _chargen = null;
  _closingChargen = false;
  _fadeInAfterChargen = false;
  _traitTip = null;
  _attacks = [];
  _bioPage = { bio: 0, notes: 0 };
  _bioSaveFns = [];
  _rollSelect = null;
  _rollQuickEl = null;
  _healAnimPlaying = false;
  _declActions = [];
  _declFullDefense = false;
  _declCapturing = false;
  _declCombat = null;
  _declCombatant = null;
  _resCombat = null;
  _resCombatant = null;
  _resExecuted = new Set();
  _resSpent = new Map();
  _resDefenseSpent = new Map();
  _resFullDefCount = 0;
  _resTurnDone = false;
  _targetingChoice = 'medium';
  _targetingDrawer = null;
  _combatDrawer = null;

  get title() {
    if (this._chargen) return `${this.document.name}: Character Creation`;
    return this.document.name;
  }

  // Stop auto-save from firing during chargen (those fields aren't actor paths)
  _onChangeForm(formConfig, event) {
    if (this._chargen) return;
    super._onChangeForm(formConfig, event);
  }


  // -- Context ------------------------------------------------------------

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    if (this._chargen) {
      return Object.assign(ctx, { chargenActive: true }, this._chargen.getData());
    }

    ctx.chargenActive = false;
    const actor = this.document;
    const sys = actor.system;
    ctx.system = sys;
    ctx.actor = actor;
    ctx.isVampire = actor.type === 'vampire';
    ctx.targetingEnabled = actor.getFlag('vtm-v20', 'targetingEnabled') === true;

    ctx.attrGroups = [
      { label: game.i18n.localize('VTM.Physical'), traits: this._prep(VTM.attributes.physical, sys.attributes, 'attributes') },
      { label: game.i18n.localize('VTM.Social'), traits: this._prep(VTM.attributes.social, sys.attributes, 'attributes') },
      { label: game.i18n.localize('VTM.Mental'), traits: this._prep(VTM.attributes.mental, sys.attributes, 'attributes') },
    ];
    ctx.abilGroups = [
      { label: game.i18n.localize('VTM.Talents'), traits: this._prep(VTM.abilities.talents, sys.abilities, 'abilities') },
      { label: game.i18n.localize('VTM.Skills'), traits: this._prep(VTM.abilities.skills, sys.abilities, 'abilities') },
      { label: game.i18n.localize('VTM.Knowledges'), traits: this._prep(VTM.abilities.knowledges, sys.abilities, 'abilities') },
    ];

    const items = Array.from(actor.items);
    const potAuto = potenceAutoSuccesses(actor);
    const activatableDisciplines = new Set(['potence']);
    ctx.disciplines = items.filter(i => i.type === 'discipline').sort((a, b) => a.sort - b.sort).map(d => ({
      _id: d._id, name: d.name, img: d.img, system: d.system,
      activatable: activatableDisciplines.has(d.name.toLowerCase()),
      active: isDisciplineActive(actor, d.name),
    }));
    ctx.backgrounds = items.filter(i => i.type === 'background').sort((a, b) => a.sort - b.sort);
    ctx.merits = items.filter(i => i.type === 'merit' && i.system.cost >= 0).sort((a, b) => a.sort - b.sort);
    ctx.flaws = items.filter(i => i.type === 'merit' && i.system.cost < 0).sort((a, b) => a.sort - b.sort);
    ctx.weapons = items.filter(i => i.type === 'weapon').sort((a, b) => a.sort - b.sort).map(w => {
      const req = w.system.requireTrait;
      const min = w.system.requireMin;
      let reqLabel = '', reqUnmet = false;
      if (req && min > 0) {
        const [cat, key] = req.split('.');
        const val = (cat === 'attributes' ? sys.attributes?.[key] : sys.abilities?.[key]) || 0;
        const name = game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`);
        reqLabel = `${name} ${min}`;
        reqUnmet = val < min;
      }
      return { _id: w._id, name: w.name, img: w.img, system: w.system, ammoLabel: ammoLabel(w.system), reqLabel, reqUnmet };
    });
    ctx.armor = items.filter(i => i.type === 'armor').sort((a, b) => a.sort - b.sort);
    ctx.equipment = items.filter(i => i.type === 'equipment').sort((a, b) => a.sort - b.sort);
    ctx.containers = items.filter(i => i.type === 'container').sort((a, b) => a.sort - b.sort);

    // Combat
    const dex = effectiveTraitValue(actor, 'attributes.dexterity');
    const strVal = effectiveStrength(actor);
    const attacks = [];
    attacks.push({
      id: 'unarmed', name: 'Unarmed',
      icon: 'fa-hand-fist',
      pool: `Dex + Brawl (${dex + (sys.abilities?.brawl || 0)})`,
      damage: damageDisplay('Str', strVal, potAuto),
      damageType: 'bashing', damageFormula: 'Str',
      skill: 'abilities.brawl', isRanged: false,
    });
    attacks.push({
      id: 'kick', name: 'Kick',
      img: 'systems/vtm-v20/VTM icons/Actions Icons/high-kick.png',
      pool: `Dex + Brawl (${dex + (sys.abilities?.brawl || 0)})`,
      damage: damageDisplay('Str+1', strVal, potAuto),
      damageType: 'bashing', damageFormula: 'Str+1',
      skill: 'abilities.brawl', isRanged: false, difficultyMod: 1, difficultyLabel: '+1',
    });
    for (const custom of (sys.customAttacks ?? [])) {
      const primary = custom.primary || 'attributes.dexterity';
      const secondary = custom.secondary || '';
      const accuracyMod = Number(custom.accuracyMod) || 0;
      const difficultyMod = Number(custom.difficultyMod) || 0;
      attacks.push({
        id: `custom-${custom.id}`,
        customId: custom.id,
        name: custom.name || 'Custom Maneuver',
        img: custom.img || '',
        icon: 'fa-hand-fist',
        pool: poolDisplay(actor, primary, secondary, accuracyMod),
        damage: damageDisplay(custom.damageFormula, strVal, potAuto),
        damageType: custom.damageType || 'bashing',
        damageFormula: custom.damageFormula || 'Str',
        poolTraits: [primary, secondary].filter(Boolean),
        accuracyMod,
        skill: secondary?.startsWith('abilities.') ? secondary : primary,
        isRanged: false,
        difficultyMod,
        difficultyLabel: difficultyMod ? signed(difficultyMod) : '',
        custom: true,
      });
    }
    for (const w of items.filter(i => i.type === 'weapon' && i.system.equipped)) {
      const isRanged = !!w.system.range;
      const skillKey = isRanged ? 'firearms' : 'melee';
      const skillVal = sys.abilities?.[skillKey] || 0;
      let dmgDisplay = w.system.damage || '0';
      const rawDmg = dmgDisplay.trim().toLowerCase();
      if (rawDmg === 'str' || rawDmg.startsWith('str')) {
        dmgDisplay = damageDisplay(w.system.damage, strVal, potAuto);
      }
      attacks.push({
        id: w.id, name: w.name, img: w.img,
        pool: `Dex + ${isRanged ? 'Firearms' : 'Melee'} (${dex + skillVal})`,
        damage: dmgDisplay,
        damageType: w.system.damageType || 'lethal',
        damageFormula: w.system.damage,
        skill: `abilities.${skillKey}`,
        isRanged, range: w.system.range, capacity: w.system.capacity,
        rate: w.system.rate, ammoLabel: ammoLabel(w.system),
      });
    }
    ctx.attacks = attacks;
    this._attacks = attacks;

    // Declaration + Resolution (inline in combat tab)
    const brawlVal = sys.abilities?.brawl || 0;
    const ath = sys.abilities?.athletics || 0;
    const meleeVal = sys.abilities?.melee || 0;
    ctx.defenses = [
      { name: 'Dodge', defense: 'dodge', icon: 'fa-running', pool: dex + ath, poolLabel: 'Dex + Athletics', trait: 'attributes.dexterity', trait2: 'abilities.athletics' },
      { name: 'Block', defense: 'block', icon: 'fa-fist-raised', pool: dex + brawlVal, poolLabel: 'Dex + Brawl', trait: 'attributes.dexterity', trait2: 'abilities.brawl' },
      { name: 'Parry', defense: 'parry', icon: 'fa-shield-alt', pool: dex + meleeVal, poolLabel: 'Dex + Melee', trait: 'attributes.dexterity', trait2: 'abilities.melee' },
    ];

    // Count how many times each attack/defense is declared (exclude reloads from attack count)
    for (const atk of attacks) {
      atk.declaredCount = this._declActions.filter(a => a.attackId === atk.id && !a.reload).length;
      atk.reloadDeclared = this._declActions.some(a => a.attackId === atk.id && a.reload);
      atk.declared = atk.declaredCount > 0 || atk.reloadDeclared;
    }
    for (const def of ctx.defenses) {
      def.declaredCount = this._declActions.filter(a => a.defense === def.defense).length;
      def.declared = def.declaredCount > 0;
    }
    ctx.declCapturing = this._declCapturing;
    ctx.declFullDefense = this._declFullDefense;
    ctx.declActionCount = this._declActions.length;

    // Custom captured actions (no row to highlight, shown separately)
    const customDecl = this._declActions
      .map((a, i) => (!a.attackId && !a.defense) ? { index: i, name: a.text || 'Custom', poolLabel: a.pool ? `Pool ${a.pool}` : '' } : null)
      .filter(Boolean);
    ctx.declCustomActions = customDecl.length ? customDecl : null;

    let lowestPool = Infinity;
    for (const a of this._declActions) {
      const p = this._declPoolForAction(a);
      if (p < lowestPool) lowestPool = p;
    }
    if (!isFinite(lowestPool)) lowestPool = 0;
    ctx.declLowestPool = Math.max(lowestPool + (sys.woundPenalty || 0), 1);
    ctx.declShowSplit = this._declActions.length > 1;

    // If we're holding a reference to a combat that no longer exists, drop it
    if (this._declCombat && !game.combats.has(this._declCombat.id)) {
      this._declCombat = null;
      this._declCombatant = null;
      this._declActions = [];
      this._declFullDefense = false;
      this._declCapturing = false;
    }
    if (this._resCombat && !game.combats.has(this._resCombat.id)) {
      this._resCombat = null;
      this._resCombatant = null;
      this._resExecuted = new Set();
      this._resSpent = new Map();
      this._resDefenseSpent = new Map();
      this._resTurnDone = false;
    }

    // Recover combat phase state from the active combat if we lost it (e.g. sheet was closed and reopened)
    if (!this._declCombat && !this._resCombat && game.combat) {
      const combat = game.combat;
      const combatant = combat.combatants.find(c => c.actor?.id === actor.id);
      if (combatant) {
        const phase = combat.getFlag('vtm-v20', 'phase');
        if (phase === 'declaration' && !combatant.getFlag('vtm-v20', 'declaration')) {
          // Everyone enters declaration for the whole phase (not just current declarer)
          this._declCombat = combat;
          this._declCombatant = combatant;
        } else if (phase === 'resolution') {
          // Everyone is in resolution mode for the whole round
          this._resCombat = combat;
          this._resCombatant = combatant;
          const resolved = combatant.getFlag('vtm-v20', 'resolved');
          if (resolved) this._resTurnDone = true;
        }
      }
    }

    if (this._declCombat) {
      const phase = this._declCombat.getFlag('vtm-v20', 'phase');
      if (phase !== 'declaration') {
        // Phase moved on, clear declaration state
        this._declCombat = null;
        this._declCombatant = null;
        this._declActions = [];
        this._declFullDefense = false;
        this._declCapturing = false;
        game.vtm._captureAction = null;
      } else if (this._declCombatant?.getFlag('vtm-v20', 'declaration')) {
        // Already confirmed, clear local state
        this._declCombat = null;
        this._declCombatant = null;
        this._declActions = [];
        this._declFullDefense = false;
        game.vtm._captureAction = null;
      }
    }
    ctx.declaring = !!this._declCombat;

    // Resolution phase
    if (this._resCombat) {
      const resPhase = this._resCombat.getFlag('vtm-v20', 'phase');
      if (resPhase !== 'resolution') {
        // Round ended or phase changed, fully clear
        this._resCombat = null;
        this._resCombatant = null;
        this._resExecuted = new Set();
        this._resSpent = new Map();
        this._resDefenseSpent = new Map();
        this._resTurnDone = false;
      }
    }
    ctx.resolving = !!this._resCombat;
    ctx.resTurnDone = this._resTurnDone;
    if (ctx.resolving) {
      const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
      const resActions = decl.actions || [];
      ctx.resTotalPool = decl.totalPool || 0;
      ctx.resMultiAction = resActions.length > 1;

      // Remaining dice = total minus spent on attacks and defense
      let spent = [...this._resSpent.values()].reduce((s, v) => s + v, 0);
      // Defense dice are tracked in _resSpent by index, same as attacks
      ctx.resRemaining = Math.max(ctx.resTotalPool - spent, 0);

      // Reset declaration highlights, mark from flag data instead
      for (const atk of attacks) atk.declared = false;
      for (const def of ctx.defenses) def.declared = false;

      for (const [i, ra] of resActions.entries()) {
        if (ra.attackId) {
          const atk = attacks.find(a => a.id === ra.attackId);
          if (atk) {
            atk.declared = true;
            atk.resIndex = i;
            atk.resExecuted = this._resExecuted.has(i);
          }
        }
        if (ra.defense) {
          const def = ctx.defenses.find(d => d.defense === ra.defense);
          if (def) {
            def.declared = true;
            def.resIndex = i;
            const alloc = ra.alloc || 1;
            const dSpent = this._resDefenseSpent.get(i) || 0;
            def.resExecuted = dSpent >= alloc;
          }
        }
      }

      // Custom resolution actions (no matching row)
      const customRes = resActions
        .map((a, i) => (!a.attackId && !a.defense) ? { index: i, name: a.text || 'Custom Action', executed: this._resExecuted.has(i) } : null)
        .filter(Boolean);
      ctx.resCustomActions = customRes.length ? customRes : null;

      // Only attacks and custom actions need to be executed; defenses are reactive
      ctx.resAllExecuted = resActions.every((a, i) => a.defense || this._resExecuted.has(i));
    }

    ctx.armorPenalty = items
      .filter(i => (i.type === 'armor' || i.type === 'container') && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.penalty || 0), 0);

    // Health
    const healthDescs = {
      bruised: 'No penalties.', hurt: 'No movement hindrance.',
      injured: 'Halve maximum running speed.',
      wounded: 'Move or attack, not both. Doing both costs -1 die per yard moved.',
      mauled: 'May only hobble about.', crippled: 'May only crawl.',
      incapacitated: 'Cannot move. Likely unconscious. At 0 blood, enter Torpor.',
      torpor: 'Deathlike suspended animation. Cannot act. May be revived by blood.',
    };
    ctx.healthTrack = VTM.healthLevels.map(h => ({
      key: h.key,
      label: game.i18n.localize(`VTM.Health${h.key.charAt(0).toUpperCase() + h.key.slice(1)}`),
      penalty: h.penalty, desc: healthDescs[h.key],
      damage: sys.health.levels[h.key],
      damageLabel: ['', '/', 'X', '*'][sys.health.levels[h.key]],
      cssClass: ['', 'bashing', 'lethal', 'aggravated'][sys.health.levels[h.key]]
    }));
    if (actor.type === 'vampire') {
      ctx.healthTrack.push({ key: 'torpor', label: 'Torpor', penalty: null, desc: healthDescs.torpor, infoOnly: true });
    }

    // Soak
    const stamina = sys.attributes?.stamina || 0;
    const fort = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const armorRating = items
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    ctx.soakPool = stamina + fortLevel + armorRating;
    const soakParts = [`Sta ${stamina}`];
    if (fortLevel) soakParts.push(`Fort ${fortLevel}`);
    if (armorRating) soakParts.push(`Armor ${armorRating}`);
    ctx.soakLabel = soakParts.join(' + ');

    ctx.bloodPct = sys.blood ? (sys.blood.max > 0 ? Math.round((sys.blood.value / sys.blood.max) * 100) : 0) : 0;
    ctx.bloodPerTurn = sys.bloodPerTurn || 1;
    ctx.traitMax = sys.traitMax || 5;
    ctx.woundPenalty = sys.woundPenalty || 0;

    const dollars = sys.money?.dollars ?? 0;
    const cents = sys.money?.cents ?? 0;
    ctx.moneyDisplay = `${dollars.toLocaleString()}.${String(cents).padStart(2, '0')}`;

    // Movement (V20 p.258) - uses raw Dex, not effective (Celerity adds dice, not yards)
    const rawDex = sys.attributes?.dexterity || 0;
    const walk = 7, jog = 12 + rawDex, run = 20 + (3 * rawDex);
    ctx.movement = { walk, jog, run, hobble: 3, crawl: 1 };
    const healthKeys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];
    let worstLevel = null;
    for (let i = healthKeys.length - 1; i >= 0; i--) {
      if (sys.health.levels[healthKeys[i]] > 0) { worstLevel = healthKeys[i]; break; }
    }
    switch (worstLevel) {
      case 'incapacitated': ctx.curMove = { label: 'None', value: 0 }; break;
      case 'crippled':      ctx.curMove = { label: 'Crawl', value: 1 }; break;
      case 'mauled':        ctx.curMove = { label: 'Hobble', value: 3 }; break;
      case 'wounded':       ctx.curMove = { label: 'Walk', value: walk }; break;
      case 'injured':       ctx.curMove = { label: 'Jog', value: jog }; break;
      default:              ctx.curMove = { label: 'Run', value: run }; break;
    }

    ctx.config = VTM;

    // Path, bearing, virtues
    const pathKey = sys.pathName || 'Humanity';
    const pathInfo = VTM.paths[pathKey] || VTM.paths['Humanity'];
    ctx.pathChoices = Object.keys(VTM.paths);
    ctx.virtueLabels = { ...pathInfo.virtues, courage: 'Courage' };
    ctx.bearingName = pathInfo.bearing;
    ctx.bearingLabel = VTM.bearingLabels[sys.humanity] ?? '';
    const mod = VTM.bearingModifiers[sys.humanity];
    if (mod === null) ctx.bearingMod = null;
    else if (mod < 0) ctx.bearingMod = `${mod} difficulty`;
    else if (mod > 0) ctx.bearingMod = `+${mod} difficulty`;
    else ctx.bearingMod = '';

    ctx.wpAdjective = TRAIT_DESCRIPTIONS.willpower[sys.willpower.max - 1] || '';

    const locked = actor.getFlag('vtm-v20', 'sheetLocked') !== false;
    ctx.isGM = game.user.isGM;
    ctx.lockState = locked;
    ctx.sheetLocked = locked && !game.user.isGM;

    return ctx;
  }

  _prep(keys, data, prefix) {
    return keys.map(key => ({
      key,
      label: game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`),
      value: data[key] || 0,
      path: `system.${prefix}.${key}`,
      rollKey: `${prefix}.${key}`
    }));
  }


  // -- Render & listeners -------------------------------------------------

  async _onRender(context, options) {
    await super._onRender(context, options);
    const el = this.element;

    el.classList.toggle('chargen-mode', !!this._chargen);
    const content = el.querySelector('.window-content');
    if (this._closingChargen) content?.classList.add('chargen-fade-out');
    else content?.classList.remove('chargen-fade-out');
    if (!this._chargen && this._fadeInAfterChargen && content) {
      this._fadeInAfterChargen = false;
      content.classList.add('chargen-entering');
      content.addEventListener('animationend', () => content.classList.remove('chargen-entering'), { once: true });
    }
    const locked = this.document.getFlag('vtm-v20', 'sheetLocked') !== false;
    el.classList.toggle('sheet-locked', locked && !game.user.isGM);

    this._syncChargenButton();
    this._syncCompactButton();
    el.classList.toggle('compact-combat', this._compactMode);

    if (this._chargen) {
      this._chargen.activateListeners(el);
      return;
    }

    // Bio pages work for all users (editing gated inside the method)
    this._setupBioPages(el);

    if (!this.isEditable) return;

    const canEdit = game.user.isGM || !locked;

    // Tabs
    el.querySelectorAll('.sheet-tabs .item[data-tab]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === this._tab);
      tab.addEventListener('click', ev => {
        ev.preventDefault();
        this._tab = tab.dataset.tab;
        this._syncTabs();
      });
    });
    el.querySelectorAll('.sheet-body > .tab').forEach(p =>
      p.classList.toggle('active', p.dataset.tab === this._tab));
    el.querySelector('.sheet-body')?.classList.toggle('bio-active', this._tab === 'bio');

    // Lock
    el.querySelector('.sheet-lock')?.addEventListener('click', () => {
      this.document.setFlag('vtm-v20', 'sheetLocked', !locked);
    });

    el.querySelector('.show-portrait')?.addEventListener('click', () => {
      const src = this.document.img;
      const name = this.document.name;
      game.vtm.openLightbox(src, name);
      game.socket.emit('system.vtm-v20', { action: 'showPortrait', src, name });
    });

    // Stat dots
    if (canEdit) {
      el.querySelectorAll('.dot-row:not(.item-dots) .dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const val = parseInt(dot.dataset.value);
          const path = dot.closest('.dot-row').dataset.path;
          const cur = foundry.utils.getProperty(this.document, path);
          this.document.update({ [path]: val === cur ? val - 1 : val });
        });
      });
      el.querySelectorAll('.item-dots .dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const val = parseInt(dot.dataset.value);
          const row = dot.closest('[data-item-id]');
          const item = this.document.items.get(row.dataset.itemId);
          const field = dot.closest('.dot-row').dataset.field;
          const cur = foundry.utils.getProperty(item, field);
          item.update({ [field]: val === cur ? val - 1 : val });
        });
      });
    }

    // Health, WP temp, blood (always interactive)
    el.querySelectorAll('.health-box').forEach(box =>
      box.addEventListener('click', () => {
        const level = box.dataset.level;
        const cur = this.document.system.health.levels[level];
        this.document.update({ [`system.health.levels.${level}`]: (cur + 1) % 4 });
      }));

    el.querySelectorAll('.wp-track .square').forEach(sq =>
      sq.addEventListener('click', () => {
        const val = parseInt(sq.dataset.value);
        const cur = this.document.system.willpower.value;
        this.document.update({ 'system.willpower.value': val === cur ? val - 1 : val });
      }));

    // -- Trait selection & quick-roll dice button ---
    // The popup lives on document.body so it escapes the sheet's overflow:hidden
    if (this._rollQuickEl) this._rollQuickEl.remove();
    const rqEl = document.createElement('div');
    rqEl.className = 'roll-quick-float';
    rqEl.innerHTML = '<button type="button" title="Roll"><i class="fas fa-dice-d20"></i></button>';
    document.body.appendChild(rqEl);
    this._rollQuickEl = rqEl;

    const positionDice = () => {
      const rect = this.element.getBoundingClientRect();
      rqEl.style.top = `${rect.top + rect.height / 2}px`;
      rqEl.style.left = `${rect.right + 10}px`;
    };

    const showDice = () => { positionDice(); rqEl.classList.add('visible'); };
    const hideDice = () => { rqEl.classList.remove('visible'); };

    const clearSelect = () => {
      el.querySelectorAll('.trait-row.selected').forEach(s => s.classList.remove('selected'));
      this._rollSelect = null;
      hideDice();
    };

    const doRoll = (attr, abil) => {
      clearSelect();
      game.vtm.rollDicePool(this.document, {
        trait: attr?.key,
        trait2: abil?.key,
        label: [attr?.label, abil?.label].filter(Boolean).join(' + ')
      });
    };

    el.querySelectorAll('.rollable').forEach(lbl => {
      lbl.addEventListener('click', () => {
        const key = lbl.dataset.roll;
        const label = lbl.dataset.label || key;
        const isAttr = key.startsWith('attributes.');
        const isAbil = key.startsWith('abilities.');

        // Virtues / other: direct roll, no selection
        if (!isAttr && !isAbil) {
          clearSelect();
          game.vtm.rollDicePool(this.document, { trait: key, label });
          return;
        }

        const type = isAttr ? 'attr' : 'abil';
        const cur = this._rollSelect;

        // Clicking the already-selected trait: deselect
        if (cur && cur.key === key) { clearSelect(); return; }

        // One attr + one abil: open the roll dialog with both
        if (cur && cur.type !== type) {
          const attr = type === 'attr' ? { key, label } : cur;
          const abil = type === 'abil' ? { key, label } : cur;
          doRoll(attr, abil);
          return;
        }

        // Same type or first pick: (re)select this trait
        el.querySelectorAll('.trait-row.selected').forEach(s => s.classList.remove('selected'));
        lbl.closest('.trait-row').classList.add('selected');
        this._rollSelect = { key, label, type };
        showDice();
      });
    });

    // Dice button: roll with the single selected trait
    rqEl.querySelector('button').addEventListener('click', () => {
      const sel = this._rollSelect;
      if (!sel) return;
      doRoll(sel.type === 'attr' ? sel : null, sel.type === 'abil' ? sel : null);
    });

    // Click anywhere else on the sheet clears the selection
    el.addEventListener('click', e => {
      if (!e.target.closest('.rollable')) clearSelect();
    });

    // Restore selection that survived a re-render
    if (this._rollSelect) {
      const prev = el.querySelector(`.trait-label[data-roll="${this._rollSelect.key}"]`);
      if (prev) { prev.closest('.trait-row').classList.add('selected'); showDice(); }
      else this._rollSelect = null;
    }

    el.querySelectorAll('.soak-btn').forEach(btn =>
      btn.addEventListener('click', () => this._rollSoak()));

    el.querySelectorAll('.defense-roll-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        // Declaration phase: add defense to declared actions (one per type)
        if (this._declCombat && !this._declFullDefense) {
          const defType = btn.dataset.defense || btn.dataset.label?.toLowerCase() || 'dodge';
          if (this._declActions.some(a => a.defense === defType)) {
            ui.notifications.warn(`${btn.dataset.label || 'Defense'} already declared.`);
            return;
          }
          this._saveAllocations();
          this._declActions.push({
            attackId: null,
            text: btn.dataset.label || 'Defense',
            defense: defType,
            alloc: 1,
          });
          this.render();
          return;
        }

        // Resolution phase: defenses are handled via the chat defend button
        if (this._resCombat) return;

        game.vtm.rollDicePool(this.document, {
          trait: btn.dataset.trait,
          trait2: btn.dataset.trait2,
          label: btn.dataset.label,
        });
      }));

    el.querySelector('.jump-btn')?.addEventListener('click', () => this._rollJump());
    el.querySelector('.fall-btn')?.addEventListener('click', () => this._rollFalling());

    el.querySelector('.heal-btn')?.addEventListener('click', () => this._healWithBlood());

    el.querySelectorAll('.discipline-activate').forEach(btn => {
      btn.addEventListener('click', () => this._toggleDiscipline(btn.dataset.itemId));
    });

    el.querySelector('.money-edit')?.addEventListener('click', () => this._editMoney());

    el.querySelector('.blood-spend')?.addEventListener('click', () => {
      const cur = this.document.system.blood.value;
      if (cur > 0) {
        this._playHealAnimation();
        this.document.update({ 'system.blood.value': cur - 1 });
      }
    });
    el.querySelector('.blood-gain')?.addEventListener('click', () => {
      const { value, max } = this.document.system.blood;
      if (value < max) this.document.update({ 'system.blood.value': value + 1 });
    });

    el.querySelectorAll('.item-equip').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = btn.closest('[data-item-id]').dataset.itemId;
        const item = this.document.items.get(id);
        if (!item) return;
        if (!item.system.equipped && item.type === 'weapon') {
          const req = item.system.requireTrait;
          const min = item.system.requireMin;
          if (req && min > 0) {
            const [cat, key] = req.split('.');
            const sys = this.document.system;
            const val = (cat === 'attributes' ? sys.attributes?.[key] : sys.abilities?.[key]) || 0;
            if (val < min) {
              const name = game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`);
              ui.notifications.warn(`${this.document.name} needs ${name} ${min} to wield ${item.name} (current: ${val}).`);
              return;
            }
          }
        }
        item.update({ 'system.equipped': !item.system.equipped });
      }));

    el.querySelectorAll('.attack-btn:not(.reload-btn):not(.defense-roll-btn)').forEach(btn =>
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const attackId = btn.dataset.attackId;
        try {
          // Declaration phase: add this attack to the declaration
          if (this._declCombat && !this._declFullDefense) {
            const atk = this._attacks?.find(a => a.id === attackId);
            const rate = parseInt(atk?.rate) || 0;
            if (rate > 0) {
              const used = this._declActions.filter(a => a.attackId === attackId && !a.reload).length;
              if (used >= rate) {
                ui.notifications.warn(`${atk.name}: rate of fire is ${rate}.`);
                return;
              }
            }
            this._saveAllocations();
            this._declActions.push({ attackId, text: '', alloc: 1 });
            this.render();
            return;
          }
          // Resolution phase: use the declared pool (skip reloads, they have their own button)
          if (this._resCombat && this._resCombatant) {
            if (!this._isMyResTurn()) return;
            const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
            const idx = (decl.actions || []).findIndex((a, i) => a.attackId === attackId && !a.reload && !this._resExecuted.has(i));
            if (idx >= 0) {
              await this._executeResAction(idx);
              return;
            }
          }
          // Normal (outside combat): do the attack
          const atk = this._attacks?.find(a => a.id === attackId);
          if (!atk) return;
          const targeting = this._getTargetingData();
          const spent = await this._spendAttackAmmo(atk);
          if (spent) await game.vtm.rollAttack(this.document, atk, { targeting });
        } catch (err) {
          console.error('VtM V20 | Attack failed', err);
          ui.notifications.error('Attack failed. Check the console for details.');
        } finally {
          btn.disabled = false;
        }
      }));

    el.querySelectorAll('.reload-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const attackId = btn.dataset.attackId;
        try {
          // Declaration phase: add a reload action (one per weapon max)
          if (this._declCombat && !this._declFullDefense) {
            if (this._declActions.some(a => a.attackId === attackId && a.reload)) {
              ui.notifications.warn('Reload already declared for this weapon.');
              return;
            }
            this._saveAllocations();
            const atk = this._attacks?.find(a => a.id === attackId);
            this._declActions.push({ attackId, text: `Reload ${atk?.name || 'weapon'}`, reload: true, alloc: 1 });
            this.render();
            return;
          }
          // Resolution phase: execute reload action
          if (this._resCombat && this._resCombatant) {
            if (!this._isMyResTurn()) return;
            const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
            const idx = (decl.actions || []).findIndex((a, i) => a.reload && a.attackId === attackId && !this._resExecuted.has(i));
            if (idx >= 0) {
              await this._executeResAction(idx);
              return;
            }
          }
          // Normal: just reload
          const atk = this._attacks?.find(a => a.id === attackId);
          if (atk) await this._reloadAttackWeapon(atk);
        } finally {
          btn.disabled = false;
        }
      }));

    el.querySelector('.targeting-toggle')?.addEventListener('click', async ev => {
      ev.preventDefault();
      const enabled = this.document.getFlag('vtm-v20', 'targetingEnabled') === true;
      await this.document.setFlag('vtm-v20', 'targetingEnabled', !enabled);
      this._syncTargetingDrawer(!enabled);
    });

    // Sync drawer visibility on render
    this._syncTargetingDrawer(this.document.getFlag('vtm-v20', 'targetingEnabled') === true);

    this._syncCombatDrawer();

    this._setupPortrait(el);

    if (canEdit) {
      el.querySelector('.attack-create')?.addEventListener('click', ev => {
        ev.preventDefault();
        this._createCustomAttackDialog();
      });

      el.querySelectorAll('.attack-delete').forEach(btn =>
        btn.addEventListener('click', async () => {
          const id = btn.dataset.customId;
          const attacks = this._customAttackData().filter(a => a.id !== id);
          await this.document.update({ 'system.customAttacks': attacks });
        }));

      el.querySelectorAll('.item-create').forEach(btn =>
        btn.addEventListener('click', () => {
          const type = btn.dataset.type;
          this.document.createEmbeddedDocuments('Item', [{
            name: game.i18n.localize(`VTM.New${type.charAt(0).toUpperCase() + type.slice(1)}`),
            type
          }]);
        }));

      el.querySelectorAll('.item-edit').forEach(btn =>
        btn.addEventListener('click', () => {
          const li = btn.closest('[data-item-id]');
          const item = this.document.items.get(li.dataset.itemId);
          if (!item) return;
          const nameEl = li.querySelector('.item-name');
          if (!nameEl) return;
          const input = document.createElement('input');
          input.type = 'text';
          input.value = item.name;
          input.className = 'item-name-input';
          nameEl.replaceWith(input);
          input.focus();
          input.select();
          const save = () => {
            const val = input.value.trim();
            if (val && val !== item.name) item.update({ name: val });
            else this.render();
          };
          input.addEventListener('blur', save);
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') this.render();
          });
        }));

      el.querySelectorAll('.item-delete').forEach(btn =>
        btn.addEventListener('click', async () => {
          const id = btn.closest('[data-item-id]').dataset.itemId;
          const item = this.document.items.get(id);
          if (!item) return;
          if (item.type === 'discipline' || item.type === 'background') {
            const yes = await Dialog.confirm({
              title: `Delete ${item.name}?`,
              content: `<p>Are you sure you want to delete <strong>${item.name}</strong>? This cannot be undone.</p>`,
            });
            if (!yes) return;
          }
          item.delete();
        }));

      el.querySelectorAll('.bg-notes').forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
        ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => {
          this.document.items.get(ta.dataset.itemId)?.update({ 'system.notes': ta.value });
        });
      });
    }

    el.querySelectorAll('.item-open').forEach(nameEl =>
      nameEl.addEventListener('click', () => {
        const id = nameEl.closest('[data-item-id]').dataset.itemId;
        this.document.items.get(id)?.sheet.render(true);
      }));

    this._setupTraitTips(el);
  }

  _syncTabs() {
    const el = this.element;
    el.querySelectorAll('.sheet-tabs .item[data-tab]').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === this._tab));
    el.querySelectorAll('.sheet-body > .tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === this._tab));
    el.querySelector('.sheet-body')?.classList.toggle('bio-active', this._tab === 'bio');

    // Combat drawer stays visible on any tab during active declaration/resolution
    const onCombat = this._tab === 'combat';
    if (this._combatDrawer) {
      const hasPhase = !!this._declCombat || !!this._resCombat;
      this._combatDrawer.classList.toggle('open', hasPhase && this._combatDrawer.children.length > 0);
    }
    if (this._targetingDrawer) this._targetingDrawer.classList.toggle('open', onCombat && this.document.getFlag('vtm-v20', 'targetingEnabled') === true);
  }


  // -- Chargen integration ------------------------------------------------

  static #onToggleChargen() {
    if (this._chargen) this._closeChargen();
    else this._openChargen();
  }

  _openChargen() {
    if (this._chargen || this.document.type !== 'vampire') return;
    const body = this.element.querySelector('.window-content') || this.element.querySelector('form');
    if (!body) return;
    body.classList.add('chargen-fade-out');
    body.addEventListener('animationend', () => {
      this._chargen = new ChargenWizard(this.document, this);
      this.render();
    }, { once: true });
  }

  _closeChargen() {
    if (!this._chargen || this._closingChargen) return;
    this._closingChargen = true;

    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      this._chargen?.destroy();
      this._chargen = null;
      this._closingChargen = false;
      this._fadeInAfterChargen = true;
      this.render();
    };

    const body = this.element.querySelector('.window-content') || this.element.querySelector('form');
    if (!body) return complete();
    body.classList.add('chargen-fade-out');
    body.addEventListener('animationend', complete, { once: true });

    // Actor updates during finishing can rerender and replace the animated node.
    setTimeout(complete, 300);
  }

  _syncChargenButton() {
    // Header is rendered once, so swap the button manually
    const btn = this.element.querySelector(
      '[data-action="toggleChargen"]'
    );
    if (!btn) return;
    const icon = btn.querySelector('i') || btn;
    if (this._chargen) {
      icon.className = 'fas fa-arrow-left';
      btn.setAttribute('aria-label', 'Exit');
      btn.title = 'Exit';
    } else {
      icon.className = 'fas fa-magic';
      btn.setAttribute('aria-label', 'Chargen');
      btn.title = 'Chargen';
    }
  }

  static #onToggleCompact() {
    if (this._chargen) return;
    this._compactMode = !this._compactMode;

    if (this._compactMode) {
      this._fullSize = { width: this.position.width, height: this.position.height };
      this.setPosition({ width: 650, height: 598 });
    } else {
      if (this._fullSize) this.setPosition(this._fullSize);
      this._fullSize = null;
    }
    this.render();
  }

  _syncCompactButton() {
    let btn = this.element.querySelector('.compact-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'header-control compact-toggle';
      btn.dataset.action = 'toggleCompact';
      btn.innerHTML = '<i class="fas fa-crosshairs"></i>';
      const header = this.element.querySelector(':scope > header');
      const close = header?.querySelector('.window-close, [data-action="close"]');
      if (close) close.before(btn);
      else header?.appendChild(btn);
    }
    btn.style.display = this._chargen ? 'none' : '';
    const icon = btn.querySelector('i');
    if (this._compactMode) {
      icon.className = 'fas fa-expand-alt';
      btn.title = 'Full Sheet';
    } else {
      icon.className = 'fas fa-crosshairs';
      btn.title = 'Combat Mode';
    }
  }

  async _onDropItem(event, item) {
    if (this._chargen) return this._chargen.handleDrop(item, item.uuid) ? null : super._onDropItem(event, item);
    return super._onDropItem(event, item);
  }

  async close(options = {}) {
    if (this._chargen) { this._chargen.destroy(); this._chargen = null; }
    if (this._traitTip) this._traitTip.remove();
    if (this._rollQuickEl) { this._rollQuickEl.remove(); this._rollQuickEl = null; }
    if (this._declCapturing) {
      this._declCapturing = false;
      game.vtm._captureAction = null;
    }
    if (this._targetingDrawer) {
      this._targetingDrawer.remove();
      this._targetingDrawer = null;
    }
    if (this._combatDrawer) {
      this._combatDrawer.remove();
      this._combatDrawer = null;
    }
    for (const fn of this._bioSaveFns) fn();
    return super.close(options);
  }

  async _spendAttackAmmo(atk) {
    if (!atk.isRanged || atk.id === 'unarmed') return true;

    const item = this.document.items.get(atk.id);
    if (!item || item.type !== 'weapon') return true;

    const capacity = parseAmmoCapacity(item.system.capacity);
    if (capacity === null) return true;

    const current = ammoRemaining(item.system);
    if (current <= 0) {
      ui.notifications.warn(`${item.name} is out of ammunition.`);
      return false;
    }

    await item.update({ 'system.ammo': String(current - 1) });
    return true;
  }

  static TARGETING_CHOICES = {
    medium: { label: 'Medium', hint: 'Limb, briefcase', difficultyMod: 1, damageMod: 0 },
    small: { label: 'Small', hint: 'Hand, head, cellphone', difficultyMod: 2, damageMod: 1 },
    precise: { label: 'Precise', hint: 'Eye, heart, lock', difficultyMod: 3, damageMod: 2 },
  };

  _getTargetingData() {
    if (this.document.getFlag('vtm-v20', 'targetingEnabled') !== true) return null;
    const choices = VampireSheet.TARGETING_CHOICES;
    const c = choices[this._targetingChoice] || choices.medium;
    return { size: this._targetingChoice, ...c };
  }

  _syncTargetingDrawer(open) {
    if (this._targetingDrawer && !this._targetingDrawer.isConnected) {
      this._targetingDrawer = null;
    }
    if (open) {
      if (!this._targetingDrawer) this._buildTargetingDrawer();
      requestAnimationFrame(() => {
        if (!this._targetingDrawer) return;
        // In compact mode, position below the combat drawer so they don't overlap
        if (this._compactMode && this._combatDrawer?.classList.contains('open')) {
          const appRect = this.element.getBoundingClientRect();
          const drawerRect = this._combatDrawer.getBoundingClientRect();
          this._targetingDrawer.style.top = `${drawerRect.bottom - appRect.top + 4}px`;
        } else {
          const btn = this.element.querySelector('.targeting-toggle');
          if (btn) {
            const appRect = this.element.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            const zoom = this._compactMode ? 0.85 : 1;
            this._targetingDrawer.style.top = `${(btnRect.top - appRect.top) / zoom}px`;
          }
        }
        this._targetingDrawer.classList.add('open');
      });
    } else if (this._targetingDrawer) {
      this._targetingDrawer.classList.remove('open');
    }
  }

  _buildTargetingDrawer() {
    if (this._targetingDrawer) return;
    const choices = VampireSheet.TARGETING_CHOICES;
    const drawer = document.createElement('div');
    drawer.className = 'targeting-drawer';
    drawer.innerHTML = `
      <div class="targeting-drawer-header">
        <i class="fas fa-bullseye"></i> Targeting
      </div>
      ${Object.entries(choices).map(([key, c]) => `
        <label class="targeting-drawer-opt ${key === this._targetingChoice ? 'selected' : ''}" data-key="${key}">
          <span class="opt-name">${c.label}</span>
          <span class="opt-mod">Diff +${c.difficultyMod}${c.damageMod ? `, Dmg +${c.damageMod}` : ''}</span>
          <span class="opt-hint">${c.hint}</span>
        </label>
      `).join('')}
    `;

    drawer.querySelectorAll('.targeting-drawer-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        this._targetingChoice = opt.dataset.key;
        drawer.querySelectorAll('.targeting-drawer-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    this.element.appendChild(drawer);
    this._targetingDrawer = drawer;
  }

  _syncCombatDrawer() {
    if (this._combatDrawer && !this._combatDrawer.isConnected) {
      this._combatDrawer = null;
    }

    const isDeclaring = !!this._declCombat;
    const isResolving = !!this._resCombat;

    if (!isDeclaring && !isResolving) {
      if (this._combatDrawer) this._combatDrawer.classList.remove('open');
      return;
    }

    if (!this._combatDrawer) {
      const wrapper = document.createElement('div');
      wrapper.className = 'combat-drawer';
      this.element.appendChild(wrapper);
      this._combatDrawer = wrapper;
    }

    const savedText = this._combatDrawer.querySelector('[name="declaration-text"]')?.value || '';
    if (!isResolving) this._saveAllocations();

    this._combatDrawer.innerHTML = isResolving
      ? this._buildResolutionPanel()
      : this._buildDeclarationPanel();

    const ta = this._combatDrawer.querySelector('[name="declaration-text"]');
    if (ta && savedText) ta.value = savedText;

    // Live-update allocation summary as user types
    if (!isResolving) this._bindAllocListeners();

    requestAnimationFrame(() => {
      if (!this._combatDrawer) return;
      const anchor = this._compactMode
        ? this.element.querySelector('.sheet-tabs')
        : (this.element.querySelector('.sheet-lock') || this.element.querySelector('.char-name'));
      if (anchor) {
        const appRect = this.element.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const zoom = this._compactMode ? 0.85 : 1;
        this._combatDrawer.style.top = `${(anchorRect.top - appRect.top) / zoom}px`;
      }
      this._combatDrawer.classList.add('open');
    });
  }

  _buildDeclarationPanel() {
    const actions = this._declActions;
    const sys = this.document.system;
    const wp = sys.woundPenalty || 0;
    const fullDef = this._declFullDefense;
    const currentDeclarer = this._declCombat?.getFlag('vtm-v20', 'currentDeclarer');
    const isMyTurn = currentDeclarer === this._declCombatant?.id;

    let h = '<div class="decl-panel active">';
    h += '<div class="decl-phase-banner"><i class="fas fa-scroll"></i> Declaration Phase</div>';
    h += '<div class="decl-section"><label>Describe your intent</label>';
    h += '<textarea name="declaration-text" placeholder="What do you want to do this turn?"></textarea></div>';

    if (fullDef) {
      h += '<div class="decl-split-info">';
      h += '<i class="fas fa-shield-alt"></i> <b>Entire Turn Defense</b>: full pool on first defense, -1 die per additional defense.';
      h += '</div>';
    } else {
      let lowestPool = Infinity;
      for (const a of actions) {
        const p = this._declPoolForAction(a);
        if (p < lowestPool) lowestPool = p;
      }
      if (!isFinite(lowestPool)) lowestPool = 0;
      const totalPool = Math.max(lowestPool + wp, 1);
      const multi = actions.length > 1;
      const allocated = actions.reduce((sum, a) => sum + (a.alloc || 0), 0);
      const remaining = totalPool - allocated;

      const actionEntries = actions.map((a, i) => {
        let name = a.text || 'Action';
        if (a.defense) name = `${a.text} (Defense)`;
        else if (a.reload) name = a.text || 'Reload';
        else if (a.attackId) {
          const atk = this._getAttackById(a.attackId);
          name = atk?.name || a.attackId;
        }
        const pool = this._declPoolForAction(a);
        return { i, name, pool, alloc: a.alloc || 1 };
      });

      if (actionEntries.length) {
        h += '<div class="decl-section"><label>Declared Actions</label><div class="decl-actions">';
        for (const e of actionEntries) {
          h += '<div class="decl-action-entry">';
          h += `<span class="decl-action-name">${e.name}</span>`;
          h += `<span class="decl-action-pool">Pool ${e.pool}</span>`;
          if (multi) {
            h += `<input type="number" class="decl-alloc-input" name="alloc-${e.i}" value="${e.alloc}" min="0" max="${totalPool}" />`;
          }
          h += `<button type="button" class="decl-remove" data-action="declRemoveAction" data-index="${e.i}"><i class="fas fa-times"></i></button>`;
          h += '</div>';
        }
        h += '</div></div>';
      }

      if (multi) {
        const wpBit = wp ? ` (wound ${wp})` : '';
        const overBudget = remaining < 0;
        h += '<div class="decl-split-info">';
        h += `<i class="fas fa-info-circle"></i> Lowest pool${wpBit}: <b>${totalPool}</b>`;
        h += ` | Allocated: <b class="${overBudget ? 'over-budget' : ''}">${allocated}</b> / ${totalPool}`;
        if (remaining > 0) h += ` (<b>${remaining}</b> unspent)`;
        else if (overBudget) h += ` <span class="over-budget">(${Math.abs(remaining)} over!)</span>`;
        h += '</div>';
      }
    }

    h += '<div class="decl-buttons">';
    if (!fullDef) {
      if (this._declCapturing) {
        h += '<button type="button" data-action="declCancelCapture" class="decl-btn capturing"><i class="fas fa-crosshairs"></i> Roll any trait to capture it...</button>';
      } else {
        h += '<button type="button" data-action="declAddAction" class="decl-btn"><i class="fas fa-plus"></i> Add Custom Action</button>';
      }
    }
    if (isMyTurn) {
      h += '<button type="button" data-action="declConfirm" class="decl-btn confirm"><i class="fas fa-check"></i> Confirm Declaration</button>';
    } else {
      h += '<button type="button" class="decl-btn confirm" disabled><i class="fas fa-hourglass-half"></i> Not your turn</button>';
    }
    h += '</div></div>';
    return h;
  }

  _buildResolutionPanel() {
    const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
    const actions = decl.actions || [];
    const total = decl.totalPool || 0;
    const fullDef = decl.fullDefense || false;
    let spent = [...this._resSpent.values()].reduce((s, v) => s + v, 0);
    const remaining = Math.max(total - spent, 0);
    const turnDone = this._resTurnDone;

    // Is it currently this combatant's turn to act?
    const currentResolver = this._resCombat.getFlag('vtm-v20', 'currentResolver');
    const isMyTurn = currentResolver === this._resCombatant?.id && !turnDone;

    // Build defense status (shared between all panel modes)
    const defActions = actions
      .map((a, i) => {
        if (!a.defense) return null;
        const alloc = a.alloc || 1;
        const spent = this._resDefenseSpent.get(i) || 0;
        return { i, name: a.text || a.defense, alloc, spent, remaining: alloc - spent };
      })
      .filter(Boolean);

    // Helper: render defenses block
    const defBlock = () => {
      if (!defActions.length) return '';
      let s = '<div class="res-actions"><label style="font-size:10px;color:#888;margin-bottom:2px;">Defenses (used from chat)</label>';
      for (const d of defActions) {
        const depleted = d.remaining <= 0;
        s += `<div class="res-action-entry ${depleted ? 'executed' : ''}">`;
        s += `<span class="res-action-name">${d.name} [${d.remaining}/${d.alloc}d]</span>`;
        s += depleted
          ? '<span class="res-done-label"><i class="fas fa-check"></i> Spent</span>'
          : '<span class="res-ready-label"><i class="fas fa-shield-alt"></i> Ready</span>';
        s += '</div>';
      }
      s += '</div>';
      return s;
    };

    // Helper: render End Turn button area
    const endTurnBlock = (allDone = true) => {
      let s = '<div class="res-buttons">';
      if (turnDone) {
        // Already ended, no button needed
      } else if (isMyTurn) {
        s += `<button type="button" data-action="resFinish" class="res-btn finish" ${allDone ? '' : 'disabled'}><i class="fas fa-flag-checkered"></i> End Turn</button>`;
      } else {
        s += '<button type="button" class="res-btn finish" disabled><i class="fas fa-hourglass-half"></i> Not your turn</button>';
      }
      s += '</div>';
      return s;
    };

    if (fullDef) {
      const defensesUsed = this._resFullDefCount || 0;
      let h = '<div class="res-panel active">';
      h += '<div class="res-phase-banner"><i class="fas fa-shield-alt"></i> Full Defense</div>';
      h += '<div class="res-pool-info">Defenses used: <b>' + defensesUsed + '</b> (-' + defensesUsed + ' dice penalty)</div>';
      h += '<div class="decl-split-info"><i class="fas fa-info-circle"></i> Choose a defense from the chat when attacked. Full pool on the first, -1 die each time after.</div>';
      h += endTurnBlock();
      h += '</div>';
      return h;
    }

    // Waiting state (turn done or not yet our turn, but not full defense)
    if (turnDone || !isMyTurn) {
      let h = '<div class="res-panel active">';
      h += turnDone
        ? '<div class="res-phase-banner"><i class="fas fa-hourglass-half"></i> Waiting for round to end</div>'
        : '<div class="res-phase-banner"><i class="fas fa-hourglass-half"></i> Resolution Phase</div>';
      h += `<div class="res-pool-info">Dice remaining: <b>${remaining}</b> / ${total}</div>`;
      h += defBlock();
      h += endTurnBlock();
      h += '</div>';
      return h;
    }

    // Active resolution: it's our turn, show full panel
    const customs = actions
      .map((a, i) => (!a.attackId && !a.defense) ? { i, name: a.text || 'Custom Action', done: this._resExecuted.has(i) } : null)
      .filter(Boolean);
    const reloads = actions
      .map((a, i) => a.reload ? { i, name: a.text || 'Reload', done: this._resExecuted.has(i) } : null)
      .filter(Boolean);
    const allDone = actions.every((a, i) => a.defense || this._resExecuted.has(i));

    let h = '<div class="res-panel active">';
    h += '<div class="res-phase-banner"><i class="fas fa-fist-raised"></i> Resolution Phase</div>';
    h += `<div class="res-pool-info">Dice Pool: <b>${remaining}</b> / ${total}</div>`;

    h += defBlock();

    if (reloads.length) {
      h += '<div class="res-actions">';
      for (const r of reloads) {
        h += `<div class="res-action-entry ${r.done ? 'executed' : ''}">`;
        h += `<span class="res-action-name"><i class="fas fa-redo"></i> ${r.name}</span>`;
        if (r.done) {
          h += '<span class="res-done-label"><i class="fas fa-check"></i> Done</span>';
        } else {
          h += `<button type="button" data-action="resExecute" data-index="${r.i}" class="res-roll-btn"><i class="fas fa-redo"></i> Reload</button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    }

    if (customs.length) {
      h += '<div class="res-actions">';
      for (const c of customs) {
        h += `<div class="res-action-entry ${c.done ? 'executed' : ''}">`;
        h += `<span class="res-action-name">${c.name}</span>`;
        if (c.done) {
          h += '<span class="res-done-label"><i class="fas fa-check"></i> Done</span>';
        } else {
          h += `<button type="button" data-action="resExecute" data-index="${c.i}" class="res-roll-btn"><i class="fas fa-dice-d20"></i> Roll</button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    }

    h += endTurnBlock(allDone);
    h += '</div>';
    return h;
  }

  async _reloadAttackWeapon(atk) {
    if (!atk.isRanged || atk.id === 'unarmed') return;

    const item = this.document.items.get(atk.id);
    if (!item || item.type !== 'weapon') return;

    const capacity = parseAmmoCapacity(item.system.capacity);
    if (capacity === null) {
      ui.notifications.warn(`${item.name} has no magazine capacity to reload.`);
      return;
    }

    await item.update({ 'system.ammo': String(capacity) });
  }


  // -- Bio tab (paged contentEditable) ------------------------------------

  _setupBioPages(el) {
    const SEP = '<!-- PAGE -->';
    const locked = this.document.getFlag('vtm-v20', 'sheetLocked') !== false;
    const canEdit = this.isEditable && (game.user.isGM || !locked);
    const actor = this.document;
    const toolbar = el.querySelector('.bio-toolbar');

    if (!canEdit && toolbar) toolbar.style.display = 'none';
    this._bioSaveFns = [];

    let blurTimer = null;
    let activeBody = null;
    let savedRange = null;

    el.querySelectorAll('.bio-section').forEach(section => {
      const field = section.dataset.bioField;
      let raw = actor.system[field] || '';
      const pages = raw.split(SEP);

      let cur = this._bioPage[field] || 0;
      if (cur >= pages.length) cur = pages.length - 1;
      if (cur < 0) cur = 0;
      this._bioPage[field] = cur;

      const body = section.querySelector('.bio-body');
      const indicator = section.querySelector('.bio-page-num');
      const prevBtn = section.querySelector('.bio-prev');
      const nextBtn = section.querySelector('.bio-next');
      if (!body) return;

      if (canEdit) body.contentEditable = 'true';
      body.innerHTML = pages[cur];

      const syncPage = () => { pages[this._bioPage[field]] = body.innerHTML; };

      const save = () => {
        syncPage();
        const joined = pages.join(SEP);
        if (joined === raw) return;
        raw = joined;
        actor.update({ [`system.${field}`]: joined });
      };

      this._bioSaveFns.push(save);

      const updateNav = () => {
        const total = pages.length;
        const idx = this._bioPage[field];
        if (indicator) indicator.textContent = total > 1 ? `${idx + 1} / ${total}` : '';
        if (prevBtn) prevBtn.disabled = idx <= 0;
        if (nextBtn) {
          if (!canEdit) {
            nextBtn.disabled = idx >= total - 1;
          } else {
            // Disable when sitting on an empty last page (nothing to add beyond)
            const lastEmpty = idx === total - 1
              && !pages[idx].replace(/<br\s*\/?>/gi, '').trim();
            nextBtn.disabled = lastEmpty;
          }
        }
      };
      updateNav();

      let flipping = false;

      // Slide the page body out in one direction, swap content, slide in from the other
      const flipTo = (newIdx, dir, done) => {
        if (flipping) return;
        flipping = true;
        const ms = 150;
        body.style.transition = `transform ${ms}ms ease`;
        body.style.transform = `translateX(${dir > 0 ? '-100%' : '100%'})`;
        setTimeout(() => {
          body.style.transition = 'none';
          body.style.transform = `translateX(${dir > 0 ? '100%' : '-100%'})`;
          this._bioPage[field] = newIdx;
          body.innerHTML = pages[newIdx];
          body.offsetHeight; // reflow so the jump is invisible
          body.style.transition = `transform ${ms}ms ease`;
          body.style.transform = '';
          flipping = false;
          updateNav();
          if (done) done();
        }, ms);
      };

      const goPage = (dir) => {
        syncPage();
        const idx = this._bioPage[field];
        const empty = pages.length > 1
          && !pages[idx].replace(/<br\s*\/?>/gi, '').trim();

        // Figure out where we're going
        let next;
        if (empty) {
          next = dir > 0 ? Math.min(idx, pages.length - 2)
                         : Math.max(0, idx - 1);
          if (next === idx) next = idx - 1;
          if (next < 0) return;
        } else {
          if (dir > 0 && idx === pages.length - 1 && canEdit) {
            if (!pages[idx].replace(/<br\s*\/?>/gi, '').trim()) return;
            pages.push('');
          }
          next = idx + dir;
          if (next < 0 || next >= pages.length) return;
        }

        flipTo(next, dir, () => {
          if (empty) {
            pages.splice(idx > next ? idx : idx, 1);
            if (this._bioPage[field] >= pages.length)
              this._bioPage[field] = pages.length - 1;
            updateNav();
          }
          if (canEdit) body.focus();
        });
      };

      prevBtn?.addEventListener('click', e => {
        e.preventDefault();
        clearTimeout(blurTimer);
        goPage(-1);
      });
      nextBtn?.addEventListener('click', e => {
        e.preventDefault();
        clearTimeout(blurTimer);
        goPage(1);
      });

      if (!canEdit) return;

      // When typing pushes content past the visible area, spill trailing
      // nodes to the next page and follow the cursor there.
      const checkOverflow = () => {
        if (flipping || body.scrollHeight <= body.clientHeight) return;

        const sel = window.getSelection();
        const cursorNode = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;

        const spill = document.createDocumentFragment();
        while (body.scrollHeight > body.clientHeight && body.childNodes.length > 1) {
          spill.insertBefore(body.lastChild, spill.firstChild);
        }

        // Single child still overflowing: split at the visible bottom edge
        if (!spill.childNodes.length && body.scrollHeight > body.clientHeight) {
          const rect = body.getBoundingClientRect();
          const probe = document.caretRangeFromPoint(rect.left + 4, rect.top + body.clientHeight - 2);
          if (probe) {
            const cut = document.createRange();
            cut.setStart(probe.startContainer, probe.startOffset);
            cut.setEndAfter(body.lastChild);
            spill.appendChild(cut.extractContents());
          }
        }

        if (!spill.childNodes.length) return;

        const wrap = document.createElement('div');
        wrap.appendChild(spill);
        const spillHtml = wrap.innerHTML;

        pages[this._bioPage[field]] = body.innerHTML;

        const idx = this._bioPage[field];
        if (idx + 1 < pages.length) {
          pages[idx + 1] = spillHtml + pages[idx + 1];
        } else {
          pages.splice(idx + 1, 0, spillHtml);
        }

        const cursorSpilled = cursorNode && !body.contains(cursorNode);
        if (cursorSpilled) {
          flipTo(idx + 1, 1, () => {
            body.focus();
            const r = document.createRange();
            r.selectNodeContents(body);
            r.collapse(false);
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
            checkOverflow();
          });
          return;
        }

        updateNav();
      };

      body.addEventListener('input', () => {
        checkOverflow();
        syncPage();
        updateNav();
      });

      body.addEventListener('focus', () => {
        clearTimeout(blurTimer);
        activeBody = body;
      });

      body.addEventListener('blur', () => {
        const sel = window.getSelection();
        if (sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
        clearTimeout(blurTimer);
        blurTimer = setTimeout(() => {
          activeBody = null;
          save();
        }, 200);
      });
    });

    if (!canEdit || !toolbar) return;

    // Format buttons: mousedown preventDefault keeps focus in the editor
    toolbar.querySelectorAll('.bio-fmt').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      });
    });

    // Selects need special handling (can't preventDefault or dropdown won't open)
    const restoreAndExec = (cmd, val, resetIdx) => {
      if (activeBody) {
        activeBody.focus();
        if (savedRange) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
        document.execCommand(cmd, false, val);
      }
    };

    // Selects steal focus from the body, so we clear the blur timer on both
    // mousedown (fires first) AND focus (fires after body blur sets the timer)
    const wireSelect = (sel, cmd, resetIdx) => {
      if (!sel) return;
      sel.addEventListener('mousedown', () => clearTimeout(blurTimer));
      sel.addEventListener('focus', () => clearTimeout(blurTimer));
      sel.addEventListener('change', () => {
        restoreAndExec(cmd, sel.value);
        sel.selectedIndex = resetIdx;
      });
    };

    wireSelect(toolbar.querySelector('.bio-font-size'), 'fontSize', 2);
    wireSelect(toolbar.querySelector('.bio-format-block'), 'formatBlock', 0);
  }


  // -- Portrait pan/zoom --------------------------------------------------

  _setupPortrait(el) {
    const img = el.querySelector('.portrait img');
    const wrap = el.querySelector('.portrait');
    if (!img || !wrap) return;

    const flags = this.document.getFlag('vtm-v20', 'portrait') || {};
    let offX = flags.offX ?? 0, offY = flags.offY ?? 0, scale = flags.scale ?? 1;

    const applyPosition = () => {
      if (!img.naturalWidth) return;
      const boxW = wrap.clientWidth, boxH = wrap.clientHeight;
      if (!boxW || !boxH) return;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const boxRatio = boxW / boxH;
      let w, h;
      if (imgRatio > boxRatio) { h = boxH * scale; w = h * imgRatio; }
      else { w = boxW * scale; h = w / imgRatio; }
      const maxX = Math.max(0, (w - boxW) / 2);
      const maxY = Math.max(0, (h - boxH) / 2);
      offX = Math.max(-maxX, Math.min(maxX, offX));
      offY = Math.max(-maxY, Math.min(maxY, offY));
      img.style.width = w + 'px';
      img.style.height = h + 'px';
      img.style.left = Math.min(0, Math.max(boxW - w, (boxW - w) / 2 + offX)) + 'px';
      img.style.top = Math.min(0, Math.max(boxH - h, (boxH - h) / 2 + offY)) + 'px';
    };

    if (img.complete && img.naturalWidth) applyPosition();
    else img.addEventListener('load', applyPosition);

    let dragging = false, startX, startY, startOffX, startOffY;
    img.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      dragging = false; startX = ev.clientX; startY = ev.clientY;
      startOffX = offX; startOffY = offY;
      img.setPointerCapture(ev.pointerId);
    });
    img.addEventListener('pointermove', ev => {
      if (!img.hasPointerCapture(ev.pointerId)) return;
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      dragging = true;
      offX = startOffX + dx; offY = startOffY + dy;
      applyPosition();
    });
    img.addEventListener('pointerup', ev => {
      img.releasePointerCapture(ev.pointerId);
      if (dragging) this._savePortrait(offX, offY, scale);
    });
    img.addEventListener('click', ev => {
      if (dragging) { ev.preventDefault(); ev.stopPropagation(); dragging = false; }
    }, true);

    let zoomTimer;
    wrap.addEventListener('wheel', ev => {
      ev.preventDefault();
      scale = Math.max(1, Math.min(3, scale + (ev.deltaY > 0 ? -0.1 : 0.1)));
      applyPosition();
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => this._savePortrait(offX, offY, scale), 300);
    }, { passive: false });

    const editBtn = wrap.querySelector('.portrait-edit');
    if (this.isEditable) {
      editBtn?.addEventListener('click', ev => {
        ev.stopPropagation();
        new FilePicker({
          type: 'image',
          current: this.document.img,
          callback: path => this.document.update({ img: path })
        }).browse();
      });
    } else {
      editBtn?.remove();
    }
  }

  _savePortrait(offX, offY, scale) {
    this.document.setFlag('vtm-v20', 'portrait', {
      offX: Math.round(offX), offY: Math.round(offY), scale: +scale.toFixed(1)
    });
  }


  // -- Trait tooltips ------------------------------------------------------

  _setupTraitTips(el) {
    if (this._traitTip) this._traitTip.remove();
    const tip = document.createElement('div');
    tip.className = 'trait-tooltip';
    document.body.appendChild(tip);
    this._traitTip = tip;
    let timer = null;

    const show = (target, key) => {
      const descs = TRAIT_DESCRIPTIONS[key];
      if (!descs) return;
      let val;
      if (key === 'willpower') val = this.document.system.willpower.max;
      else if (key === 'humanity') val = this.document.system.humanity;
      else val = foundry.utils.getProperty(this.document.system, key);
      tip.textContent = descs[val - (key === 'humanity' ? 0 : 1)] ?? '';
      const rect = target.getBoundingClientRect();
      tip.style.left = rect.left + 'px';
      tip.style.top = (rect.bottom + 8) + 'px';
      const box = tip.getBoundingClientRect();
      if (box.bottom > window.innerHeight) tip.style.top = (rect.top - box.height - 8) + 'px';
      if (box.right > window.innerWidth) tip.style.left = (window.innerWidth - box.width - 12) + 'px';
      tip.classList.add('visible');
    };
    const hide = () => { clearTimeout(timer); timer = null; tip.classList.remove('visible'); };

    el.querySelectorAll('.trait-label[data-roll]').forEach(lbl => {
      lbl.addEventListener('mouseenter', () => { timer = setTimeout(() => show(lbl, lbl.dataset.roll), 600); });
      lbl.addEventListener('mouseleave', hide);
    });
    el.querySelectorAll('[data-tip]').forEach(heading => {
      heading.addEventListener('mouseenter', () => { timer = setTimeout(() => show(heading, heading.dataset.tip), 600); });
      heading.addEventListener('mouseleave', hide);
    });
  }


  // -- Soak roll -----------------------------------------------------------

  // Tally d10s against a difficulty, V20-style (1s cancel successes)
  _tallyDice(roll, difficulty) {
    let successes = 0, ones = 0;
    const dice = roll.terms[0].results.map(r => {
      const val = r.result;
      let status = 'fail';
      if (val >= difficulty) { successes++; status = 'success'; }
      if (val === 1) { ones++; status = 'botch'; }
      return { value: val, status };
    });
    successes -= ones;
    let outcome = 'failure';
    if (successes > 0) outcome = 'success';
    else if (successes < 0 || (successes <= 0 && ones > 0)) outcome = 'botch';
    return { dice, total: Math.max(successes, 0), outcome };
  }

  async _emitRollCard(actor, { roll, label, pool, difficulty, dice, total, outcome, extra = '', ledgeBtn = false, flags = {}, autoSuccesses = 0, diceTotal = 0 }) {
    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/roll-result.hbs', {
      actorImg: actor.img, actorName: actor.name,
      label, pool, difficulty, specialty: false, dice, total, outcome, extra, ledgeBtn, portraitStyle,
      autoSuccesses, diceTotal,
    });

    await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags,
    });
  }

  _attackTraitOptions(selected = '', allowBlank = false) {
    const sys = this.document.system;
    const option = (value, label, valueText) =>
      `<option value="${value}" ${value === selected ? 'selected' : ''}>${label} (${valueText})</option>`;
    const group = (label, entries, root) => {
      const options = entries
        .map(key => option(`${root}.${key}`, game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`), sys[root]?.[key] || 0))
        .join('');
      return `<optgroup label="${label}">${options}</optgroup>`;
    };

    const blank = allowBlank ? '<option value="">-- None --</option>' : '';
    const attrs = [
      group('Attributes: Physical', VTM.attributes.physical, 'attributes'),
      group('Attributes: Social', VTM.attributes.social, 'attributes'),
      group('Attributes: Mental', VTM.attributes.mental, 'attributes'),
    ].join('');
    const abilities = [
      group('Abilities: Talents', VTM.abilities.talents, 'abilities'),
      group('Abilities: Skills', VTM.abilities.skills, 'abilities'),
      group('Abilities: Knowledges', VTM.abilities.knowledges, 'abilities'),
    ].join('');
    const virtues = sys.virtues ? group('Virtues', ['conscience', 'selfControl', 'courage'], 'virtues') : '';
    const other = [
      option('willpower', 'Willpower', sys.willpower?.max || 0),
      option('humanity', sys.pathName || 'Humanity', sys.humanity || 0),
    ].join('');

    return `${blank}${attrs}${abilities}${virtues}<optgroup label="Other">${other}</optgroup>`;
  }

  async _createCustomAttackDialog() {
    const damageTypeOptions = VTM.damageTypes
      .map(type => `<option value="${type}" ${type === 'bashing' ? 'selected' : ''}>${type}</option>`)
      .join('');
    const content = `
      <form class="vtm-roll-dialog custom-attack-dialog">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="New Maneuver" />
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div class="custom-attack-icon-row">
            <input type="text" name="img" placeholder="systems/vtm-v20/VTM icons/Actions Icons/high-kick.png" />
            <button type="button" class="attack-icon-picker"><i class="fas fa-folder-open"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label>Primary Pool Trait</label>
          <select name="primary">${this._attackTraitOptions('attributes.dexterity')}</select>
        </div>
        <div class="form-group">
          <label>Secondary Pool Trait</label>
          <select name="secondary">${this._attackTraitOptions('abilities.brawl', true)}</select>
        </div>
        <div class="form-group">
          <label>Accuracy Modifier (dice)</label>
          <input type="number" name="accuracyMod" value="0" step="1" />
        </div>
        <div class="form-group">
          <label>Difficulty Modifier</label>
          <input type="number" name="difficultyMod" value="0" step="1" />
        </div>
        <div class="form-group">
          <label>Damage</label>
          <div class="custom-attack-damage-row">
            <select name="damageMode">
              <option value="strength" selected>Strength +</option>
              <option value="fixed">Fixed Number</option>
            </select>
            <input type="number" name="damageValue" value="0" step="1" />
          </div>
        </div>
        <div class="form-group">
          <label>Damage Type</label>
          <select name="damageType">${damageTypeOptions}</select>
        </div>
      </form>`;

    new Dialog({
      title: 'Create Attack / Maneuver',
      content,
      buttons: {
        create: {
          icon: '<i class="fas fa-plus"></i>',
          label: 'Add',
          callback: html => this._saveCustomAttack(html[0].querySelector('form')),
        },
      },
      render: html => {
        html.find('.attack-icon-picker').click(() => {
          if (typeof FilePicker === 'undefined') return;
          new FilePicker({
            type: 'image',
            current: html.find('[name="img"]').val(),
            callback: path => html.find('[name="img"]').val(path),
          }).render(true);
        });
      },
      default: 'create',
    }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 460 }).render(true);
  }

  async _saveCustomAttack(form) {
    const damageValue = parseInt(form.damageValue.value, 10) || 0;
    const damageFormula = form.damageMode.value === 'strength'
      ? (damageValue ? `Str${signed(damageValue)}` : 'Str')
      : `${damageValue}`;
    const attack = {
      id: foundry.utils.randomID(),
      name: form.name.value.trim() || 'Custom Maneuver',
      img: form.img.value.trim(),
      primary: form.primary.value || 'attributes.dexterity',
      secondary: form.secondary.value || '',
      accuracyMod: parseInt(form.accuracyMod.value, 10) || 0,
      difficultyMod: parseInt(form.difficultyMod.value, 10) || 0,
      damageFormula,
      damageType: form.damageType.value || 'bashing',
    };
    const attacks = this._customAttackData();
    attacks.push(attack);
    await this.document.update({ 'system.customAttacks': attacks });
  }

  _customAttackData() {
    return Array.from(this.document.system.customAttacks ?? []).map(attack => ({
      id: attack.id || foundry.utils.randomID(),
      name: attack.name || 'Custom Maneuver',
      img: attack.img || '',
      primary: attack.primary || 'attributes.dexterity',
      secondary: attack.secondary || '',
      accuracyMod: Number(attack.accuracyMod) || 0,
      difficultyMod: Number(attack.difficultyMod) || 0,
      damageFormula: attack.damageFormula || 'Str',
      damageType: attack.damageType || 'bashing',
    }));
  }

  // -- Declaration (inline in combat tab) ------------------------------------

  startDeclaration(combat, combatant) {
    if (this._declCombat) return; // already in declaration mode
    this._declCombat = combat;
    this._declCombatant = combatant;
    this._tab = 'combat';
    this.render(true);
  }

  _endDeclaration() {
    this._declCombat = null;
    this._declCombatant = null;
    this._declActions = [];
    this._declFullDefense = false;
    this._declCapturing = false;
    game.vtm._captureAction = null;
    this.render();
  }

  _getAttackById(id) {
    if (id === 'unarmed') return { name: 'Unarmed' };
    if (id === 'kick') return { name: 'Kick' };
    if (id?.startsWith('custom-')) {
      const custom = (this.document.system.customAttacks ?? []).find(c => c.id === id.replace('custom-', ''));
      return custom ? { name: custom.name } : null;
    }
    const item = this.document.items.get(id);
    return item ? { name: item.name } : null;
  }

  _bindAllocListeners() {
    if (!this._combatDrawer) return;
    const inputs = this._combatDrawer.querySelectorAll('.decl-alloc-input');
    const summary = this._combatDrawer.querySelector('.decl-split-info');
    if (!inputs.length || !summary) return;

    const actions = this._declActions;
    const sys = this.document.system;
    const wp = sys.woundPenalty || 0;
    let lowestPool = Infinity;
    for (const a of actions) {
      const p = this._declPoolForAction(a);
      if (p < lowestPool) lowestPool = p;
    }
    if (!isFinite(lowestPool)) lowestPool = 0;
    const totalPool = Math.max(lowestPool + wp, 1);

    const update = () => {
      let allocated = 0;
      inputs.forEach(inp => {
        const idx = parseInt(inp.name.replace('alloc-', ''));
        const val = Math.max(parseInt(inp.value) || 0, 0);
        if (actions[idx]) actions[idx].alloc = val;
        allocated += val;
      });
      const rem = totalPool - allocated;
      const over = rem < 0;
      const wpBit = wp ? ` (wound ${wp})` : '';
      let txt = `<i class="fas fa-info-circle"></i> Lowest pool${wpBit}: <b>${totalPool}</b>`;
      txt += ` | Allocated: <b class="${over ? 'over-budget' : ''}">${allocated}</b> / ${totalPool}`;
      if (rem > 0) txt += ` (<b>${rem}</b> unspent)`;
      else if (over) txt += ` <span class="over-budget">(${Math.abs(rem)} over!)</span>`;
      summary.innerHTML = txt;
    };

    inputs.forEach(inp => inp.addEventListener('input', update));
  }

  _saveAllocations() {
    if (!this._combatDrawer) return;
    this._declActions.forEach((a, i) => {
      const input = this._combatDrawer.querySelector(`[name="alloc-${i}"]`);
      if (input) a.alloc = Math.max(parseInt(input.value) || 0, 0);
    });
  }

  _declPoolForAction(a) {
    const sys = this.document.system;
    const dex = effectiveTraitValue(this.document, 'attributes.dexterity');
    if (a.pool) return a.pool;
    if (a.defense) {
      const skills = { dodge: 'athletics', block: 'brawl', parry: 'melee' };
      return dex + (sys.abilities?.[skills[a.defense]] || 0);
    }
    if (a.reload) return dex + (sys.abilities?.firearms || 0);
    if (a.attackId === 'unarmed' || a.attackId === 'kick') return dex + (sys.abilities?.brawl || 0);
    if (a.attackId?.startsWith('custom-')) {
      const customId = a.attackId.replace('custom-', '');
      const custom = (sys.customAttacks ?? []).find(c => c.id === customId);
      if (custom) {
        const traits = [custom.primary, custom.secondary].filter(Boolean);
        return traits.reduce((sum, path) => sum + effectiveTraitValue(this.document, path), 0) + (Number(custom.accuracyMod) || 0);
      }
      return 0;
    }
    const w = Array.from(this.document.items).find(i => i.id === a.attackId);
    if (w) {
      const isRanged = !!w.system.range;
      return dex + (sys.abilities?.[isRanged ? 'firearms' : 'melee'] || 0);
    }
    return 0;
  }

  static #onDeclFullDefense() {
    this._declFullDefense = !this._declFullDefense;
    if (this._declFullDefense) {
      this._declActions = [];
      this._declCapturing = false;
      game.vtm._captureAction = null;
    }
    this.render();
  }

  static #onDeclQuickAdd(ev, target) {
    if (this._declFullDefense) return;
    this._saveAllocations();
    const defense = target.dataset.defense;
    if (defense) {
      const names = { dodge: 'Dodge', block: 'Block', parry: 'Parry' };
      this._declActions.push({ attackId: null, text: names[defense], defense, alloc: 1 });
    } else {
      const attackId = target.dataset.attackId;
      const atk = this._attacks?.find(a => a.id === attackId);
      const rate = parseInt(atk?.rate) || 0;
      if (rate > 0) {
        const used = this._declActions.filter(a => a.attackId === attackId && !a.reload).length;
        if (used >= rate) {
          ui.notifications.warn(`${atk.name}: rate of fire is ${rate}.`);
          return;
        }
      }
      this._declActions.push({ attackId, text: '', alloc: 1 });
    }
    this.render();
  }

  static #onDeclQuickRemove(ev, target) {
    this._saveAllocations();
    const defense = target.dataset.defense;
    if (defense) {
      const idx = this._declActions.findLastIndex(a => a.defense === defense);
      if (idx >= 0) this._declActions.splice(idx, 1);
    } else {
      const attackId = target.dataset.attackId;
      // Only remove attack actions (not reloads) when clicking minus on attack count
      const idx = this._declActions.findLastIndex(a => a.attackId === attackId && !a.reload);
      if (idx >= 0) this._declActions.splice(idx, 1);
    }
    this.render();
  }

  static #onDeclRemoveReload(ev, target) {
    this._saveAllocations();
    const attackId = target.dataset.attackId;
    const idx = this._declActions.findLastIndex(a => a.attackId === attackId && a.reload);
    if (idx >= 0) this._declActions.splice(idx, 1);
    this.render();
  }

  static #onDeclAddAction() {
    this._saveAllocations();
    this._declCapturing = true;
    this.render();
    game.vtm._captureAction = (rollData) => {
      this._declCapturing = false;
      const action = {
        attackId: null,
        text: rollData.label,
        pool: rollData.pool,
        difficulty: rollData.difficulty,
        alloc: 1,
      };
      if (rollData.source) action.source = rollData.source;
      this._declActions.push(action);
      this.render();
      ui.notifications.info(`Captured: ${rollData.label} (pool ${rollData.pool})`);
    };
  }

  static #onDeclCancelCapture() {
    this._declCapturing = false;
    game.vtm._captureAction = null;
    this.render();
  }

  static #onDeclRemoveAction(ev, target) {
    this._saveAllocations();
    const idx = parseInt(target.dataset.index);
    if (!isNaN(idx)) {
      this._declActions.splice(idx, 1);
      this.render();
    }
  }

  static async #onDeclConfirm() {
    if (!this._declCombat || !this._declCombatant) return;
    // Only the current declarer can confirm
    const curDeclarer = this._declCombat.getFlag('vtm-v20', 'currentDeclarer');
    if (curDeclarer !== this._declCombatant.id) return;

    this._saveAllocations();

    const el = this.element;
    const descField = el.querySelector('[name="declaration-text"]');
    const text = descField?.value || '';

    const actor = this.document;
    const sys = actor.system;
    const wp = sys.woundPenalty || 0;
    const fullDef = this._declFullDefense;

    // Block confirm if over budget
    if (!fullDef && this._declActions.length > 1) {
      let lowestCheck = Infinity;
      for (const a of this._declActions) {
        const p = this._declPoolForAction(a);
        if (p < lowestCheck) lowestCheck = p;
      }
      if (!isFinite(lowestCheck)) lowestCheck = 0;
      const budget = Math.max(lowestCheck + wp, 1);
      const spent = this._declActions.reduce((s, a) => s + (a.alloc || 0), 0);
      if (spent > budget) {
        ui.notifications.warn(`You've allocated ${spent} dice but only have ${budget}. Remove ${spent - budget} before confirming.`);
        return;
      }
    }

    if (fullDef) {
      // Full defense: no actions, store the flag. Pool is handled reactively.
      this._declActions = [{ attackId: null, text: 'Full Defense', fullDefense: true, alloc: 0 }];
    } else {
      if (!this._declActions.length && text.trim()) {
        this._declActions.push({ attackId: null, text: text.trim(), alloc: 1 });
      }
      if (!this._declActions.length) {
        this._declActions.push({ attackId: null, text: 'No action', alloc: 0 });
      }
    }

    let totalPool = 0;
    let basePool = 0;
    if (!fullDef) {
      let lowestPool = Infinity;
      for (const a of this._declActions) {
        const p = this._declPoolForAction(a);
        if (p !== undefined && p < lowestPool) lowestPool = p;
      }
      if (!isFinite(lowestPool)) lowestPool = 0;
      basePool = lowestPool;
      totalPool = Math.max(lowestPool + wp, 1);
    }

    const combatant = this._declCombatant;
    const combat = this._declCombat;

    await combatant.setFlag('vtm-v20', 'declaration', {
      text: text || (fullDef ? 'Entire Turn Defense' : this._declActions.map(a => a.defense ? `${a.text} (Defense)` : (a.text || 'Attack')).join(', ')),
      actions: this._declActions,
      fullDefense: fullDef,
      totalPool,
      basePool,
      diceAllocations: [],
      resolved: false,
    });

    const intent = text || (fullDef ? 'Entire Turn Defense' : 'No declaration');
    await ChatMessage.create({
      content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">${combatant.name} declares:</span></div><div class="roll-meta">${intent}</div></div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });

    this._endDeclaration();
    const { advanceDeclaration } = await import('./initiative.mjs');
    advanceDeclaration(combat);
  }


  // -- Resolution (inline in combat tab) -------------------------------------

  // Called once when the resolution phase begins for ALL combatants
  enterResolutionPhase(combat, combatant) {
    if (this._resCombat) return; // already in resolution mode
    this._resCombat = combat;
    this._resCombatant = combatant;
    this._resExecuted = new Set();
    this._resSpent = new Map();
    this._resDefenseSpent = new Map();
    this._resFullDefCount = 0;
    this._resTurnDone = false;
    this._tab = 'combat';
    this.render();
  }

  // Called when it's THIS combatant's turn to act
  async startResolution(combat, combatant) {
    // Don't reset tracking if we already have state from defending before our turn
    if (!this._resCombat) {
      this._resCombat = combat;
      this._resCombatant = combatant;
      this._resExecuted = new Set();
      this._resSpent = new Map();
      this._resDefenseSpent = new Map();
      this._resFullDefCount = 0;
    }
    this._resTurnDone = false;
    this._tab = 'combat';

    // Check if wound penalty changed since declaration
    const decl = combatant.getFlag('vtm-v20', 'declaration') || {};
    if (!decl.fullDefense && decl.basePool !== undefined) {
      const wp = this.document.system.woundPenalty || 0;
      const currentTotal = Math.max(decl.basePool + wp, 1);
      if (currentTotal !== decl.totalPool) {
        await this._promptReallocation(combatant, decl, currentTotal);
        return; // _promptReallocation handles render
      }
    }

    this.render(true);
  }

  async _promptReallocation(combatant, decl, newTotal) {
    const actions = decl.actions || [];
    const oldTotal = decl.totalPool;
    const diff = oldTotal - newTotal;

    const alreadySpent = [...this._resSpent.entries()];
    const lockedDice = alreadySpent.reduce((s, [, v]) => s + v, 0);
    const budget = Math.max(newTotal - lockedDice, 0);

    const entries = actions.map((a, i) => {
      let name = a.text || 'Action';
      if (a.defense) name = `${a.text || a.defense} (Defense)`;
      else if (a.attackId && this._getAttackById) {
        const resolved = this._getAttackById(a.attackId);
        if (resolved?.name) name = resolved.name;
      }
      const executed = this._resExecuted.has(i);
      const spent = this._resSpent.get(i) || 0;
      return { i, name, alloc: a.alloc || 1, executed, spent };
    });

    let freeEntries = entries.filter(e => !e.executed);
    const abortedSet = new Set();

    // Not enough dice for every remaining action to have at least 1
    if (budget < freeEntries.length && freeEntries.length > 0) {
      const mustDrop = freeEntries.length - budget;

      if (budget <= 0) {
        // No dice at all: everything is aborted
        for (const e of freeEntries) abortedSet.add(e.i);
      } else {
        const picked = await new Promise(resolve => {
          let html = '<div style="margin:6px 0;color:#ddd;">';
          html += `<p>Your reduced pool (<b>${budget}</b> dice) can't cover all <b>${freeEntries.length}</b> remaining actions.</p>`;
          html += `<p>Drop at least <b>${mustDrop}</b> action${mustDrop > 1 ? 's' : ''}:</p>`;
          for (const e of freeEntries) {
            html += `<div style="padding:3px 0;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;">`;
            html += `<input type="checkbox" class="abort-pick" data-index="${e.i}" />`;
            html += `<span>${e.name} [${e.alloc}d]</span></label></div>`;
          }
          html += '<p class="abort-status" style="margin-top:6px;font-size:11px;"></p></div>';

          new Dialog({
            title: `${this.document.name}: Drop Actions`,
            content: html,
            buttons: {
              ok: { icon: '<i class="fas fa-check"></i>', label: 'Confirm', callback: dlg => {
                const checked = dlg[0].querySelectorAll('.abort-pick:checked');
                const set = new Set([...checked].map(c => parseInt(c.dataset.index)));
                // If they didn't check enough, auto-fill from the end
                if (set.size < mustDrop) {
                  for (let j = freeEntries.length - 1; j >= 0 && set.size < mustDrop; j--) {
                    set.add(freeEntries[j].i);
                  }
                }
                resolve(set);
              }},
            },
            render: dlg => {
              const status = dlg.find('.abort-status');
              const checks = dlg.find('.abort-pick');
              const update = () => {
                const n = checks.filter(':checked').length;
                const left = mustDrop - n;
                if (left > 0) status.html(`<span style="color:var(--vtm-red);">Select ${left} more to drop</span>`);
                else if (left === 0) status.html('<span style="color:#5a5;">Ready to confirm</span>');
                else status.html(`<span style="color:#aaa;">Dropping ${Math.abs(left)} extra (more dice per remaining action)</span>`);
              };
              checks.on('change', update);
              update();
            },
            default: 'ok',
            close: () => {
              const auto = new Set();
              for (let j = freeEntries.length - 1; j >= 0 && auto.size < mustDrop; j--) {
                auto.add(freeEntries[j].i);
              }
              resolve(auto);
            },
          }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
        });

        for (const idx of picked) abortedSet.add(idx);
      }

      for (const idx of abortedSet) this._resExecuted.add(idx);
      freeEntries = freeEntries.filter(e => !abortedSet.has(e.i));
    }

    // Auto-distribute: cap each at budget, then trim from the end (min 1)
    let autoTotal = 0;
    for (const e of freeEntries) {
      e.alloc = Math.min(e.alloc, budget);
      autoTotal += e.alloc;
    }
    let canTrim = true;
    while (autoTotal > budget && canTrim) {
      canTrim = false;
      for (let j = freeEntries.length - 1; j >= 0 && autoTotal > budget; j--) {
        if (freeEntries[j].alloc > 1) {
          freeEntries[j].alloc--;
          autoTotal--;
          canTrim = true;
        }
      }
    }

    // Build the redistribution dialog (skip if all actions were aborted)
    if (freeEntries.length === 0) {
      const updated = actions.map(a => ({ ...a }));
      for (const idx of abortedSet) if (updated[idx]) updated[idx].alloc = 0;
      await combatant.setFlag('vtm-v20', 'declaration', { ...decl, totalPool: newTotal, actions: updated });
      this._tab = 'combat';
      this.render(true);
      return;
    }

    let inputsHtml = '';
    for (const e of entries) {
      if (e.executed || abortedSet.has(e.i)) {
        const label = abortedSet.has(e.i) ? 'Dropped' : `${e.spent}d (used)`;
        inputsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;opacity:0.5;">
          <span>${e.name}</span><span>${label}</span></div>`;
      } else {
        inputsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">
          <span>${e.name}</span>
          <input type="number" class="realloc-input" data-index="${e.i}" value="${e.alloc}" min="1" max="${budget}" style="width:45px;text-align:center;" />
        </div>`;
      }
    }

    const confirmed = await new Promise(resolve => {
      new Dialog({
        title: `${this.document.name}: Reallocate Dice`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Wound penalty changed! Pool reduced from <b>${oldTotal}</b> to <b>${newTotal}</b> (-${diff}).</p>
          ${lockedDice ? `<p>Already spent on executed actions: <b>${lockedDice}</b></p>` : ''}
          <p>Redistribute <b>${budget}</b> dice among your remaining actions:</p>
          <div style="margin-top:8px;">${inputsHtml}</div>
          <p class="realloc-summary" style="margin-top:6px;font-size:11px;color:#888;"></p>
        </div>`,
        buttons: {
          ok: { icon: '<i class="fas fa-check"></i>', label: 'Confirm', callback: dlg => {
            const inputs = dlg[0].querySelectorAll('.realloc-input');
            const allocs = {};
            inputs.forEach(inp => {
              allocs[parseInt(inp.dataset.index)] = Math.max(parseInt(inp.value) || 1, 1);
            });
            resolve(allocs);
          }},
        },
        render: html => {
          const summary = html.find('.realloc-summary');
          const inputs = html.find('.realloc-input');
          const update = () => {
            let used = 0;
            inputs.each((_, inp) => { used += Math.max(parseInt(inp.value) || 1, 1); });
            const rem = budget - used;
            summary.html(rem < 0
              ? `<span style="color:var(--vtm-red);">Over budget by ${Math.abs(rem)}!</span>`
              : `Remaining: <b>${rem}</b> / ${budget}`);
          };
          inputs.on('input', update);
          update();
        },
        default: 'ok',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
    });

    const updated = actions.map(a => ({ ...a }));
    for (const idx of abortedSet) if (updated[idx]) updated[idx].alloc = 0;

    if (confirmed) {
      for (const [idx, val] of Object.entries(confirmed)) {
        const i = parseInt(idx);
        if (updated[i]) updated[i].alloc = val;
      }
    } else {
      // Dialog closed: apply auto-trimmed values
      for (const e of freeEntries) {
        if (updated[e.i]) updated[e.i].alloc = e.alloc;
      }
    }

    await combatant.setFlag('vtm-v20', 'declaration', {
      ...decl,
      totalPool: newTotal,
      actions: updated,
    });

    this._tab = 'combat';
    this.render(true);
  }

  _endResolution() {
    this._resCombat = null;
    this._resCombatant = null;
    this._resExecuted = new Set();
    this._resSpent = new Map();
    this._resDefenseSpent = new Map();
    this._resFullDefCount = 0;
    this._resTurnDone = false;
    this.render();
  }

  _isMyResTurn() {
    if (!this._resCombat || !this._resCombatant || this._resTurnDone) return false;
    return this._resCombat.getFlag('vtm-v20', 'currentResolver') === this._resCombatant.id;
  }

  async _executeResAction(idx) {
    if (isNaN(idx) || this._resExecuted.has(idx) || !this._resCombatant) return;
    if (!this._isMyResTurn()) {
      ui.notifications.warn('Not your turn to act.');
      return;
    }

    const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
    const actions = decl.actions || [];
    const action = actions[idx];
    if (!action) return;

    const totalPool = decl.totalPool || 0;
    const spent = [...this._resSpent.values()].reduce((s, v) => s + v, 0);
    const remaining = Math.max(totalPool - spent, 0);
    const multiAction = actions.length > 1;

    let poolForAction = remaining;
    if (multiAction) {
      poolForAction = Math.min(action.alloc || 1, remaining);
    }

    // Reload action
    if (action.reload && action.attackId) {
      const atk = this._attacks?.find(a => a.id === action.attackId);
      if (!atk) return;

      if (multiAction) {
        // Multi-action reload: roll Dex+Firearms, need 1+ success
        const result = await game.vtm.rollDicePool(this.document, {
          label: `Reload: ${atk.name} (Dex + Firearms)`,
          poolOverride: poolForAction,
        });
        if (result?.total >= 1) await this._reloadAttackWeapon(atk);
      } else {
        // Single action: auto-reload, no roll needed
        await this._reloadAttackWeapon(atk);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          content: `<div class="vtm-roll-result"><b>${atk.name}</b>: Reloaded</div>`,
        });
      }

      this._resExecuted.add(idx);
      this._resSpent.set(idx, multiAction ? poolForAction : 0);
      this.render();
      return;
    }

    // Custom action (captured from a roll): dispatch to the original function
    if (!action.attackId && !action.reload && !action.defense) {
      if (action.source === 'jump') {
        await this._rollJump({ poolOverride: poolForAction, difficulty: action.difficulty, label: action.text });
      } else {
        await game.vtm.rollDicePool(this.document, {
          label: action.text || 'Custom Action',
          difficulty: action.difficulty || 6,
          poolOverride: poolForAction,
        });
      }
      this._resExecuted.add(idx);
      this._resSpent.set(idx, poolForAction);
      this.render();
      return;
    }

    if (action.attackId) {
      const { rollAttack } = await import('./combat.mjs');
      const actor = this.document;
      const targeting = this._getTargetingData();

      if (action.attackId === 'unarmed' || action.attackId === 'kick') {
        const isKick = action.attackId === 'kick';
        const atk = {
          id: action.attackId, name: isKick ? 'Kick' : 'Unarmed',
          damageFormula: isKick ? 'Str+1' : 'Str', damageType: 'bashing',
          skill: 'abilities.brawl', isRanged: false,
          difficultyMod: isKick ? 1 : 0,
        };
        await rollAttack(actor, atk, { poolOverride: poolForAction, targeting });
      } else if (action.attackId.startsWith('custom-')) {
        const atkDef = this._attacks?.find(a => a.id === action.attackId);
        if (atkDef) await rollAttack(actor, atkDef, { poolOverride: poolForAction, targeting });
      } else {
        const w = actor.items.get(action.attackId);
        if (w) {
          const isRanged = !!w.system.range;
          const atk = {
            id: w.id, name: w.name, img: w.img,
            damageFormula: w.system.damage,
            damageType: w.system.damageType || 'lethal',
            skill: `abilities.${isRanged ? 'firearms' : 'melee'}`,
            isRanged, range: w.system.range, capacity: w.system.capacity,
          };
          await rollAttack(actor, atk, { poolOverride: poolForAction, targeting });
        }
      }
    }

    this._resExecuted.add(idx);
    this._resSpent.set(idx, poolForAction);
    this.render();
  }

  static async #onResExecute(ev, target) {
    const idx = parseInt(target.dataset.index);
    await this._executeResAction(idx);
  }

  static async #onResFinish() {
    if (!this._resCombat || !this._resCombatant) return;
    const combat = this._resCombat;
    await this._resCombatant.setFlag('vtm-v20', 'resolved', true);
    // Don't clear resolution state. Defenses may still be needed this round.
    this._resTurnDone = true;
    this.render();
    const { advanceResolution } = await import('./initiative.mjs');
    advanceResolution(combat);
  }


  async _rollSoak() {
    const actor = this.document;
    const actorItems = Array.from(actor.items);
    const stamina = actor.system.attributes?.stamina || 0;
    const fort = actorItems.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const armorRating = actorItems
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    const pool = Math.max(stamina + fortLevel + armorRating, 1);

    const parts = [`Stamina ${stamina}`];
    if (fortLevel) parts.push(`Fortitude ${fortLevel}`);
    if (armorRating) parts.push(`Armor ${armorRating}`);
    const difficulty = 6;
    const label = `Soak (${parts.join(' + ')})`;

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);

    await this._emitRollCard(actor, { roll, label, pool, difficulty, dice, total, outcome });
  }


  // -- Healing with blood --------------------------------------------------

  async _toggleDiscipline(itemId) {
    const actor = this.document;
    const item = actor.items.get(itemId);
    if (!item) return;
    const key = item.name.toLowerCase();
    const active = actor.getFlag('vtm-v20', 'activeDisciplines') || [];
    const isActive = active.includes(key);

    if (isActive) {
      await actor.setFlag('vtm-v20', 'activeDisciplines', active.filter(d => d !== key));
      ui.notifications.info(`${item.name} deactivated.`);
    } else {
      if (key === 'potence') {
        const blood = actor.system.blood;
        if (!blood || blood.value < 1) {
          ui.notifications.warn('Not enough blood to activate.');
          return;
        }
        await actor.update({ 'system.blood.value': blood.value - 1 });
        await actor.setFlag('vtm-v20', 'activeDisciplines', [...active, key]);
        this._playHealAnimation();
        ui.notifications.info(`${item.name} activated: ${item.system.level} automatic successes on Strength rolls.`);
      } else {
        ui.notifications.info(`${item.name} activation not yet implemented.`);
      }
    }
  }

  // Spend blood to heal bashing/lethal levels. Generation caps how many can
  // be healed in one turn (bloodPerTurn); aggravated can't be healed this way.
  async _healWithBlood() {
    const actor = this.document;
    const sys = actor.system;
    const blood = sys.blood?.value || 0;
    const perTurn = sys.bloodPerTurn || 1;

    // Count normal (bashing/lethal) damage on the track
    const keys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];
    const normal = keys.reduce((n, k) => n + (sys.health.levels[k] === 1 || sys.health.levels[k] === 2 ? 1 : 0), 0);

    if (!normal) return ui.notifications.info('No bashing or lethal damage to heal.');
    if (!blood) return ui.notifications.warn(`${actor.name} has no blood to spend.`);

    const max = Math.min(blood, perTurn, normal);
    let amount = 1;
    if (max > 1) {
      amount = await this._healAmountDialog(max);
      if (!amount) return;
    }

    this._playHealAnimation();
    await this._applyHeal(amount);

    const lvls = amount === 1 ? 'one health level' : `${amount} health levels`;
    const pts = amount === 1 ? 'one blood point' : `${amount} blood points`;
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${actor.name} rested and healed ${lvls}, spending ${pts}.</span></div></div>`,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  // Remove `amount` normal levels (lethal first, then bashing) and spend the blood
  async _applyHeal(amount) {
    const actor = this.document;
    const levels = foundry.utils.deepClone(actor.system.health.levels);
    const keys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];

    let bash = 0, leth = 0, agg = 0;
    for (const k of keys) {
      if (levels[k] === 1) bash++;
      else if (levels[k] === 2) leth++;
      else if (levels[k] === 3) agg++;
    }

    let healed = 0;
    for (let i = 0; i < amount; i++) {
      if (leth > 0) leth--;
      else if (bash > 0) bash--;
      else break;
      healed++;
    }

    // Rebuild track: agg on top, then lethal, then bashing, rest empty
    let idx = 0;
    for (let i = 0; i < agg; i++) levels[keys[idx++]] = 3;
    for (let i = 0; i < leth; i++) levels[keys[idx++]] = 2;
    for (let i = 0; i < bash; i++) levels[keys[idx++]] = 1;
    while (idx < keys.length) levels[keys[idx++]] = 0;

    const newBlood = Math.max(0, (actor.system.blood.value || 0) - healed);
    await actor.update({ 'system.health.levels': levels, 'system.blood.value': newBlood });
    return healed;
  }

  _healAmountDialog(max) {
    const opts = Array.from({ length: max }, (_, i) =>
      `<button type="button" class="diff-btn ${i === 0 ? 'active' : ''}" data-amt="${i + 1}">${i + 1}</button>`).join('');
    const content = `
      <form class="vtm-roll-dialog jump-dialog">
        <div class="form-group">
          <label>Blood Points to Spend (heals 1 level each)</label>
          <input type="hidden" name="amount" value="1" />
          <div class="diff-buttons">${opts}</div>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: 'Heal with Blood',
        content,
        buttons: {
          heal: {
            icon: '<i class="fas fa-tint"></i>',
            label: 'Heal',
            callback: html => resolve(parseInt(html[0].querySelector('[name="amount"]').value) || 1),
          }
        },
        render: html => {
          html.find('.diff-btn').click(ev => {
            html.find('.diff-btn').removeClass('active');
            ev.currentTarget.classList.add('active');
            html.find('[name="amount"]').val(ev.currentTarget.dataset.amt);
          });
        },
        default: 'heal',
        close: () => resolve(null)
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 340 }).render(true);
    });
  }


  // -- Falling damage ------------------------------------------------------

  async _rollFalling() {
    const actor = this.document;
    const choice = await this._fallingDialog();
    if (!choice) return;

    const meters = choice.unit === 'meters' ? choice.height : choice.height * 0.3048;
    let dice = Math.floor(meters / 3);
    const terminal = dice >= 10;
    dice = Math.min(dice, 10);
    if (dice < 1) return ui.notifications.info('Not high enough to cause damage.');

    // Terminal velocity or sharp objects → lethal; otherwise bashing
    const dmgType = (terminal || choice.sharp) ? 'lethal' : 'bashing';

    const roll = new Roll(`${dice}d10`);
    await roll.evaluate();
    const { dice: diceResults, total } = this._tallyDice(roll, 6);

    if (total <= 0) {
      await this._emitRollCard(actor, {
        roll, label: 'Falling Damage', pool: dice, difficulty: 6,
        dice: diceResults, total: 0, outcome: 'failure',
        extra: `${choice.height} ${choice.unit} fall. No damage.`,
      });
      return;
    }

    // Build soak label for the card
    const stamina = actor.system.attributes?.stamina || 0;
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const fullArmor = Array.from(actor.items)
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    const armorUsed = terminal ? Math.floor(fullArmor / 2) : fullArmor;

    const soakParts = [`Sta ${stamina}`];
    if (fortLevel) soakParts.push(`Fort ${fortLevel}`);
    if (armorUsed) soakParts.push(`Armor ${armorUsed}${terminal ? ' (halved)' : ''}`);

    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    if (actor.type === 'mortal' && dmgType === 'lethal') {
      await applyHealthDamage(actor, total, dmgType);
      await checkIncapacitated(actor);
      const cond = getCondition(actor);
      const pen = actor.system.woundPenalty || 0;
      const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
        attackerName: 'Fall', attackerImg: actor.img,
        attackerPortraitStyle: portraitStyle,
        defenderName: actor.name, defenderImg: actor.img,
        defenderPortraitStyle: portraitStyle,
        weaponName: 'Fall', damageType: dmgType,
        dmgPool: dice, dmgLabel: `${choice.height} ${choice.unit} fall`,
        dmgDice: diceResults, dmgSuccesses: total,
        soakPool: 0, soakLabel: 'Mortal cannot soak lethal damage',
        soakDice: [], soakSuccesses: 0, soakSkipped: true,
        netDamage: total, noDamage: total === 0,
        damageAdjustment: null,
        condition: cond, penalty: pen ? `${pen}` : null,
      });

      await showDice(roll, actor);
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatHtml,
        type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
      return;
    }

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/falling-card.hbs', {
      actorImg: actor.img, actorName: actor.name, portraitStyle,
      height: choice.height, unit: choice.unit, dmgType,
      pool: dice, dice: diceResults, total, terminal,
      soakLabel: soakParts.join(' + '),
    });

    const flags = { 'vtm-v20': { fall: {
      actorUuid: actor.uuid, dmgTotal: total, dmgType, terminal,
    }}};

    await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER, flags,
    });
  }

  // Soak roll for falling damage, called from the chat button hook
  async _rollFallingSoak(fallData) {
    const actor = this.document;
    if (actor.type === 'mortal' && String(fallData.dmgType || '').toLowerCase() === 'lethal') {
      const net = Math.max(Number(fallData.dmgTotal) || 0, 0);
      if (net > 0) await applyHealthDamage(actor, net, fallData.dmgType);
      await checkIncapacitated(actor);

      const cond = getCondition(actor);
      const pen = actor.system.woundPenalty || 0;
      const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
      let portraitStyle = '';
      if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
        const r = 0.213 / (pFlags.scale ?? 1);
        portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
      }

      const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
        attackerName: 'Fall', attackerImg: actor.img,
        attackerPortraitStyle: portraitStyle,
        defenderName: actor.name, defenderImg: actor.img,
        defenderPortraitStyle: portraitStyle,
        weaponName: 'Fall', damageType: fallData.dmgType,
        dmgPool: fallData.dmgTotal, dmgLabel: `${fallData.dmgTotal} ${fallData.dmgType}`,
        dmgDice: [], dmgSuccesses: fallData.dmgTotal,
        soakPool: 0, soakLabel: 'Mortal cannot soak lethal damage',
        soakDice: [], soakSuccesses: 0, soakSkipped: true,
        netDamage: net, noDamage: net === 0,
        damageAdjustment: null,
        condition: cond, penalty: pen ? `${pen}` : null,
      });

      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatHtml,
        type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
      return;
    }

    const stamina = actor.system.attributes?.stamina || 0;
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const fullArmor = Array.from(actor.items)
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    const armorUsed = fallData.terminal ? Math.floor(fullArmor / 2) : fullArmor;

    const pool = Math.max(stamina + fortLevel + armorUsed, 1);
    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total: soaked } = this._tallyDice(roll, 6);

    const rawNet = Math.max(fallData.dmgTotal - soaked, 0);
    const net = finalDamageAfterSoak(actor, rawNet, fallData.dmgType);
    if (net > 0) await applyHealthDamage(actor, net, fallData.dmgType);
    await checkIncapacitated(actor);

    const cond = getCondition(actor);
    const pen = actor.system.woundPenalty || 0;

    const soakParts = [`Sta ${stamina}`];
    if (fortLevel) soakParts.push(`Fort ${fortLevel}`);
    if (armorUsed) soakParts.push(`Armor ${armorUsed}${fallData.terminal ? ' (halved)' : ''}`);

    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
      attackerName: 'Fall', attackerImg: actor.img,
      attackerPortraitStyle: portraitStyle,
      defenderName: actor.name, defenderImg: actor.img,
      defenderPortraitStyle: portraitStyle,
      weaponName: 'Fall', damageType: fallData.dmgType,
      dmgPool: fallData.dmgTotal, dmgLabel: `${fallData.dmgTotal} ${fallData.dmgType} (pre-soak)`,
      dmgDice: [], dmgSuccesses: fallData.dmgTotal,
      soakPool: pool, soakLabel: soakParts.join(' + '),
      soakDice: dice, soakSuccesses: soaked,
      netDamage: net, noDamage: net === 0,
      damageAdjustment: rawNet !== net ? `Vampire bashing damage halved: ${rawNet} to ${net}.` : null,
      condition: cond, penalty: pen ? `${pen}` : null,
    });

    await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  _fallingDialog() {
    const content = `
      <form class="vtm-roll-dialog jump-dialog">
        <div class="form-group">
          <label>Height</label>
          <div class="fall-height-row">
            <input type="number" name="height" value="10" min="1" step="1" class="fall-height" />
            <select name="unit" class="fall-unit">
              <option value="meters" selected>Meters</option>
              <option value="feet">Feet</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Surface</label>
          <div class="jump-type-row">
            <label class="jump-type"><input type="radio" name="surface" value="solid" checked /> Solid Ground</label>
            <label class="jump-type"><input type="radio" name="surface" value="sharp" /> Sharp Objects</label>
          </div>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: 'Falling Damage',
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-arrow-down"></i>',
            label: 'Fall',
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({
                height: parseFloat(form.height.value) || 10,
                unit: form.unit.value,
                sharp: form.surface.value === 'sharp',
              });
            }
          }
        },
        default: 'roll',
        close: () => resolve(null)
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 340 }).render(true);
    });
  }


  // -- Jump roll -----------------------------------------------------------

  async _rollJump(opts = {}) {
    const actor = this.document;
    let pool, difficulty, label;

    if (opts.poolOverride) {
      // Resolution phase: skip the dialog, use assigned pool
      pool = opts.poolOverride;
      difficulty = opts.difficulty || 6;
      label = opts.label || 'Jump';
    } else {
      const str = effectiveStrength(actor);
      const ath = actor.system.abilities?.athletics || 0;
      const woundPen = actor.system.woundPenalty || 0;
      const potAuto = potenceAutoSuccesses(actor);

      const choice = await this._jumpDialog(str, ath, woundPen, potAuto);
      if (!choice) return;

      const running = choice.type === 'running';
      pool = Math.max(str + (running ? ath : 0) + choice.mod + woundPen, 1);
      const labelBase = running
        ? `Running Jump (Strength + Athletics)`
        : `Standing Jump (Strength)`;
      const baseDifficulty = choice.difficulty;
      difficulty = blindedDifficulty(actor, baseDifficulty);
      label = difficulty > baseDifficulty ? `${labelBase} | blinded diff +2` : labelBase;

      if (game.vtm?._captureAction) {
        const cb = game.vtm._captureAction;
        game.vtm._captureAction = null;
        cb({ label: labelBase, pool, difficulty, source: 'jump' });
        return;
      }
    }

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    let { dice, total: diceTotal, outcome } = this._tallyDice(roll, difficulty);
    const autoSucc = potenceAutoSuccesses(this.document);
    const total = diceTotal + autoSucc;
    if (total > 0 && outcome !== 'success') outcome = 'success';
    else if (autoSucc > 0 && outcome === 'botch') outcome = 'failure';

    let extra;
    if (outcome === 'success') {
      extra = `Clears ${total * 3} ft / ${total} m across, or ${total * 2} ft / ${total * 0.5} m up`;
    } else if (outcome === 'failure') {
      extra = 'Fell short of the distance.';
    } else {
      extra = 'Slipped, hit the wall or fell';
    }

    const flags = { 'vtm-v20': { jump: { actorUuid: actor.uuid } } };
    await this._emitRollCard(actor, {
      roll, label, pool, difficulty, dice, total, outcome, extra, ledgeBtn: true, flags,
      autoSuccesses: autoSucc, diceTotal,
    });
  }

  // Ledge catch on a failed jump (Dexterity + Athletics, diff 6). Callable
  // from the chat-card button even when the sheet isn't rendered.
  async _rollLedgeCatch() {
    const actor = this.document;
    const dex = actor.system.attributes?.dexterity || 0;
    const ath = actor.system.abilities?.athletics || 0;
    const woundPen = actor.system.woundPenalty || 0;

    const top = `
        <div class="form-group">
          <label>Catch a Ledge</label>
          <div class="ledge-pool-row">Dexterity + Athletics <span class="jump-pool">${dex + ath}</span></div>
        </div>`;
    const res = await this._rollOptionsDialog({ title: 'Catch a Ledge', top, defaultDiff: 6, woundPen });
    if (!res) return;

    const pool = Math.max(dex + ath + res.mod + woundPen, 1);
    const baseDifficulty = res.difficulty;
    const difficulty = blindedDifficulty(actor, baseDifficulty);
    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);

    let extra;
    if (outcome === 'success') extra = 'Caught a ledge or safety as they fell';
    else if (outcome === 'failure') extra = 'Failed to catch hold';
    else extra = 'Slipped, hit the wall or fell';

    await this._emitRollCard(actor, {
      roll,
      label: difficulty > baseDifficulty
        ? 'Catch a Ledge (Dexterity + Athletics) | blinded diff +2'
        : 'Catch a Ledge (Dexterity + Athletics)',
      pool,
      difficulty,
      dice,
      total,
      outcome,
      extra,
    });
  }

  async _jumpDialog(str, ath, woundPen = 0, potAuto = 0) {
    const potText = potAuto ? ` (+${potAuto} auto)` : '';
    const top = `
        <div class="form-group">
          <label>Jump Type</label>
          <div class="jump-type-row">
            <label class="jump-type"><input type="radio" name="jumpType" value="standing" checked /> Standing <span class="jump-pool">Str ${str}${potText}</span></label>
            <label class="jump-type"><input type="radio" name="jumpType" value="running" /> Running <span class="jump-pool">Str ${str} + Ath ${ath}${potText}</span></label>
          </div>
        </div>`;
    const res = await this._rollOptionsDialog({ title: 'Jump', top, defaultDiff: 3, woundPen, potAuto, buttonLabel: 'Jump' });
    if (!res) return null;
    return { type: res.form.jumpType.value, difficulty: res.difficulty, mod: res.mod };
  }

  _rollOptionsDialog({ title, top = '', defaultDiff = 6, woundPen = 0, potAuto = 0, buttonLabel = 'Roll' }) {
    const diffBtns = [3, 4, 5, 6, 7, 8, 9, 10]
      .map(d => `<button type="button" class="diff-btn ${d === defaultDiff ? 'active' : ''}" data-diff="${d}">${d}</button>`)
      .join('');
    const woundRow = woundPen ? `
        <div class="form-group wound-pen-row">
          <label>Wound Penalty</label>
          <span class="wound-pen-val">${woundPen}</span>
        </div>` : '';
    const potenceRow = potAuto ? `
        <div class="form-group wound-pen-row potence-row">
          <label>Potence (auto-successes)</label>
          <span class="wound-pen-val">+${potAuto}</span>
        </div>` : '';
    const content = `
      <form class="vtm-roll-dialog jump-dialog">${top}
        <div class="form-group">
          <label>Modifier</label>
          <input type="number" name="modifier" value="0" />
        </div>${woundRow}${potenceRow}
        <div class="form-group">
          <label>Difficulty</label>
          <input type="hidden" name="difficulty" value="${defaultDiff}" />
          <div class="diff-buttons">${diffBtns}</div>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title,
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: buttonLabel,
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({
                form,
                difficulty: parseInt(form.difficulty.value) || defaultDiff,
                mod: parseInt(form.modifier.value) || 0,
              });
            }
          }
        },
        render: html => {
          html.find('.diff-btn').click(ev => {
            html.find('.diff-btn').removeClass('active');
            ev.currentTarget.classList.add('active');
            html.find('[name="difficulty"]').val(ev.currentTarget.dataset.diff);
          });
        },
        default: 'roll',
        close: () => resolve(null)
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 340 }).render(true);
    });
  }


  // -- Money dialog --------------------------------------------------------

  _editMoney() {
    const total = (this.document.system.money?.dollars ?? 0)
      + (this.document.system.money?.cents ?? 0) / 100;
    const content = `
      <form class="money-dialog-form">
        <div class="money-row">
          <label>Adjust By</label>
          <div class="money-field">
            <span class="money-dollar">$</span>
            <input type="number" name="adjust" value="1.00" min="0" step="0.01" />
          </div>
        </div>
        <div class="money-row">
          <label>Balance</label>
          <div class="money-balance-row">
            <button type="button" class="money-adj" data-adj="-1"><i class="fas fa-minus"></i></button>
            <div class="money-field">
              <span class="money-dollar">$</span>
              <input type="number" name="balance" value="${total.toFixed(2)}" min="0" step="0.01" />
            </div>
            <button type="button" class="money-adj" data-adj="1"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </form>`;
    new Dialog({
      title: `${this.document.name}: Money`,
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Save',
          callback: html => {
            const val = Math.max(0, parseFloat(html.find('[name="balance"]').val()) || 0);
            this.document.update({
              'system.money.dollars': Math.floor(val),
              'system.money.cents': Math.round((val - Math.floor(val)) * 100)
            });
          }
        }
      },
      default: 'save',
      render: html => {
        html.find('.money-adj').click(ev => {
          const sign = parseFloat(ev.currentTarget.dataset.adj);
          const step = parseFloat(html.find('[name="adjust"]').val()) || 1;
          const bal = html.find('[name="balance"]');
          bal.val(Math.max(0, (parseFloat(bal.val()) || 0) + sign * step).toFixed(2));
        });
      }
    }, { classes: ['vtm-v20'], width: 300 }).render(true);
  }

  _playMoneyAnimation() {
    const section = this.element?.querySelector('.money-section');
    if (!section) return;
    const img = document.createElement('img');
    img.src = 'systems/vtm-v20/VTM icons/Money.png';
    img.className = 'money-anim';
    section.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
  }

  // Blood effect over the portrait when healing or spending blood: three sprite
  // strips played back to back (buildup -> swirl -> dissipate). Attached to the
  // window frame, not the portrait, so it survives the re-render the blood change
  // triggers; guarded so rapid clicks don't restart it mid-play.
  _playHealAnimation() {
    if (this._healAnimPlaying) return;
    const root = this.element;
    const portrait = root?.querySelector('.portrait');
    if (!portrait) return;

    this._healAnimPlaying = true;

    foundry.audio.AudioHelper.play({
      src: 'systems/vtm-v20/VTM icons/Blood Consumption Sound effect.mp3', volume: 0.6, loop: false
    }, false);

    // Center over the portrait, positioned relative to the (persistent) frame
    const rr = root.getBoundingClientRect();
    const pr = portrait.getBoundingClientRect();
    const fx = document.createElement('div');
    fx.className = 'blood-heal-anim';
    fx.style.left = `${pr.left - rr.left + pr.width / 2}px`;
    fx.style.top = `${pr.top - rr.top + pr.height / 2}px`;
    root.appendChild(fx);

    const parts = [
      { img: 'Blood Usage Animation 1.png', cls: 'part1' },
      { img: 'Blood Usage Animation 2.png', cls: 'part2' },
      { img: 'Blood Usage Animation 3.png', cls: 'part3' },
    ];

    // Safety net so a missed animationend can't leave the guard stuck on
    const guard = setTimeout(() => { fx.remove(); this._healAnimPlaying = false; }, 2500);

    let i = 0;
    const next = () => {
      if (i >= parts.length) {
        clearTimeout(guard);
        fx.remove();
        this._healAnimPlaying = false;
        return;
      }
      const p = parts[i++];
      fx.classList.remove('part1', 'part2', 'part3');
      void fx.offsetWidth; // reflow so the next part's animation restarts cleanly
      fx.style.backgroundImage = `url('systems/vtm-v20/VTM icons/${p.img}')`;
      fx.classList.add(p.cls);
    };
    fx.addEventListener('animationend', next);
    next();
  }
}
