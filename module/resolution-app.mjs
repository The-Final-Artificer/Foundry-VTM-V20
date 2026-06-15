// Resolution dialog: players allocate dice and execute their declared actions.

import { advanceResolution } from './initiative.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export class ResolutionApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['vtm-v20', 'resolution-dialog'],
    position: { width: 480, height: 'auto' },
    window: { title: 'Resolve Actions', resizable: true },
    actions: {
      executeAction: ResolutionApp.#onExecute,
      finishTurn: ResolutionApp.#onFinish,
    },
  };

  static PARTS = {
    form: { template: 'systems/vtm-v20/templates/resolution-app.hbs' },
  };

  constructor(combat, combatant, options = {}) {
    super(options);
    this.combat = combat;
    this.combatant = combatant;
    this.actor = combatant.actor;
    this._executed = new Set(); // indices of actions already executed
  }

  get title() {
    return `${this.combatant.name}: Resolve Actions`;
  }

  async _prepareContext() {
    const decl = this.combatant.getFlag('vtm-v20', 'declaration') || {};
    const actions = decl.actions || [];
    const totalPool = decl.totalPool || 0;
    const multiAction = actions.length > 1;

    // Mark defense as executed if it was used via the chat Defend button
    const defenseUsed = this.combatant.getFlag('vtm-v20', 'defenseUsed');
    if (defenseUsed) {
      const defIdx = actions.findIndex(a => a.defense);
      if (defIdx >= 0) this._executed.add(defIdx);
    }

    // Build display data for each action
    const actor = this.actor;
    const items = Array.from(actor.items);
    const display = actions.map((a, i) => {
      let name = a.text || 'Attack';
      if (a.defense) name = `${a.text || 'Defense'} (Defense)`;
      else if (a.attackId === '_unarmed') name = 'Unarmed Attack';
      else if (a.attackId) {
        const w = items.find(it => it.id === a.attackId);
        if (w) name = `Attack with ${w.name}`;
      }
      return {
        index: i,
        name,
        attackId: a.attackId,
        isDefense: !!a.defense,
        defense: a.defense,
        executed: this._executed.has(i),
      };
    });

    return {
      actor,
      actorImg: actor.img,
      actorName: actor.name,
      actions: display,
      totalPool,
      multiAction,
      allExecuted: this._executed.size >= actions.length,
      declarationText: decl.text || '',
    };
  }

  static async #onExecute(ev, target) {
    const idx = parseInt(target.dataset.index);
    if (isNaN(idx) || this._executed.has(idx)) return;

    const decl = this.combatant.getFlag('vtm-v20', 'declaration') || {};
    const actions = decl.actions || [];
    const action = actions[idx];
    if (!action) return;

    const totalPool = decl.totalPool || 0;
    const multiAction = actions.length > 1;

    // For multi-action, read the dice allocation from the input
    let poolForAction = totalPool;
    if (multiAction) {
      const input = this.element.querySelector(`[name="alloc-${idx}"]`);
      poolForAction = parseInt(input?.value) || 1;
    }

    // Execute the action
    if (action.attackId) {
      const { rollAttack } = await import('./combat.mjs');
      const actor = this.actor;

      if (action.attackId === '_unarmed') {
        // Build a minimal unarmed attack object
        const dex = actor.system.attributes?.dexterity || 0;
        const brawl = actor.system.abilities?.brawl || 0;
        const atk = {
          id: '_unarmed', name: 'Unarmed',
          damageFormula: 'Str', damageType: 'bashing',
          skill: 'abilities.brawl', isRanged: false,
        };
        await rollAttack(actor, atk, { poolOverride: poolForAction });
      } else {
        // Find the weapon and build the attack object same as the sheet does
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
          await rollAttack(actor, atk, { poolOverride: poolForAction });
        }
      }
    }

    this._executed.add(idx);
    this.render();
  }

  static async #onFinish() {
    await this.combatant.setFlag('vtm-v20', 'resolved', true);
    this.close();
    advanceResolution(this.combat);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    // Live validation: allocations must sum to totalPool, can't go over
    const inputs = [...el.querySelectorAll('.alloc-input')];
    const totalDisplay = el.querySelector('.alloc-total');
    if (inputs.length > 1 && totalDisplay) {
      const decl = this.combatant.getFlag('vtm-v20', 'declaration') || {};
      const max = decl.totalPool || 0;

      const updateDisplay = () => {
        const sum = inputs.reduce((s, inp) => s + (parseInt(inp.value) || 0), 0);
        totalDisplay.textContent = `${sum} / ${max}`;
        totalDisplay.classList.toggle('over-budget', sum > max);
      };

      for (const inp of inputs) {
        if (inp.disabled) continue;
        inp.addEventListener('input', () => {
          let val = parseInt(inp.value);
          if (isNaN(val) || val < 1) { inp.value = 1; updateDisplay(); return; }

          const otherSum = inputs.reduce((s, other) => {
            return s + (other === inp ? 0 : (parseInt(other.value) || 1));
          }, 0);
          const ceiling = Math.max(max - otherSum, 1);
          if (val > ceiling) inp.value = ceiling;

          updateDisplay();
        });
      }
      updateDisplay();
    }
  }
}
