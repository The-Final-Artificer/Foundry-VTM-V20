// Shipped summaries for the clan weakness popup on the sheet header. The
// Authentic Text Manager can replace any of them with the book's own wording.

export const CLAN_WEAKNESSES = {
  "Assamite": "The Tremere blood-curse lingers: drinking another Kindred's vitae inflicts one unsoakable level of lethal damage per blood point, and attempted diablerie brings automatic aggravated damage with none of the usual benefits.",
  "Brujah": "Rolls to resist or guide frenzy are at +2 difficulty, and a Brujah may never spend Willpower to avoid frenzy, only to end one already raging.",
  "Followers of Set": "Children of the serpent fear the sun: sunlight deals two additional health levels of damage to them.",
  "Gangrel": "Every frenzy leaves a lasting animal feature behind; each five such marks permanently lower one Social Attribute by a dot.",
  "Giovanni": "Their Kiss brings agony instead of bliss: a Giovanni's bite deals double damage to mortal vessels.",
  "Lasombra": "They cast no reflection: mirrors, photographs and recordings all refuse to show them.",
  "Malkavian": "Each Malkavian carries an incurable derangement from the Embrace; Willpower can quiet it for a scene, never remove it.",
  "Nosferatu": "The Embrace twists them horribly: Appearance is always zero, can never rise, and Social rolls that depend on looks fail outright.",
  "Ravnos": "Every Ravnos nurses a signature vice; offered the chance to indulge it, they must roll Self-Control (difficulty 6) or give in.",
  "Toreador": "Faced with genuine beauty, they must roll Self-Control (difficulty 6) or stand entranced while the moment lasts.",
  "Tremere": "The clan's blood binds with frightening ease: two draughts of another vampire's vitae form a full blood bond, the first counting as two.",
  "Tzimisce": "They must rest amid at least two handfuls of earth from a place that mattered in life; each day without it halves their dice pools, down to a single die.",
  "Ventrue": "Exacting tastes rule them: each Ventrue can feed only from a particular kind of mortal and gains nothing from any other blood.",
  "Caitiff": "Clanless and scorned: Social rolls against Kindred who know what they are suffer +2 difficulty, and Caitiff may not take Status at character creation.",
  "Pander": "Panders share the Caitiff's lot: +2 difficulty on Social rolls with Kindred who despise the clanless, and no Status at character creation.",
};

export function clanWeaknessInfo(name) {
  const raw = CLAN_WEAKNESSES[name];
  return raw ? { body: raw } : null;
}

// GM-made clan items extend the built-in list
export function worldClans() {
  return game.items?.filter(i => i.type === 'clan') ?? [];
}

export function clanItemInfo(name) {
  if (!name) return null;
  const w = worldClans().find(i => i.name === name)?.system?.weakness?.trim();
  return w ? { body: w } : null;
}

export function clanDisciplinesFor(name, fallbackMap) {
  const item = worldClans().find(i => i.name === name);
  if (item?.system?.disciplines?.length) return item.system.disciplines;
  return fallbackMap?.[name] || [];
}

export function clanOptions(baseList) {
  const names = [...baseList];
  for (const c of worldClans()) if (!names.includes(c.name)) names.push(c.name);
  return names;
}
