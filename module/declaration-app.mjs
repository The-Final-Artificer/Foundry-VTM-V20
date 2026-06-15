// Declaration dialog: players declare their actions for the round.
// Opens per-combatant during the declaration phase.

import { advanceDeclaration } from './initiative.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export class DeclarationApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['vtm-v20', 'declaration-dialog'],
    position: { width: 480, height: 'auto' },
    window: { title: 'Declare Actions', resizable: true },
    actions: {
      addAction: DeclarationApp.#onAddAction,
      cancelCapture: DeclarationApp.#onCancelCapture,
      removeAction: DeclarationApp.#onRemoveAction,
      confirmDeclaration: DeclarationApp.#onConfirm,
      openSheet: DeclarationApp.#onOpenSheet,
    },
  };

  static PARTS = {
    form: { template: 'systems/vtm-v20/templates/declaration-app.hbs' },
  };

  constructor(combat, combatant, options = {}) {
    super(options);
    this.combat = combat;
    this.combatant = combatant;
    this.actor = combatant.actor;
    this._actions = [];
    this._capturing = false;
  }

  get title() {
    return `${this.combatant.name}: Declare Actions`;
  }

  async _prepareContext() {
    const actor = this.actor;
    const sys = actor.system;
    const items = Array.from(actor.items);

    // Build the same attack list the sheet uses
    const attacks = [];
    const dex = sys.attributes?.dexterity || 0;

    for (const w of items.filter(i => i.type === 'weapon' && i.system.equipped)) {
      const isRanged = !!w.system.range;
      const skillKey = isRanged ? 'firearms' : 'melee';
      const skillVal = sys.abilities?.[skillKey] || 0;
      attacks.push({
        id: w.id, name: w.name, img: w.img,
        poolSize: dex + skillVal,
        poolLabel: `Dex ${dex} + ${isRanged ? 'Firearms' : 'Melee'} ${skillVal}`,
        isRanged, rate: parseInt(w.system.rate) || 0,
      });
    }

    // Add unarmed
    const brawl = sys.abilities?.brawl || 0;
    attacks.unshift({
      id: '_unarmed', name: 'Unarmed', img: 'icons/svg/sword.svg',
      poolSize: dex + brawl,
      poolLabel: `Dex ${dex} + Brawl ${brawl}`,
      isRanged: false,
    });

    // Defense options
    const ath = sys.abilities?.athletics || 0;
    const melee = sys.abilities?.melee || 0;
    const defenses = [
      { name: 'Dodge', defense: 'dodge', poolSize: dex + ath, poolLabel: `Dex ${dex} + Athletics ${ath}` },
      { name: 'Block', defense: 'block', poolSize: dex + brawl, poolLabel: `Dex ${dex} + Brawl ${brawl}` },
      { name: 'Parry', defense: 'parry', poolSize: dex + melee, poolLabel: `Dex ${dex} + Melee ${melee}` },
    ];
    const hasDefense = this._actions.some(a => a.defense);

    // Compute the lowest pool for splitting (custom actions carry their own pool)
    let lowestPool = Infinity;
    for (const a of this._actions) {
      let p;
      if (a.pool) p = a.pool;
      else if (a.defense) {
        const def = defenses.find(d => d.defense === a.defense);
        if (def) p = def.poolSize;
      } else {
        const atk = attacks.find(x => x.id === a.attackId);
        if (atk) p = atk.poolSize;
      }
      if (p !== undefined && p < lowestPool) lowestPool = p;
    }
    if (!isFinite(lowestPool)) lowestPool = 0;

    // Add wound penalty to pool display
    const wp = sys.woundPenalty || 0;
    const effectivePool = Math.max(lowestPool + wp, 1);

    return {
      actor,
      actorImg: actor.img,
      actorName: actor.name,
      attacks,
      defenses,
      hasDefense,
      actions: this._actions.map((a, i) => {
        const atk = attacks.find(x => x.id === a.attackId);
        const def = a.defense ? defenses.find(d => d.defense === a.defense) : null;
        let attackName, poolLabel;
        if (def) {
          attackName = def.name;
          poolLabel = def.poolLabel;
        } else if (a.pool) {
          attackName = a.text || 'Custom';
          poolLabel = `Pool ${a.pool}`;
        } else {
          attackName = atk?.name || a.text || 'Custom';
          poolLabel = atk?.poolLabel || '';
        }
        return { ...a, index: i, attackName, poolLabel, isDefense: !!a.defense };
      }),
      actionCount: this._actions.length,
      lowestPool: effectivePool,
      showSplit: this._actions.length > 1,
      woundPenalty: wp,
      capturing: this._capturing,
    };
  }

  static #onAddAction() {
    this._capturing = true;
    this.render();

    game.vtm._captureAction = (rollData) => {
      this._capturing = false;
      this._actions.push({
        attackId: null,
        text: rollData.label,
        pool: rollData.pool,
        difficulty: rollData.difficulty,
      });
      this.render();
      ui.notifications.info(`Captured: ${rollData.label} (pool ${rollData.pool})`);
    };
  }

  static #onCancelCapture() {
    this._capturing = false;
    game.vtm._captureAction = null;
    this.render();
  }

  static async #onOpenSheet() {
    const sheet = this.actor.sheet;
    await sheet.render(true);
    this._setupDocking(sheet);
  }

  static #onRemoveAction(ev, target) {
    const idx = parseInt(target.dataset.index);
    if (!isNaN(idx)) {
      this._actions.splice(idx, 1);
      this.render();
    }
  }

  static async #onConfirm() {
    const el = this.element;
    const descField = el.querySelector('[name="declaration-text"]');
    const text = descField?.value || '';

    // If no attacks were added via quick-add, fall back to text or placeholder
    if (!this._actions.length && text.trim()) {
      this._actions.push({ attackId: null, text: text.trim() });
    }
    if (!this._actions.length) {
      this._actions.push({ attackId: null, text: 'No action' });
    }

    // Compute lowest pool for the split
    const actor = this.actor;
    const sys = actor.system;
    const dex = sys.attributes?.dexterity || 0;
    const items = Array.from(actor.items);
    const wp = sys.woundPenalty || 0;

    let lowestPool = Infinity;
    const defSkills = { dodge: 'athletics', block: 'brawl', parry: 'melee' };
    for (const a of this._actions) {
      let p;
      if (a.pool) {
        p = a.pool;
      } else if (a.defense) {
        const skillVal = sys.abilities?.[defSkills[a.defense]] || 0;
        p = dex + skillVal + wp;
      } else if (!a.attackId || a.attackId === '_unarmed') {
        const brawl = sys.abilities?.brawl || 0;
        p = dex + brawl + wp;
      } else {
        const w = items.find(i => i.id === a.attackId);
        if (w) {
          const isRanged = !!w.system.range;
          const skillKey = isRanged ? 'firearms' : 'melee';
          const skillVal = sys.abilities?.[skillKey] || 0;
          p = dex + skillVal + wp;
        }
      }
      if (p !== undefined && p < lowestPool) lowestPool = p;
    }
    if (!isFinite(lowestPool)) lowestPool = 0;
    const totalPool = Math.max(lowestPool, 1);

    // Save to combatant flags
    await this.combatant.setFlag('vtm-v20', 'declaration', {
      text: text || this._actions.map(a => a.defense ? `${a.text} (Defense)` : (a.text || 'Attack')).join(', '),
      actions: this._actions,
      totalPool,
      diceAllocations: [],
      resolved: false,
    });

    // Post this combatant's declaration to chat
    const intent = text || 'No declaration';
    await ChatMessage.create({
      content: `<div class="vtm-roll"><div class="roll-info" style="padding:6px 0"><span class="roll-actor">${this.combatant.name} declares:</span></div><div class="roll-meta">${intent}</div></div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });

    game.vtm._captureAction = null;
    this.close();
    advanceDeclaration(this.combat);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    el.querySelectorAll('.decl-quick-add:not(.decl-add-defense)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.attackId;
        const atk = context.attacks.find(a => a.id === id);
        if (atk?.rate > 0) {
          const used = this._actions.filter(a => a.attackId === id).length;
          if (used >= atk.rate) {
            ui.notifications.warn(`${atk.name}: rate of fire is ${atk.rate}.`);
            return;
          }
        }
        this._actions.push({ attackId: id, text: '' });
        this.render();
      });
    });

    el.querySelectorAll('.decl-add-defense').forEach(btn => {
      btn.addEventListener('click', () => {
        const defense = btn.dataset.defense;
        const names = { dodge: 'Dodge', block: 'Block', parry: 'Parry' };
        this._actions.push({ attackId: null, text: names[defense], defense });
        this.render();
      });
    });

    // Auto-dock if the actor's sheet is already open
    if (!this._cleanupDocking && this.actor.sheet?.rendered) {
      this._setupDocking(this.actor.sheet);
    }
  }

  _setupDocking(sheetApp) {
    if (this._cleanupDocking) this._cleanupDocking();

    const sp = sheetApp.position;
    const dw = this.position.width || 480;
    const sw = sp.width || 480;
    const vw = window.innerWidth;

    // Position declaration flush to the sheet's right edge, but keep both on screen
    let sL = sp.left;
    let dL = sL + sw;
    if (dL + dw > vw) {
      dL = vw - dw;
      sL = dL - sw;
      if (sL < 0) sL = 0;
      sheetApp.setPosition({ left: sL });
    }
    this.setPosition({ left: dL, top: sp.top });

    // Intercept header drags on both windows so we move them as a unit
    const onGrab = (e) => {
      const header = e.target.closest('.window-header');
      if (!header) return;
      if (e.target.closest('button, a, [data-action]')) return;

      // Sheet was closed, tear down docking and let Foundry's normal drag take over
      if (!sheetApp.rendered) {
        if (this._cleanupDocking) this._cleanupDocking();
        return;
      }

      const isOurs = this.element.contains(header) || sheetApp.element.contains(header);
      if (!isOurs) return;

      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      const s0 = { left: sheetApp.position.left, top: sheetApp.position.top };
      const d0 = { left: this.position.left, top: this.position.top };
      const sw = sheetApp.position.width || 480;
      const dw = this.position.width || 480;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let sL = s0.left + dx, dL = d0.left + dx;
        let sT = s0.top + dy, dT = d0.top + dy;

        // Keep the pair inside the viewport
        if (sL < 0) { dL -= sL; sL = 0; }
        if (dL + dw > window.innerWidth) {
          const over = dL + dw - window.innerWidth;
          dL -= over; sL -= over;
          if (sL < 0) sL = 0;
        }
        if (sT < 0) { dT -= sT; sT = 0; }
        if (dT < 0) dT = 0;

        sheetApp.setPosition({ left: sL, top: sT });
        this.setPosition({ left: dL, top: dT });
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    };

    // Capture phase so we intercept before Foundry's own drag
    this.element.addEventListener('pointerdown', onGrab, true);
    sheetApp.element.addEventListener('pointerdown', onGrab, true);

    this._cleanupDocking = () => {
      this.element?.removeEventListener('pointerdown', onGrab, true);
      sheetApp.element?.removeEventListener('pointerdown', onGrab, true);
      this._cleanupDocking = null;
    };
  }

  async close(options) {
    if (this._cleanupDocking) this._cleanupDocking();
    game.vtm._captureAction = null;
    return super.close(options);
  }
}
