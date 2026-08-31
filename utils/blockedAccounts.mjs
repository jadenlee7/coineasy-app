function cleanEntry(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned !== value || cleaned.length > 512) return null;
  return cleaned;
}

function easyGoIdFromEntry(value) {
  const entry = cleanEntry(value);
  if (!entry) return null;
  if (entry.startsWith('easygo:')) {
    return cleanEntry(entry.slice('easygo:'.length));
  }
  return entry.includes(':') ? null : entry;
}

function uniqueEntries(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const entry = cleanEntry(value);
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

/**
 * Match both current raw EasyGo user ids and historical DID-shaped entries.
 * New server blocks are persisted as raw ids; `easygo:<id>` and other DIDs are
 * read only for backwards-compatible filtering.
 */
export function isBlockedAccount(entries, { userId, did } = {}) {
  const blocked = new Set(uniqueEntries(entries));
  const normalizedUserId = cleanEntry(userId);
  const normalizedDid = cleanEntry(did);
  return Boolean(
    (normalizedUserId && (
      blocked.has(normalizedUserId)
      || blocked.has(`easygo:${normalizedUserId}`)
    ))
    || (normalizedDid && blocked.has(normalizedDid))
    || (normalizedDid && easyGoIdFromEntry(normalizedDid)
      && blocked.has(easyGoIdFromEntry(normalizedDid))),
  );
}

export function addServerBlockedAccountId(entries, userId) {
  const normalizedUserId = easyGoIdFromEntry(userId);
  if (!normalizedUserId) return uniqueEntries(entries);
  return uniqueEntries([
    ...(Array.isArray(entries) ? entries : []).filter(
      (entry) => easyGoIdFromEntry(entry) !== normalizedUserId,
    ),
    normalizedUserId,
  ]);
}

export function removeServerBlockedAccountId(entries, userId) {
  const normalizedUserId = easyGoIdFromEntry(userId);
  if (!normalizedUserId) return uniqueEntries(entries);
  return uniqueEntries(entries).filter(
    (entry) => easyGoIdFromEntry(entry) !== normalizedUserId,
  );
}

/**
 * Replace server-owned ids after a complete paginated read while retaining
 * only historical non-EasyGo DIDs that cannot safely be mapped server-side.
 */
export function reconcileServerBlockedAccountIds(entries, serverUserIds) {
  const legacyDids = uniqueEntries(entries).filter((entry) => (
    entry.includes(':') && !entry.startsWith('easygo:')
  ));
  const serverIds = uniqueEntries(serverUserIds)
    .map(easyGoIdFromEntry)
    .filter(Boolean);
  return uniqueEntries([...legacyDids, ...serverIds]);
}

export function sameBlockedAccountEntries(left, right) {
  const a = uniqueEntries(left);
  const b = uniqueEntries(right);
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}
