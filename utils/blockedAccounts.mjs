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

// Released local-only writers stored creator DIDs (including easygo:<id>).
// Raw ids were introduced for server-confirmed blocks. Keep that distinction
// in the existing array format; never silently turn a device filter into a POST.
export function localBlockedAccountEntries(entries) {
  return uniqueEntries(entries).filter((entry) => entry.includes(':'));
}

export function removeLocalBlockedAccountEntries(entries) {
  return uniqueEntries(entries).filter((entry) => !entry.includes(':'));
}

/**
 * Replace server-owned ids only after a complete, validated paginated read.
 * Preserve local DIDs absent from the server. A confirmed matching server id
 * takes over its easygo: alias so a later account-wide unblock can remove it.
 */
export function reconcileServerBlockedAccountIds(entries, serverUserIds) {
  const serverIds = uniqueEntries(serverUserIds)
    .map(easyGoIdFromEntry)
    .filter(Boolean);
  const confirmedIds = new Set(serverIds);
  const localDids = localBlockedAccountEntries(entries).filter((entry) => (
    !entry.startsWith('easygo:') || !confirmedIds.has(easyGoIdFromEntry(entry))
  ));
  return uniqueEntries([...localDids, ...serverIds]);
}

export function sameBlockedAccountEntries(left, right) {
  const a = uniqueEntries(left);
  const b = uniqueEntries(right);
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}
