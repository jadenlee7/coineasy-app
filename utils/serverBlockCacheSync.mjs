import {
  reconcileServerBlockedAccountIds,
  sameBlockedAccountEntries,
} from './blockedAccounts.mjs';

const PAGE_LIMIT = 100;
const PAGE_MAX = 6;

export async function synchronizeServerBlockCache({
  currentEntries,
  isCurrent,
  listPage,
  saveEntries,
  pageLimit = PAGE_LIMIT,
  pageMax = PAGE_MAX,
} = {}) {
  if (typeof isCurrent !== 'function' || !isCurrent()) return false;
  if (typeof listPage !== 'function' || typeof saveEntries !== 'function') return false;

  const ids = [];
  const seenCursors = new Set();
  let cursor = null;
  for (let page = 0; page < pageMax; page += 1) {
    const result = await listPage({ cursor, limit: pageLimit });
    if (!isCurrent()) return false;
    for (const row of Array.isArray(result?.rows) ? result.rows : []) {
      if (typeof row?.id === 'string' && row.id.trim() === row.id && row.id) {
        ids.push(row.id);
      }
    }
    const nextCursor = typeof result?.nextCursor === 'string' && result.nextCursor
      ? result.nextCursor
      : null;
    if (!nextCursor) {
      const nextEntries = reconcileServerBlockedAccountIds(currentEntries, ids);
      if (sameBlockedAccountEntries(currentEntries, nextEntries)) return true;
      if (!isCurrent()) return false;
      const saved = await saveEntries(nextEntries);
      return Boolean(saved && isCurrent());
    }
    if (seenCursors.has(nextCursor)) throw new Error('server_block_cursor_repeated');
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  throw new Error('server_block_page_bound_exceeded');
}
