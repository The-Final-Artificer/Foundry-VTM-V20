export const HEALTH_KEYS = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];

// The track as an ordered list of box values (0 none, 1 bashing, 2 lethal, 3 agg).
// Extra bruised boxes sit between Bruised and Hurt so condition/penalty lookups
// on the named keys stay correct.
export function trackValues(sys) {
  const lv = sys.health.levels;
  const extra = sys.health.extra ?? [];
  return [lv.bruised, ...extra, lv.hurt, lv.injured, lv.wounded, lv.mauled, lv.crippled, lv.incapacitated];
}

export function trackSize(sys) {
  return HEALTH_KEYS.length + (sys.health.extra?.length ?? 0);
}

export function countDamage(sys) {
  let bash = 0, leth = 0, agg = 0;
  for (const v of trackValues(sys)) {
    if (v === 1) bash++;
    else if (v === 2) leth++;
    else if (v === 3) agg++;
  }
  return { bash, leth, agg };
}

// Refill the whole track (agg on top, then lethal, then bashing) and return the
// update payload. Pass extraCount to resize the extra boxes in the same go;
// damage that no longer fits is dropped least-severe first.
export function rebuildTrack(sys, { bash, leth, agg }, extraCount = sys.health.extra?.length ?? 0) {
  const size = HEALTH_KEYS.length + extraCount;
  const vals = new Array(size).fill(0);
  let i = 0;
  for (let n = 0; n < agg && i < size; n++) vals[i++] = 3;
  for (let n = 0; n < leth && i < size; n++) vals[i++] = 2;
  for (let n = 0; n < bash && i < size; n++) vals[i++] = 1;
  return {
    'system.health.levels': {
      bruised: vals[0],
      hurt: vals[extraCount + 1],
      injured: vals[extraCount + 2],
      wounded: vals[extraCount + 3],
      mauled: vals[extraCount + 4],
      crippled: vals[extraCount + 5],
      incapacitated: vals[extraCount + 6],
    },
    'system.health.extra': vals.slice(1, extraCount + 1),
  };
}
