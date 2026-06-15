export const BLINDED_STATUS_ID = 'vtm-blinded';
export const DAZED_STATUS_ID = 'vtm-dazed';
export const INCAPACITATED_STATUS_ID = 'vtm-incapacitated';
export const STRUGGLING_IMMOBILIZED_STATUS_ID = 'vtm-immobilized-struggling';
export const FULL_IMMOBILIZED_STATUS_ID = 'vtm-immobilized-full';

export function iterableValues(value) {
  if (!value) return [];
  if (typeof value[Symbol.iterator] === 'function') return value;
  if (Array.isArray(value.contents)) return value.contents;
  return [];
}

export function collectStatusIds(doc, ids = new Set()) {
  if (!doc) return ids;

  for (const id of iterableValues(doc.statuses)) ids.add(id);

  for (const effect of iterableValues(doc.effects)) {
    if (effect.disabled) continue;
    for (const id of iterableValues(effect.statuses)) ids.add(id);

    const coreStatus = effect.getFlag?.('core', 'statusId') ?? effect.flags?.core?.statusId;
    if (coreStatus) ids.add(coreStatus);

    if (effect.statusId) ids.add(effect.statusId);
  }

  return ids;
}

export function hasStatus(statusId, ...docs) {
  const ids = new Set();
  for (const doc of docs) collectStatusIds(doc, ids);
  return ids.has(statusId);
}

export function blindedDifficulty(actor, baseDifficulty) {
  const diff = Number(baseDifficulty) || 6;
  return hasStatus(BLINDED_STATUS_ID, actor) ? Math.min(diff + 2, 10) : diff;
}
