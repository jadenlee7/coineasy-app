import {
  reconcileServerBlockedAccountIds,
  sameBlockedAccountEntries,
} from './blockedAccounts.mjs';

const PAGE_LIMIT = 100;
const PAGE_MAX = 6;

function validServerId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !/[\s:\u0000-\u001f\u007f]/u.test(value);
}

function validatePage(result, pageLimit) {
  if (
    !result || typeof result !== 'object' || Array.isArray(result)
    || !Array.isArray(result.rows) || result.rows.length > pageLimit
    || result.rows.some((row) => (
      !row || typeof row !== 'object' || Array.isArray(row) || !validServerId(row.id)
    ))
    || (result.nextCursor !== null && !validServerId(result.nextCursor))
  ) throw new Error('server_block_page_invalid');
}

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
    validatePage(result, pageLimit);
    ids.push(...result.rows.map((row) => row.id));
    const nextCursor = result.nextCursor;
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
