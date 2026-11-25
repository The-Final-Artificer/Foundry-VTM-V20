// True Faith (V20 p. 372). The merit brings a discipline-shaped entry with it,
// so the rating has dots and every level its own text and button. Levels 1
// and 5 are the ones with something to roll.
import { TRUE_FAITH } from './true-faith-data.mjs';
import { rollDicePool, showDice } from './dice.mjs';
import { evalPool, getActor, portraitStyle } from './combat.mjs';
import { effectiveTraitValue, faithLevel } from './discipline-effects.mjs';
import { soakAndApply } from './elder-powers.mjs';
import { getOverrides } from './authentic-store.mjs';

const isFaithMerit = item => item?.type === 'merit' && (item.name || '').trim().toLowerCase() === 'true faith';
const faithEntry = actor => actor?.items.find(i => i.type === 'discipline' && i.name.toLowerCase() === 'true faith');

// What an entry should say: the book's own words where the Authentic Text
// Manager holds them, the shipped text otherwise. The slots are keyed by
// rating, since the book gives the five ratings no names.
function faithData() {
  const data = foundry.utils.deepClone(TRUE_FAITH);
  const ov = getOverrides();
  const slot = `discipline:${data.name}`;
  if (ov[`${slot}:intro`]) data.system.description = ov[`${slot}:intro`];
  for (const key of Object.keys(data.system.powers)) {
    const text = ov[`${slot}:power:${key}`];
    if (text) data.system.powers[key].desc = text;
  }
  return data;
}

async function ensureEntry(actor) {
  if (!actor?.items.some(isFaithMerit) || faithEntry(actor)) return;
  await actor.createEmbeddedDocuments('Item', [faithData()]);
}

// Saved HTML can come back with small differences, so texts are compared by
// their words alone
const words = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// An entry made before the book text was pasted still carries the shipped
// wording. Text someone has edited by hand is left alone.
async function refreshText(actor) {
  const entry = faithEntry(actor);
  if (!entry) return;
  const want = faithData().system;
  const shipped = TRUE_FAITH.system;
  const changes = {};
  if (words(entry.system.description) === words(shipped.description) && words(want.description) !== words(shipped.description)) {
    changes['system.description'] = want.description;
  }
  for (const [key, p] of Object.entries(shipped.powers)) {
    if (words(entry.system.powers?.[key]?.desc) === words(p.desc) && words(want.powers[key].desc) !== words(p.desc)) {
      changes[`system.powers.${key}.desc`] = want.powers[key].desc;
    }
  }
  if (Object.keys(changes).length) await entry.update(changes);
}

export function registerTrueFaith() {
  // Only the client that made the change follows up, or every open client
  // would add its own copy
  Hooks.on('createItem', (item, options, userId) => {
    if (userId === game.user.id && isFaithMerit(item) && item.parent instanceof Actor) ensureEntry(item.parent);
  });
  Hooks.on('createActor', (actor, options, userId) => {
    if (userId === game.user.id) ensureEntry(actor);
  });
  Hooks.on('deleteItem', (item, options, userId) => {
    if (userId !== game.user.id || !isFaithMerit(item) || !(item.parent instanceof Actor)) return;
    if (!item.parent.items.some(isFaithMerit)) faithEntry(item.parent)?.delete();
  });
  // Book text applied in the Authentic Text Manager reaches existing entries
  // right away, not only on the next load
  const onText = setting => { if (setting?.key === 'vtm-v20.authenticTextRev') syncTrueFaith(); };
  Hooks.on('createSetting', onText);
  Hooks.on('updateSetting', onText);
}

// Characters who took the merit before it did anything get their entry now,
// and entries still on the shipped wording pick up pasted book text
export async function syncTrueFaith() {
  // One GM does the writing, or two online would each add an entry
  if (game.users.activeGM?.id !== game.user.id) return;
  for (const actor of game.actors) {
    await ensureEntry(actor);
    await refreshText(actor);
  }
}

function dormant(actor) {
  const why = (actor.system?.humanity ?? 0) < 9
    ? 'True Faith is silent below Humanity 9.'
    : 'This character has no True Faith.';
  ui.notifications.warn(why);
}

const vampiresTargeted = () => Array.from(game.user.targets).filter(t => t.actor?.type === 'vampire');

async function postCard(actor, data, flags = null) {
  const html = await renderTemplate('systems/vtm-v20/templates/combat-card.hbs', {
    actorImg: actor.img, actorName: actor.name,
    portraitStyle: portraitStyle(actor),
    ...data,
  });
  const msg = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  };
  if (flags) msg.flags = { 'vtm-v20': { combat: flags } };
  await ChatMessage.create(msg);
}

// Level 1: hold a vampire off with a brandished symbol or a prayer. Faith is
// rolled against its current Willpower; pressed to its body, the symbol burns.
export async function rollWard(actor, item, power) {
  const faith = faithLevel(actor);
  if (!faith) return dormant(actor);
  const tokens = vampiresTargeted();
  if (!tokens.length) return ui.notifications.warn('Target the vampire you are warding off.');

  const press = await new Promise(resolve => {
    new Dialog({
      title: item.name,
      content: '<p style="margin:8px 0;color:#ddd;">Hold the symbol up, or press it against the vampire?</p>',
      buttons: {
        ward: { icon: '<i class="fas fa-hand-paper"></i>', label: 'Brandish', callback: () => resolve(false) },
        press: { icon: '<i class="fas fa-fire"></i>', label: 'Press against it', callback: () => resolve(true) },
      },
      default: 'ward',
      close: () => resolve(null),
    }, { classes: ['vtm-v20', 'dialog'], width: 360 }).render(true);
  });
  if (press === null) return;
  if (press && tokens.length > 1) return ui.notifications.warn('The symbol can only be pressed against one vampire at a time.');

  const roll = new Roll(`${faith}d10`);
  await roll.evaluate();
  await showDice(roll, actor);

  // One prayer, weighed against each vampire's own will
  for (const token of tokens) {
    const victim = token.actor;
    const wp = victim.system.willpower?.value ?? 0;
    const difficulty = Math.min(Math.max(wp, 2), 10);
    const res = evalPool(roll, difficulty);
    const n = res.total;

    let line;
    if (res.outcome === 'botch') line = `${victim.name} may advance unhindered.`;
    else if (n < 1) line = `${victim.name} cannot advance.`;
    else if (press) line = `The symbol sears ${victim.name}'s flesh: ${n} aggravated.`;
    else line = `${victim.name} is forced back ${n} step${n > 1 ? 's' : ''}.`;

    await postCard(actor, {
      targetImg: victim.img, targetPortraitStyle: portraitStyle(victim),
      label: `${item.name} vs ${victim.name}`,
      sublabel: `Faith ${faith} vs Willpower ${wp}`,
      pool: faith, difficulty,
      dice: res.dice, total: n, outcome: res.outcome,
      hitLabel: line,
    });
    if (press && n > 0) {
      await soakAndApply(actor, victim, token, n, 'aggravated', item.name, `${n} success${n > 1 ? 'es' : ''}, 1 aggravated each`);
    }
  }
}

// Level 5: every vampire in earshot must flee unless it fights the urge
// down, turn after turn. Each one answers on its own card.
export async function rollHolyPresence(actor, item, power) {
  const faith = faithLevel(actor);
  if (faith < 5) return faith ? ui.notifications.warn('This takes True Faith 5.') : dormant(actor);
  const tokens = vampiresTargeted();
  if (!tokens.length) return ui.notifications.warn('Target the vampires who can hear you.');

  for (const token of tokens) {
    const victim = token.actor;
    const difficulty = Math.min(5 + effectiveTraitValue(victim, 'attributes.intelligence'), 10);
    await postCard(actor, {
      targetImg: victim.img, targetPortraitStyle: portraitStyle(victim),
      label: item.name, noDice: true,
      hitLabel: `${victim.name} hears ${actor.name} pray and must flee, unless they fight it down this turn.`,
      resistBtns: [
        // taunt-resist-btn only lends its look; the phase flag keeps the two apart
        { cls: 'taunt-resist-btn faith-wp-btn', icon: 'fa-bolt', label: 'Spend 1 Willpower' },
        { cls: 'taunt-resist-btn faith-sta-btn', icon: 'fa-dice-d20', label: `Roll Stamina (diff ${difficulty})` },
      ],
    }, {
      phase: 'faith-resist',
      defenderId: victim.id, defenderTokenId: token.id,
      difficulty, resolved: false,
    });
  }
}

// The two answers on a level 5 card, bound from the chat render hook
export function bindFaithButtons(msg, html) {
  const c = msg.flags?.['vtm-v20']?.combat;
  if (!c || c.phase !== 'faith-resist') return;

  const el = html instanceof HTMLElement ? html : (html[0] || html);
  const btns = [...(el?.querySelectorAll('.faith-wp-btn, .faith-sta-btn') ?? [])];
  if (!btns.length) return;

  const victim = getActor(c.defenderId, c.defenderTokenId);
  if (c.resolved || !victim || (!victim.isOwner && !game.user.isGM)) {
    btns.forEach(b => b.remove());
    return;
  }

  const settle = async () => {
    if (msg.isAuthor || game.user.isGM) await msg.update({ 'flags.vtm-v20.combat.resolved': true });
    else game.socket.emit('system.vtm-v20', { action: 'resolveMsg', msgId: msg.id });
  };
  const stands = () => postCard(victim, {
    label: 'True Faith', noDice: true,
    defendedLabel: `${victim.name} masters the urge to flee, for this turn.`,
  });

  el.querySelector('.faith-wp-btn')?.addEventListener('click', async () => {
    const wp = victim.system.willpower?.value || 0;
    if (wp < 1) return ui.notifications.warn('No Willpower left to spend.');
    btns.forEach(b => { b.disabled = true; });
    await victim.update({ 'system.willpower.value': wp - 1 });
    await settle();
    await stands();
  });

  el.querySelector('.faith-sta-btn')?.addEventListener('click', async () => {
    btns.forEach(b => { b.disabled = true; });
    const result = await rollDicePool(victim, {
      trait: 'attributes.stamina',
      label: 'Stand Before the Faithful',
      difficulty: c.difficulty || 6,
      open: true,
    });
    if (!result) { btns.forEach(b => { b.disabled = false; }); return; }
    await settle();
    if (result.outcome === 'success') return stands();
    await postCard(victim, {
      label: 'True Faith', noDice: true,
      hitLabel: `${victim.name} flees. With nowhere to run, they collapse, helpless.`,
    });
  });
}
