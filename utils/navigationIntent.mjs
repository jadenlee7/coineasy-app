const EASYGO_ROUTE_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAX_EASYGO_ROUTE_ID_LENGTH = 128;

export const EASYGO_NAVIGATION_INTENT = Object.freeze({
  post: 'post',
  profile: 'profile',
});

export function normalizeEasyGoRouteId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > MAX_EASYGO_ROUTE_ID_LENGTH
    || !EASYGO_ROUTE_ID_PATTERN.test(normalized)
  ) return null;
  return normalized;
}

export function easyGoUserIdFromDid(value) {
  if (typeof value !== 'string' || !value.startsWith('easygo:')) return null;
  return normalizeEasyGoRouteId(value.slice('easygo:'.length));
}

export function navigationIntentFromParsedUrl({ path, queryParams } = {}) {
  const normalizedPath = typeof path === 'string'
    ? path.replace(/^\/+|\/+$/gu, '').toLowerCase()
    : '';
  if (!['profile', 'user'].includes(normalizedPath)) return null;

  const userId = normalizeEasyGoRouteId(queryParams?.userId)
    || easyGoUserIdFromDid(queryParams?.did);
  return userId
    ? Object.freeze({ type: EASYGO_NAVIGATION_INTENT.profile, userId })
    : null;
}

export function navigationIntentFromNotificationData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!['mention', 'reaction', 'reply'].includes(data.type)) return null;

  const postId = normalizeEasyGoRouteId(
    data.type === 'reply' ? (data.master || data.post_id) : data.post_id,
  );
  return postId
    ? Object.freeze({ type: EASYGO_NAVIGATION_INTENT.post, postId })
    : null;
}

export function routeForEasyGoNavigationIntent(intent) {
  if (intent?.type === EASYGO_NAVIGATION_INTENT.profile) {
    const userId = normalizeEasyGoRouteId(intent.userId);
    return userId
      ? Object.freeze({ name: 'ProfileSelected', params: Object.freeze({ userId }) })
      : null;
  }
  if (intent?.type === EASYGO_NAVIGATION_INTENT.post) {
    const postId = normalizeEasyGoRouteId(intent.postId);
    return postId
      ? Object.freeze({ name: 'PostDetails', params: Object.freeze({ postId }) })
      : null;
  }
  return null;
}
