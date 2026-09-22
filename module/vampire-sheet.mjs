import { VTM } from './config.mjs';
import { showDice, promptRollAdjust } from './dice.mjs';
import { TRAIT_DESCRIPTIONS } from './trait-descriptions.mjs';
import { ChargenWizard } from './chargen.mjs';
import { applyHealthDamage, checkIncapacitated, computeSoakPool, finalDamageAfterSoak, getCondition, clinchInflictDamage, clinchEscape, holdEscape, standUp } from './combat.mjs';
import { blindedDifficulty, hasStatus, statusIconVisibility, FRENZY_STATUS_ID, ROTSCHRECK_STATUS_ID } from './status-effects.mjs';
import { archetypeInfo } from './archetypes-data.mjs';
import { archetypeAuthentic, traitAuthentic } from './authentic-store.mjs';
import { disciplineLevel, isDisciplineActive, potenceLevel, potenceAutoSuccesses, celerityLevel, effectiveTraitValue, effectiveStrength, usesStrengthTrait } from './discipline-effects.mjs';
import { exportSheet } from './sheet-export.mjs';
import { computeCarry } from './movement.mjs';
import { trackSize, countDamage, rebuildTrack } from './health-track.mjs';

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

// Burst needs the star in the rate ('21*'); full auto is any gun cycling 10+
// rounds a turn, with system.fullAuto overriding the two liars (the burst-only
// 93R at rate 15, the USAS-12 hosing at rate 6).
function fireModeInfo(atk) {
  if (!atk?.isRanged) return null;
  const rateStr = String(atk.rate || '');
  const rateNum = parseInt(rateStr) || 0;
  const burst = rateStr.includes('*');
  const auto = atk.fullAuto === 'yes' || (atk.fullAuto !== 'no' && rateNum >= 10);
  if (!burst && !auto) return null;
  return { rateNum, burst, auto };
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
        { icon: "fas fa-file-export", label: "Export Sheet", action: "exportSheet" },
        { icon: "fas fa-heart-circle-plus", label: "Health Levels", action: "manageHealth" },
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
      resYield: VampireSheet.#onResYield,
      resDelay: VampireSheet.#onResDelay,
      resActNow: VampireSheet.#onResActNow,
      resDeferDelay: VampireSheet.#onResDeferDelay,
      resDeferredNow: VampireSheet.#onResDeferredNow,
      toggleCompact: VampireSheet.#onToggleCompact,
      exportSheet: VampireSheet.#onExportSheet,
      manageHealth: VampireSheet.#onManageHealth,
    }
  };

  _getHeaderControls() {
    const controls = super._getHeaderControls();
    return game.user.isGM ? controls : controls.filter(c => c.action !== 'manageHealth');
  }

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
  _bioTab = 'bio';
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
  _resBloodSpent = 0;
  _targetingChoice = 'medium';
  _targetingHeadshot = false;
  _targetingDrawer = null;
  _movementActive = false;
  _movementDrawer = null;
  _combatDrawer = null;
  _bloodBuffDrawer = null;
  _bloodBuffOpen = false;
  _bloodBudgetPanel = null;
  _declTimerBar = null;
  _declTimerInterval = null;
  _declTimerStart = 0;

  // Route combat advancement through the GM so players don't hit permission errors
  static async _gmAdvance(action, combat) {
    if (game.user.isGM) {
      const mod = await import('./initiative.mjs');
      mod[action](combat);
    } else {
      game.socket.emit('system.vtm-v20', { action, combatId: combat.id });
    }
  }

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
    const flankMode = actor.getFlag('vtm-v20', 'flankMode');
    ctx.flankAttack = flankMode === 'flank';
    ctx.rearAttack = flankMode === 'rear';
    ctx.posLabel = flankMode === 'rear' ? 'Rear +2' : flankMode === 'flank' ? 'Flank +1' : 'Position';
    const rangeMode = actor.getFlag('vtm-v20', 'rangeMode');
    ctx.rangePointBlank = rangeMode === 'pointblank';
    ctx.rangeMax = rangeMode === 'max';
    ctx.rangeLabel = rangeMode === 'pointblank' ? 'Point Blank' : rangeMode === 'max' ? 'Max Range' : 'Range';
    ctx.multiOpp = actor.getFlag('vtm-v20', 'multiOpp') || 0;
    ctx.weaponLength = actor.getFlag('vtm-v20', 'weaponLength') === true;

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
    ctx.disciplines = items.filter(i => i.type === 'discipline').sort((a, b) => a.sort - b.sort).map(d => ({
      _id: d._id, name: d.name, img: d.img, system: d.system,
      activatable: true,
      active: isDisciplineActive(actor, d.name),
    }));
    ctx.backgrounds = items.filter(i => i.type === 'background').sort((a, b) => a.sort - b.sort);

    const allPaths = items.filter(i => i.type === 'path').sort((a, b) => a.sort - b.sort);
    const pathsByCategory = {};
    for (const p of allPaths) {
      const cat = p.system.category || 'thaumaturgical';
      (pathsByCategory[cat] ??= []).push(p);
    }
    ctx.pathCategories = Object.entries(pathsByCategory).map(([key, paths]) => ({
      key, label: key.charAt(0).toUpperCase() + key.slice(1) + ' Paths', paths
    }));
    ctx.hasPaths = allPaths.length > 0;

    ctx.rituals = items.filter(i => i.type === 'ritual').sort((a, b) => {
      const diff = a.system.level - b.system.level;
      return diff !== 0 ? diff : a.sort - b.sort;
    });

    ctx.merits = items.filter(i => i.type === 'merit' && i.system.cost >= 0).sort((a, b) => a.sort - b.sort);
    ctx.flaws = items.filter(i => i.type === 'merit' && i.system.cost < 0).sort((a, b) => a.sort - b.sort);
    ctx.ambidextrous = items.some(i => i.type === 'merit' && /ambidext/i.test(i.name));
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
      img: 'systems/vtm-v20/VTM icons/high-punch.svg',
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
    attacks.push({
      id: 'clinch', name: 'Clinch',
      img: 'systems/vtm-v20/VTM icons/grab.svg',
      pool: `Str + Brawl (${strVal + (sys.abilities?.brawl || 0)})`,
      damage: damageDisplay('Str', strVal, potAuto),
      damageType: 'bashing', damageFormula: 'Str',
      skill: 'abilities.brawl', isRanged: false,
      poolTraits: ['attributes.strength', 'abilities.brawl'],
      clinch: true,
      note: 'On a hit, locks both combatants in the grapple',
    });
    const disarmWeapon = items.find(i => i.type === 'weapon' && i.system.equipped && !i.system.range);
    attacks.push({
      id: 'disarm', name: 'Disarm',
      img: 'systems/vtm-v20/VTM icons/Disarm.svg',
      pool: `Dex + Melee (${dex + (sys.abilities?.melee || 0)})`,
      damage: 'Special', damageType: '',
      damageFormula: disarmWeapon?.system.damage || 'Str',
      skill: 'abilities.melee', isRanged: false,
      difficultyMod: 1, difficultyLabel: '+1',
      disarm: true,
      note: 'Damage roll vs target Strength: beat it to disarm. No damage either way',
    });
    attacks.push({
      id: 'hold', name: 'Hold',
      img: 'systems/vtm-v20/VTM icons/grab.svg',
      pool: `Str + Brawl (${strVal + (sys.abilities?.brawl || 0)})`,
      hideDamage: true,
      damageFormula: '', damageType: '',
      skill: 'abilities.brawl', isRanged: false,
      poolTraits: ['attributes.strength', 'abilities.brawl'],
      difficultyMod: 1, difficultyLabel: '+1',
      hold: true,
      note: 'No damage. Pins the target until they break free',
    });
    attacks.push({
      id: 'sweep', name: 'Sweep',
      img: 'systems/vtm-v20/VTM icons/falling.svg',
      pool: `Dex + Brawl/Melee (${dex + (sys.abilities?.brawl || 0)}/${dex + (sys.abilities?.melee || 0)})`,
      damage: damageDisplay('Str', strVal, potAuto),
      damageType: 'bashing', damageFormula: 'Str',
      skill: 'abilities.brawl', isRanged: false,
      difficultyMod: 1, difficultyLabel: '+1',
      sweep: true,
      note: 'Target saves Dex + Athletics (diff 8) or is knocked down',
    });
    attacks.push({
      id: 'tackle', name: 'Tackle',
      icon: 'fa-person-falling-burst',
      pool: `Str + Brawl (${strVal + (sys.abilities?.brawl || 0)})`,
      damage: damageDisplay('Str+1', strVal, potAuto),
      damageType: 'bashing', damageFormula: 'Str+1',
      skill: 'abilities.brawl', isRanged: false,
      poolTraits: ['attributes.strength', 'abilities.brawl'],
      difficultyMod: 1, difficultyLabel: '+1',
      tackle: true,
      note: 'Both combatants save Dex + Athletics (diff 7) or are knocked down',
    });
    if (actor.type === 'vampire') {
      // Skin of the Adder sharpens the fangs: +1 bite damage while active
      const biteDmg = actor.getFlag('vtm-v20', 'skinOfTheAdder') ? 'Str+2' : 'Str+1';
      attacks.push({
        id: 'bite', name: 'Bite',
        img: 'systems/vtm-v20/VTM icons/fangs.svg',
        pool: `Dex + Brawl + 1 (${dex + (sys.abilities?.brawl || 0) + 1})`,
        damage: damageDisplay(biteDmg, strVal, potAuto),
        damageType: 'aggravated', damageFormula: biteDmg,
        skill: 'abilities.brawl', isRanged: false,
        accuracyMod: 1, bite: true,
        note: 'Only in a clinch, hold, or tackle',
      });
    }
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
        rate: w.system.rate, fullAuto: w.system.fullAuto || '', firearm: !!w.system.firearm, ammoLabel: ammoLabel(w.system),
        offHand: !!w.system.offHand,
        note: w.system.offHand ? (ctx.ambidextrous ? 'Off hand (Ambidextrous: no penalty)' : 'Off hand: +1 difficulty') : '',
      });
    }
    if (actor.getFlag('vtm-v20', 'horridReality')) {
      const manip = sys.attributes?.manipulation || 0;
      const sub = sys.abilities?.subterfuge || 0;
      attacks.push({
        id: 'horrid-reality', name: 'Horrid Reality Injury',
        icon: 'fa-brain',
        pool: `Man + Sub (${manip + sub})`,
        damage: 'successes', damageType: 'lethal',
        damageFormula: 'special', isRanged: false,
        horridReality: true,
      });
    }
    const serpentis = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'serpentis');
    const tongueSkill = actor.getFlag('vtm-v20', 'tongueSkill');
    if (serpentis && serpentis.system.level >= 2 && tongueSkill) {
      const skillVal = sys.abilities?.[tongueSkill] || 0;
      const skillLabel = tongueSkill.charAt(0).toUpperCase() + tongueSkill.slice(1);
      attacks.push({
        id: 'tongue-of-the-asp', name: 'Tongue of the Asp',
        icon: 'fa-dragon',
        pool: `Dex + ${skillLabel} (${dex + skillVal})`,
        damage: damageDisplay('Str', strVal, potAuto),
        damageType: 'aggravated', damageFormula: 'Str',
        skill: `abilities.${tongueSkill}`, isRanged: false,
      });
    }
    const quietus = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'quietus');
    if (quietus && quietus.system.level >= 5) {
      const sta = effectiveTraitValue(actor, 'attributes.stamina');
      const ath = sys.abilities?.athletics || 0;
      const potLvl = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'potence')?.system.level || 0;
      const rangeDots = (sys.attributes?.strength || 0) + potLvl;
      attacks.push({
        id: 'taste-of-death', name: 'Taste of Death',
        icon: 'fa-droplet',
        pool: `Sta + Ath (${sta + ath})`,
        damage: '2/blood agg', damageType: 'aggravated',
        damageFormula: 'special',
        poolTraits: ['attributes.stamina', 'abilities.athletics'],
        isRanged: true, range: `${rangeDots * 10}ft`,
        tasteOfDeath: true,
      });
    }
    attacks.push({
      id: 'get-up', name: 'Get Up',
      icon: 'fa-person-arrow-up-from-line',
      pool: `Dex + Athletics (${dex + (sys.abilities?.athletics || 0)})`,
      skill: 'abilities.athletics', isRanged: false,
      isAction: true, actionDifficulty: 4,
      note: 'Success removes the prone and knockdown effects',
    });
    attacks.push({
      id: 'ready-weapon', name: 'Ready Weapon',
      img: 'systems/vtm-v20/VTM icons/switch-weapon.svg',
      pool: `Dex + Melee (${dex + (sys.abilities?.melee || 0)}) / Dex + Firearms (${dex + (sys.abilities?.firearms || 0)})`,
      isRanged: false,
      isAction: true, isReadyWeapon: true,
      actionDifficulty: 4,
    });
    ctx.attacks = attacks;
    this._attacks = attacks;

    // Declaration + Resolution (inline in combat tab)
    const brawlVal = sys.abilities?.brawl || 0;
    const ath = sys.abilities?.athletics || 0;
    const meleeVal = sys.abilities?.melee || 0;
    ctx.defenses = [
      { name: 'Dodge', defense: 'dodge', img: 'systems/vtm-v20/VTM icons/body-balance.svg', pool: dex + ath, poolLabel: 'Dex + Athletics', trait: 'attributes.dexterity', trait2: 'abilities.athletics' },
      { name: 'Block', defense: 'block', img: 'systems/vtm-v20/VTM icons/hand-bandage.svg', pool: dex + brawlVal, poolLabel: 'Dex + Brawl', trait: 'attributes.dexterity', trait2: 'abilities.brawl' },
      { name: 'Parry', defense: 'parry', img: 'systems/vtm-v20/VTM icons/sword-clash.svg', pool: dex + meleeVal, poolLabel: 'Dex + Melee', trait: 'attributes.dexterity', trait2: 'abilities.melee' },
    ];

    // Locked in a clinch: the only legal actions are hurting the partner or
    // trying to break out. No attacks, no defenses, until someone is free.
    const clinchState = actor.getFlag('vtm-v20', 'clinch');
    ctx.clinched = !!clinchState;
    if (clinchState) {
      const clinchOppName = canvas?.tokens?.get(clinchState.tokenId)?.name
        || game.actors.get(clinchState.actorId)?.name || 'opponent';
      attacks.length = 0;
      attacks.push({
        id: 'clinch-damage', name: 'Inflict Damage',
        img: 'systems/vtm-v20/VTM icons/grab.svg',
        pool: `Str (${strVal})`,
        damage: damageDisplay('Str', strVal, potAuto),
        damageType: 'bashing', damageFormula: 'Str',
        isRanged: false, clinchAction: 'damage',
        poolTraits: ['attributes.strength', 'abilities.brawl'],
        note: `Automatic damage to ${clinchOppName}`,
      }, {
        id: 'clinch-escape', name: 'Escape Clinch',
        img: 'systems/vtm-v20/VTM icons/grab.svg',
        pool: `Str + Brawl (${strVal + brawlVal})`,
        hideDamage: true,
        isRanged: false, clinchAction: 'escape',
        poolTraits: ['attributes.strength', 'abilities.brawl'],
        note: `Resisted roll against ${clinchOppName}`,
      });
      ctx.defenses = [];
    }

    // Held in someone's grip: the only action is trying to break out
    const heldState = actor.getFlag('vtm-v20', 'held');
    ctx.held = !clinchState && !!heldState;
    if (ctx.held) {
      const holderName = canvas?.tokens?.get(heldState.tokenId)?.name
        || game.actors.get(heldState.actorId)?.name || 'opponent';
      attacks.length = 0;
      attacks.push({
        id: 'hold-escape', name: 'Break Hold',
        img: 'systems/vtm-v20/VTM icons/grab.svg',
        pool: `Str + Brawl (${strVal + brawlVal})`,
        hideDamage: true,
        isRanged: false, clinchAction: 'hold-escape',
        poolTraits: ['attributes.strength', 'abilities.brawl'],
        note: `Resisted roll against ${holderName}`,
      });
      ctx.defenses = [];
    }
    ctx.grappleLocked = ctx.clinched || ctx.held;

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
      this._stopDeclTimer();
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
      this._resBloodSpent = 0;
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
        this._stopDeclTimer();
        this._declCombat = null;
        this._declCombatant = null;
        this._declActions = [];
        this._declFullDefense = false;
        this._declCapturing = false;
        game.vtm._captureAction = null;
      } else if (this._declCombatant?.getFlag('vtm-v20', 'declaration')) {
        this._stopDeclTimer();
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
        if (actor.getFlag('vtm-v20', 'wpIgnoreWounds')) {
          actor.unsetFlag('vtm-v20', 'wpIgnoreWounds');
        }
        this._resCombat = null;
        this._resCombatant = null;
        this._resExecuted = new Set();
        this._resSpent = new Map();
        this._resDefenseSpent = new Map();
        this._resTurnDone = false;
        this._resBloodSpent = 0;
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

    // Carrying capacity
    const carry = computeCarry(actor);
    ctx.carriedWeight = carry.weight;
    ctx.maxCarry = carry.maxCarry;
    ctx.encumbered = carry.encumbered;
    ctx.cannotMove = carry.cannotMove;
    ctx.moveHalves = carry.moveHalves;

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
    // Extra bruised boxes (Huge Size, GM additions) slot in right after Bruised
    const extraRows = (sys.health.extra ?? []).map((v, i) => ({
      key: `extra-${i}`,
      label: game.i18n.localize('VTM.HealthBruised'),
      penalty: 0, desc: healthDescs.bruised,
      damage: v,
      damageLabel: ['', '/', 'X', '*'][v],
      cssClass: ['', 'bashing', 'lethal', 'aggravated'][v]
    }));
    ctx.healthTrack.splice(1, 0, ...extraRows);
    if (actor.type === 'vampire') {
      ctx.healthTrack.push({ key: 'torpor', label: 'Torpor', penalty: null, desc: healthDescs.torpor, infoOnly: true });
    }

    // Soak
    const stamina = effectiveTraitValue(actor, 'attributes.stamina');
    const fort = items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const armorRating = items
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    ctx.soakPool = stamina + fortLevel + armorRating;
    const soakParts = [`Sta ${stamina}`];
    if (fortLevel) soakParts.push(`Fort ${fortLevel}`);
    if (armorRating) soakParts.push(`Armor ${armorRating}`);
    if (actor.getFlag('vtm-v20', 'skinOfTheAdder')) soakParts.push('diff 5');
    ctx.soakLabel = soakParts.join(' + ');

    ctx.bloodPct = sys.blood ? (sys.blood.max > 0 ? Math.round((sys.blood.value / sys.blood.max) * 100) : 0) : 0;
    // Hunger threshold: blood at or below 7 minus Self-Control/Instinct
    const hungerVirtue = sys.virtues?.selfControl || 0;
    ctx.hungerThreshold = Math.max(7 - hungerVirtue, 0);
    ctx.hungry = this.document.type === 'vampire' && (sys.blood?.value ?? 0) <= ctx.hungerThreshold;
    ctx.hungerLabel = actor.getFlag('vtm-v20', 'virtueLabels')?.selfControl || game.i18n.localize('VTM.SelfControl');
    ctx.natureInfo = archetypeAuthentic(sys.nature) || archetypeInfo(sys.nature);
    ctx.demeanorInfo = archetypeAuthentic(sys.demeanor) || archetypeInfo(sys.demeanor);
    ctx.humanityTip = this.document.type === 'vampire' && sys.pathName === 'Humanity';
    ctx.bloodPerTurn = sys.bloodPerTurn || 1;
    ctx.traitMax = sys.traitMax || 5;
    ctx.woundPenalty = sys.rawWoundPenalty || sys.woundPenalty || 0;
    const inFrenzy = hasStatus(FRENZY_STATUS_ID, actor);
    const inRotschreck = hasStatus(ROTSCHRECK_STATUS_ID, actor);
    ctx.frenzied = this.document.type === 'vampire' && (inFrenzy || inRotschreck);
    ctx.frenzyName = inFrenzy ? 'Frenzy' : 'R\u00f6tschreck';
    // Same art as the token status effect
    const statusImg = id => CONFIG.statusEffects?.find(e => e.id === id)?.img;
    ctx.frenzyIcon = inFrenzy ? statusImg(FRENZY_STATUS_ID) : statusImg(ROTSCHRECK_STATUS_ID);
    ctx.frenzyWpNote = inFrenzy
      ? 'Spend 1 Willpower to control one of your actions for a turn; the frenzy continues.'
      : 'Spend 1 Willpower to keep control for one turn.';
    ctx.brujahFrenzyNote = inFrenzy && /brujah/i.test(sys.clan || '');
    ctx.frenzyInstinct = this.document.type === 'vampire' && inFrenzy
      && /instinct/i.test(actor.getFlag('vtm-v20', 'virtueLabels')?.selfControl || '');
    ctx.woundsIgnored = !!actor.getFlag('vtm-v20', 'wpIgnoreWounds');

    const dollars = sys.money?.dollars ?? 0;
    const cents = sys.money?.cents ?? 0;
    ctx.moneyDisplay = `${dollars.toLocaleString()}.${String(cents).padStart(2, '0')}`;

    // Movement comes from the data model (movement.mjs), same numbers the
    // token bar reads
    const move = sys.movement;
    ctx.movement = { walk: move.walk, jog: move.jog, run: move.run, hobble: move.hobble, crawl: move.crawl };
    ctx.curMove = { label: move.curLabel, value: move.curValue };

    ctx.config = VTM;

    // Path, bearing, virtues
    const pathKey = sys.pathName || 'Humanity';
    const pathInfo = VTM.paths[pathKey] || VTM.paths['Humanity'];
    ctx.pathChoices = Object.keys(VTM.paths);
    const flagLabels = actor.getFlag('vtm-v20', 'virtueLabels');
    ctx.virtueLabels = flagLabels
      ? { conscience: flagLabels.conscience, selfControl: flagLabels.selfControl, courage: 'Courage' }
      : { ...pathInfo.virtues, courage: 'Courage' };
    ctx.bearingName = pathInfo.bearing;
    ctx.bearingLabel = VTM.bearingLabels[sys.humanity] ?? '';
    const mod = VTM.bearingModifiers[sys.humanity];
    if (mod === null) ctx.bearingMod = null;
    else if (mod < 0) ctx.bearingMod = `${mod} difficulty`;
    else if (mod > 0) ctx.bearingMod = `+${mod} difficulty`;
    else ctx.bearingMod = '';

    ctx.wpAdjective = TRAIT_DESCRIPTIONS.willpower[sys.willpower.max - 1] || '';
    ctx.wpSpent = !!actor.getFlag('vtm-v20', 'wpSpent');
    ctx.wpIgnoreWounds = !!actor.getFlag('vtm-v20', 'wpIgnoreWounds');

    const locked = actor.getFlag('vtm-v20', 'sheetLocked') !== false;
    ctx.isGM = game.user.isGM;
    ctx.lockState = locked;
    ctx.sheetLocked = locked && !game.user.isGM;

    const fx = [];
    if (actor.getFlag('vtm-v20', 'horridForm'))
      fx.push({ name: 'Horrid Form', icon: 'fa-skull', desc: 'Physical +3, Social 0, brawl +1 damage' });
    if (actor.getFlag('vtm-v20', 'wolfForm'))
      fx.push({ name: 'Wolf Form', icon: 'fa-paw', desc: 'Str+1 aggravated bite, double speed, Perception -2 diff' });
    if (actor.getFlag('vtm-v20', 'batForm'))
      fx.push({ name: 'Bat Form', icon: 'fa-crow', desc: 'Str 1, flight 20mph, hearing -3 diff, attacks vs you +2 diff' });
    if (actor.getFlag('vtm-v20', 'shadowPlay'))
      fx.push({ name: 'Shadow Play', icon: 'fa-moon', desc: '+1 difficulty on ranged attacks against you' });
    if (actor.getFlag('vtm-v20', 'horridReality'))
      fx.push({ name: 'Horrid Reality', icon: 'fa-brain', desc: 'Horrid Reality Injury attack available (Man + Sub vs Perc + SC, no soak)' });
    if (actor.getFlag('vtm-v20', 'skinOfTheAdder'))
      fx.push({ name: 'Skin of the Adder', icon: 'fa-shield-alt', desc: 'Soak diff 5, can soak agg (claws/fangs), bite +1 damage, Appearance 1' });
    if (actor.items.find(i => i.type === 'weapon' && i.name === 'Feral Claws'))
      fx.push({ name: 'Feral Claws', icon: 'fa-hand-rock', desc: 'Str+1 aggravated, climbing diff -2' });
    if (actor.items.find(i => i.type === 'weapon' && i.name === 'Bone Spikes'))
      fx.push({ name: 'Bone Spikes', icon: 'fa-bone', desc: 'Str+1 lethal damage' });
    if (actor.getFlag('vtm-v20', 'boneQuills'))
      fx.push({ name: 'Bone Quills', icon: 'fa-shield-virus', desc: 'Melee attackers take their Str in lethal (unless 3+ attack successes). +2 grapple damage.' });
    if (actor.getFlag('vtm-v20', 'celerityBurst'))
      fx.push({ name: 'Movement Burst', icon: 'fa-wind', desc: `Movement speed x${celerityLevel(actor) + 1}` });
    if (actor.getFlag('vtm-v20', 'celerityActions'))
      fx.push({ name: 'Speed Burst', icon: 'fa-forward', desc: `+${Math.floor((celerityLevel(actor) || 0))} half-pools of action dice this round. Dex pools lose the Celerity bonus.` });
    ctx.activeEffects = fx;

    return ctx;
  }

  _prep(keys, data, prefix) {
    const specs = this.document.getFlag('vtm-v20', 'specialties') || {};
    const alwaysSpecialize = ['crafts', 'performance', 'academics', 'science'];
    return keys.map(key => {
      const val = data[key] || 0;
      const traitKey = `${prefix}.${key}`;
      const specKey = `${prefix}--${key}`; // no dots, Foundry expands dots into nested paths
      const canSpec = val >= 4 || alwaysSpecialize.includes(key);
      return {
        key,
        label: game.i18n.localize(`VTM.${key.charAt(0).toUpperCase() + key.slice(1)}`),
        value: val,
        path: `system.${prefix}.${key}`,
        rollKey: traitKey,
        specKey,
        specialties: specs[specKey] || [],
        canSpecialize: canSpec,
      };
    });
  }


  async _editSpecialties(traitKey, label) {
    const specs = this.document.getFlag('vtm-v20', 'specialties') || {};
    const existing = specs[traitKey] || [];

    // Build a row for each existing specialty + one blank
    const rows = [...existing, { name: '', desc: '' }];
    const rowsHtml = rows.map((s, i) => `
      <div class="spec-row" data-idx="${i}">
        <input type="text" class="spec-name" value="${(s.name || '').replace(/"/g, '&quot;')}" placeholder="Specialty name" />
        <textarea class="spec-desc" placeholder="Description (optional)" rows="2">${s.desc || ''}</textarea>
        <button type="button" class="spec-remove" title="Remove"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    const dlg = new Dialog({
      title: `${label} Specialties`,
      content: `
        <form class="vtm-spec-dialog">
          <div class="spec-rows">${rowsHtml}</div>
          <button type="button" class="spec-add"><i class="fas fa-plus"></i> Add Specialty</button>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Save',
          callback: async html => {
            const el = html instanceof HTMLElement ? html : html[0];
            const list = [];
            el.querySelectorAll('.spec-row').forEach(row => {
              const name = row.querySelector('.spec-name').value.trim();
              if (!name) return;
              const desc = row.querySelector('.spec-desc').value.trim();
              list.push(desc ? { name, desc } : { name });
            });
            const updated = { ...specs };
            if (list.length) updated[traitKey] = list;
            else delete updated[traitKey];
            await this.document.unsetFlag('vtm-v20', 'specialties');
            if (Object.keys(updated).length) await this.document.setFlag('vtm-v20', 'specialties', updated);
          },
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel' },
      },
      default: 'save',
      render: html => {
        const el = html instanceof HTMLElement ? html : html[0];
        const container = el.querySelector('.spec-rows');

        el.querySelector('.spec-add').addEventListener('click', () => {
          const row = document.createElement('div');
          row.className = 'spec-row';
          row.innerHTML = `
            <input type="text" class="spec-name" placeholder="Specialty name" />
            <textarea class="spec-desc" placeholder="Description (optional)" rows="2"></textarea>
            <button type="button" class="spec-remove" title="Remove"><i class="fas fa-trash"></i></button>
          `;
          container.appendChild(row);
          row.querySelector('.spec-name').focus();
          row.querySelector('.spec-remove').addEventListener('click', () => row.remove());
        });

        el.querySelectorAll('.spec-remove').forEach(btn => {
          btn.addEventListener('click', () => btn.closest('.spec-row').remove());
        });
      },
    }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
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
    // Chargen manages its own inputs; the lock overlay would eat the clicks
    el.classList.toggle('sheet-locked', locked && !game.user.isGM && !this._chargen);

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

    // Specialty editing
    if (canEdit) {
      el.querySelectorAll('.spec-edit').forEach(btn => {
        btn.addEventListener('click', ev => {
          ev.stopPropagation();
          const row = btn.closest('.trait-row');
          const traitKey = row.dataset.trait;
          const label = row.querySelector('.trait-label').dataset.label;
          this._editSpecialties(traitKey, label);
        });
      });
    }

    // Stat dots
    if (canEdit) {
      el.querySelectorAll('.dot-row:not(.item-dots) .dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const val = parseInt(dot.dataset.value);
          const path = dot.closest('.dot-row').dataset.path;
          // Nosferatu can't change Appearance
          if (path === 'system.attributes.appearance' && this.document.system.clan?.toLowerCase() === 'nosferatu') return;
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

    // Tongue of the Asp skill prompt (one-time when Serpentis reaches lvl 2)
    const serpItem = this.document.items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'serpentis');
    if (serpItem?.system.level >= 2 && !this.document.getFlag('vtm-v20', 'tongueSkill') && !this._tonguePromptShown) {
      this._tonguePromptShown = true;
      this._promptTongueSkill();
    }

    // Blood buff UI for physical attributes
    if (this.document.type === 'vampire') this._renderBloodBuffUI(el, canEdit);

    // Health, WP temp, blood (always interactive)
    el.querySelectorAll('.health-box').forEach(box =>
      box.addEventListener('click', () => {
        const level = box.dataset.level;
        if (level.startsWith('extra-')) {
          const idx = parseInt(level.slice(6), 10);
          const extra = [...(this.document.system.health.extra ?? [])];
          extra[idx] = ((extra[idx] || 0) + 1) % 4;
          this.document.update({ 'system.health.extra': extra });
          return;
        }
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
    el.querySelector('.throw-btn')?.addEventListener('click', () => this._rollThrowing());
    el.querySelector('.awaken-btn')?.addEventListener('click', () => this._rollAwakening());
    el.querySelector('.electro-btn')?.addEventListener('click', () => this._rollElectrocution());
    el.querySelector('.fire-btn')?.addEventListener('click', () => this._rollFire());
    el.querySelector('.sunlight-btn')?.addEventListener('click', () => this._rollSunlight());
    el.querySelector('.frenzy-check-btn')?.addEventListener('click', () => this._rollFrenzy());
    el.querySelector('.rotschreck-btn')?.addEventListener('click', () => this._rollRotschreck());
    el.querySelector('.end-frenzy-btn')?.addEventListener('click', () => this._endFrenzy());
    el.querySelector('.ride-wave-btn')?.addEventListener('click', () => this._rideTheWave());
    el.classList.toggle('frenzied', this.document.type === 'vampire'
      && (hasStatus(FRENZY_STATUS_ID, this.document) || hasStatus(ROTSCHRECK_STATUS_ID, this.document)));

    el.querySelector('.wp-spend-btn:not(.wp-ignore-wounds-btn)')?.addEventListener('click', () => this._toggleWpSpend());
    el.querySelector('.wp-ignore-wounds-btn')?.addEventListener('click', () => this._toggleWpIgnoreWounds());

    el.querySelector('.heal-btn')?.addEventListener('click', () => this._healWithBlood());
    el.querySelector('.heal-btn')?.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      this._reflexiveHealRoll();
    });

    el.querySelectorAll('.discipline-activate').forEach(btn => {
      btn.addEventListener('click', () => this._toggleDiscipline(btn.dataset.itemId));
    });

    el.querySelectorAll('.bg-roll').forEach(btn => {
      btn.addEventListener('click', () => {
        game.vtm.rollDicePool(this.document, {
          trait: `bg.${btn.dataset.itemId}`,
          label: btn.dataset.name,
        });
      });
    });

    el.querySelectorAll('.ritual-cast').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this.document.items.get(btn.dataset.itemId);
        if (!item) return;
        game.vtm.rollDicePool(this.document, {
          trait: item.system.primary,
          trait2: item.system.secondary,
          label: `Ritual: ${item.name}`,
          difficulty: item.system.castDifficulty,
        });
      });
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

    el.querySelectorAll('.item-open').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = btn.closest('[data-item-id]').dataset.itemId;
        this.document.items.get(id)?.sheet.render(true);
      }));

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

    el.querySelectorAll('.attack-btn:not(.reload-btn):not(.defense-roll-btn):not(.action-roll-btn)').forEach(btn =>
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const attackId = btn.dataset.attackId;
        try {
          // Declaration phase: add this attack to the declaration
          if (this._declCombat && !this._declFullDefense) {
            await this._declAddAttack(attackId);
            return;
          }
          // Resolution phase: use the declared pool (skip reloads, they have their own button)
          if (this._resCombat && this._resCombatant) {
            const defIdx = this._myDeferredIdx();
            if (!this._isMyResTurn() && defIdx === null) return;
            const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
            let idx;
            if (!this._isMyResTurn()) {
              // Deferred slot: only its own action may fire
              const a = (decl.actions || [])[defIdx];
              idx = (a && a.attackId === attackId && !a.reload) ? defIdx : -1;
            } else {
              idx = (decl.actions || []).findIndex((a, i) => a.attackId === attackId && !a.reload && !this._resExecuted.has(i));
            }
            if (idx >= 0) {
              await this._executeResAction(idx);
              return;
            }
            if (!this._isMyResTurn()) return;
          }
          // Normal (outside combat): do the attack
          const atk = this._attacks?.find(a => a.id === attackId);
          if (!atk) return;
          if (atk.horridReality) {
            await this._rollHorridReality();
            return;
          }
          if (atk.tasteOfDeath) {
            await this._rollTasteOfDeath();
            return;
          }
          if (atk.clinchAction) {
            if (atk.clinchAction === 'damage') await clinchInflictDamage(this.document);
            else if (atk.clinchAction === 'hold-escape') await holdEscape(this.document);
            else await clinchEscape(this.document);
            return;
          }
          const plan = await this._promptFireMode(atk);
          if (!plan) return;
          const targeting = this._getTargetingData();
          const spent = await this._spendAttackAmmo(atk, { count: plan.rounds });
          if (!spent) return;
          const fireOpts = plan.mode === 'single' ? {} : { fireMode: plan.mode, fireRounds: plan.rounds };
          await game.vtm.rollAttack(this.document, atk, { targeting, ...fireOpts });
        } catch (err) {
          console.error('VtM V20 | Attack failed', err);
          ui.notifications.error('Attack failed. Check the console for details.');
        } finally {
          btn.disabled = false;
        }
      }));

    // Right-click: same attack, but through the adjustment dialog first
    el.querySelectorAll('.attack-btn:not(.reload-btn):not(.defense-roll-btn):not(.action-roll-btn)').forEach(btn =>
      btn.addEventListener('contextmenu', async ev => {
        ev.preventDefault();
        if (this._declCombat && !this._declFullDefense) return;
        const attackId = btn.dataset.attackId;
        const atk = this._attacks?.find(a => a.id === attackId);
        if (!atk || atk.horridReality || atk.tasteOfDeath || atk.clinchAction) return;
        btn.disabled = true;
        try {
          if (this._resCombat && this._resCombatant) {
            const defIdx = this._myDeferredIdx();
            if (!this._isMyResTurn() && defIdx === null) return;
            const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
            let idx;
            if (!this._isMyResTurn()) {
              const a = (decl.actions || [])[defIdx];
              idx = (a && a.attackId === attackId && !a.reload) ? defIdx : -1;
            } else {
              idx = (decl.actions || []).findIndex((a, i) => a.attackId === attackId && !a.reload && !this._resExecuted.has(i));
            }
            if (idx >= 0) {
              await this._executeResAction(idx, true);
              return;
            }
            if (!this._isMyResTurn()) return;
          }
          // Outside combat: check ammo up front, only spend once the roll happens
          if (!(await this._spendAttackAmmo(atk, { dryRun: true }))) return;
          const plan = await this._promptFireMode(atk);
          if (!plan) return;
          const targeting = this._getTargetingData();
          const fireOpts = plan.mode === 'single' ? {} : { fireMode: plan.mode, fireRounds: plan.rounds };
          const result = await game.vtm.rollAttack(this.document, atk, { targeting, adjust: true, ...fireOpts });
          if (result !== false) await this._spendAttackAmmo(atk, { count: plan.rounds });
        } catch (err) {
          console.error('VtM V20 | Attack failed', err);
          ui.notifications.error('Attack failed. Check the console for details.');
        } finally {
          btn.disabled = false;
        }
      }));

    el.querySelectorAll('.action-roll-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        const actionId = btn.dataset.actionId;
        const readyType = btn.dataset.readyType;
        const action = this._attacks?.find(a => a.id === actionId);
        if (!action) return;

        const skill = readyType === 'ranged' ? 'abilities.firearms'
          : readyType === 'melee' ? 'abilities.melee' : action.skill;
        const label = readyType
          ? `Ready Weapon (${readyType === 'melee' ? 'Melee' : 'Ranged'})`
          : action.name;

        if (this._declCombat && !this._declFullDefense) {
          this._saveAllocations();
          this._declActions.push({ attackId: actionId, text: label, alloc: 1, readyType });
          this.render();
          return;
        }

        if (this._resCombat && this._resCombatant) {
          const defIdx = this._myDeferredIdx();
          if (!this._isMyResTurn() && defIdx === null) return;
          const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
          let idx;
          if (!this._isMyResTurn()) {
            const a = (decl.actions || [])[defIdx];
            idx = (a && a.attackId === actionId && (!readyType || a.readyType === readyType)) ? defIdx : -1;
          } else {
            idx = (decl.actions || []).findIndex((a, i) =>
              a.attackId === actionId && (!readyType || a.readyType === readyType) && !this._resExecuted.has(i));
          }
          if (idx >= 0) {
            await this._executeResAction(idx);
            return;
          }
          if (!this._isMyResTurn()) return;
        }

        const result = await game.vtm.rollDicePool(this.document, {
          trait: 'attributes.dexterity', trait2: skill,
          label, difficulty: action.actionDifficulty || 6,
        });
        if (actionId === 'get-up' && result?.outcome === 'success') await standUp(this.document);
      }));

    // Right-click on declared action rolls: adjustment dialog. Outside combat
    // the normal click already opens the full roll dialog, nothing to add.
    el.querySelectorAll('.action-roll-btn').forEach(btn =>
      btn.addEventListener('contextmenu', async ev => {
        ev.preventDefault();
        if (this._declCombat && !this._declFullDefense) return;
        if (!this._resCombat || !this._resCombatant) return;
        const actionId = btn.dataset.actionId;
        const readyType = btn.dataset.readyType;
        if (!this._attacks?.find(a => a.id === actionId)) return;
        const defIdx = this._myDeferredIdx();
        if (!this._isMyResTurn() && defIdx === null) return;
        const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
        let idx;
        if (!this._isMyResTurn()) {
          const a = (decl.actions || [])[defIdx];
          idx = (a && a.attackId === actionId && (!readyType || a.readyType === readyType)) ? defIdx : -1;
        } else {
          idx = (decl.actions || []).findIndex((a, i) =>
            a.attackId === actionId && (!readyType || a.readyType === readyType) && !this._resExecuted.has(i));
        }
        if (idx >= 0) await this._executeResAction(idx, true);
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
            const defIdx = this._myDeferredIdx();
            if (!this._isMyResTurn() && defIdx === null) return;
            const decl = this._resCombatant.getFlag('vtm-v20', 'declaration') || {};
            let idx;
            if (!this._isMyResTurn()) {
              const a = (decl.actions || [])[defIdx];
              idx = (a && a.reload && a.attackId === attackId) ? defIdx : -1;
            } else {
              idx = (decl.actions || []).findIndex((a, i) => a.reload && a.attackId === attackId && !this._resExecuted.has(i));
            }
            if (idx >= 0) {
              await this._executeResAction(idx);
              return;
            }
            if (!this._isMyResTurn()) return;
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

    // Positioning and range pills open a small dropdown; picking an option
    // sets the flag and the re-render refreshes the pill label.
    const bindToggleMenu = (btnSel, onPick) => {
      const wrap = el.querySelector(btnSel)?.closest('.toggle-dropdown');
      const menu = wrap?.querySelector('.toggle-menu');
      if (!wrap || !menu) return;
      wrap.querySelector(btnSel).addEventListener('click', ev => {
        ev.preventDefault();
        menu.classList.toggle('open');
      });
      wrap.addEventListener('mouseleave', () => menu.classList.remove('open'));
      menu.querySelectorAll('[data-value]').forEach(opt =>
        opt.addEventListener('click', async ev => {
          ev.preventDefault();
          menu.classList.remove('open');
          await onPick(opt.dataset.value);
        }));
    };
    bindToggleMenu('.positioning-toggle', async v => {
      if (v === 'none') await this.document.unsetFlag('vtm-v20', 'flankMode');
      else await this.document.setFlag('vtm-v20', 'flankMode', v);
    });
    bindToggleMenu('.range-toggle', async v => {
      if (v === 'short') await this.document.unsetFlag('vtm-v20', 'rangeMode');
      else await this.document.setFlag('vtm-v20', 'rangeMode', v);
    });

    // Outnumbered counter: left-click raises the penalty, right-click lowers it
    const setMultiOpp = async next => {
      if (next <= 0) await this.document.unsetFlag('vtm-v20', 'multiOpp');
      else await this.document.setFlag('vtm-v20', 'multiOpp', Math.min(next, 4));
    };
    el.querySelector('.outnumbered-toggle')?.addEventListener('click', async ev => {
      ev.preventDefault();
      const cur = this.document.getFlag('vtm-v20', 'multiOpp') || 0;
      await setMultiOpp(cur >= 4 ? 0 : cur + 1);
    });
    el.querySelector('.outnumbered-toggle')?.addEventListener('contextmenu', async ev => {
      ev.preventDefault();
      const cur = this.document.getFlag('vtm-v20', 'multiOpp') || 0;
      await setMultiOpp(cur - 1);
    });

    el.querySelector('.weapon-length-toggle')?.addEventListener('click', async ev => {
      ev.preventDefault();
      if (this.document.getFlag('vtm-v20', 'weaponLength')) await this.document.unsetFlag('vtm-v20', 'weaponLength');
      else await this.document.setFlag('vtm-v20', 'weaponLength', true);
    });

    // Sync drawer visibility on render
    this._syncTargetingDrawer(this.document.getFlag('vtm-v20', 'targetingEnabled') === true);

    el.querySelector('.movement-toggle')?.addEventListener('click', ev => {
      ev.preventDefault();
      this._movementActive = !this._movementActive;
      ev.currentTarget.classList.toggle('active', this._movementActive);
      this._syncMovementDrawer(this._movementActive);
    });
    el.querySelector('.movement-toggle')?.classList.toggle('active', this._movementActive);
    this._syncMovementDrawer(this._movementActive);

    this._syncCombatDrawer();
    if (this.document.type === 'vampire') this._syncBloodBudgetPanel();
    this._syncDeclTimer();

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
        const resize = () => { ta.style.height = '0'; ta.style.height = ta.scrollHeight + 'px'; };
        resize();
        requestAnimationFrame(resize);
        ta.addEventListener('input', resize);
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

    el.querySelectorAll('.path-category-header').forEach(h =>
      h.addEventListener('click', () => h.closest('.path-category').classList.toggle('collapsed')));

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

    // Resize bg-notes textareas when their tab becomes visible
    if (this._tab === 'powers') {
      requestAnimationFrame(() => {
        el.querySelectorAll('.bg-notes').forEach(ta => {
          ta.style.height = '0';
          ta.style.height = ta.scrollHeight + 'px';
        });
      });
    }
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

  static #onExportSheet() {
    if (this._chargen) return;
    exportSheet(this);
  }

  static async #onManageHealth() {
    if (!game.user.isGM) return;
    const actor = this.document;
    const sys = actor.system;
    const count = sys.health.extra?.length ?? 0;

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: `${actor.name}: Health Levels` },
      content: `<p>Current track: <strong>${7 + count}</strong> levels (${count} extra Bruised).</p>
        <p style="font-size: 12px; opacity: 0.8;">Added levels are always of the Bruised variant.</p>`,
      buttons: [
        { action: 'add', label: 'Add Level', icon: 'fas fa-plus' },
        { action: 'remove', label: 'Remove Level', icon: 'fas fa-minus' },
        { action: 'close', label: 'Close', default: true },
      ],
      rejectClose: false,
    });

    if (choice === 'add') {
      await actor.update(rebuildTrack(sys, countDamage(sys), count + 1));
    } else if (choice === 'remove') {
      if (!count) return ui.notifications.warn('No extra health levels to remove.');
      await actor.update(rebuildTrack(sys, countDamage(sys), count - 1));
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
    if (this._bloodBuffDrawer) {
      this._bloodBuffDrawer.remove();
      this._bloodBuffDrawer = null;
    }
    if (this._bloodBudgetPanel) {
      this._bloodBudgetPanel.remove();
      this._bloodBudgetPanel = null;
    }
    this._stopDeclTimer();
    if (this._declTimerBar) {
      this._declTimerBar.remove();
      this._declTimerBar = null;
    }
    for (const fn of this._bioSaveFns) fn();
    return super.close(options);
  }

  async _spendAttackAmmo(atk, { dryRun = false, count = 1 } = {}) {
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

    if (!dryRun) await item.update({ 'system.ammo': String(Math.max(current - count, 0)) });
    return true;
  }

  _bulletsDeclared(attackId) {
    return this._declActions
      .filter(a => a.attackId === attackId && !a.reload)
      .reduce((s, a) => s + (a.bullets || 1), 0);
  }

  // Ammo a declaration can still plan around: the mag as it stands (or a full
  // one if a reload is already declared), minus rounds promised to earlier
  // declarations this turn.
  _plannedAmmo(atk) {
    const item = this.document.items.get(atk.id);
    if (!item || item.type !== 'weapon') return Infinity;
    const capacity = parseAmmoCapacity(item.system.capacity);
    if (capacity === null) return Infinity;
    const inDecl = !!(this._declCombat && !this._declFullDefense);
    const reloading = inDecl && this._declActions.some(a => a.attackId === atk.id && a.reload);
    const base = reloading ? capacity : (ammoRemaining(item.system) ?? capacity);
    return Math.max(base - (inDecl ? this._bulletsDeclared(atk.id) : 0), 0);
  }

  async _declAddAttack(attackId) {
    const atk = this._attacks?.find(a => a.id === attackId);
    if (!atk) return;
    const rate = parseInt(atk.rate) || 0;
    const used = this._bulletsDeclared(attackId);
    if (rate > 0 && used >= rate) {
      ui.notifications.warn(`${atk.name}: rate of fire is ${rate} rounds per turn.`);
      return;
    }
    let plan = { mode: 'single', rounds: 1 };
    if (fireModeInfo(atk)) {
      plan = await this._promptFireMode(atk, { budget: rate > 0 ? rate - used : null });
      if (!plan) return;
    }
    this._saveAllocations();
    const decl = { attackId, text: '', alloc: 1 };
    if (atk.isRanged && rate > 0) decl.bullets = plan.rounds;
    if (plan.mode !== 'single') {
      decl.fireMode = plan.mode;
      decl.fireRounds = plan.rounds;
      decl.text = plan.mode === 'burst' ? `${atk.name} (Burst)` : `${atk.name} (Full Auto x${plan.rounds})`;
    }
    this._declActions.push(decl);
    this.render();
  }

  async _promptFireMode(atk, { budget = null } = {}) {
    const info = fireModeInfo(atk);
    if (!info) return { mode: 'single', rounds: 1 };
    const ammo = this._plannedAmmo(atk);
    const cap = budget === null ? (info.rateNum || 1) : budget;
    const avail = Math.min(cap, ammo);
    const canBurst = info.burst && avail >= 3;
    const canAuto = info.auto && avail >= 2;
    if (!canBurst && !canAuto) return { mode: 'single', rounds: 1 };

    const mode = await new Promise(resolve => {
      const buttons = {
        single: { icon: '<i class="fas fa-bullseye"></i>', label: 'Single Shot', callback: () => resolve('single') },
      };
      if (canBurst) buttons.burst = {
        icon: '<i class="fas fa-ellipsis-h"></i>',
        label: 'Three-Round Burst (+2 dice, +1 diff)',
        callback: () => resolve('burst'),
      };
      if (canAuto) buttons.auto = {
        icon: '<i class="fas fa-fire"></i>',
        label: `Full Auto (up to ${avail} rounds, +2 diff)`,
        callback: () => resolve('auto'),
      };
      new Dialog({
        title: `${this.document.name}: ${atk.name}`,
        content: '<p style="margin:8px 0;color:#ddd;">Fire mode?</p>',
        buttons,
        default: 'single',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 430 }).render(true);
    });
    if (!mode) return null;
    if (mode === 'single') return { mode: 'single', rounds: 1 };

    if (mode === 'auto' && this.document.getFlag('vtm-v20', 'targetingEnabled') === true) {
      ui.notifications.warn("Can't target a specific area while auto firing.");
      return null;
    }
    if (mode === 'burst') return { mode: 'burst', rounds: 3 };

    if (avail <= 2) return { mode: 'auto', rounds: avail };
    const rounds = await new Promise(resolve => {
      new Dialog({
        title: `${this.document.name}: Full Auto`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Rounds to fire (2 to ${avail}). Every 2 rounds adds 1 accuracy die, rounded.</p>
          <input type="number" name="fa-rounds" value="${avail}" min="2" max="${avail}" style="width:100%;" />
        </div>`,
        buttons: {
          fire: {
            icon: '<i class="fas fa-fire"></i>', label: 'Fire',
            callback: html => {
              const v = parseInt(html.find('[name="fa-rounds"]').val());
              resolve(Math.min(Math.max(isNaN(v) ? avail : v, 2), avail));
            },
          },
        },
        default: 'fire',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
    });
    if (!rounds) return null;
    return { mode: 'auto', rounds };
  }

  static TARGETING_CHOICES = {
    medium: { label: 'Medium', hint: 'Limb, briefcase', difficultyMod: 1, damageMod: 0 },
    small: { label: 'Small', hint: 'Hand, cellphone', difficultyMod: 2, damageMod: 1 },
    precise: { label: 'Precise', hint: 'Eye, heart, lock', difficultyMod: 3, damageMod: 2 },
  };

  _getTargetingData() {
    if (this.document.getFlag('vtm-v20', 'targetingEnabled') !== true) return null;
    const choices = VampireSheet.TARGETING_CHOICES;
    const c = choices[this._targetingChoice] || choices.medium;
    const headshot = !!this._targetingHeadshot
      && (this._targetingChoice === 'small' || this._targetingChoice === 'precise');
    return { size: this._targetingChoice, ...c, headshot, label: headshot ? `${c.label} (Head)` : c.label };
  }

  _syncTargetingDrawer(open) {
    if (this._targetingDrawer && !this._targetingDrawer.isConnected) {
      this._targetingDrawer = null;
    }
    if (open) {
      if (!this._targetingDrawer) this._buildTargetingDrawer();
      requestAnimationFrame(() => {
        if (!this._targetingDrawer) return;
        const combatTab = this.element.querySelector('.tab.combat');
        if (combatTab?.classList.contains('active')) {
          // Below the declaration/resolution panel whenever it's open,
          // so a tall panel never swallows the drawer
          if (this._combatDrawer?.classList.contains('open')) {
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
          ${key === 'small' || key === 'precise' ? `<span class="opt-headshot ${key === this._targetingChoice && this._targetingHeadshot ? 'on' : ''}" title="Aim at the head: bullets stay lethal against Kindred"><i class="fas fa-skull"></i> Head</span>` : ''}
        </label>
      `).join('')}
    `;

    drawer.querySelectorAll('.targeting-drawer-opt').forEach(opt => {
      opt.addEventListener('click', ev => {
        const key = opt.dataset.key;
        // The Head pill selects its row and flips the headshot aim; picking
        // a row normally clears it.
        if (ev.target.closest('.opt-headshot')) {
          this._targetingHeadshot = this._targetingChoice === key ? !this._targetingHeadshot : true;
        } else {
          this._targetingHeadshot = false;
        }
        this._targetingChoice = key;
        drawer.querySelectorAll('.targeting-drawer-opt').forEach(o => {
          o.classList.toggle('selected', o === opt);
          o.querySelector('.opt-headshot')?.classList.toggle('on', o === opt && this._targetingHeadshot);
        });
      });
    });

    this.element.appendChild(drawer);
    this._targetingDrawer = drawer;
  }

  _syncMovementDrawer(open) {
    if (this._movementDrawer && !this._movementDrawer.isConnected) {
      this._movementDrawer = null;
    }
    if (open) {
      if (!this._movementDrawer) this._buildMovementDrawer();
      requestAnimationFrame(() => {
        if (!this._movementDrawer) return;
        const combatTab = this.element.querySelector('.tab.combat');
        if (combatTab?.classList.contains('active')) {
          const appRect = this.element.getBoundingClientRect();
          const zoom = this._compactMode ? 0.85 : 1;
          if (this._targetingDrawer?.classList.contains('open')) {
            const tdRect = this._targetingDrawer.getBoundingClientRect();
            this._movementDrawer.style.top = `${(tdRect.bottom - appRect.top) / zoom + 4}px`;
          } else if (this._combatDrawer?.classList.contains('open')) {
            const cdRect = this._combatDrawer.getBoundingClientRect();
            this._movementDrawer.style.top = `${(cdRect.bottom - appRect.top) / zoom + 4}px`;
          } else {
            const btn = this.element.querySelector('.targeting-toggle');
            if (btn) {
              const btnRect = btn.getBoundingClientRect();
              this._movementDrawer.style.top = `${(btnRect.bottom - appRect.top) / zoom + 4}px`;
            }
          }
        }
        this._movementDrawer.classList.add('open');
      });
    } else if (this._movementDrawer) {
      this._movementDrawer.classList.remove('open');
    }
  }

  _buildMovementDrawer() {
    if (this._movementDrawer) return;
    const drawer = document.createElement('div');
    drawer.className = 'movement-drawer';
    drawer.innerHTML = `
      <div class="movement-drawer-header">
        <i class="fas fa-person-running"></i> During Movement
      </div>
      <div class="movement-drawer-hint">-1 die per yard moved (resolution only)</div>
      <label class="movement-drawer-input">
        <span>Distance (yards)</span>
        <input type="number" name="movement-dist" value="0" min="0" />
      </label>
    `;
    this.element.appendChild(drawer);
    this._movementDrawer = drawer;
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

    // Right-click on a resolution roll button opens the adjustment dialog
    if (isResolving) {
      this._combatDrawer.querySelectorAll('[data-action="resExecute"]').forEach(b =>
        b.addEventListener('contextmenu', ev => {
          ev.preventDefault();
          const idx = parseInt(b.dataset.index);
          const decl = this._resCombatant?.getFlag('vtm-v20', 'declaration') || {};
          const a = (decl.actions || [])[idx];
          if (!a || a.heal || a.reload) return;
          this._executeResAction(idx, true);
        }));
    }

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
        if (p !== undefined && p < lowestPool) lowestPool = p;
      }
      if (!isFinite(lowestPool)) lowestPool = 0;
      const celInfo = this._celerityDeclInfo(lowestPool, wp);
      const totalPool = celInfo.budget;
      const nonHealCount = actions.filter(a => !a.heal).length;
      // Celerity always uses explicit allocation, even for a single action,
      // so the cap can be respected while distributing the bigger budget
      const multi = nonHealCount > 1 || (celInfo.on && nonHealCount > 0);
      const allocated = actions.reduce((sum, a) => sum + (a.alloc || 0), 0);
      const remaining = totalPool - allocated;

      const actionEntries = actions.map((a, i) => {
        let name = a.text || 'Action';
        if (a.heal) name = a.text || 'Heal';
        else if (a.defense) name = `${a.text} (Defense)`;
        else if (a.reload) name = a.text || 'Reload';
        else if (a.attackId && !a.text) {
          const atk = this._getAttackById(a.attackId);
          name = atk?.name || a.attackId;
        }
        const pool = this._declPoolForAction(a);
        return { i, name, pool, alloc: a.heal ? 0 : (a.alloc || 1), isHeal: !!a.heal };
      });

      if (actionEntries.length) {
        h += '<div class="decl-section"><label>Declared Actions</label><div class="decl-actions">';
        for (const e of actionEntries) {
          h += '<div class="decl-action-entry">';
          h += `<span class="decl-action-name">${e.name}</span>`;
          if (e.isHeal) {
            h += '<span class="decl-action-pool" style="font-style:italic;opacity:.7">Reflexive</span>';
          } else {
            h += `<span class="decl-action-pool">Pool ${e.pool}</span>`;
          }
          h += `<button type="button" class="decl-remove" data-action="declRemoveAction" data-index="${e.i}"><i class="fas fa-times"></i></button>`;
          if (multi && !e.isHeal) {
            h += `<div class="decl-slider-row">
              <input type="range" class="decl-alloc-slider" name="alloc-${e.i}" value="${e.alloc}" min="0" max="${totalPool}" step="1" />
              <span class="decl-slider-val">${e.alloc}</span>
            </div>`;
          }
          h += '</div>';
        }
        h += '</div></div>';
      }

      if (multi) {
        const wpBit = wp ? ` (wound ${wp})` : '';
        const overBudget = remaining < 0;
        h += '<div class="decl-split-info">';
        h += celInfo.on
          ? `<i class="fas fa-wind"></i> Celerity budget${wpBit}: <b>${totalPool}</b>`
          : `<i class="fas fa-info-circle"></i> Lowest pool${wpBit}: <b>${totalPool}</b>`;
        h += ` | Allocated: <b class="${overBudget ? 'over-budget' : ''}">${allocated}</b> / ${totalPool}`;
        if (remaining > 0) h += ` (<b>${remaining}</b> unspent)`;
        else if (overBudget) h += ` <span class="over-budget">(${Math.abs(remaining)} over!)</span>`;
        h += '</div>';
      }
      if (celInfo.on) {
        h += nonHealCount > 0
          ? `<div class="decl-split-info celerity-cap-info"><i class="fas fa-hourglass-half"></i> Turn cap: <b>${celInfo.cap}</b> dice resolve on your turn. Actions beyond it resolve at initiative -1, -2...</div>`
          : `<div class="decl-split-info celerity-cap-info"><i class="fas fa-wind"></i> Speed Burst active. Budget and cap appear once you declare actions.</div>`;
      }
    }

    h += '<div class="decl-buttons">';
    if (!fullDef && !this.document.getFlag('vtm-v20', 'clinch') && !this.document.getFlag('vtm-v20', 'held')) {
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
    const finalCall = isMyTurn && !!this._resCombat.getFlag('vtm-v20', 'finalCall');
    const amDelayed = !!this._resCombatant?.getFlag('vtm-v20', 'delayed')
      && !this._resCombatant?.getFlag('vtm-v20', 'resolved');

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
        s += `<button type="button" data-action="resYield" class="res-btn yield"><i class="fas fa-hourglass-end"></i> Yield</button>`;
        if (!allDone && !finalCall) {
          s += `<button type="button" data-action="resDelay" class="res-btn delay" title="Bank remaining actions, jump back in any time with Act Now"><i class="fas fa-pause"></i> Delay</button>`;
        }
        const canEnd = allDone || finalCall;
        s += `<button type="button" data-action="resFinish" class="res-btn finish" ${canEnd ? '' : 'disabled'}><i class="fas fa-flag-checkered"></i> End Turn</button>`;
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
      const defIdx = this._myDeferredIdx();
      let h = '<div class="res-panel active">';

      // A deferred Celerity slot is live for us right now
      if (defIdx !== null && !this._resExecuted.has(defIdx)) {
        const dr = this._resCombat.getFlag('vtm-v20', 'deferredResolver');
        const a = actions[defIdx];
        let name = a?.text || 'Action';
        if (a?.attackId && !a?.text) name = this._getAttackById(a.attackId)?.name || name;
        h += `<div class="res-phase-banner celerity-slot"><i class="fas fa-wind"></i> Deferred action resolves now (initiative ${dr?.init})</div>`;
        h += '<div class="res-actions">';
        h += '<div class="res-action-entry">';
        h += `<span class="res-action-name">${name} [${a?.alloc || 1}d]</span>`;
        h += `<button type="button" data-action="resExecute" data-index="${defIdx}" class="res-roll-btn"><i class="fas fa-dice-d20"></i> Resolve</button>`;
        h += '</div></div>';
        h += '<div class="res-buttons">';
        h += `<button type="button" data-action="resDeferDelay" data-index="${defIdx}" class="res-btn delay" title="Bank this slot, jump back in any time with Act Now"><i class="fas fa-pause"></i> Delay</button>`;
        h += '</div>';
        h += defBlock();
        h += '</div>';
        return h;
      }

      if (amDelayed) {
        const left = actions.filter((a, i) => !a.defense && !a.heal && !this._resExecuted.has(i)).length;
        h += '<div class="res-phase-banner celerity-slot"><i class="fas fa-pause"></i> Delaying</div>';
        h += `<div class="res-pool-info">Dice remaining: <b>${remaining}</b> / ${total} | Actions banked: <b>${left}</b></div>`;
        h += '<div class="res-buttons">';
        h += '<button type="button" data-action="resActNow" class="res-btn finish"><i class="fas fa-bolt"></i> Act Now</button>';
        h += '</div>';
        h += defBlock();
        h += '</div>';
        return h;
      }

      h += turnDone
        ? '<div class="res-phase-banner"><i class="fas fa-hourglass-half"></i> Waiting for round to end</div>'
        : '<div class="res-phase-banner"><i class="fas fa-hourglass-half"></i> Resolution Phase</div>';
      h += `<div class="res-pool-info">Dice remaining: <b>${remaining}</b> / ${total}</div>`;
      const pendingDef = (this._resCombatant.getFlag('vtm-v20', 'deferred') || []).filter(e => !this._resExecuted.has(e.idx));
      if (pendingDef.length) {
        const banked = pendingDef.filter(e => e.delayed);
        const auto = pendingDef.filter(e => !e.delayed);
        if (auto.length) {
          h += `<div class="decl-split-info celerity-cap-info"><i class="fas fa-wind"></i> ${auto.length} deferred action${auto.length > 1 ? 's' : ''} pending (initiative ${auto.map(e => e.init).join(', ')})</div>`;
        }
        if (banked.length) {
          h += `<div class="decl-split-info celerity-cap-info"><i class="fas fa-pause"></i> ${banked.length} deferred action${banked.length > 1 ? 's' : ''} banked</div>`;
          h += '<div class="res-buttons">';
          h += '<button type="button" data-action="resDeferredNow" class="res-btn finish"><i class="fas fa-bolt"></i> Act Now (deferred)</button>';
          h += '</div>';
        }
      }
      h += defBlock();
      h += endTurnBlock();
      h += '</div>';
      return h;
    }

    // Active resolution: it's our turn, show full panel
    const heals = actions
      .map((a, i) => a.heal ? { i, name: a.text || 'Heal', amount: a.heal, done: this._resExecuted.has(i) } : null)
      .filter(Boolean);
    const customs = actions
      .map((a, i) => (!a.attackId && !a.defense && !a.heal) ? { i, name: a.text || 'Custom Action', done: this._resExecuted.has(i) } : null)
      .filter(Boolean);
    const reloads = actions
      .map((a, i) => a.reload ? { i, name: a.text || 'Reload', done: this._resExecuted.has(i) } : null)
      .filter(Boolean);

    // Celerity cap: actions that can't fit in the turn defer instead of block
    const cap = decl.celerityCap;
    const capLeft = cap != null ? Math.max(cap - spent, 0) : null;
    const isBlocked = (a, i) => cap != null && !a.defense && !a.heal
      && !this._resExecuted.has(i) && (a.alloc || 1) > capLeft;
    const blocked = actions.map((a, i) => isBlocked(a, i) ? i : null).filter(i => i !== null);
    const allDone = actions.every((a, i) => a.defense || this._resExecuted.has(i) || blocked.includes(i));

    let h = '<div class="res-panel active">';
    h += finalCall
      ? '<div class="res-phase-banner celerity-slot"><i class="fas fa-hourglass-end"></i> Final call: act now, unspent actions are lost when you end your turn</div>'
      : '<div class="res-phase-banner"><i class="fas fa-fist-raised"></i> Resolution Phase</div>';
    h += `<div class="res-pool-info">Dice Pool: <b>${remaining}</b> / ${total}${cap != null ? ` | Turn cap: <b>${capLeft}</b> / ${cap}` : ''}</div>`;

    if (blocked.length) {
      const myInit = this._resCombatant?.getFlag('vtm-v20', 'effInit')
        ?? this._resCombatant?.initiative ?? 0;
      const preview = blocked.map((idx, n) => {
        const a = actions[idx];
        let name = a.text || 'Action';
        if (a.attackId && !a.text) name = this._getAttackById(a.attackId)?.name || name;
        return `${name} (init ${myInit - (n + 1)})`;
      }).join(', ');
      h += `<div class="decl-split-info celerity-cap-info"><i class="fas fa-wind"></i> Over cap, deferring on End Turn: ${preview}</div>`;
    }

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

    if (heals.length) {
      h += '<div class="res-actions">';
      for (const hl of heals) {
        h += `<div class="res-action-entry ${hl.done ? 'executed' : ''}">`;
        h += `<span class="res-action-name"><i class="fas fa-heart"></i> ${hl.name}</span>`;
        if (hl.done) {
          h += '<span class="res-done-label"><i class="fas fa-check"></i> Done</span>';
        } else {
          h += `<button type="button" data-action="resExecute" data-index="${hl.i}" class="res-roll-btn"><i class="fas fa-heart"></i> Heal</button>`;
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

    // Description / Notes switcher: one section visible at a time
    const syncBioTab = () => {
      el.querySelectorAll('.bio-subtab').forEach(t =>
        t.classList.toggle('active', t.dataset.bioTab === this._bioTab));
      el.querySelectorAll('.bio-section').forEach(s =>
        s.classList.toggle('active', s.dataset.bioField === this._bioTab));
    };
    syncBioTab();
    el.querySelectorAll('.bio-subtab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (this._bioTab === tab.dataset.bioTab) return;
        this._bioTab = tab.dataset.bioTab;
        syncBioTab();
      });
    });

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
      // Path characters get the Conviction/Instinct ladders instead
      let lookup = key;
      const vLabels = this.document.getFlag('vtm-v20', 'virtueLabels');
      if (key === 'virtues.conscience' && /conviction/i.test(vLabels?.conscience || '')) lookup = 'virtues.conviction';
      else if (key === 'virtues.selfControl' && /instinct/i.test(vLabels?.selfControl || '')) lookup = 'virtues.instinct';
      const descs = traitAuthentic(lookup) || TRAIT_DESCRIPTIONS[lookup];
      if (!descs) return;
      let val;
      if (key === 'willpower') val = this.document.system.willpower.max;
      else if (key === 'humanity') val = this.document.system.humanity;
      else val = effectiveTraitValue(this.document, key);
      const idx = val - (key === 'humanity' ? 0 : 1);
      const base = descs[Math.min(idx, descs.length - 1)] ?? '';

      // Append specialty descriptions if any exist
      const specKey = key.replace('.', '--');
      const allSpecs = this.document.getFlag('vtm-v20', 'specialties') || {};
      const traitSpecs = (allSpecs[specKey] || []).filter(s => s.desc);
      if (traitSpecs.length) {
        const specHtml = traitSpecs.map(s =>
          `<div class="tip-spec"><span class="tip-spec-name">${s.name}:</span> ${s.desc}</div>`
        ).join('');
        tip.innerHTML = `<div>${base}</div><div class="tip-specs">${specHtml}</div>`;
      } else {
        tip.textContent = base;
      }

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
    // Info icons carry their own popup; hovering one shouldn't also pop the trait tooltip
    el.querySelectorAll('.arch-info').forEach(a => a.addEventListener('mouseenter', hide));
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
    const rawSuccesses = successes;
    successes -= ones;
    let outcome = 'failure';
    if (successes > 0) outcome = 'success';
    else if (rawSuccesses === 0 && ones > 0) outcome = 'botch';
    return { dice, total: Math.max(successes, 0), outcome };
  }

  async _emitRollCard(actor, { roll, label, pool, difficulty, dice, total, outcome, extra = '', ledgeBtn = false, flags = {}, autoSuccesses = 0, autoLabel = '', diceTotal = 0 }) {
    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    if (!autoLabel && autoSuccesses) autoLabel = `${autoSuccesses} Potence`;

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/roll-result.hbs', {
      actorImg: actor.img, actorName: actor.name,
      label, pool, difficulty, specialty: false, dice, total, outcome, extra, ledgeBtn, portraitStyle,
      autoSuccesses, autoLabel, diceTotal,
    });

    await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
    this._resBloodSpent = 0;
    this._tab = 'combat';
    this.render(true);
  }

  _endDeclaration() {
    this._stopDeclTimer();
    this._declCombat = null;
    this._declCombatant = null;
    this._declActions = [];
    this._declFullDefense = false;
    this._declCapturing = false;
    game.vtm._captureAction = null;
    this.render();
  }

  _syncDeclTimer() {
    if (!this._declCombat || !this._declCombatant) {
      this._stopDeclTimer();
      return;
    }
    if (!game.settings.get('vtm-v20', 'declarationTimer')) {
      this._stopDeclTimer();
      return;
    }

    const curDeclarer = this._declCombat.getFlag('vtm-v20', 'currentDeclarer');
    const isMyTurn = curDeclarer === this._declCombatant.id;

    if (!isMyTurn) {
      this._stopDeclTimer();
      return;
    }

    // Already running for this turn
    if (this._declTimerInterval) return;

    const seconds = game.settings.get('vtm-v20', 'declarationTimerSeconds') || 15;

    if (!this._declTimerBar) {
      const bar = document.createElement('div');
      bar.className = 'decl-timer-bar';
      bar.innerHTML = '<div class="decl-timer-fill"></div><span class="decl-timer-text"></span>';
      this.element.appendChild(bar);
      this._declTimerBar = bar;
    }

    this._declTimerBar.classList.add('active');
    this._declTimerStart = Date.now();
    const duration = seconds * 1000;

    const fill = this._declTimerBar.querySelector('.decl-timer-fill');
    const text = this._declTimerBar.querySelector('.decl-timer-text');

    this._declTimerInterval = setInterval(() => {
      const elapsed = Date.now() - this._declTimerStart;
      const pct = Math.min(elapsed / duration, 1);
      const left = Math.max(Math.ceil((duration - elapsed) / 1000), 0);

      fill.style.width = `${(1 - pct) * 100}%`;
      text.textContent = `${left}s`;

      // Color shift as time runs low
      if (pct > 0.75) fill.classList.add('urgent');
      else fill.classList.remove('urgent');

      if (pct >= 1) {
        this._declTimerExpired();
      }
    }, 100);
  }

  async _declTimerExpired() {
    this._stopDeclTimer();
    if (!this._declCombat || !this._declCombatant) return;

    const curDeclarer = this._declCombat.getFlag('vtm-v20', 'currentDeclarer');
    if (curDeclarer !== this._declCombatant.id) return;

    // Only the GM client writes the timeout, prevents duplicate submissions
    if (!game.user.isGM) {
      this._endDeclaration();
      return;
    }

    const combatant = this._declCombatant;
    const combat = this._declCombat;

    await combatant.setFlag('vtm-v20', 'declaration', {
      text: 'No action (timed out)',
      actions: [{ attackId: null, text: 'No action', alloc: 0 }],
      fullDefense: false,
      totalPool: 0,
      basePool: 0,
      diceAllocations: [],
      resolved: false,
    });

    await ChatMessage.create({
      content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">${combatant.name}:</span></div><div class="roll-meta">Declaration timed out, no actions declared.</div></div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });

    this._endDeclaration();
    await VampireSheet._gmAdvance('advanceDeclaration', combat);
  }

  _stopDeclTimer() {
    if (this._declTimerInterval) {
      clearInterval(this._declTimerInterval);
      this._declTimerInterval = null;
    }
    if (this._declTimerBar) {
      this._declTimerBar.classList.remove('active');
    }
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
    const controls = this._combatDrawer.querySelectorAll('.decl-alloc-slider');
    const summary = this._combatDrawer.querySelector('.decl-split-info');
    if (!controls.length || !summary) return;

    const actions = this._declActions;
    const sys = this.document.system;
    const wp = sys.woundPenalty || 0;
    let lowestPool = Infinity;
    for (const a of actions) {
      const p = this._declPoolForAction(a);
      if (p < lowestPool) lowestPool = p;
    }
    if (!isFinite(lowestPool)) lowestPool = 0;
    const celInfo = this._celerityDeclInfo(lowestPool, wp);
    const totalPool = celInfo.budget;

    const update = () => {
      let allocated = 0;
      controls.forEach(inp => {
        const idx = parseInt(inp.name.replace('alloc-', ''));
        const val = Math.max(parseInt(inp.value) || 0, 0);
        if (actions[idx]) actions[idx].alloc = val;
        allocated += val;

        const label = inp.closest('.decl-action-entry')?.querySelector('.decl-slider-val');
        if (label) label.textContent = val;
      });
      const rem = totalPool - allocated;
      const over = rem < 0;
      const wpBit = wp ? ` (wound ${wp})` : '';
      let txt = celInfo.on
        ? `<i class="fas fa-wind"></i> Celerity budget${wpBit}: <b>${totalPool}</b>`
        : `<i class="fas fa-info-circle"></i> Lowest pool${wpBit}: <b>${totalPool}</b>`;
      txt += ` | Allocated: <b class="${over ? 'over-budget' : ''}">${allocated}</b> / ${totalPool}`;
      if (rem > 0) txt += ` (<b>${rem}</b> unspent)`;
      else if (over) txt += ` <span class="over-budget">(${Math.abs(rem)} over!)</span>`;
      if (celInfo.on) txt += ` | Cap: <b>${celInfo.cap}</b>`;
      summary.innerHTML = txt;
    };

    controls.forEach(inp => inp.addEventListener('input', update));
  }

  _saveAllocations() {
    if (!this._combatDrawer) return;
    this._declActions.forEach((a, i) => {
      const el = this._combatDrawer.querySelector(`[name="alloc-${i}"]`);
      if (el) a.alloc = Math.max(parseInt(el.value) || 0, 0);
    });
  }

  // Celerity Extra Actions: budget = pool + floor(pool/2) per dot, cap = pool
  // + dots. Both take wounds. Pools are already stripped of the Dex passive
  // while the flag is on, so lowestPool arrives here pre-stripped.
  _celerityDeclInfo(lowestPool, wp) {
    const on = !!this.document.getFlag('vtm-v20', 'celerityActions');
    if (!on) return { on: false, budget: Math.max(lowestPool + wp, 1), cap: null };
    const cel = celerityLevel(this.document);
    const bonus = Math.floor(lowestPool / 2) * cel;
    return {
      on: true,
      budget: Math.max(lowestPool + bonus + wp, 1),
      cap: Math.max(lowestPool + cel + wp, 1),
    };
  }

  _declPoolForAction(a) {
    if (a.heal) return undefined;
    const sys = this.document.system;
    const dex = effectiveTraitValue(this.document, 'attributes.dexterity');
    if (a.pool) return a.pool;
    if (['clinch-damage', 'clinch-escape', 'hold-escape'].includes(a.attackId)) {
      return effectiveTraitValue(this.document, 'attributes.strength') + (sys.abilities?.brawl || 0);
    }
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
    const atkDef = this._attacks?.find(x => x.id === a.attackId);
    if (atkDef?.isReadyWeapon) {
      const skill = a.readyType === 'ranged' ? 'firearms' : 'melee';
      return dex + (sys.abilities?.[skill] || 0);
    }
    if (atkDef?.isAction) {
      const skill = (atkDef.skill || '').split('.').pop();
      return dex + (sys.abilities?.[skill] || 0);
    }
    if (atkDef?.poolTraits) {
      return atkDef.poolTraits.reduce((sum, path) => sum + effectiveTraitValue(this.document, path), 0);
    }
    if (atkDef?.skill) {
      const skill = atkDef.skill.split('.').pop();
      return dex + (sys.abilities?.[skill] || 0);
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

  static async #onDeclQuickAdd(ev, target) {
    if (this._declFullDefense) return;
    const defense = target.dataset.defense;
    if (defense) {
      this._saveAllocations();
      const names = { dodge: 'Dodge', block: 'Block', parry: 'Parry' };
      this._declActions.push({ attackId: null, text: names[defense], defense, alloc: 1 });
      this.render();
      return;
    }
    await this._declAddAttack(target.dataset.attackId);
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

    // Block confirm if over budget (heal is reflexive, doesn't count).
    // Celerity validates even a single action, its alloc is cap-bound.
    const nonHealActions = this._declActions.filter(a => !a.heal);
    const celerityOn = !!this.document.getFlag('vtm-v20', 'celerityActions');
    if (!fullDef && (nonHealActions.length > 1 || (celerityOn && nonHealActions.length > 0))) {
      let lowestCheck = Infinity;
      for (const a of nonHealActions) {
        const p = this._declPoolForAction(a);
        if (p < lowestCheck) lowestCheck = p;
      }
      if (!isFinite(lowestCheck)) lowestCheck = 0;
      const info = this._celerityDeclInfo(lowestCheck, wp);
      const budget = info.budget;
      const spent = this._declActions.reduce((s, a) => s + (a.alloc || 0), 0);
      if (spent > budget) {
        ui.notifications.warn(`You've allocated ${spent} dice but only have ${budget}. Remove ${spent - budget} before confirming.`);
        return;
      }
      // No single action may exceed the supernatural cap
      if (info.on) {
        const fat = this._declActions.find(a => !a.heal && (a.alloc || 0) > info.cap);
        if (fat) {
          ui.notifications.warn(`No single action can exceed the cap of ${info.cap} dice (one has ${fat.alloc}).`);
          return;
        }
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
    let celerityCap = null;
    if (!fullDef) {
      let lowestPool = Infinity;
      for (const a of this._declActions) {
        const p = this._declPoolForAction(a);
        if (p !== undefined && p < lowestPool) lowestPool = p;
      }
      if (!isFinite(lowestPool)) lowestPool = 0;
      basePool = lowestPool;
      const info = this._celerityDeclInfo(lowestPool, wp);
      totalPool = info.budget;
      celerityCap = info.on ? info.cap : null;
    }

    const combatant = this._declCombatant;
    const combat = this._declCombat;

    await combatant.setFlag('vtm-v20', 'declaration', {
      text: text || (fullDef ? 'Entire Turn Defense' : this._declActions.map(a => a.defense ? `${a.text} (Defense)` : (a.text || 'Attack')).join(', ')),
      actions: this._declActions,
      fullDefense: fullDef,
      totalPool,
      basePool,
      celerityCap,
      diceAllocations: [],
      resolved: false,
    });

    const intent = text || (fullDef ? 'Entire Turn Defense' : 'No declaration');
    await ChatMessage.create({
      content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">${combatant.name} declares:</span></div><div class="roll-meta">${intent}</div></div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });

    this._endDeclaration();
    await VampireSheet._gmAdvance('advanceDeclaration', combat);
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

    // Check if wound penalty changed since declaration. The comparison must
    // rebuild the pool the same way the declaration did, Celerity included,
    // or the bonus dice read as a phantom wound change.
    const decl = combatant.getFlag('vtm-v20', 'declaration') || {};
    if (!decl.fullDefense && decl.basePool !== undefined) {
      const wp = this.document.system.woundPenalty || 0;
      const celOn = decl.celerityCap != null;
      const cel = celOn ? celerityLevel(this.document) : 0;
      const bonus = celOn ? Math.floor(decl.basePool / 2) * cel : 0;
      const currentTotal = Math.max(decl.basePool + bonus + wp, 1);
      const currentCap = celOn ? Math.max(decl.basePool + cel + wp, 1) : null;
      if (currentTotal !== decl.totalPool) {
        await this._promptReallocation(combatant, decl, currentTotal, currentCap);
        return; // _promptReallocation handles render
      }
    }

    this.render(true);
  }

  async _promptReallocation(combatant, decl, newTotal, newCap = null) {
    const actions = decl.actions || [];
    const oldTotal = decl.totalPool;
    const diff = oldTotal - newTotal;

    const alreadySpent = [...this._resSpent.entries()];
    const lockedDice = alreadySpent.reduce((s, [, v]) => s + v, 0);
    const budget = Math.max(newTotal - lockedDice, 0);

    const entries = actions.map((a, i) => {
      let name = a.text || 'Action';
      if (a.defense) name = `${a.text || a.defense} (Defense)`;
      else if (a.attackId && !a.text && this._getAttackById) {
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
      await combatant.setFlag('vtm-v20', 'declaration', { ...decl, totalPool: newTotal, celerityCap: newCap, actions: updated });
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
      celerityCap: newCap,
      actions: updated,
    });

    this._tab = 'combat';
    this.render(true);
  }

  _endResolution() {
    if (this.document.getFlag('vtm-v20', 'wpIgnoreWounds')) {
      this.document.unsetFlag('vtm-v20', 'wpIgnoreWounds');
    }
    this._resCombat = null;
    this._resCombatant = null;
    this._resExecuted = new Set();
    this._resSpent = new Map();
    this._resDefenseSpent = new Map();
    this._resFullDefCount = 0;
    this._resTurnDone = false;
    this.render();
  }

  // A deferred Celerity slot for this combatant just came up in the order
  startDeferredResolution(combat, combatant, idx, init) {
    if (!this._resCombat) {
      this._resCombat = combat;
      this._resCombatant = combatant;
    }
    this._tab = 'combat';
    ui.notifications.info(`${combatant.name}: deferred action resolves now (initiative ${init}).`);
    this.render();
  }

  _isMyResTurn() {
    if (!this._resCombat || !this._resCombatant || this._resTurnDone) return false;
    return this._resCombat.getFlag('vtm-v20', 'currentResolver') === this._resCombatant.id;
  }

  // Which action index (if any) is currently mine to resolve as a deferred
  // Celerity slot woven into the turn order.
  _myDeferredIdx() {
    const dr = this._resCombat?.getFlag('vtm-v20', 'deferredResolver');
    if (!dr || dr.combatantId !== this._resCombatant?.id) return null;
    return dr.idx;
  }

  async _executeResAction(idx, adjust = false) {
    await this._executeResActionInner(idx, adjust);

    // If that was a deferred slot, mark it done and hand control back
    const dr = this._resCombat?.getFlag('vtm-v20', 'deferredResolver');
    if (dr && dr.combatantId === this._resCombatant?.id && dr.idx === idx && this._resExecuted.has(idx)) {
      const list = (this._resCombatant.getFlag('vtm-v20', 'deferred') || []).filter(e => e.idx !== idx);
      await this._resCombatant.setFlag('vtm-v20', 'deferred', list);
      await VampireSheet._gmAdvance('advanceResolution', this._resCombat);
    }
  }

  async _executeResActionInner(idx, adjust = false) {
    if (isNaN(idx) || this._resExecuted.has(idx) || !this._resCombatant) return;
    const deferredIdx = this._myDeferredIdx();
    const isDeferredSlot = deferredIdx === idx;
    if (!this._isMyResTurn() && !isDeferredSlot) {
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
    const nonHealCount = actions.filter(a => !a.heal).length;
    // Celerity declarations always use explicit allocations
    const multiAction = nonHealCount > 1 || decl.celerityCap != null;

    let poolForAction = remaining;
    if (multiAction) {
      poolForAction = Math.min(action.alloc || 1, remaining);
    }

    // Celerity turn cap: on the normal turn, dice beyond the cap can't be
    // spent. Blocked actions defer to initiative slots instead. Deferred
    // slots themselves bypass the cap, their dice were already priced in.
    const cap = decl.celerityCap;
    if (cap != null && !isDeferredSlot && !action.heal && !action.defense) {
      const capLeft = cap - spent;
      if (multiAction) {
        if (poolForAction > capLeft) {
          ui.notifications.info('Over the turn cap. This action will resolve as a deferred slot after you end your turn.');
          return;
        }
      } else {
        if (capLeft < 1) {
          ui.notifications.info('Turn cap exhausted. This action will resolve as a deferred slot after you end your turn.');
          return;
        }
        poolForAction = Math.min(poolForAction, capLeft);
      }
    }
    let movementDist = 0;
    if (this._movementActive) {
      movementDist = parseInt(this._movementDrawer?.querySelector('[name="movement-dist"]')?.value) || 0;
      if (movementDist > 0 && movementDist >= poolForAction) {
        ui.notifications.warn(`Cannot act: movement (${movementDist} yards) would reduce the dice pool below 1.`);
        return;
      }
    }
    const poolSpent = poolForAction;
    if (movementDist > 0) poolForAction = Math.max(poolForAction - movementDist, 1);
    const poolNote = movementDist > 0 ? `-${movementDist} movement` : '';

    // Heal action
    if (action.heal) {
      const actor = this.document;
      const sys = actor.system;
      const perTurn = sys.bloodPerTurn || 1;
      const bloodLeft = perTurn - this._resBloodSpent;
      const amount = Math.min(action.heal, bloodLeft);
      if (amount <= 0) {
        ui.notifications.warn(`Already spent ${perTurn} blood this turn, cannot heal.`);
        this._resExecuted.add(idx);
        this._resSpent.set(idx, 0);
        this.render();
        return;
      }
      const hasOtherActions = actions.some((a, i) => i !== idx && !a.heal && !a.defense);

      if (hasOtherActions) {
        // Healing while doing other stuff: Stamina + Survival reflexive (diff 8)
        const stamina = effectiveTraitValue(actor, 'attributes.stamina');
        const survival = sys.abilities?.survival || 0;
        const pool = Math.max(stamina + survival, 1);

        const result = await game.vtm.rollDicePool(actor, {
          label: `Heal (Stamina ${stamina} + Survival ${survival})`,
          poolOverride: pool,
          difficulty: 8,
        });

        if (result?.outcome === 'success') {
          this._playHealAnimation();
          await this._applyHeal(amount);
          const sLvls = amount === 1 ? 'one health level' : `${amount} health levels`;
          const sPts = amount === 1 ? 'one blood point' : `${amount} blood points`;
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${actor.name} healed ${sLvls} while acting, spending ${sPts}.</span></div></div>`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          });
        } else if (result?.outcome === 'botch') {
          const totalLoss = amount + 1;
          const newBlood = Math.max(0, (sys.blood?.value || 0) - totalLoss);
          const counts = countDamage(sys);
          const cap = trackSize(sys);
          counts.bash++;
          if (counts.agg + counts.leth + counts.bash > cap) counts.bash = Math.max(0, cap - counts.agg - counts.leth);
          await actor.update({ ...rebuildTrack(sys, counts), 'system.blood.value': newBlood });

          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="vtm-roll botch"><div class="roll-result"><span class="result-botch">${actor.name} botched the healing attempt, losing ${totalLoss} blood and taking an extra health level!</span></div></div>`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          });
        } else {
          const newBlood = Math.max(0, (sys.blood?.value || 0) - amount);
          await actor.update({ 'system.blood.value': newBlood });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="vtm-roll failure"><div class="roll-result"><span class="result-fail">${actor.name} failed to heal while acting, losing ${amount} blood with no effect.</span></div></div>`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          });
        }
      } else {
        this._playHealAnimation();
        await this._applyHeal(amount);
        const lvls = amount === 1 ? 'one health level' : `${amount} health levels`;
        const pts = amount === 1 ? 'one blood point' : `${amount} blood points`;
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${actor.name} rested and healed ${lvls}, spending ${pts}.</span></div></div>`,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        });
      }

      this._resBloodSpent += amount;
      this._resExecuted.add(idx);
      this._resSpent.set(idx, 0);
      this.render();
      return;
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
      this._resSpent.set(idx, multiAction ? poolSpent : 0);
      this.render();
      return;
    }

    // Custom action (captured from a roll): dispatch to the original function
    if (!action.attackId && !action.reload && !action.defense) {
      let result;
      if (action.source === 'jump') {
        result = await this._rollJump({ poolOverride: poolForAction, difficulty: action.difficulty, label: action.text, adjust });
      } else {
        result = await game.vtm.rollDicePool(this.document, {
          label: action.text || 'Custom Action',
          difficulty: action.difficulty || 6,
          poolOverride: poolForAction, poolNote, adjust,
        });
      }
      // Adjustment dialog closed: nothing rolled, nothing spent
      if (adjust && result === null) return;
      this._resExecuted.add(idx);
      this._resSpent.set(idx, poolSpent);
      this.render();
      return;
    }

    if (action.attackId) {
      const { rollAttack } = await import('./combat.mjs');
      const actor = this.document;
      const targeting = this._getTargetingData();

      const atkEntry = this._attacks?.find(a => a.id === action.attackId);
      if (action.attackId === 'clinch-damage') {
        await clinchInflictDamage(actor);
      } else if (action.attackId === 'clinch-escape') {
        await clinchEscape(actor, { poolOverride: poolForAction });
      } else if (action.attackId === 'hold-escape') {
        await holdEscape(actor, { poolOverride: poolForAction });
      } else if (atkEntry?.isAction) {
        let resSkill = atkEntry.skill;
        let resLabel = atkEntry.name;
        if (atkEntry.isReadyWeapon && action.readyType) {
          resSkill = action.readyType === 'ranged' ? 'abilities.firearms' : 'abilities.melee';
          resLabel = `Ready Weapon (${action.readyType === 'melee' ? 'Melee' : 'Ranged'})`;
        }
        const result = await game.vtm.rollDicePool(actor, {
          trait: 'attributes.dexterity', trait2: resSkill,
          label: resLabel, difficulty: atkEntry.actionDifficulty || 6,
          poolOverride: poolForAction, poolNote, adjust,
        });
        if (adjust && result === null) return;
        if (action.attackId === 'get-up' && result?.outcome === 'success') await standUp(actor);
      } else if (action.attackId === 'horrid-reality') {
        await this._rollHorridReality();
      } else if (action.attackId === 'taste-of-death') {
        await this._rollTasteOfDeath(poolForAction);
      } else if (action.attackId === 'unarmed' || action.attackId === 'kick') {
        const isKick = action.attackId === 'kick';
        const atk = {
          id: action.attackId, name: isKick ? 'Kick' : 'Unarmed',
          damageFormula: isKick ? 'Str+1' : 'Str', damageType: 'bashing',
          skill: 'abilities.brawl', isRanged: false,
          difficultyMod: isKick ? 1 : 0,
        };
        const result = await rollAttack(actor, atk, { poolOverride: poolForAction, targeting, poolNote, adjust });
        if (result === false) return;
      } else {
        const atkDef = this._attacks?.find(a => a.id === action.attackId);
        if (atkDef) {
          const fireOpts = {};
          let rounds = 0;
          if (atkDef.isRanged) {
            const item = actor.items.get(action.attackId);
            const capacity = item?.type === 'weapon' ? parseAmmoCapacity(item.system.capacity) : null;
            rounds = action.fireMode === 'auto' ? Math.max(action.fireRounds || 2, 2)
              : action.fireMode === 'burst' ? 3 : 1;
            if (capacity !== null) {
              const current = ammoRemaining(item.system);
              if (current <= 0) {
                ui.notifications.warn(`${item.name} is out of ammunition.`);
                return;
              }
              if (action.fireMode === 'burst' && current < 3) {
                ui.notifications.warn(`${item.name}: a three-round burst needs 3 rounds in the magazine (${current} left).`);
                return;
              }
              if (action.fireMode === 'auto' && current < 2) {
                ui.notifications.warn(`${item.name}: not enough ammunition for automatic fire (${current} left).`);
                return;
              }
              rounds = Math.min(rounds, current);
            }
            if (action.fireMode) {
              fireOpts.fireMode = action.fireMode;
              fireOpts.fireRounds = rounds;
            }
          }
          const result = await rollAttack(actor, atkDef, { poolOverride: poolForAction, targeting, poolNote, adjust, ...fireOpts });
          if (result === false) return;
          if (rounds > 0) await this._spendAttackAmmo(atkDef, { count: rounds });
        } else {
          const w = actor.items.get(action.attackId);
          if (w) {
            const isRanged = !!w.system.range;
            const atk = {
              id: w.id, name: w.name, img: w.img,
              damageFormula: w.system.damage,
              damageType: w.system.damageType || 'lethal',
              skill: `abilities.${isRanged ? 'firearms' : 'melee'}`,
              isRanged, firearm: !!w.system.firearm, range: w.system.range, capacity: w.system.capacity,
            };
            const result = await rollAttack(actor, atk, { poolOverride: poolForAction, targeting, poolNote, adjust });
            if (result === false) return;
            if (isRanged) await this._spendAttackAmmo(atk, { count: 1 });
          }
        }
      }
    }

    this._resExecuted.add(idx);
    this._resSpent.set(idx, poolSpent);
    this.render();
  }

  static async #onResExecute(ev, target) {
    const idx = parseInt(target.dataset.index);
    await this._executeResAction(idx);
  }

  static async #onResFinish() {
    if (!this._resCombat || !this._resCombatant) return;
    const combat = this._resCombat;
    const cb = this._resCombatant;

    // Cap-blocked actions become deferred slots at descending initiative
    const decl = cb.getFlag('vtm-v20', 'declaration') || {};
    if (decl.celerityCap != null) {
      const blocked = (decl.actions || [])
        .map((a, i) => (!a.defense && !a.heal && !this._resExecuted.has(i)) ? i : null)
        .filter(i => i !== null);
      if (blocked.length) {
        // A jump-in acts at the interrupted turn's initiative, so slots
        // count down from there instead of the original roll
        const myInit = cb.getFlag('vtm-v20', 'effInit') ?? cb.initiative ?? 0;
        const entries = blocked.map((idx, n) => ({ idx, init: myInit - (n + 1) }));
        await cb.setFlag('vtm-v20', 'deferred', entries);
        const slots = entries.map(e => e.init).join(', ');
        await ChatMessage.create({
          content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">${cb.name}</span></div><div class="roll-meta"><i class="fas fa-wind"></i> Celerity: ${entries.length} action${entries.length > 1 ? 's' : ''} deferred to initiative ${slots}.</div></div>`,
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        });
      }
    }

    await cb.setFlag('vtm-v20', 'resolved', true);
    // Don't clear resolution state. Defenses may still be needed this round.
    this._resTurnDone = true;
    this.render();
    await VampireSheet._gmAdvance('advanceResolution', combat);
  }

  static async #onResYield() {
    if (!this._resCombat || !this._resCombatant) return;
    if (!this._isMyResTurn()) return;
    const combat = this._resCombat;
    const cb = this._resCombatant;
    await cb.setFlag('vtm-v20', 'yielded', true);
    await VampireSheet._gmAdvance('advanceResolution', combat);
    await cb.update({ initiative: (cb.initiative ?? 0) - 10000 });
    this.render();
  }

  // Bank the remaining actions: jump back in later with Act Now
  static async #onResDelay() {
    if (!this._resCombat || !this._resCombatant) return;
    if (!this._isMyResTurn()) return;
    if (this._resCombat.getFlag('vtm-v20', 'finalCall')) return;
    await this._resCombatant.setFlag('vtm-v20', 'delayed', true);
    this.render();
    await VampireSheet._gmAdvance('advanceResolution', this._resCombat);
  }

  static async #onResActNow() {
    if (!this._resCombat || !this._resCombatant) return;
    if (!this._resCombatant.getFlag('vtm-v20', 'delayed')) return;
    if (game.user.isGM) {
      const { requestActNow } = await import('./initiative.mjs');
      requestActNow(this._resCombat, this._resCombatant);
    } else {
      game.socket.emit('system.vtm-v20', {
        action: 'actNow',
        combatId: this._resCombat.id,
        combatantId: this._resCombatant.id,
      });
    }
  }

  // Delay the deferred slot that is currently prompting me
  static async #onResDeferDelay(ev, target) {
    if (!this._resCombat || !this._resCombatant) return;
    const idx = parseInt(target.dataset.index);
    const dr = this._resCombat.getFlag('vtm-v20', 'deferredResolver');
    if (!dr || dr.combatantId !== this._resCombatant.id || dr.idx !== idx) return;
    const entries = (this._resCombatant.getFlag('vtm-v20', 'deferred') || []).map(e => ({ ...e }));
    const entry = entries.find(e => e.idx === idx);
    if (!entry) return;
    entry.delayed = true;
    await this._resCombatant.setFlag('vtm-v20', 'deferred', entries);
    this.render();
    await VampireSheet._gmAdvance('advanceResolution', this._resCombat);
  }

  static async #onResDeferredNow() {
    if (!this._resCombat || !this._resCombatant) return;
    const entries = this._resCombatant.getFlag('vtm-v20', 'deferred') || [];
    if (!entries.some(e => e.delayed)) return;
    if (game.user.isGM) {
      const { requestDeferredNow } = await import('./initiative.mjs');
      requestDeferredNow(this._resCombat, this._resCombatant);
    } else {
      game.socket.emit('system.vtm-v20', {
        action: 'deferredNow',
        combatId: this._resCombat.id,
        combatantId: this._resCombatant.id,
      });
    }
  }


  async _rollHorridReality() {
    const actor = this.document;
    const target = game.user.targets.size ? game.user.targets.first()?.actor : null;
    if (!target) {
      ui.notifications.warn('Target a token first.');
      return;
    }

    const opts = await new Promise(resolve => {
      const content = `
        <div style="margin:6px 0">
          <div class="form-group" style="margin-bottom:6px">
            <label>Damage Type</label>
            <select id="hr-dmg-type" style="width:100%">
              <option value="lethal">Lethal</option>
              <option value="bashing">Bashing</option>
            </select>
          </div>
          <div class="form-group">
            <label>Damage Limit (0 = no limit)</label>
            <input id="hr-limit" type="number" value="0" min="0" max="20" style="width:100%" />
          </div>
        </div>`;
      new Dialog({
        title: 'Horrid Reality Injury',
        content,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll', callback: dlg => {
            resolve({
              dmgType: dlg[0].querySelector('#hr-dmg-type').value,
              limit: parseInt(dlg[0].querySelector('#hr-limit').value) || 0,
            });
          }},
        },
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 300 }).render(true);
    });
    if (!opts) return;

    const manip = effectiveTraitValue(actor, 'attributes.manipulation');
    const sub = actor.system.abilities?.subterfuge || 0;
    const pool = Math.max(manip + sub, 1);
    const tPerc = target.system.attributes?.perception || 0;
    const tSC = target.system.virtues?.selfControl || 0;
    const difficulty = Math.min(Math.max(tPerc + tSC, 3), 10);

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);

    let dmg = Math.max(total, 0);
    if (opts.limit > 0 && dmg > opts.limit) dmg = opts.limit;

    if (dmg > 0) {
      const { applyHealthDamage, checkIncapacitated } = await import('./combat.mjs');
      await applyHealthDamage(target, dmg, opts.dmgType);
      await checkIncapacitated(target);
    }

    const limitNote = opts.limit > 0 ? ` (limit: ${opts.limit})` : '';
    const label = `Horrid Reality vs ${target.name} | Man ${manip} + Sub ${sub} | diff ${difficulty} (Perc ${tPerc} + SC ${tSC})`;
    await this._emitRollCard(actor, {
      roll, label, pool, difficulty, dice, total, outcome,
      extra: `${dmg} ${opts.dmgType} damage${limitNote}, no soak`,
    });
  }

  async _rollTasteOfDeath(poolOverride) {
    const actor = this.document;
    const blood = actor.system.blood;
    const bpt = actor.system.bloodPerTurn || 1;
    const maxBlood = Math.min(bpt, blood?.value || 0);
    if (maxBlood < 1) {
      ui.notifications.warn('Not enough blood for Taste of Death.');
      return;
    }

    const spent = await new Promise(resolve => {
      const content = `<div style="text-align:center;margin:8px 0">
        <label>Blood points to spit (max ${maxBlood}/turn):</label><br/>
        <input type="number" id="tod-blood" value="1" min="1" max="${maxBlood}"
          style="width:60px;text-align:center;margin-top:6px"/>
        <p style="font-size:11px;color:#999;margin-top:4px">Each blood point = 2 dice aggravated damage</p>
      </div>`;
      new Dialog({
        title: 'Taste of Death',
        content,
        buttons: {
          spit: { icon: '<i class="fas fa-droplet"></i>', label: 'Attack', callback: dlg => {
            const val = parseInt(dlg[0].querySelector('#tod-blood').value) || 1;
            resolve(Math.max(Math.min(val, maxBlood), 1));
          }},
        },
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 300 }).render(true);
    });
    if (!spent) return;

    await actor.update({ 'system.blood.value': blood.value - spent });
    foundry.audio.AudioHelper.play({
      src: 'systems/vtm-v20/VTM icons/Blood Consumption Sound effect.mp3', volume: 0.6, loop: false
    }, false);

    const dmgDice = spent * 2;
    const atk = {
      id: 'taste-of-death', name: `Taste of Death (${spent} blood)`,
      damageFormula: String(dmgDice), damageType: 'aggravated',
      poolTraits: ['attributes.stamina', 'abilities.athletics'],
      isRanged: true,
    };
    const targeting = this._getTargetingData();
    const { rollAttack } = await import('./combat.mjs');
    await rollAttack(actor, atk, poolOverride ? { poolOverride, targeting } : { targeting });
  }

  async _promptTongueSkill() {
    const skill = await new Promise(resolve => {
      new Dialog({
        title: 'Tongue of the Asp',
        content: '<p style="text-align:center;margin:10px 0">Does Tongue of the Asp use <b>Brawl</b> or <b>Melee</b> for attack rolls?</p>',
        buttons: {
          brawl: { icon: '<i class="fas fa-hand-fist"></i>', label: 'Dex + Brawl', callback: () => resolve('brawl') },
          melee: { icon: '<i class="fas fa-khanda"></i>', label: 'Dex + Melee', callback: () => resolve('melee') },
        },
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 320 }).render(true);
    });
    if (!skill) return;
    await this.document.setFlag('vtm-v20', 'tongueSkill', skill);
  }

  async _rollSoak() {
    const actor = this.document;
    const dmgType = await new Promise(resolve => {
      new Dialog({
        title: 'Soak: Damage Type',
        content: '<p style="margin:8px 0">What type of damage are you soaking?</p>',
        buttons: {
          bashing: { label: 'Bashing', callback: () => resolve('bashing') },
          lethal: { label: 'Lethal', callback: () => resolve('lethal') },
          aggravated: { label: 'Aggravated', callback: () => resolve('aggravated') },
        },
        default: 'lethal',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 340 }).render(true);
    });
    if (!dmgType) return;

    let fireOrSunlight = false;
    if (dmgType === 'aggravated' && actor.type === 'vampire') {
      fireOrSunlight = await new Promise(resolve => {
        new Dialog({
          title: 'Aggravated Damage Source',
          content: `<p style="margin:8px 0">Is this aggravated damage from <b>sunlight or fire</b>?</p>
            <p style="font-size:11px;color:#999">If yes, armor will not protect against this damage.</p>`,
          buttons: {
            yes: { icon: '<i class="fas fa-fire"></i>', label: 'Sunlight / Fire', callback: () => resolve(true) },
            no: { icon: '<i class="fas fa-paw"></i>', label: 'Teeth / Claws / Other', callback: () => resolve(false) },
          },
          default: 'no',
          close: () => resolve(false),
        }, { classes: ['vtm-v20', 'dialog'], width: 340 }).render(true);
      });
    }

    const soakData = computeSoakPool(actor, { dmgType, fireOrSunlight });
    if (!soakData.canSoak) {
      return ui.notifications.warn('Cannot soak this damage type.');
    }

    const { pool, parts, difficulty } = soakData;
    const label = `Soak ${dmgType} (${parts.join(' + ')})`;
    const roll = new Roll(`${Math.max(pool, 1)}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);
    await this._emitRollCard(actor, { roll, label, pool, difficulty, dice, total, outcome });
  }


  // -- Blood buff (physical attributes) ------------------------------------

  _renderBloodBuffUI(el, canEdit) {
    const actor = this.document;
    const sys = actor.system;
    const buffs = actor.getFlag('vtm-v20', 'bloodBuffs') || {};
    const physAttrs = ['strength', 'dexterity', 'stamina'];
    const hasAnyBuff = physAttrs.some(a => (buffs[a] || 0) > 0);

    // Update dots for buffed attributes
    for (const attr of physAttrs) {
      const row = el.querySelector(`.dot-row[data-path="system.attributes.${attr}"]`);
      if (!row) continue;
      const base = sys.attributes[attr] || 0;
      const buff = buffs[attr] || 0;
      const total = base + buff;

      if (buff > 0) {
        const tMax = sys.traitMax || 5;
        let dots = '';
        if (total <= tMax) {
          for (let i = 1; i <= tMax; i++) {
            if (i <= base) dots += `<span class="dot filled" data-value="${i}"></span>`;
            else if (i <= total) dots += `<span class="dot blood-buff" data-value="${i}"></span>`;
            else dots += `<span class="dot empty" data-value="${i}"></span>`;
          }
        } else {
          const overflow = total - tMax;
          for (let i = 1; i <= tMax; i++) {
            if (i <= overflow) dots += `<span class="dot blood-buff" data-value="${i}"></span>`;
            else dots += `<span class="dot empty" data-value="${i}"></span>`;
          }
        }
        row.innerHTML = dots;

        if (canEdit) {
          row.querySelectorAll('.dot.filled').forEach(dot => {
            dot.addEventListener('click', () => {
              const val = parseInt(dot.dataset.value);
              const cur = sys.attributes[attr] || 0;
              actor.update({ [`system.attributes.${attr}`]: val === cur ? val - 1 : val });
            });
          });
        }
      }
    }

    // Add toggle button to Attributes heading (disabled during declaration)
    const strRow = el.querySelector('.dot-row[data-path="system.attributes.strength"]');
    const attrBlock = strRow?.closest('.section-block');
    if (!attrBlock) return;
    const h2 = attrBlock.querySelector('h2');
    if (!h2 || h2.querySelector('.blood-buff-toggle')) return;

    const inDecl = !!this._declCombat;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `blood-buff-toggle${this._bloodBuffOpen ? ' active' : ''}${hasAnyBuff ? ' has-buffs' : ''}`;
    btn.title = inDecl ? 'Cannot enhance during declaration' : 'Enhance Physical Attributes';
    btn.disabled = inDecl;
    btn.innerHTML = '<i class="fas fa-tint"></i>';
    btn.addEventListener('click', () => {
      if (this._declCombat) return;
      this._bloodBuffOpen = !this._bloodBuffOpen;
      btn.classList.toggle('active', this._bloodBuffOpen);
      this._syncBloodBuffDrawer();
    });
    h2.appendChild(btn);

    // Close drawer if we entered declaration
    if (inDecl && this._bloodBuffOpen) {
      this._bloodBuffOpen = false;
      if (this._bloodBuffDrawer) this._bloodBuffDrawer.classList.remove('open');
    }

    this._syncBloodBuffDrawer();
  }

  _syncBloodBuffDrawer() {
    if (this._bloodBuffDrawer && !this._bloodBuffDrawer.isConnected) {
      this._bloodBuffDrawer = null;
    }
    if (this._bloodBuffOpen) {
      if (!this._bloodBuffDrawer) this._buildBloodBuffDrawer();
      else this._updateBloodBuffDrawer();
      requestAnimationFrame(() => {
        if (!this._bloodBuffDrawer) return;
        const statsTab = this.element.querySelector('.tab.stats');
        if (statsTab?.classList.contains('active')) {
          const anchor = this.element.querySelector('.blood-buff-toggle')?.closest('h2');
          if (anchor) {
            const appRect = this.element.getBoundingClientRect();
            const h3Rect = anchor.getBoundingClientRect();
            const zoom = this._compactMode ? 0.85 : 1;
            this._bloodBuffDrawer.style.top = `${(h3Rect.top - appRect.top) / zoom}px`;
          }
        }
        this._bloodBuffDrawer.classList.add('open');
      });
    } else if (this._bloodBuffDrawer) {
      this._bloodBuffDrawer.classList.remove('open');
    }
  }

  _buildBloodBuffDrawer() {
    if (this._bloodBuffDrawer) return;
    const drawer = document.createElement('div');
    drawer.className = 'blood-buff-drawer';
    this._fillBloodBuffDrawer(drawer);
    this.element.appendChild(drawer);
    this._bloodBuffDrawer = drawer;
  }

  _updateBloodBuffDrawer() {
    if (!this._bloodBuffDrawer) return;
    this._fillBloodBuffDrawer(this._bloodBuffDrawer);
  }

  _bloodBudgetLeft() {
    if (!this._resCombat && !this._declCombat) return Infinity;
    const perTurn = this.document.system.bloodPerTurn || 1;
    let committed = this._resBloodSpent;
    // Count declared heal blood that hasn't been executed yet
    const combatant = this._resCombatant || this._declCombatant;
    const decl = combatant?.getFlag('vtm-v20', 'declaration');
    if (decl?.actions) {
      for (let i = 0; i < decl.actions.length; i++) {
        const a = decl.actions[i];
        if (a.heal && !this._resExecuted.has(i)) committed += a.heal;
      }
    }
    return Math.max(perTurn - committed, 0);
  }

  _fillBloodBuffDrawer(drawer) {
    const actor = this.document;
    const sys = actor.system;
    const buffs = actor.getFlag('vtm-v20', 'bloodBuffs') || {};
    const decay = actor.getFlag('vtm-v20', 'bloodBuffDecay') || {};
    const physAttrs = ['strength', 'dexterity', 'stamina'];
    const labels = { strength: 'Str', dexterity: 'Dex', stamina: 'Sta' };
    const freeLimit = (sys.traitMax || 5) + 1;

    const inCombat = !!this._resCombat;
    const left = this._bloodBudgetLeft();
    const atLimit = inCombat && left <= 0;
    const round = game.combat?.round || 0;

    drawer.innerHTML = `
      <div class="blood-buff-drawer-header">
        <i class="fas fa-tint"></i> Enhance
      </div>
      ${physAttrs.map(attr => {
        const base = sys.attributes[attr] || 0;
        const buff = buffs[attr] || 0;
        const total = base + buff;
        const plusOff = atLimit || total >= 10 || (sys.blood?.value || 0) < 1;
        const lastSpent = decay[attr];
        let decayTag = '';
        if (total > freeLimit && lastSpent !== undefined && round > lastSpent) {
          const turns = lastSpent + 3 - round;
          if (turns > 0) decayTag = `<span class="blood-buff-decay" title="Overflow decays in ${turns} turn${turns > 1 ? 's' : ''}"><i class="fas fa-hourglass-half"></i> ${turns}</span>`;
        }
        return `<div class="blood-buff-row" data-attr="${attr}">
          <span class="blood-buff-label">${labels[attr]}</span>
          <span class="blood-buff-val">${base}${buff ? ` + ${buff}` : ''}</span>${decayTag}
          <div class="blood-buff-controls">
            <button type="button" class="blood-buff-btn bb-minus" data-attr="${attr}" ${!buff ? 'disabled' : ''}>−</button>
            <button type="button" class="blood-buff-btn bb-plus" data-attr="${attr}" ${plusOff ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
      }).join('')}
    `;

    drawer.querySelectorAll('.bb-plus').forEach(btn => {
      btn.addEventListener('click', () => this._bloodBuffAdd(btn.dataset.attr));
    });
    drawer.querySelectorAll('.bb-minus').forEach(btn => {
      btn.addEventListener('click', () => this._bloodBuffRemove(btn.dataset.attr));
    });
  }

  _syncBloodBudgetPanel() {
    if (this._bloodBudgetPanel && !this._bloodBudgetPanel.isConnected) {
      this._bloodBudgetPanel = null;
    }

    const inCombat = !!(this._declCombat || this._resCombat);
    if (!inCombat) {
      if (this._bloodBudgetPanel) {
        this._bloodBudgetPanel.classList.remove('open');
      }
      return;
    }

    if (!this._bloodBudgetPanel) {
      const panel = document.createElement('div');
      panel.className = 'blood-budget-panel';
      this.element.appendChild(panel);
      this._bloodBudgetPanel = panel;
    }

    const sys = this.document.system;
    const perTurn = sys.bloodPerTurn || 1;
    const spent = this._resBloodSpent;
    const left = Math.max(perTurn - spent, 0);

    // Count committed heal blood
    const decl = this._resCombatant?.getFlag('vtm-v20', 'declaration');
    let healCommitted = 0;
    if (decl?.actions) {
      for (let i = 0; i < decl.actions.length; i++) {
        if (decl.actions[i].heal && !this._resExecuted.has(i)) healCommitted += decl.actions[i].heal;
      }
    }
    const available = Math.max(perTurn - spent - healCommitted, 0);

    let dots = '';
    for (let i = 0; i < perTurn; i++) {
      if (i < spent) dots += '<span class="bp-dot spent"></span>';
      else if (i < spent + healCommitted) dots += '<span class="bp-dot reserved"></span>';
      else dots += '<span class="bp-dot available"></span>';
    }

    const healNote = healCommitted ? `, ${healCommitted} for healing` : '';
    this._bloodBudgetPanel.innerHTML = `
      <div class="bp-header"><i class="fas fa-tint"></i> Blood / Turn</div>
      <div class="bp-dots">${dots}</div>
      <div class="bp-count">${available} available${healNote}</div>
    `;

    this._bloodBudgetPanel.classList.add('open');
  }

  async _bloodBuffAdd(attr) {
    const actor = this.document;
    const sys = actor.system;
    const base = sys.attributes[attr] || 0;
    const buffs = foundry.utils.deepClone(actor.getFlag('vtm-v20', 'bloodBuffs') || {});
    const current = buffs[attr] || 0;
    const total = base + current;

    if (total >= 10) return ui.notifications.warn('Cannot exceed 10.');
    if ((sys.blood?.value || 0) < 1) return ui.notifications.warn('No blood to spend.');

    const inCombat = !!(this._resCombat || this._declCombat);
    if (inCombat && this._bloodBudgetLeft() <= 0) {
      return ui.notifications.warn(`No blood budget left this turn.`);
    }

    this._playHealAnimation();
    buffs[attr] = current + 1;
    await actor.update({ 'system.blood.value': (sys.blood.value || 0) - 1 });
    await actor.setFlag('vtm-v20', 'bloodBuffs', buffs);
    if (inCombat) this._resBloodSpent++;

    // Track when blood was last spent on an overflow attribute
    const freeLimit = (sys.traitMax || 5) + 1;
    if (base + current + 1 > freeLimit && game.combat) {
      const decay = foundry.utils.deepClone(actor.getFlag('vtm-v20', 'bloodBuffDecay') || {});
      decay[attr] = game.combat.round || 1;
      await actor.setFlag('vtm-v20', 'bloodBuffDecay', decay);
    }
  }

  async _bloodBuffRemove(attr) {
    const actor = this.document;
    const buffs = foundry.utils.deepClone(actor.getFlag('vtm-v20', 'bloodBuffs') || {});
    if (!buffs[attr]) return;
    buffs[attr] -= 1;

    // Clean up decay tracking if no longer in overflow
    const base = actor.system.attributes?.[attr] || 0;
    const freeLimit = (actor.system.traitMax || 5) + 1;
    if (base + buffs[attr] <= freeLimit) {
      const decay = actor.getFlag('vtm-v20', 'bloodBuffDecay');
      if (decay?.[attr] !== undefined) {
        const others = Object.keys(decay).filter(k => k !== attr);
        if (!others.length) await actor.unsetFlag('vtm-v20', 'bloodBuffDecay');
        else await actor.update({ [`flags.vtm-v20.bloodBuffDecay.-=${attr}`]: null });
      }
    }

    if (buffs[attr] <= 0) {
      // Foundry's setFlag merges, so setting {} won't delete existing keys.
      // Use the -=key syntax or unsetFlag to actually remove data.
      const remaining = Object.keys(buffs).filter(k => k !== attr && buffs[k] > 0);
      if (!remaining.length) {
        await actor.unsetFlag('vtm-v20', 'bloodBuffs');
      } else {
        await actor.update({ [`flags.vtm-v20.bloodBuffs.-=${attr}`]: null });
      }
    } else {
      await actor.setFlag('vtm-v20', 'bloodBuffs', buffs);
    }
  }

  // -- Healing with blood --------------------------------------------------

  async _toggleDiscipline(itemId) {
    const actor = this.document;
    const item = actor.items.get(itemId);
    if (!item) return;
    const key = item.name.toLowerCase();
    const active = actor.getFlag('vtm-v20', 'activeDisciplines') || [];
    const isActive = active.includes(key);

    const inCombat = !!(this._resCombat || this._declCombat);

    // Celerity has two independent powers: manage both from one dialog
    if (key === 'celerity') {
      return this._celerityManage(item, inCombat);
    }

    if (isActive) {
      const activePowers = this._getActivePowers(actor, key);
      let toDeactivate;

      if (activePowers.length <= 1) {
        toDeactivate = activePowers.map(p => p.id);
      } else {
        toDeactivate = await new Promise(resolve => {
          const btns = {};
          for (const p of activePowers) {
            btns[p.id] = { label: p.name, callback: () => resolve([p.id]) };
          }
          btns._all = { label: 'Deactivate All', callback: () => resolve(activePowers.map(p => p.id)) };
          new Dialog({
            title: `Deactivate ${item.name}`,
            content: '<p style="margin:8px 0;color:#ddd;">Which power to deactivate?</p>',
            buttons: btns,
            close: () => resolve(null),
          }, { classes: ['vtm-v20', 'dialog'], width: 380 }).render(true);
        });
        if (!toDeactivate) return;
      }

      const deactivated = [];
      for (const id of toDeactivate) {
        const name = await this._deactivatePower(actor, key, id);
        if (name) deactivated.push(name);
      }

      const remaining = this._getActivePowers(actor, key);
      if (remaining.length === 0) {
        await actor.setFlag('vtm-v20', 'activeDisciplines', active.filter(d => d !== key));
      }

      if (deactivated.length) ui.notifications.info(`${deactivated.join(', ')} deactivated.`);
    } else {
      if (key === 'potence') {
        const blood = actor.system.blood;
        if (!blood || blood.value < 1) {
          ui.notifications.warn('Not enough blood to activate.');
          return;
        }
        if (inCombat && this._bloodBudgetLeft() <= 0) {
          return ui.notifications.warn('No blood budget left this turn.');
        }
        await actor.update({ 'system.blood.value': blood.value - 1 });
        await actor.setFlag('vtm-v20', 'activeDisciplines', [...active, key]);
        if (inCombat) this._resBloodSpent++;
        this._playHealAnimation();
        ui.notifications.info(`${item.name} activated: ${item.system.level} automatic successes on Strength rolls.`);
      } else {
        item.sheet.render(true);
      }
    }
  }

  // One dialog for both Celerity powers: each button activates or
  // deactivates its power depending on current state.
  async _celerityManage(item, inCombat) {
    const actor = this.document;
    const cel = item.system.level;
    const mult = cel + 1;
    const burstOn = !!actor.getFlag('vtm-v20', 'celerityBurst');
    const actionsOn = !!actor.getFlag('vtm-v20', 'celerityActions');

    const choice = await new Promise(resolve => {
      new Dialog({
        title: 'Celerity',
        content: '<p style="margin:8px 0;color:#ddd;">Spend 1 Blood point to Activate:</p>',
        buttons: {
          burst: {
            label: burstOn ? 'Deactivate Movement Burst' : `Movement Burst: speed x${mult}`,
            callback: () => resolve('burst'),
          },
          actions: {
            label: actionsOn ? 'Deactivate Speed Burst' : `Speed Burst: +${cel} half-pools of dice`,
            callback: () => resolve('actions'),
          },
        },
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 420 }).render(true);
    });
    if (!choice) return;

    const isOn = choice === 'burst' ? burstOn : actionsOn;

    // Deactivate path
    if (isOn) {
      const name = await this._deactivatePower(actor, 'celerity',
        choice === 'burst' ? 'movement-burst' : 'extra-actions');
      if (this._getActivePowers(actor, 'celerity').length === 0) {
        const active = actor.getFlag('vtm-v20', 'activeDisciplines') || [];
        await actor.setFlag('vtm-v20', 'activeDisciplines', active.filter(d => d !== 'celerity'));
      }
      if (name) ui.notifications.info(`${name} deactivated.`);
      this.render();
      return;
    }

    // Extra Actions only matters while building a declaration
    if (choice === 'actions') {
      if (!this._declCombat) {
        ui.notifications.warn('Speed Burst can only be activated during the declaration phase.');
        return;
      }
      if (this._declCombatant?.getFlag('vtm-v20', 'declaration')) {
        ui.notifications.warn('Declaration already confirmed. Activate before declaring next round.');
        return;
      }
    }

    const blood = actor.system.blood;
    if (!blood || blood.value < 1) {
      ui.notifications.warn('Not enough blood to activate.');
      return;
    }
    if (inCombat && this._bloodBudgetLeft() <= 0) {
      return ui.notifications.warn('No blood budget left this turn.');
    }
    await actor.update({ 'system.blood.value': blood.value - 1 });
    await actor.setFlag('vtm-v20', choice === 'burst' ? 'celerityBurst' : 'celerityActions', true);
    const active = actor.getFlag('vtm-v20', 'activeDisciplines') || [];
    if (!active.includes('celerity')) {
      await actor.setFlag('vtm-v20', 'activeDisciplines', [...active, 'celerity']);
    }
    if (inCombat) this._resBloodSpent++;
    this._playHealAnimation();
    if (choice === 'burst') {
      ui.notifications.info(inCombat
        ? `Movement Burst: speed x${mult} this turn.`
        : `Movement Burst: speed x${mult} until deactivated.`);
    } else {
      ui.notifications.info('Speed Burst active: bigger dice budget this round, Dex pools lose the Celerity bonus.');
    }
    this.render();
  }

  // Spend blood to heal bashing/lethal levels. Generation caps how many can
  // be healed in one turn (bloodPerTurn); aggravated can't be healed this way.
  _getActivePowers(actor, discKey) {
    const powers = [];
    if (discKey === 'protean') {
      if (actor.items.find(i => i.type === 'weapon' && i.name === 'Feral Claws'))
        powers.push({ id: 'feral-claws', name: 'Feral Claws' });
      if (actor.getFlag('vtm-v20', 'wolfForm'))
        powers.push({ id: 'wolf-form', name: 'Earth Meld / Wolf Form' });
      if (actor.getFlag('vtm-v20', 'batForm'))
        powers.push({ id: 'bat-form', name: 'Bat Form' });
    } else if (discKey === 'vicissitude') {
      if (actor.items.find(i => i.type === 'weapon' && i.name === 'Bone Spikes'))
        powers.push({ id: 'bone-spikes', name: 'Bone Spikes' });
      if (actor.getFlag('vtm-v20', 'boneQuills'))
        powers.push({ id: 'bone-quills', name: 'Bone Quills' });
      if (actor.getFlag('vtm-v20', 'horridForm'))
        powers.push({ id: 'horrid-form', name: 'Horrid Form' });
    } else if (discKey === 'serpentis') {
      if (actor.getFlag('vtm-v20', 'skinOfTheAdder'))
        powers.push({ id: 'skin-of-adder', name: 'Skin of the Adder' });
    } else if (discKey === 'obtenebration') {
      if (actor.getFlag('vtm-v20', 'shadowPlay'))
        powers.push({ id: 'shadow-play', name: 'Shadow Play' });
    } else if (discKey === 'chimerstry') {
      if (actor.getFlag('vtm-v20', 'horridReality'))
        powers.push({ id: 'horrid-reality', name: 'Horrid Reality' });
    } else if (discKey === 'celerity') {
      if (actor.getFlag('vtm-v20', 'celerityBurst'))
        powers.push({ id: 'movement-burst', name: 'Movement Burst' });
      if (actor.getFlag('vtm-v20', 'celerityActions'))
        powers.push({ id: 'extra-actions', name: 'Speed Burst' });
    }
    return powers;
  }

  async _deactivatePower(actor, discKey, powerId) {
    if (discKey === 'protean') {
      if (powerId === 'feral-claws') {
        const claws = actor.items.find(i => i.type === 'weapon' && i.name === 'Feral Claws');
        if (claws) await claws.delete();
        return 'Feral Claws';
      } else if (powerId === 'wolf-form') {
        const bite = actor.items.find(i => i.type === 'weapon' && i.name === 'Wolf Bite');
        if (bite) await bite.delete();
        await actor.unsetFlag('vtm-v20', 'wolfForm');
        return 'Wolf Form';
      } else if (powerId === 'bat-form') {
        const saved = actor.getFlag('vtm-v20', 'batForm');
        if (saved) {
          await actor.update({ 'system.attributes.strength': saved.strength });
          await actor.unsetFlag('vtm-v20', 'batForm');
        }
        return 'Bat Form';
      }
    } else if (discKey === 'vicissitude') {
      if (powerId === 'bone-spikes') {
        const spikes = actor.items.find(i => i.type === 'weapon' && i.name === 'Bone Spikes');
        if (spikes) await spikes.delete();
        return 'Bone Spikes';
      } else if (powerId === 'bone-quills') {
        await actor.unsetFlag('vtm-v20', 'boneQuills');
        return 'Bone Quills';
      } else if (powerId === 'horrid-form') {
        const saved = actor.getFlag('vtm-v20', 'horridForm');
        if (saved) {
          await actor.update({
            'system.attributes.strength': saved.strength,
            'system.attributes.dexterity': saved.dexterity,
            'system.attributes.stamina': saved.stamina,
            'system.attributes.charisma': saved.charisma,
            'system.attributes.manipulation': saved.manipulation,
            'system.attributes.appearance': saved.appearance,
          });
          await actor.unsetFlag('vtm-v20', 'horridForm');
        }
        return 'Horrid Form';
      }
    } else if (discKey === 'serpentis') {
      if (powerId === 'skin-of-adder') {
        const adder = actor.getFlag('vtm-v20', 'skinOfTheAdder');
        if (adder) {
          await actor.update({ 'system.attributes.appearance': adder.appearance });
          await actor.unsetFlag('vtm-v20', 'skinOfTheAdder');
        }
        return 'Skin of the Adder';
      }
    } else if (discKey === 'obtenebration') {
      if (powerId === 'shadow-play') {
        await actor.unsetFlag('vtm-v20', 'shadowPlay');
        return 'Shadow Play';
      }
    } else if (discKey === 'chimerstry') {
      if (powerId === 'horrid-reality') {
        await actor.unsetFlag('vtm-v20', 'horridReality');
        return 'Horrid Reality';
      }
    } else if (discKey === 'celerity') {
      if (powerId === 'movement-burst') {
        await actor.unsetFlag('vtm-v20', 'celerityBurst');
        return 'Movement Burst';
      } else if (powerId === 'extra-actions') {
        await actor.unsetFlag('vtm-v20', 'celerityActions');
        return 'Speed Burst';
      }
    }
    return null;
  }

  async _toggleWpSpend() {
    const actor = this.document;
    const spent = !!actor.getFlag('vtm-v20', 'wpSpent');
    if (spent) {
      await actor.unsetFlag('vtm-v20', 'wpSpent');
      return;
    }
    const wp = actor.system.willpower?.value || 0;
    if (wp < 1) {
      ui.notifications.warn('No temporary Willpower remaining.');
      return;
    }
    await actor.update({ 'system.willpower.value': wp - 1 });
    await actor.setFlag('vtm-v20', 'wpSpent', true);
  }

  async _toggleWpIgnoreWounds() {
    const actor = this.document;
    const active = !!actor.getFlag('vtm-v20', 'wpIgnoreWounds');
    if (active) {
      await actor.unsetFlag('vtm-v20', 'wpIgnoreWounds');
      return;
    }

    if (this._declCombat) {
      ui.notifications.warn('Endure can only be used during the resolution phase.');
      return;
    }

    const penalty = Math.abs(actor.system.rawWoundPenalty || 0);
    if (!penalty) {
      ui.notifications.info('No wound penalties to ignore.');
      return;
    }

    const wp = actor.system.willpower?.value || 0;
    if (wp < 1) {
      ui.notifications.warn('No temporary Willpower remaining.');
      return;
    }
    await actor.update({ 'system.willpower.value': wp - 1 });
    await actor.setFlag('vtm-v20', 'wpIgnoreWounds', true);

    if (this._resCombat && this._resCombatant) {
      await this._distributeEndureDice(penalty);
    }
  }

  async _distributeEndureDice(recovered) {
    const combatant = this._resCombatant;
    const decl = combatant.getFlag('vtm-v20', 'declaration') || {};
    const actions = decl.actions || [];
    const oldTotal = decl.totalPool || 0;
    const newTotal = oldTotal + recovered;

    const eligible = actions
      .map((a, i) => {
        if (a.defense || this._resExecuted.has(i)) return null;
        return { i, name: a.text || 'Action', alloc: a.alloc || 0 };
      })
      .filter(Boolean);

    if (!eligible.length) {
      await combatant.setFlag('vtm-v20', 'declaration', { ...decl, totalPool: newTotal });
      this.render();
      return;
    }

    // Single eligible action: auto-assign
    if (eligible.length === 1) {
      const updated = actions.map(a => ({ ...a }));
      updated[eligible[0].i].alloc += recovered;
      await combatant.setFlag('vtm-v20', 'declaration', { ...decl, totalPool: newTotal, actions: updated });
      this.render();
      return;
    }

    // Multiple: let the player distribute
    const base = Math.floor(recovered / eligible.length);
    let rem = recovered % eligible.length;
    for (const e of eligible) {
      e.bonus = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }

    let inputsHtml = '';
    for (const e of eligible) {
      inputsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">
        <span>${e.name} [${e.alloc}d]</span>
        <input type="number" class="endure-input" data-index="${e.i}" value="${e.bonus}" min="0" max="${recovered}" style="width:45px;text-align:center;" />
      </div>`;
    }
    for (const [i, a] of actions.entries()) {
      if (!a.defense) continue;
      inputsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;opacity:0.5;">
        <span>${a.text || a.defense} (Defense)</span><span>--</span>
      </div>`;
    }

    const result = await new Promise(resolve => {
      new Dialog({
        title: `${this.document.name}: Distribute Recovered Dice`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Wound penalty ignored! <b>${recovered}</b> dice recovered.</p>
          <p>Distribute among your non-defense actions:</p>
          <div style="margin-top:8px;">${inputsHtml}</div>
          <p class="endure-summary" style="margin-top:6px;font-size:11px;color:#888;"></p>
        </div>`,
        buttons: {
          ok: { icon: '<i class="fas fa-check"></i>', label: 'Confirm', callback: dlg => {
            const inputs = dlg[0].querySelectorAll('.endure-input');
            const allocs = {};
            inputs.forEach(inp => {
              allocs[parseInt(inp.dataset.index)] = Math.max(parseInt(inp.value) || 0, 0);
            });
            resolve(allocs);
          }},
        },
        render: html => {
          const summary = html.find('.endure-summary');
          const inputs = html.find('.endure-input');
          const update = () => {
            let used = 0;
            inputs.each((_, inp) => { used += Math.max(parseInt(inp.value) || 0, 0); });
            const left = recovered - used;
            if (left < 0) summary.html(`<span style="color:var(--vtm-red);">Over by ${Math.abs(left)}!</span>`);
            else if (left > 0) summary.html(`<span style="color:var(--vtm-gold);">${left} unassigned</span>`);
            else summary.html(`All ${recovered} dice assigned`);
          };
          inputs.on('input', update);
          update();
        },
        default: 'ok',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
    });

    const updated = actions.map(a => ({ ...a }));
    if (result) {
      for (const [idx, bonus] of Object.entries(result)) {
        const i = parseInt(idx);
        if (updated[i]) updated[i].alloc += bonus;
      }
    } else {
      // Closed without confirming, distribute evenly
      const perAction = Math.floor(recovered / eligible.length);
      let extra = recovered % eligible.length;
      for (const e of eligible) {
        const add = perAction + (extra > 0 ? 1 : 0);
        if (extra > 0) extra--;
        if (updated[e.i]) updated[e.i].alloc += add;
      }
    }

    await combatant.setFlag('vtm-v20', 'declaration', { ...decl, totalPool: newTotal, actions: updated });
    this.render();
  }

  async _healWithBlood() {
    if (this._resCombat) {
      return ui.notifications.warn('Healing must be declared during the declaration phase.');
    }
    const actor = this.document;
    const sys = actor.system;
    const blood = sys.blood?.value || 0;
    const perTurn = sys.bloodPerTurn || 1;

    const dmg = countDamage(sys);
    const normal = dmg.bash + dmg.leth;

    if (!normal) return ui.notifications.info('No bashing or lethal damage to heal.');
    if (!blood) return ui.notifications.warn(`${actor.name} has no blood to spend.`);

    const max = Math.min(blood, perTurn, normal);
    let amount = 1;
    if (max > 1) {
      amount = await this._healAmountDialog(max);
      if (!amount) return;
    }

    // Declaration phase: add as a declared action instead of healing now
    if (this._declCombat) {
      if (this._declFullDefense) {
        return ui.notifications.warn('Cannot heal while committed to full defense.');
      }
      if (this._declActions.some(a => a.heal)) {
        return ui.notifications.warn('Heal already declared.');
      }
      this._saveAllocations();
      this._declActions.push({
        attackId: null,
        text: `Heal (${amount} blood)`,
        heal: amount,
        alloc: 0,
      });
      this.render();
      return;
    }

    this._playHealAnimation();
    await this._applyHeal(amount);

    const lvls = amount === 1 ? 'one health level' : `${amount} health levels`;
    const pts = amount === 1 ? 'one blood point' : `${amount} blood points`;
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${actor.name} rested and healed ${lvls}, spending ${pts}.</span></div></div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  async _reflexiveHealRoll() {
    const actor = this.document;
    const sys = actor.system;
    const blood = sys.blood?.value || 0;
    const perTurn = sys.bloodPerTurn || 1;

    const dmg = countDamage(sys);
    const normal = dmg.bash + dmg.leth;

    if (!normal) return ui.notifications.info('No bashing or lethal damage to heal.');
    if (!blood) return ui.notifications.warn(`${actor.name} has no blood to spend.`);

    const max = Math.min(blood, perTurn, normal);
    let amount = 1;
    if (max > 1) {
      amount = await this._healAmountDialog(max);
      if (!amount) return;
    }

    const inCombat = !!(this._resCombat || this._declCombat);
    if (inCombat && this._bloodBudgetLeft() < amount) {
      return ui.notifications.warn('Not enough blood budget left this turn.');
    }

    const stamina = effectiveTraitValue(actor, 'attributes.stamina');
    const survival = sys.abilities?.survival || 0;
    const pool = Math.max(stamina + survival, 1);

    const result = await game.vtm.rollDicePool(actor, {
      label: `Reflexive Heal (Stamina ${stamina} + Survival ${survival})`,
      poolOverride: pool,
      difficulty: 8,
    });

    if (result?.outcome === 'success') {
      this._playHealAnimation();
      await this._applyHeal(amount);
      if (inCombat) this._resBloodSpent += amount;
      const sLvls = amount === 1 ? 'one health level' : `${amount} health levels`;
      const sPts = amount === 1 ? 'one blood point' : `${amount} blood points`;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="vtm-roll success"><div class="roll-result"><span class="result-success">${actor.name} healed ${sLvls} while acting, spending ${sPts}.</span></div></div>`,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
    } else if (result?.outcome === 'botch') {
      const totalLoss = amount + 1;
      const newBlood = Math.max(0, blood - totalLoss);
      const counts = countDamage(sys);
      const cap = trackSize(sys);
      counts.bash++;
      if (counts.agg + counts.leth + counts.bash > cap) counts.bash = Math.max(0, cap - counts.agg - counts.leth);
      await actor.update({ ...rebuildTrack(sys, counts), 'system.blood.value': newBlood });
      if (inCombat) this._resBloodSpent += totalLoss;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="vtm-roll botch"><div class="roll-result"><span class="result-botch">${actor.name} botched the healing attempt, losing ${totalLoss} blood and taking an extra health level!</span></div></div>`,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
    } else {
      const newBlood = Math.max(0, blood - amount);
      await actor.update({ 'system.blood.value': newBlood });
      if (inCombat) this._resBloodSpent += amount;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="vtm-roll failure"><div class="roll-result"><span class="result-fail">${actor.name} failed to heal while acting, losing ${amount} blood with no effect.</span></div></div>`,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
    }
  }

  // Remove `amount` normal levels (lethal first, then bashing) and spend the blood
  async _applyHeal(amount) {
    const actor = this.document;
    let { bash, leth, agg } = countDamage(actor.system);

    let healed = 0;
    for (let i = 0; i < amount; i++) {
      if (leth > 0) leth--;
      else if (bash > 0) bash--;
      else break;
      healed++;
    }

    const newBlood = Math.max(0, (actor.system.blood.value || 0) - healed);
    await actor.update({
      ...rebuildTrack(actor.system, { bash, leth, agg }),
      'system.blood.value': newBlood,
    });
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


  // -- Electrocution -------------------------------------------------------

  static ELECTRO_SOURCES = {
    minor: { label: 'Minor (wall socket)', levels: 1 },
    major: { label: 'Major (protective fence)', levels: 2 },
    severe: { label: 'Severe (vehicle battery, junction box)', levels: 3 },
    fatal: { label: 'Fatal (main feed line, subway rail)', levels: 4 },
  };

  async _rollElectrocution() {
    const actor = this.document;
    const sources = VampireSheet.ELECTRO_SOURCES;
    const pullDiff = actor.type === 'vampire' ? 5 : 9;

    const options = Object.entries(sources)
      .map(([k, s]) => `<option value="${k}">${s.label}: ${s.levels}/turn</option>`)
      .join('');
    const choice = await new Promise(resolve => {
      new Dialog({
        title: `${actor.name}: Electrocution`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Lethal damage every turn until contact is severed. Armor does not protect.</p>
          <select name="electro-source" style="width:100%;">${options}</select>
        </div>`,
        buttons: {
          jolt: {
            icon: '<i class="fas fa-bolt"></i>', label: 'Suffer One Turn',
            callback: html => resolve({ action: 'jolt', key: html.find('[name="electro-source"]').val() }),
          },
          pull: {
            icon: '<i class="fas fa-hand-rock"></i>', label: `Pull Away (Str, diff ${pullDiff})`,
            callback: () => resolve({ action: 'pull' }),
          },
        },
        default: 'jolt',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 430 }).render(true);
    });
    if (!choice) return;

    // Strength roll to break contact: diff 5 for Kindred, 9 for mortals
    if (choice.action === 'pull') {
      const str = effectiveStrength(actor);
      const wound = actor.system.woundPenalty || 0;
      const pool = Math.max(str + wound, 1);
      const roll = new Roll(`${pool}d10`);
      await roll.evaluate();
      let { dice, total, outcome } = this._tallyDice(roll, pullDiff);
      const autos = potenceAutoSuccesses(actor);
      total += autos;
      if (total > 0 && outcome !== 'success') outcome = 'success';
      else if (autos > 0 && outcome === 'botch') outcome = 'failure';
      const extra = outcome === 'success' ? 'Tears free of the current.'
        : outcome === 'botch' ? 'Muscles clamp onto the source. Still connected.'
        : 'Cannot let go.';
      await this._emitRollCard(actor, {
        roll,
        label: `Pull Away from Electrocution (Strength${autos ? ` + Potence ${autos} auto` : ''}${wound ? `, wound ${wound}` : ''})`,
        pool, difficulty: pullDiff, dice, total, outcome, extra,
      });
      return;
    }

    const src = sources[choice.key] || sources.minor;
    let dmgType = 'lethal';
    const incoming = src.levels;

    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    // Mortals cannot soak lethal: the current simply cooks them
    if (actor.type === 'mortal') {
      await applyHealthDamage(actor, incoming, dmgType);
      await checkIncapacitated(actor);
      const cond = getCondition(actor);
      const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
        attackerName: 'Electrocution', attackerImg: actor.img,
        attackerPortraitStyle: portraitStyle,
        defenderName: actor.name, defenderImg: actor.img,
        defenderPortraitStyle: portraitStyle,
        weaponName: src.label, damageType: dmgType,
        dmgPool: incoming, dmgLabel: `${src.label}, per turn of contact`,
        dmgDice: [], dmgSuccesses: incoming,
        soakPool: 0, soakLabel: 'Mortal cannot soak lethal damage',
        soakDice: [], soakSuccesses: 0, soakSkipped: true,
        netDamage: incoming, noDamage: false,
        damageAdjustment: cond === 'Incapacitated' ? 'Incapacitated by electricity: possible permanent damage (Storyteller).' : null,
        condition: cond, penalty: actor.system.woundPenalty ? `${actor.system.woundPenalty}` : null,
      });
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatHtml,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
      return;
    }

    // Vampires soak with Stamina + Fortitude, no armor. A botched soak fries
    // blood and brain: the whole jolt lands as aggravated.
    const stamina = effectiveTraitValue(actor, 'attributes.stamina');
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const pool = Math.max(stamina + fortLevel, 1);
    const soakDiff = actor.getFlag('vtm-v20', 'skinOfTheAdder') ? 5 : 6;

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, soakDiff);
    const botched = outcome === 'botch';
    if (botched) dmgType = 'aggravated';
    const soaked = botched ? 0 : total;

    const net = Math.max(incoming - soaked, 0);
    if (net > 0) await applyHealthDamage(actor, net, dmgType);
    await checkIncapacitated(actor);
    const cond = getCondition(actor);

    const soakParts = [`Sta ${stamina}`];
    if (fortLevel) soakParts.push(`Fort ${fortLevel}`);
    soakParts.push('no armor');

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
      attackerName: 'Electrocution', attackerImg: actor.img,
      attackerPortraitStyle: portraitStyle,
      defenderName: actor.name, defenderImg: actor.img,
      defenderPortraitStyle: portraitStyle,
      weaponName: src.label, damageType: dmgType,
      dmgPool: incoming, dmgLabel: `${src.label}, per turn of contact`,
      dmgDice: [], dmgSuccesses: incoming,
      soakPool: pool, soakLabel: soakParts.join(' + '),
      soakDice: dice, soakSuccesses: soaked, soakSkipped: false,
      netDamage: net, noDamage: net === 0,
      damageAdjustment: botched ? 'Soak botched: the current fries blood and brain, the damage is aggravated.' : null,
      condition: cond, penalty: actor.system.woundPenalty ? `${actor.system.woundPenalty}` : null,
    });

    await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  // -- Fire and Burns ------------------------------------------------------

  static FIRE_HEATS = {
    candle: { label: 'Candle (first-degree burns)', diff: 3 },
    torch: { label: 'Torch (second-degree burns)', diff: 5 },
    bunsen: { label: 'Bunsen burner (third-degree burns)', diff: 7 },
    electrical: { label: 'Electrical fire', diff: 8 },
    chemical: { label: 'Chemical fire', diff: 9 },
    molten: { label: 'Molten metal', diff: 10 },
  };

  static FIRE_SIZES = {
    torch: { label: 'Torch: part of the body exposed', levels: 1 },
    bonfire: { label: 'Bonfire: half the body exposed', levels: 2 },
    inferno: { label: 'Raging inferno: fully engulfed', levels: 3 },
  };

  async _rollFire() {
    const actor = this.document;
    const heats = VampireSheet.FIRE_HEATS;
    const sizes = VampireSheet.FIRE_SIZES;

    const heatOptions = Object.entries(heats)
      .map(([k, h]) => `<option value="${k}">${h.label}: soak diff ${h.diff}</option>`).join('');
    const sizeOptions = Object.entries(sizes)
      .map(([k, s]) => `<option value="${k}">${s.label}: ${s.levels}/turn</option>`).join('');

    const choice = await new Promise(resolve => {
      new Dialog({
        title: `${actor.name}: Fire`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Aggravated damage every turn in the flames. Armor does not protect and only Fortitude soaks it.</p>
          <label style="display:block;margin:6px 0 2px;">Heat</label>
          <select name="fire-heat" style="width:100%;">${heatOptions}</select>
          <label style="display:block;margin:6px 0 2px;">Size</label>
          <select name="fire-size" style="width:100%;">${sizeOptions}</select>
        </div>`,
        buttons: {
          burn: {
            icon: '<i class="fas fa-fire"></i>', label: 'Burn One Turn',
            callback: html => resolve({
              heat: html.find('[name="fire-heat"]').val(),
              size: html.find('[name="fire-size"]').val(),
            }),
          },
        },
        default: 'burn',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 430 }).render(true);
    });
    if (!choice) return;

    const heat = heats[choice.heat] || heats.torch;
    const size = sizes[choice.size] || sizes.torch;
    const dmgType = 'aggravated';
    const incoming = size.levels;

    const pFlags = actor.getFlag('vtm-v20', 'portrait') || {};
    let portraitStyle = '';
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      portraitStyle = `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }

    // Only Fortitude soaks fire; mortals and Fortitude-less Kindred just burn
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = actor.type === 'vampire' ? (fort?.system.level || 0) : 0;

    let roll = null;
    let soakDice = [];
    let soaked = 0;
    let soakSkipped = true;
    let soakLabel = actor.type === 'vampire'
      ? 'No Fortitude: fire cannot be soaked'
      : 'Mortals cannot soak fire';
    if (fortLevel > 0) {
      roll = new Roll(`${fortLevel}d10`);
      await roll.evaluate();
      const t = this._tallyDice(roll, heat.diff);
      soakDice = t.dice;
      soaked = t.outcome === 'botch' ? 0 : t.total;
      soakSkipped = false;
      soakLabel = `Fortitude ${fortLevel} only, diff ${heat.diff} (no armor)`;
    }

    const net = Math.max(incoming - soaked, 0);
    if (net > 0) await applyHealthDamage(actor, net, dmgType);
    await checkIncapacitated(actor);
    const cond = getCondition(actor);

    let scarNote = null;
    if (cond === 'Crippled' || cond === 'Incapacitated') {
      scarNote = 'Burns cover most of the body: Appearance reduced by 2.';
    } else if (cond === 'Mauled') {
      scarNote = 'Scarred by the flames: Appearance reduced by 1 until wounds heal to Bruised.';
    }

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
      attackerName: 'Fire', attackerImg: actor.img,
      attackerPortraitStyle: portraitStyle,
      defenderName: actor.name, defenderImg: actor.img,
      defenderPortraitStyle: portraitStyle,
      weaponName: heat.label, damageType: dmgType,
      dmgPool: incoming, dmgLabel: `${size.label}, per turn in the flames`,
      dmgDice: [], dmgSuccesses: incoming,
      soakPool: fortLevel, soakLabel,
      soakDice, soakSuccesses: soaked, soakSkipped,
      netDamage: net, noDamage: net === 0,
      damageAdjustment: scarNote,
      condition: cond, penalty: actor.system.woundPenalty ? `${actor.system.woundPenalty}` : null,
    });

    if (roll) await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  // -- Frenzy --------------------------------------------------------------

  static FRENZY_PROVOCATIONS = {
    smell: { label: 'Smell of blood (when hungry)', diff: 3 },
    sight: { label: 'Sight of blood (when hungry)', diff: 4 },
    harassed: { label: 'Being harassed', diff: 4 },
    lifeThreat: { label: 'Life-threatening situation', diff: 4 },
    taunts: { label: 'Malicious taunts', diff: 4 },
    physical: { label: 'Physical provocation', diff: 6 },
    taste: { label: 'Taste of blood (when hungry)', diff: 6 },
    lovedOne: { label: 'Loved one in danger', diff: 7 },
    humiliation: { label: 'Outright public humiliation', diff: 8 },
  };

  _portraitStyle() {
    const pFlags = this.document.getFlag('vtm-v20', 'portrait') || {};
    if ((pFlags.scale ?? 1) > 1 || pFlags.offX || pFlags.offY) {
      const r = 0.213 / (pFlags.scale ?? 1);
      return `object-position: calc(50% + ${(pFlags.offX * r).toFixed(1)}px) calc(50% + ${(pFlags.offY * r).toFixed(1)}px); transform: scale(${pFlags.scale});`;
    }
    return '';
  }

  _frenzyEffectData() {
    const existing = CONFIG.statusEffects.find(e => e.id === FRENZY_STATUS_ID);
    return {
      name: existing?.name ?? 'Frenzy',
      img: existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/frenzy-status.svg',
      origin: 'status',
      statuses: [FRENZY_STATUS_ID],
      ...statusIconVisibility(),
    };
  }

  async _enterFrenzy({ botch = false, difficulty = 0 } = {}) {
    const actor = this.document;
    await actor.unsetFlag('vtm-v20', 'frenzyResist');
    if (difficulty) await actor.setFlag('vtm-v20', 'frenzyDiff', difficulty);
    if (!hasStatus(FRENZY_STATUS_ID, actor)) {
      await actor.createEmbeddedDocuments('ActiveEffect', [this._frenzyEffectData()]);
    }
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: actor.img, actorName: actor.name,
      portraitStyle: this._portraitStyle(),
      label: 'Frenzy', noDice: true,
      hitLabel: `${actor.name} succumbs to the Beast and frenzies!${botch ? ' It lasts until the Storyteller says otherwise, and may leave a derangement behind.' : ''}`,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  async _endFrenzy() {
    const actor = this.document;
    const name = hasStatus(FRENZY_STATUS_ID, actor) ? 'Frenzy' : 'R\u00f6tschreck';
    const ids = Array.from(actor.effects)
      .filter(e => e.statuses?.has?.(FRENZY_STATUS_ID) || e.statuses?.has?.(ROTSCHRECK_STATUS_ID))
      .map(e => e.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
    await actor.unsetFlag('vtm-v20', 'frenzyDiff');
    const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
      actorImg: actor.img, actorName: actor.name,
      portraitStyle: this._portraitStyle(),
      label: `${name} Ends`, noDice: true,
      defendedLabel: `${actor.name} claws back control. The pain returns.`,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }

  // Instinct only: rolling to act consciously while the Beast drives
  async _rideTheWave() {
    const actor = this.document;
    const vFlags = actor.getFlag('vtm-v20', 'virtueLabels');
    const label = vFlags?.selfControl || 'Instinct';
    // Stored frenzyDiff already carries the Brujah +2 from the entry roll
    const brujah = /brujah/i.test(actor.system.clan || '');
    let difficulty = Number(actor.getFlag('vtm-v20', 'frenzyDiff')) || 0;
    if (!difficulty) {
      const base = await new Promise(resolve => {
        new Dialog({
          title: `${actor.name}: Ride the Wave`,
          content: `<div style="margin:6px 0;color:#ddd;">
            <p>No stored frenzy difficulty. Use the one that provoked this frenzy.</p>
            ${brujah ? `<p style="color:#c41e3a;"><b>Brujah:</b> +2 difficulty (clan weakness), added automatically.</p>` : ''}
            <input type="number" name="wave-diff" value="6" min="2" max="10" style="width:100%;" />
          </div>`,
          buttons: {
            roll: {
              icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll',
              callback: html => resolve(Math.min(Math.max(parseInt(html.find('[name="wave-diff"]').val()) || 6, 2), 10)),
            },
          },
          default: 'roll',
          close: () => resolve(0),
        }, { classes: ['vtm-v20', 'dialog'], width: 380 }).render(true);
      });
      if (!base) return;
      difficulty = brujah ? Math.min(base + 2, 10) : base;
    }

    let pool = actor.system.virtues?.selfControl || 0;
    let hCapped = false;
    const hum = actor.system.humanity ?? 10;
    if (pool > hum) { pool = hum; hCapped = true; }
    let capped = false;
    const bp = actor.system.blood?.value || 0;
    if (bp < pool) { pool = bp; capped = true; }
    pool = Math.max(pool, 1);

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);
    const extra = outcome === 'botch' ? 'The Beast turns on everything nearby. No control at all.'
      : total > 0 ? 'Rides the wave: this action is taken consciously.'
      : 'The Beast does as it pleases.';
    await this._emitRollCard(actor, {
      roll, label: `Ride the Wave (${label}${hCapped ? ', capped by Humanity' : ''}${capped ? ', capped by blood' : ''}${brujah ? ', Brujah +2 diff' : ''})`,
      pool, difficulty, dice, total, outcome, extra,
    });
  }

  async _rollFrenzy() {
    const actor = this.document;
    if (hasStatus(FRENZY_STATUS_ID, actor)) {
      ui.notifications.info('Already in frenzy. Use End Frenzy on the banner.');
      return;
    }

    const vFlags = actor.getFlag('vtm-v20', 'virtueLabels');
    const scLabel = vFlags?.selfControl || game.i18n.localize('VTM.SelfControl');
    const progress = Number(actor.getFlag('vtm-v20', 'frenzyResist')) || 0;
    // Brujah rage runs hotter: +2 difficulty to resist or guide frenzy
    const brujah = /brujah/i.test(actor.system.clan || '');
    const brujahNote = brujah ? `<p style="color:#c41e3a;"><b>Brujah:</b> +2 difficulty (clan weakness), added automatically.</p>` : '';

    const provs = VampireSheet.FRENZY_PROVOCATIONS;
    const conscience = actor.system.virtues?.conscience || 0;
    const conLabel = vFlags?.conscience || game.i18n.localize('VTM.Conscience');
    const evilDiff = Math.min(Math.max(9 - conscience, 2), 10);
    const options = Object.entries(provs)
      .map(([k, p]) => `<option value="${k}">${p.label}: diff ${p.diff}</option>`)
      .join('') + `<option value="evil">Blatantly evil act: diff ${evilDiff} (9 - ${conLabel})</option>`;

    // Instinct does not resist: the character always frenzies, unless the
    // difficulty is below her Instinct, in which case frenzy is her choice.
    if (/instinct/i.test(scLabel)) {
      const instinctVal = actor.system.virtues?.selfControl || 0;
      const picked = await new Promise(resolve => {
        new Dialog({
          title: `${actor.name}: Frenzy (${scLabel})`,
          content: `<div style="margin:6px 0;color:#ddd;">
            <p>${scLabel} ${instinctVal}: the Beast takes over, unless the difficulty is lower than that.</p>
            ${brujahNote}
            <label style="display:block;margin:6px 0 2px;">Provocation</label>
            <select name="frenzy-prov" style="width:100%;">${options}</select>
            <label style="display:block;margin:6px 0 2px;">Difficulty override (optional)</label>
            <input type="number" name="frenzy-diff" placeholder="Storyteller's call" min="2" max="10" style="width:100%;" />
          </div>`,
          buttons: {
            face: {
              icon: '<i class="fas fa-paw"></i>', label: 'Face the Beast',
              callback: html => resolve({
                prov: html.find('[name="frenzy-prov"]').val(),
                diff: parseInt(html.find('[name="frenzy-diff"]').val()),
              }),
            },
          },
          default: 'face',
          close: () => resolve(null),
        }, { classes: ['vtm-v20', 'dialog'], width: 440 }).render(true);
      });
      if (!picked) return;

      const iProv = provs[picked.prov];
      const iBase = !isNaN(picked.diff)
        ? Math.min(Math.max(picked.diff, 2), 10)
        : (picked.prov === 'evil' ? evilDiff : (iProv?.diff ?? 6));
      const iDiff = brujah ? Math.min(iBase + 2, 10) : iBase;
      const iLabel = picked.prov === 'evil' ? 'Blatantly evil act' : (iProv?.label ?? 'Provocation');

      if (iDiff >= instinctVal) {
        const forcedHtml = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
          actorImg: actor.img, actorName: actor.name,
          portraitStyle: this._portraitStyle(),
          label: `Frenzy: ${iLabel}`, noDice: true,
          hitLabel: `Difficulty ${iDiff} vs ${scLabel} ${instinctVal}: the Beast will not be denied.`,
        });
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: forcedHtml,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        });
        await this._enterFrenzy({ difficulty: iDiff });
        return;
      }

      const wants = await new Promise(resolve => {
        new Dialog({
          title: `${actor.name}: The Beast Waits`,
          content: `<p style="margin:8px 0;color:#ddd;">Difficulty ${iDiff} is below ${scLabel} ${instinctVal}. Frenzy is a choice this time.</p>`,
          buttons: {
            frenzy: { icon: '<i class="fas fa-paw"></i>', label: 'Frenzy', callback: () => resolve(true) },
            hold: { icon: '<i class="fas fa-hand-paper"></i>', label: 'Hold Back', callback: () => resolve(false) },
          },
          default: 'hold',
          close: () => resolve(null),
        }, { classes: ['vtm-v20', 'dialog'], width: 400 }).render(true);
      });
      if (wants === null) return;
      if (wants) {
        await this._enterFrenzy({ difficulty: iDiff });
      } else {
        const heldHtml = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
          actorImg: actor.img, actorName: actor.name,
          portraitStyle: this._portraitStyle(),
          label: `Frenzy: ${iLabel}`, noDice: true,
          defendedLabel: `${actor.name} keeps a rein on the Beast and chooses not to frenzy (diff ${iDiff}).`,
        });
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: heldHtml,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        });
      }
      return;
    }

    const choice = await new Promise(resolve => {
      new Dialog({
        title: `${actor.name}: Resist Frenzy`,
        content: `<div style="margin:6px 0;color:#ddd;">
          ${progress ? `<p>Accumulated successes: <b>${progress}/5</b>.</p>` : ''}
          <p>${scLabel} roll. Five total successes overcome the urge; fewer hold the Beast off for one turn per success.</p>
          ${brujahNote}
          <label style="display:block;margin:6px 0 2px;">Provocation</label>
          <select name="frenzy-prov" style="width:100%;">${options}</select>
          <label style="display:block;margin:6px 0 2px;">Difficulty override (optional)</label>
          <input type="number" name="frenzy-diff" placeholder="Storyteller's call" min="2" max="10" style="width:100%;" />
        </div>`,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>', label: `Roll ${scLabel}`,
            callback: html => resolve({
              prov: html.find('[name="frenzy-prov"]').val(),
              diff: parseInt(html.find('[name="frenzy-diff"]').val()),
            }),
          },
          succumb: { icon: '<i class="fas fa-paw"></i>', label: 'Succumb', callback: () => resolve({ succumb: true }) },
        },
        default: 'roll',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 440 }).render(true);
    });
    if (!choice) return;
    if (choice.succumb) {
      await this._enterFrenzy();
      return;
    }

    const prov = provs[choice.prov];
    const baseDiff = !isNaN(choice.diff)
      ? Math.min(Math.max(choice.diff, 2), 10)
      : (choice.prov === 'evil' ? evilDiff : (prov?.diff ?? 6));
    const difficulty = brujah ? Math.min(baseDiff + 2, 10) : baseDiff;
    const provLabel = choice.prov === 'evil' ? 'Blatantly evil act' : (prov?.label ?? 'Provocation');

    // Self-Control rolls cap at the current blood pool, same as resisting the Kiss
    let pool = actor.system.virtues?.selfControl || 0;
    let hCapped = false;
    const hum = actor.system.humanity ?? 10;
    if (pool > hum) { pool = hum; hCapped = true; }
    let capped = false;
    const bp = actor.system.blood?.value || 0;
    if (bp < pool) { pool = bp; capped = true; }
    pool = Math.max(pool, 1);

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);
    const label = `Resist Frenzy: ${provLabel} (${scLabel}${hCapped ? ', capped by Humanity' : ''}${capped ? ', capped by blood' : ''}${brujah ? ', Brujah +2 diff' : ''})`;

    if (outcome === 'botch') {
      await this._emitRollCard(actor, { roll, label, pool, difficulty, dice, total: 0, outcome, extra: 'Botch! The Beast takes the wheel.' });
      await this._enterFrenzy({ botch: true });
      return;
    }
    if (total <= 0) {
      await this._emitRollCard(actor, { roll, label, pool, difficulty, dice, total, outcome, extra: 'The rage wins.' });
      await this._enterFrenzy();
      return;
    }

    const newTotal = progress + total;
    if (newTotal >= 5) {
      await actor.unsetFlag('vtm-v20', 'frenzyResist');
      await this._emitRollCard(actor, {
        roll, label, pool, difficulty, dice, total, outcome,
        extra: `${newTotal}/5 successes accumulated: the urge is completely overcome.`,
      });
    } else {
      await actor.setFlag('vtm-v20', 'frenzyResist', newTotal);
      await this._emitRollCard(actor, {
        roll, label, pool, difficulty, dice, total, outcome,
        extra: `Holds the Beast off for ${total} turn${total === 1 ? '' : 's'} (${newTotal}/5 accumulated). Roll again when it expires.`,
      });
    }
  }

  // -- Rotschreck: the Red Fear --------------------------------------------

  static ROTSCHRECK_PROVOCATIONS = {
    cigarette: { label: 'Lighting a cigarette', diff: 3 },
    torch: { label: 'Sight of a torch', diff: 5 },
    bonfire: { label: 'Bonfire', diff: 6 },
    obscuredSun: { label: 'Obscured sunlight', diff: 7 },
    burned: { label: 'Being burned', diff: 7 },
    directSun: { label: 'Direct sunlight', diff: 8 },
    trapped: { label: 'Trapped in a burning building', diff: 9 },
  };

  async _rollRotschreck() {
    const actor = this.document;
    if (hasStatus(FRENZY_STATUS_ID, actor)) {
      ui.notifications.info('Frenzied characters are immune to R\u00f6tschreck.');
      return;
    }

    const provs = VampireSheet.ROTSCHRECK_PROVOCATIONS;
    const progress = Number(actor.getFlag('vtm-v20', 'rotschreckResist')) || 0;
    const options = Object.entries(provs)
      .map(([k, p]) => `<option value="${k}">${p.label}: diff ${p.diff}</option>`)
      .join('');

    const choice = await new Promise(resolve => {
      new Dialog({
        title: `${actor.name}: R\u00f6tschreck`,
        content: `<div style="margin:6px 0;color:#ddd;">
          ${progress ? `<p>Accumulated successes: <b>${progress}/5</b>.</p>` : ''}
          <p>Courage roll against the Red Fear. Five total successes ignore the Beast completely; fewer master the fear for one turn per success.</p>
          <label style="display:block;margin:6px 0 2px;">Provocation</label>
          <select name="rot-prov" style="width:100%;">${options}</select>
          <label style="display:block;margin:6px 0 2px;">Difficulty override (optional)</label>
          <input type="number" name="rot-diff" placeholder="Storyteller's call" min="2" max="10" style="width:100%;" />
        </div>`,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll Courage',
            callback: html => resolve({
              prov: html.find('[name="rot-prov"]').val(),
              diff: parseInt(html.find('[name="rot-diff"]').val()),
            }),
          },
        },
        default: 'roll',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 440 }).render(true);
    });
    if (!choice) return;

    const prov = provs[choice.prov];
    const difficulty = !isNaN(choice.diff)
      ? Math.min(Math.max(choice.diff, 2), 10)
      : (prov?.diff ?? 6);
    const provLabel = prov?.label ?? 'Provocation';
    const courage = actor.system.virtues?.courage || 0;
    const hum = actor.system.humanity ?? 10;
    const hCapped = courage > hum;
    const pool = Math.max(Math.min(courage, hum), 1);

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total, outcome } = this._tallyDice(roll, difficulty);
    const label = `R\u00f6tschreck: ${provLabel} (Courage${hCapped ? ', capped by Humanity' : ''})`;

    if (outcome === 'botch') {
      await this._emitRollCard(actor, { roll, label, pool, difficulty, dice, total: 0, outcome, extra: 'Botch! The Red Fear boils over into frenzy.' });
      await actor.unsetFlag('vtm-v20', 'rotschreckResist');
      await this._enterFrenzy({ botch: true });
      return;
    }
    if (total <= 0) {
      await this._emitRollCard(actor, {
        roll, label, pool, difficulty, dice, total, outcome,
        extra: 'Flees madly for safety, tearing apart anything in the way.',
      });
      await actor.unsetFlag('vtm-v20', 'rotschreckResist');
      if (!hasStatus(ROTSCHRECK_STATUS_ID, actor)) {
        const existing = CONFIG.statusEffects.find(e => e.id === ROTSCHRECK_STATUS_ID);
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: existing?.name ?? 'R\u00f6tschreck',
          img: existing?.img ?? existing?.icon ?? 'systems/vtm-v20/VTM icons/rotschreck-status.svg',
          origin: 'status',
          statuses: [ROTSCHRECK_STATUS_ID],
          ...statusIconVisibility(),
        }]);
      }
      return;
    }

    const newTotal = progress + total;
    if (newTotal >= 5) {
      await actor.unsetFlag('vtm-v20', 'rotschreckResist');
      const ids = Array.from(actor.effects).filter(e => e.statuses?.has?.(ROTSCHRECK_STATUS_ID)).map(e => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
      await this._emitRollCard(actor, {
        roll, label, pool, difficulty, dice, total, outcome,
        extra: `${newTotal}/5 successes accumulated: the Beast's fear is ignored completely.`,
      });
    } else {
      await actor.setFlag('vtm-v20', 'rotschreckResist', newTotal);
      await this._emitRollCard(actor, {
        roll, label, pool, difficulty, dice, total, outcome,
        extra: `Masters the fear for ${total} turn${total === 1 ? '' : 's'} (${newTotal}/5 accumulated). Roll again when it expires.`,
      });
    }
  }

  // -- Sunlight ------------------------------------------------------------

  static SUN_INTENSITIES = {
    faint: { label: 'Faint: closed curtain, heavy cloud, twilight', diff: 3 },
    protected: { label: 'Fully protected: heavy clothes, sunglasses, gloves, hat', diff: 5 },
    indirect: { label: 'Indirect: through a window or light curtains', diff: 7 },
    cloudy: { label: 'Cloudy day outside, one direct ray, mirror reflection', diff: 9 },
    direct: { label: 'Direct rays from an unobscured sun', diff: 10 },
  };

  static SUN_EXPOSURES = {
    small: { label: 'Small part exposed: a hand, part of the face', levels: 1 },
    large: { label: 'Large part exposed: a leg, an arm, the whole head', levels: 2 },
    half: { label: 'Half the body or more exposed, thin clothing', levels: 3 },
  };

  async _rollSunlight() {
    const actor = this.document;
    const intensities = VampireSheet.SUN_INTENSITIES;
    const exposures = VampireSheet.SUN_EXPOSURES;

    const intensityOptions = Object.entries(intensities)
      .map(([k, h]) => `<option value="${k}">${h.label}: soak diff ${h.diff}</option>`).join('');
    const exposureOptions = Object.entries(exposures)
      .map(([k, s]) => `<option value="${k}">${s.label}: ${s.levels}/turn</option>`).join('');

    const choice = await new Promise(resolve => {
      new Dialog({
        title: `${actor.name}: Sunlight`,
        content: `<div style="margin:6px 0;color:#ddd;">
          <p>Aggravated damage every turn in the light. Only Fortitude soaks it.</p>
          <label style="display:block;margin:6px 0 2px;">Intensity of Light</label>
          <select name="sun-intensity" style="width:100%;">${intensityOptions}</select>
          <label style="display:block;margin:6px 0 2px;">Exposure</label>
          <select name="sun-exposure" style="width:100%;">${exposureOptions}</select>
        </div>`,
        buttons: {
          burn: {
            icon: '<i class="fas fa-cloud-sun"></i>', label: 'Burn One Turn',
            callback: html => resolve({
              intensity: html.find('[name="sun-intensity"]').val(),
              exposure: html.find('[name="sun-exposure"]').val(),
            }),
          },
        },
        default: 'burn',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 460 }).render(true);
    });
    if (!choice) return;

    const intensity = intensities[choice.intensity] || intensities.faint;
    const exposure = exposures[choice.exposure] || exposures.small;
    const dmgType = 'aggravated';
    const incoming = exposure.levels;

    // Only Fortitude stands between a vampire and the sun
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;

    let roll = null;
    let soakDice = [];
    let soaked = 0;
    let soakSkipped = true;
    let soakLabel = 'No Fortitude: sunlight cannot be soaked';
    if (fortLevel > 0) {
      roll = new Roll(`${fortLevel}d10`);
      await roll.evaluate();
      const t = this._tallyDice(roll, intensity.diff);
      soakDice = t.dice;
      soaked = t.outcome === 'botch' ? 0 : t.total;
      soakSkipped = false;
      soakLabel = `Fortitude ${fortLevel} only, diff ${intensity.diff}`;
    }

    const net = Math.max(incoming - soaked, 0);
    if (net > 0) await applyHealthDamage(actor, net, dmgType);
    await checkIncapacitated(actor);
    const cond = getCondition(actor);

    const chatHtml = await renderTemplate('systems/vtm-v20/templates/damage-card.hbs', {
      attackerName: 'Sunlight', attackerImg: actor.img,
      attackerPortraitStyle: this._portraitStyle(),
      defenderName: actor.name, defenderImg: actor.img,
      defenderPortraitStyle: this._portraitStyle(),
      weaponName: intensity.label, damageType: dmgType,
      dmgPool: incoming, dmgLabel: `${exposure.label}, per turn in the light`,
      dmgDice: [], dmgSuccesses: incoming,
      soakPool: fortLevel, soakLabel,
      soakDice, soakSuccesses: soaked, soakSkipped,
      netDamage: net, noDamage: net === 0,
      damageAdjustment: null,
      condition: cond, penalty: actor.system.woundPenalty ? `${actor.system.woundPenalty}` : null,
    });

    if (roll) await showDice(roll, actor);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatHtml,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
    const stamina = effectiveTraitValue(actor, 'attributes.stamina');
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
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
      style: CONST.CHAT_MESSAGE_STYLES.OTHER, flags,
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
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      });
      return;
    }

    const stamina = effectiveTraitValue(actor, 'attributes.stamina');
    const fort = Array.from(actor.items).find(i => i.type === 'discipline' && i.name.toLowerCase() === 'fortitude');
    const fortLevel = fort?.system.level || 0;
    const fullArmor = Array.from(actor.items)
      .filter(i => i.type === 'armor' && i.system.equipped)
      .reduce((sum, i) => sum + (i.system.rating || 0), 0);
    const armorUsed = fallData.terminal ? Math.floor(fullArmor / 2) : fullArmor;

    const pool = Math.max(stamina + fortLevel + armorUsed, 1);
    const fallSoakDiff = actor.getFlag('vtm-v20', 'skinOfTheAdder') ? 5 : 6;
    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const { dice, total: soaked } = this._tallyDice(roll, fallSoakDiff);

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
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
      if (opts.adjust) {
        const adj = await promptRollAdjust({ title: `Roll: ${label}`, pool, difficulty });
        if (!adj) return null;
        pool = Math.max(pool + adj.mod, 1);
        difficulty = adj.difficulty;
        if (adj.mod) label += ` | bonus ${adj.mod > 0 ? '+' : ''}${adj.mod}`;
      }
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
    let autoSucc = potenceAutoSuccesses(this.document);

    let wpUsed = false;
    if (actor.getFlag('vtm-v20', 'wpSpent')) {
      autoSucc += 1;
      wpUsed = true;
      await actor.unsetFlag('vtm-v20', 'wpSpent');
    }

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

    const potAuto = potenceAutoSuccesses(actor);
    const autoLabels = [];
    if (potAuto) autoLabels.push(`${potAuto} Potence`);
    if (wpUsed) autoLabels.push('1 WP');
    const autoLabel = autoLabels.join(' + ');

    const flags = { 'vtm-v20': { jump: { actorUuid: actor.uuid } } };
    await this._emitRollCard(actor, {
      roll, label, pool, difficulty, dice, total, outcome, extra, ledgeBtn: true, flags,
      autoSuccesses: autoSucc, autoLabel, diceTotal,
    });
  }

  // Ledge catch on a failed jump (Dexterity + Athletics, diff 6). Callable
  // from the chat-card button even when the sheet isn't rendered.
  async _rollLedgeCatch() {
    const actor = this.document;
    const dex = effectiveTraitValue(actor, 'attributes.dexterity');
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

  // -- Throwing roll --------------------------------------------------------

  async _rollThrowing() {
    const actor = this.document;
    const rawStr = actor.system.attributes?.strength || 0;
    const str = rawStr + potenceLevel(actor);
    const dex = effectiveTraitValue(actor, 'attributes.dexterity');
    const ath = actor.system.abilities?.athletics || 0;
    const woundPen = actor.system.woundPenalty || 0;

    const choice = await this._throwDialog(str, dex, ath, woundPen);
    if (!choice) return;

    const overKg = Math.max(choice.weight - 1, 0);
    const maxDist = Math.max(str * 5 - overKg * 5, 0);
    const canThrow = maxDist > 0;
    const halfDist = Math.round(maxDist / 2 * 10) / 10;

    const baseDiff = choice.range === 'far' ? 7 : 6;
    const difficulty = blindedDifficulty(actor, baseDiff);
    const pool = Math.max(dex + ath + choice.mod + woundPen, 1);

    const labelBase = 'Throwing (Dexterity + Athletics)';
    const label = difficulty > baseDiff ? `${labelBase} | blinded diff +2` : labelBase;

    if (game.vtm?._captureAction) {
      const cb = game.vtm._captureAction;
      game.vtm._captureAction = null;
      cb({ label: labelBase, pool, difficulty, source: 'throw' });
      return;
    }

    const roll = new Roll(`${pool}d10`);
    await roll.evaluate();
    const tally = this._tallyDice(roll, difficulty);
    let { total, outcome } = tally;

    let wpUsed = false;
    if (actor.getFlag('vtm-v20', 'wpSpent')) {
      total += 1;
      wpUsed = true;
      if (total > 0 && outcome !== 'success') outcome = 'success';
      await actor.unsetFlag('vtm-v20', 'wpSpent');
    }

    const rangeTxt = choice.range === 'far'
      ? `${halfDist}-${maxDist} yds (diff ${difficulty})`
      : `up to ${halfDist} yds (diff ${difficulty})`;
    let extra;
    if (!canThrow) {
      extra = `Too heavy to throw (${choice.weight} kg). Hurled ~1 yard.`;
    } else if (outcome === 'success') {
      extra = `${choice.weight} kg at ${rangeTxt}. Hit with ${total} success${total > 1 ? 'es' : ''}.`;
    } else if (outcome === 'botch') {
      extra = `${choice.weight} kg at ${rangeTxt}. Botched the throw!`;
    } else {
      extra = `${choice.weight} kg at ${rangeTxt}. Missed the target.`;
    }

    const autoSuccesses = wpUsed ? 1 : 0;
    const autoLabel = wpUsed ? '1 WP' : '';
    await this._emitRollCard(actor, { roll, label, pool, difficulty, dice: tally.dice, total, outcome, extra, autoSuccesses, autoLabel, diceTotal: tally.total });
  }

  _throwDialog(str, dex, ath, woundPen) {
    const pool = dex + ath;
    const calcDist = w => {
      const over = Math.max(w - 1, 0);
      return Math.max(str * 5 - over * 5, 0);
    };
    const initDist = calcDist(1);

    const content = `
      <form class="vtm-roll-dialog jump-dialog">
        <div class="form-group">
          <label>Pool</label>
          <div class="ledge-pool-row">Dexterity + Athletics <span class="jump-pool">${pool}</span></div>
        </div>
        <div class="form-group">
          <label>Object Weight (kg)</label>
          <input type="number" name="weight" value="1" min="0.1" step="0.1" />
        </div>
        <div class="form-group">
          <label>Max Distance</label>
          <div class="throw-dist"><span class="throw-dist-val">${initDist}</span> yards</div>
        </div>
        <div class="form-group">
          <label>Range</label>
          <div class="jump-type-row">
            <label class="jump-type"><input type="radio" name="range" value="near" checked /> Half range (diff 6)</label>
            <label class="jump-type"><input type="radio" name="range" value="far" /> Full range (diff 7)</label>
          </div>
        </div>
        <div class="form-group">
          <label>Modifier</label>
          <input type="number" name="modifier" value="0" />
        </div>
        ${woundPen ? `<div class="form-group wound-pen-row"><label>Wound Penalty</label><span class="wound-pen-val">${woundPen}</span></div>` : ''}
        <div class="form-group">
          <label>Difficulty</label>
          <input type="hidden" name="difficulty" value="6" />
          <div class="diff-buttons">
            ${[3,4,5,6,7,8,9,10].map(d => `<button type="button" class="diff-btn ${d === 6 ? 'active' : ''}" data-diff="${d}">${d}</button>`).join('')}
          </div>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: 'Throwing',
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: 'Throw',
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({
                weight: parseFloat(form.weight.value) || 1,
                range: form.range.value,
                mod: parseInt(form.modifier.value) || 0,
                difficulty: parseInt(form.difficulty.value) || 6,
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
          // Update distance and difficulty when weight or range changes
          const updateDist = () => {
            const w = parseFloat(html.find('[name="weight"]').val()) || 1;
            const dist = Math.max(str * 5 - Math.max(w - 1, 0) * 5, 0);
            html.find('.throw-dist-val').text(dist);
          };
          const updateDiff = () => {
            const range = html.find('[name="range"]:checked').val();
            const diff = range === 'far' ? 7 : 6;
            html.find('[name="difficulty"]').val(diff);
            html.find('.diff-btn').removeClass('active');
            html.find(`.diff-btn[data-diff="${diff}"]`).addClass('active');
          };
          html.find('[name="weight"]').on('input', updateDist);
          html.find('[name="range"]').change(updateDiff);
        },
        default: 'roll',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 380 }).render(true);
    });
  }

  async _rollAwakening() {
    const actor = this.document;
    const per = actor.system.attributes?.perception || 0;
    const auspex = disciplineLevel(actor, 'auspex');
    const humanity = actor.system.humanity || 0;
    const pathName = actor.system.pathName || 'Humanity';
    const woundPen = actor.system.woundPenalty || 0;

    const choice = await this._awakenDialog(per, auspex, humanity, pathName, woundPen);
    if (!choice) return;

    // Phase 1: Perception + Auspex vs diff 8
    const percPool = Math.max(per + auspex + choice.mod + woundPen, 1);
    const percLabel = auspex
      ? `Awakening: Perception + Auspex (${auspex})`
      : 'Awakening: Perception';

    const percRoll = new Roll(`${percPool}d10`);
    await percRoll.evaluate();
    const perc = this._tallyDice(percRoll, 8);

    let wpUsed = false;
    if (actor.getFlag('vtm-v20', 'wpSpent')) {
      wpUsed = true;
      await actor.unsetFlag('vtm-v20', 'wpSpent');
    }
    const wpAuto = wpUsed ? 1 : 0;
    let percTotal = perc.total + wpAuto;
    let percOutcome = perc.outcome;
    if (percTotal > 0 && percOutcome !== 'success') percOutcome = 'success';

    if (percOutcome === 'botch') {
      await this._emitRollCard(actor, {
        roll: percRoll, label: percLabel, pool: percPool, difficulty: 8,
        dice: perc.dice, total: perc.total, outcome: 'botch',
        extra: 'Deep sleep. Cannot be roused until sundown.',
      });
      return;
    }

    if (percOutcome === 'failure') {
      await this._emitRollCard(actor, {
        roll: percRoll, label: percLabel, pool: percPool, difficulty: 8,
        dice: perc.dice, total: 0, outcome: 'failure',
        extra: 'Slips back into slumber. May attempt again if disturbed.',
      });
      return;
    }

    // Phase 2: Humanity/Path vs diff 8
    const humPool = Math.max(humanity, 1);
    const humLabel = `Awakening: ${pathName}`;

    const humRoll = new Roll(`${humPool}d10`);
    await humRoll.evaluate();
    const hum = this._tallyDice(humRoll, 8);

    let extra;
    if (hum.outcome === 'botch') {
      extra = 'Deep sleep. Cannot be roused until sundown.';
    } else if (hum.outcome === 'failure') {
      extra = 'Slips back into slumber. May attempt again if disturbed.';
    } else if (hum.total >= 5) {
      extra = `${hum.total} successes. Fully awake for the scene.`;
    } else {
      extra = `${hum.total} success${hum.total > 1 ? 'es' : ''}. Awake for ${hum.total} turn${hum.total > 1 ? 's' : ''}.`;
    }

    // Show both rolls: perception first, then humanity
    const percAutoLabel = wpUsed ? '1 WP' : '';
    await this._emitRollCard(actor, {
      roll: percRoll, label: percLabel, pool: percPool, difficulty: 8,
      dice: perc.dice, total: percTotal, outcome: percOutcome,
      extra: `Noticed the disturbance with ${percTotal} success${percTotal > 1 ? 'es' : ''}.`,
      autoSuccesses: wpAuto, autoLabel: percAutoLabel, diceTotal: perc.total,
    });

    await this._emitRollCard(actor, {
      roll: humRoll, label: humLabel, pool: humPool, difficulty: 8,
      dice: hum.dice, total: hum.total, outcome: hum.outcome,
      extra,
    });
  }

  _awakenDialog(per, auspex, humanity, pathName, woundPen) {
    const pool = per + auspex;
    const auspexNote = auspex ? ` + Auspex (${auspex})` : '';
    const content = `
      <form class="vtm-roll-dialog jump-dialog">
        <div class="form-group">
          <label>Step 1: Notice</label>
          <div class="ledge-pool-row">Perception${auspexNote} (${pool} dice, diff 8)</div>
        </div>
        <div class="form-group">
          <label>Step 2: Rouse</label>
          <div class="ledge-pool-row">${pathName} (${humanity} dice, diff 8)</div>
        </div>
        <div class="form-group">
          <label>Modifier</label>
          <input type="number" name="modifier" value="0" />
        </div>
        ${woundPen ? `<div class="form-group wound-pen-row"><label>Wound Penalty</label><span class="wound-pen-val">${woundPen}</span></div>` : ''}
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: 'Awakening',
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: 'Roll',
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({ mod: parseInt(form.modifier.value) || 0 });
            }
          }
        },
        default: 'roll',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog', 'roll-dialog'], width: 380 }).render(true);
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
