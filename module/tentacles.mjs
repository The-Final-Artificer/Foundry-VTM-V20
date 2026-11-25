// Arms of the Abyss (Obtenebration 3). Each success on the roll raises one
// tentacle. They stand on the map as unlinked tokens of a single actor per
// summoner, so they can be targeted, hurt and grappled like anything else,
// and the grab itself is the ordinary Clinch.
import { rollDicePool } from './dice.mjs';
import { clinchInflictDamage, combatantFor, getActor, portraitStyle, releaseClinch, rollAttack } from './combat.mjs';
import { confirmAndSpend, whisperActivation } from './item-sheet.mjs';
import { disciplineLevel } from './discipline-effects.mjs';
import { countDamage } from './health-track.mjs';

const IMG = 'systems/vtm-v20/VTM icons/arm-of-the-abyss.webp';
const FOLDER = 'Arms of the Abyss';
export const TENTACLE_HEALTH = 4;
export const TENTACLE_REACH = 6;

const GRAB = {
  id: 'tentacle-grab', name: 'Grab',
  skill: 'abilities.brawl', poolTraits: ['attributes.strength', 'abilities.brawl'],
  isRanged: false, damageFormula: 'Str+1', damageType: 'lethal',
  clinch: true,
};

// Grid steps around the summoner where new arms come up
const SPOTS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];

const firstGm = () => game.users.filter(u => u.active && u.isGM)[0] ?? null;

export function isTentacle(actor) {
  return !!actor?.getFlag?.('vtm-v20', 'tentacle');
}

// The vampire who called this arm up, if they are still around
export function tentacleMaster(actor) {
  const t = actor?.getFlag?.('vtm-v20', 'tentacle');
  return t ? (getActor(t.masterId, t.masterToken) ?? null) : null;
}

export function tentacleReach(actor) {
  return actor.getFlag('vtm-v20', 'tentacleFeet') || TENTACLE_REACH;
}

// Every arm this vampire has standing on a scene
export function tentaclesOf(master, scene = canvas.scene) {
  if (!master || !scene) return [];
  const tokId = master.isToken ? master.token.id : null;
  return scene.tokens.filter(t => {
    const f = t.actor?.getFlag('vtm-v20', 'tentacle');
    return f && f.masterId === master.id && (f.masterToken ?? null) === tokId;
  });
}

// Strength and Dexterity come from Obtenebration, with Potence and Celerity
// dots stacked on as plain dots. Brawl is borrowed for the grab.
function armStats(master) {
  const obt = disciplineLevel(master, 'obtenebration');
  return {
    strength: Math.min(obt + disciplineLevel(master, 'potence'), 10),
    dexterity: Math.min(obt + disciplineLevel(master, 'celerity'), 10),
    brawl: Math.min(master.system.abilities?.brawl || 0, 10),
  };
}

// The power's roll button lands here instead of the plain roll
export async function rollArmsOfTheAbyss(actor, item, power) {
  const token = actor.isToken ? actor.token?.object : actor.getActiveTokens()[0];
  if (!token) {
    ui.notifications.warn('Put your token on the scene first: the tentacles rise around it.');
    return;
  }

  const standing = tentaclesOf(actor);
  if (standing.length) {
    const choice = await new Promise(resolve => {
      new Dialog({
        title: power.name,
        content: `<p style="margin:8px 0;color:#ddd;">${standing.length} tentacle${standing.length > 1 ? 's are' : ' is'} already standing.</p>`,
        buttons: {
          more: { icon: '<i class="fas fa-plus"></i>', label: 'Summon more', callback: () => resolve('more') },
          dismiss: { icon: '<i class="fas fa-times"></i>', label: 'Dismiss all', callback: () => resolve('dismiss') },
        },
        default: 'more',
        close: () => resolve(null),
      }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
    });
    if (!choice) return;
    if (choice === 'dismiss') return removeTentacles(standing);
  }

  const ok = await confirmAndSpend(actor, power.cost, power.name);
  if (!ok) return;
  await whisperActivation(actor, `${item.name}: ${power.name}`, null, power.cost, false);

  const result = await rollDicePool(actor, {
    trait: power.primary, trait2: power.secondary,
    label: `${item.name}: ${power.name}`,
    difficulty: power.difficulty || 7,
  });
  if (!result || result.total < 1) return;

  const stats = armStats(actor);
  const n = result.total;
  const data = {
    action: 'tentacleSummon', sceneId: canvas.scene.id,
    masterId: actor.id, masterToken: token.id, linked: !actor.isToken, count: n,
  };
  if (game.user.isGM) await summonLocal(data);
  else if (!firstGm()) return ui.notifications.warn('No GM online: the tentacles could not be placed.');
  else game.socket.emit('system.vtm-v20', data);

  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: actor.img, actorName: actor.name,
    portraitStyle: portraitStyle(actor),
    label: power.name, noDice: true,
    hitLabel: `${n} tentacle${n > 1 ? 's rise' : ' rises'} from the dark: Strength ${stats.strength}, Dexterity ${stats.dexterity}, ${TENTACLE_HEALTH} health levels, constrict for ${stats.strength + 1} dice of lethal.`,
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
}

// One actor per summoner holds the stats; the arms on the map are its
// unlinked tokens, each with its own wounds and upgrades
async function baseActorFor(master, masterToken) {
  const stats = armStats(master);
  const system = {
    attributes: { strength: stats.strength, dexterity: stats.dexterity },
    abilities: { brawl: stats.brawl },
  };
  const ownership = foundry.utils.deepClone(master.ownership);
  const base = game.actors.find(a => {
    const t = a.getFlag('vtm-v20', 'tentacle');
    return t && t.masterId === master.id && (t.masterToken ?? null) === masterToken;
  });
  if (base) {
    await base.update({ system, ownership });
    return base;
  }

  const folder = game.folders.find(f => f.type === 'Actor' && f.name === FOLDER)
    ?? await Folder.create({ name: FOLDER, type: 'Actor' });
  return Actor.create({
    name: `Arm of the Abyss (${master.name})`,
    type: 'mortal', img: IMG, folder: folder.id, ownership, system,
    flags: {
      'vtm-v20': { tentacle: { masterId: master.id, masterToken } },
      core: { sheetClass: 'vtm-v20.TentacleSheet' },
    },
    prototypeToken: {
      name: 'Arm of the Abyss', actorLink: false,
      texture: { src: IMG }, width: 1, height: 1,
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
    },
  });
}

// Runs on the GM's client: players may not create actors or tokens
async function summonLocal({ sceneId, masterId, masterToken, linked, count }) {
  const scene = game.scenes.get(sceneId);
  const tokDoc = scene?.tokens.get(masterToken);
  const master = linked ? game.actors.get(masterId) : tokDoc?.actor;
  if (!scene || !tokDoc || !master) return;

  const base = await baseActorFor(master, linked ? null : masterToken);
  const size = scene.grid.size;
  const standing = tentaclesOf(master, scene);
  // Numbered so two arms can be told apart on the map
  let num = Math.max(0, ...standing.map(t => Number(/(\d+)$/.exec(t.name)?.[1]) || 0));
  const docs = [];
  for (let i = 0; i < Math.min(count, 20); i++) {
    const [dx, dy] = SPOTS[(standing.length + i) % SPOTS.length];
    // The GM may be looking at another scene, so the parent is spelled out
    const td = await base.getTokenDocument({
      name: `Arm of the Abyss ${++num}`,
      x: tokDoc.x + dx * size, y: tokDoc.y + dy * size,
      elevation: tokDoc.elevation, disposition: tokDoc.disposition,
    }, { parent: scene });
    docs.push(td.toObject());
  }
  await scene.createEmbeddedDocuments('Token', docs);
}

async function removeLocal({ sceneId, tokenIds }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;
  const ids = [];
  for (const id of tokenIds || []) {
    const td = scene.tokens.get(id);
    if (!td || !isTentacle(td.actor)) continue;
    // Whoever it was holding goes free with it
    if (td.actor.getFlag('vtm-v20', 'clinch')) await releaseClinch(td.actor);
    ids.push(id);
  }
  if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids);
}

export async function removeTentacles(tokenDocs) {
  const list = tokenDocs.filter(Boolean);
  if (!list.length) return;
  const data = { action: 'tentacleRemove', sceneId: list[0].parent.id, tokenIds: list.map(t => t.id) };
  if (game.user.isGM) return removeLocal(data);
  if (!firstGm()) return ui.notifications.warn('No GM online to remove the tentacles.');
  game.socket.emit('system.vtm-v20', data);
}

export function bindTentacleSocketHandlers() {
  game.socket.on('system.vtm-v20', async data => {
    if (!data || !['tentacleSummon', 'tentacleRemove'].includes(data.action)) return;
    if (game.user.id !== firstGm()?.id) return;
    if (data.action === 'tentacleSummon') await summonLocal(data);
    else await removeLocal(data);
  });
}

// The health track has seven boxes like everyone's; an arm comes apart at four
export async function checkTentacleDestroyed(actor) {
  const { bash, leth, agg } = countDamage(actor.system);
  if (bash + leth + agg < TENTACLE_HEALTH || !actor.token) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="vtm-roll"><div class="roll-result"><span class="result-fail">${actor.name} is torn apart and dissolves.</span></div></div>`,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
  await removeTentacles([actor.token]);
}

// In a fight the arms move on their summoner's turn, each once a round.
// Returns why not, or null when the arm may act. Upgrades and letting go
// only need the turn, not the arm's action.
export function tentacleBlock(actor, { action = true } = {}) {
  const combat = game.combat;
  const master = tentacleMaster(actor);
  const mc = combat?.started && master ? combatantFor(combat, master) : null;
  if (!mc) return null;
  const myTurn = combat.getFlag('vtm-v20', 'phase') === 'resolution'
    && (combat.getFlag('vtm-v20', 'currentResolver') === mc.id
      || combat.getFlag('vtm-v20', 'deferredResolver')?.combatantId === mc.id);
  if (!myTurn) return `Tentacles act on ${master.name}'s turn`;
  if (action && actor.getFlag('vtm-v20', 'tentacleActed') === combat.round) return 'This tentacle has already acted this round';
  return null;
}

async function markActed(actor) {
  if (game.combat?.started) await actor.setFlag('vtm-v20', 'tentacleActed', game.combat.round);
}

export async function tentacleGrab(actor) {
  const why = tentacleBlock(actor);
  if (why) return ui.notifications.warn(`${why}.`);
  if (actor.getFlag('vtm-v20', 'clinch')) return ui.notifications.warn('This tentacle is already holding someone.');
  if (!game.user.targets.size) return ui.notifications.warn('Target a token first.');
  const done = await rollAttack(actor, GRAB);
  if (done !== false) await markActed(actor);
}

export async function tentacleConstrict(actor) {
  const why = tentacleBlock(actor);
  if (why) return ui.notifications.warn(`${why}.`);
  if (!actor.getFlag('vtm-v20', 'clinch')) return ui.notifications.warn('This tentacle is not holding anyone.');
  await clinchInflictDamage(actor);
  await markActed(actor);
}

export async function tentacleRelease(actor) {
  await releaseClinch(actor);
}

// One blood point from the summoner: a dot of Strength or Dexterity for this
// arm, or another six feet of reach
export async function tentacleEnhance(actor, what) {
  const master = tentacleMaster(actor);
  if (!master?.isOwner) return ui.notifications.warn('Only the summoner can feed a tentacle.');
  const why = tentacleBlock(actor, { action: false });
  if (why) return ui.notifications.warn(`${why}.`);

  const blood = master.system.blood?.value || 0;
  if (blood < 1) return ui.notifications.warn('No blood to spend.');
  const sheet = master.sheet;
  const inFight = !!(sheet?._resCombat || sheet?._declCombat);
  if (inFight && sheet._bloodBudgetLeft?.() <= 0) return ui.notifications.warn('No blood budget left this turn.');

  if (what === 'length') {
    await actor.setFlag('vtm-v20', 'tentacleFeet', tentacleReach(actor) + TENTACLE_REACH);
  } else {
    const cur = actor.system.attributes[what] || 0;
    if (cur >= 10) return ui.notifications.warn('Cannot exceed 10.');
    await actor.update({ [`system.attributes.${what}`]: cur + 1 });
  }
  await master.update({ 'system.blood.value': blood - 1 });
  if (inFight) sheet._resBloodSpent++;
}
