const DEVICE_ACCOUNT_DATA_KEYS = Object.freeze([
  'easygo_recent_profile_searches',
  'list_blocked_user',
  'list_muted_users',
  'list_hidden_post',
  'easygo_expo_push_token',
]);

export function accountDeletionLocalDataKeys(courseProgressOwner) {
  const owner = typeof courseProgressOwner === 'string'
    ? courseProgressOwner.trim()
    : '';
  const keys = [...DEVICE_ACCOUNT_DATA_KEYS];
  if (owner) keys.unshift(`easygo_course_progress:${owner}`);
  return keys;
}

export async function purgeAccountDeletionLocalData({
  courseProgressOwner,
  removeMany,
} = {}) {
  if (typeof removeMany !== 'function') {
    throw new Error('account_deletion_local_purge_unavailable');
  }
  const keys = accountDeletionLocalDataKeys(courseProgressOwner);
  await removeMany(keys);
  return keys;
}
