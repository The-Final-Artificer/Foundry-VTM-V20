import { getActor } from './combat.mjs';
import { trackValues } from './health-track.mjs';
import {
  TENTACLE_HEALTH, removeTentacles, tentacleBlock, tentacleConstrict, tentacleEnhance,
  tentacleGrab, tentacleMaster, tentacleReach, tentacleRelease, tentaclesOf,
} from './tentacles.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const MARKS = ['', '/', 'X', '*'];
const KINDS = ['', 'bashing', 'lethal', 'aggravated'];

// The whole character sheet would be nine tenths empty for a limb of shadow
export class TentacleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ['vtm-v20', 'sheet', 'actor', 'tentacle'],
    position: { width: 340, height: 'auto' },
    window: { resizable: false },
    actions: {
      grab: TentacleSheet.#onGrab,
      constrict: TentacleSheet.#onConstrict,
      release: TentacleSheet.#onRelease,
      enhance: TentacleSheet.#onEnhance,
      dismiss: TentacleSheet.#onDismiss,
      dismissAll: TentacleSheet.#onDismissAll,
    },
  };

  static PARTS = {
    sheet: { template: 'systems/vtm-v20/templates/tentacle-sheet.hbs' },
  };

  async _prepareContext() {
    const actor = this.document;
    const master = tentacleMaster(actor);
    const hurt = trackValues(actor.system).filter(v => v > 0);
    const clinch = actor.getFlag('vtm-v20', 'clinch');
    const victim = clinch ? getActor(clinch.actorId, clinch.tokenId) : null;
    const str = actor.system.attributes.strength;
    const canAct = this.isEditable && actor.isToken;

    return {
      name: actor.token?.name || actor.name,
      img: actor.img,
      masterName: master?.name ?? null,
      str,
      dex: actor.system.attributes.dexterity,
      brawl: actor.system.abilities.brawl,
      reach: tentacleReach(actor),
      crush: str + 1,
      boxes: Array.from({ length: TENTACLE_HEALTH }, (_, i) => ({ kind: KINDS[hurt[i] || 0], mark: MARKS[hurt[i] || 0] })),
      holding: !!clinch,
      victimName: victim?.name ?? null,
      canAct,
      // Feeding an arm costs the summoner's blood, so it needs their owner
      canFeed: canAct && !!master?.isOwner,
      blocked: canAct ? tentacleBlock(actor) : null,
      onMap: actor.isToken,
    };
  }

  static #onGrab() { return tentacleGrab(this.document); }
  static #onConstrict() { return tentacleConstrict(this.document); }
  static #onRelease() { return tentacleRelease(this.document); }
  static #onEnhance(ev, target) { return tentacleEnhance(this.document, target.dataset.what); }

  static #onDismiss() {
    if (this.document.token) return removeTentacles([this.document.token]);
  }

  static #onDismissAll() {
    const master = tentacleMaster(this.document);
    const scene = this.document.token?.parent;
    if (master && scene) return removeTentacles(tentaclesOf(master, scene));
  }
}

// Whose turn it is decides what the buttons allow, and a tentacle sits out of
// the tracker, so nothing else would refresh its sheet when the turn passes
export function registerTentacleHooks() {
  Hooks.on('updateCombat', (combat, changed) => {
    if (!changed.flags?.['vtm-v20'] && !('round' in changed)) return;
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof TentacleSheet && app.rendered) app.render();
    }
  });
}
