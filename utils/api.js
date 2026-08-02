// utils/api.js
// EasyGo backend API client (Phase 1).
// Wraps fetch with EXPO_PUBLIC_BACKEND_URL base + Privy access token (Bearer).
// See backend/src/middleware/auth.js (server-side requireAuth) and EASYGO_BUILD_PLAN.md §11.
// All endpoints return parsed JSON on 2xx, throw ApiError otherwise.

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ---------------------------------------------------------------------------
// Token provider — set once at app boot via Privy hook (see hooks/useAuthSync.js)
// ---------------------------------------------------------------------------
let _getAccessToken = null;

export function setApiTokenProvider(fn) {
  // fn: () => Promise<string | null>
  _getAccessToken = fn;
}

async function _resolveAuthHeader() {
  if (!_getAccessToken) return {};
  try {
    const token = await _getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    console.warn('[api] token provider failed');
    return {};
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------
async function request(method, path, { body, query, auth = true, signal } = {}) {
  if (!BASE_URL) {
    // In Phase 1 dev before BACKEND_URL is set, fail soft (callers should treat null as "not wired")
    console.warn('[api] EXPO_PUBLIC_BACKEND_URL not set; skipping', method, path);
    return null;
  }

  const url = new URL(path.replace(/^\//, ''), BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/');
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) Object.assign(headers, await _resolveAuthHeader());

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  let parsed = null;
  const text = await res.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!res.ok) {
    throw new ApiError(`[${method} ${path}] ${res.status}`, { status: res.status, body: parsed });
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Public helpers (1:1 with backend route surface)
// See backend/src/routes/{auth,me,orange,swap,telegram,profiles,posts,follows}.js
// ---------------------------------------------------------------------------
export const api = {
  // auth
  syncProfile: () => request('POST', '/auth/sync', {}),
  me: () => request('GET', '/auth/me'),
  siweNonce: (address) => request('POST', '/auth/siwe/nonce', { body: { address } }),
  siweVerify: ({ message, signature }) =>
    request('POST', '/auth/siwe/verify', { body: { message, signature } }),

  // privacy + consent (Path C v2 S3)
  consent: ({ signal } = {}) => request('GET', '/me/consent', { signal }),
  updateConsent: (body, { signal } = {}) => request('PUT', '/me/consent', { body, signal }),
  exportMyData: ({ signal } = {}) => request('GET', '/me/data', { signal }),
  exportMySocialData: ({ signal } = {}) => request('GET', '/me/social-export', { signal }),
  accountDeletionStatus: ({ signal } = {}) => request('GET', '/me/account-deletion', { signal }),
  requestAccountDeletion: ({ clientRequestId, walletRiskAcknowledged }) => (
    request('POST', '/me/account-deletion', {
      body: {
        confirmation: 'DELETE_MY_EASYGO_ACCOUNT',
        clientRequestId,
        walletRiskAcknowledged: walletRiskAcknowledged === true,
      },
    })
  ),

  // ENS identity (Path C v2 S4; backend flag remains off by default)
  subnameStatus: () => request('GET', '/identity/subname'),
  subnameChallenge: () => request('POST', '/identity/subname/challenge', {}),
  issueSubname: ({ message, signature }) =>
    request('POST', '/identity/issue-subname', { body: { message, signature } }),
  segments: () => request('GET', '/segments'),

  // quests (Path C v2 S6; backend flag remains off by default)
  quests: () => request('GET', '/quests'),
  startQuest: (questId, { walletSharingOptIn = false } = {}) =>
    request('POST', `/quests/${encodeURIComponent(questId)}/start`, {
      body: { walletSharingOptIn },
    }),
  completeQuest: (questId, proof) =>
    request('POST', `/quests/${encodeURIComponent(questId)}/complete`, { body: proof }),

  // staged social retirement metadata (S8; mode defaults to active)
  socialStatus: () => request('GET', '/social/status', { auth: false }),

  // orange (🍊 hype point ledger)
  orangeBalance: (_address) => request('GET', '/orange/balance'),
  orangeHistory: (_address, { limit = 50 } = {}) =>
    request('GET', '/orange/history', { query: { limit } }),
  orangeRewardStatus: () => request('GET', '/orange/rewards/status'),
  orangeClaimFirstReward: () => request('POST', '/orange/claims/first-reward'),
  orangeClaimDailyCheckin: () => request('POST', '/orange/claims/daily-checkin'),
  orangeClaimDailyActivity: () => request('POST', '/orange/claims/daily-activity'),
  orangeClaimAdReward: () => request('POST', '/orange/claims/ad-reward'),
  orangeClaimCourseQuiz: ({ courseId, sectionId }) =>
    request('POST', '/orange/claims/course-quiz', { body: { courseId, sectionId } }),

  // swap (Squid via backend proxy)
  swapQuote: (params) => request('POST', '/swap/quote', { body: params }),
  swapLog: (entry) => request('POST', '/swap/log', { body: entry }),

  // -------------------------------------------------------------------------
  // social (PR #9 backend: profiles, posts, follows, likes)
  // All endpoints return shapes documented in backend/README.md "Social (PR #9)".
  // -------------------------------------------------------------------------
  profiles: {
    // Current authenticated user's full profile (private fields + counts).
    me: () => request('GET', '/profiles/me'),
    // Update current user's editable profile fields. body: { username?, displayName?, bio?, pfp? }
    updateMe: (body) => request('PUT', '/profiles/me', { body }),
    // Public profile by userId (cuid).
    get: (userId) => request('GET', `/profiles/${encodeURIComponent(userId)}`),
    // Public profile by username (URL-safe).
    byUsername: (username) =>
      request('GET', `/profiles/by-username/${encodeURIComponent(username)}`),
    // Prefix/substring discovery across username and display name.
    search: (query, { limit = 20 } = {}) =>
      request('GET', '/profiles/search', { query: { q: query, limit } }),
  },

  posts: {
    // Reverse-chron home feed (cursor pagination).
    feed: ({ cursor, limit = 20, q, tag } = {}) =>
      request('GET', '/posts', { query: { cursor, limit, q, tag } }),
    // A user's posts timeline (cursor pagination).
    timeline: (userId, { cursor, limit = 20 } = {}) =>
      request('GET', `/posts/by-author/${encodeURIComponent(userId)}`, {
        query: { cursor, limit },
      }),
    // Single post by id.
    get: (postId) => request('GET', `/posts/${encodeURIComponent(postId)}`),
    // Replies for a post (cursor pagination).
    replies: (postId, { cursor, limit = 20 } = {}) =>
      request('GET', `/posts/${encodeURIComponent(postId)}/replies`, {
        query: { cursor, limit },
      }),
    // Create a new post (top-level or reply if parentPostId set).
    // body: { body, parentPostId?, mediaUrl? }
    create: (body) => request('POST', '/posts', { body }),
    // Edit own post body/media.
    update: (postId, body) =>
      request('PUT', `/posts/${encodeURIComponent(postId)}`, { body }),
    // Soft-delete own post.
    remove: (postId) => request('DELETE', `/posts/${encodeURIComponent(postId)}`),
    // Like / unlike a post.
    like: (postId) => request('POST', `/posts/${encodeURIComponent(postId)}/like`),
    unlike: (postId) =>
      request('DELETE', `/posts/${encodeURIComponent(postId)}/like`),
  },

  follows: {
    // Follow / unfollow a user.
    follow: (targetUserId) =>
      request('POST', `/follows/${encodeURIComponent(targetUserId)}`),
    unfollow: (targetUserId) =>
      request('DELETE', `/follows/${encodeURIComponent(targetUserId)}`),
    // Is the current viewer following targetUserId?
    status: (targetUserId) =>
      request('GET', `/follows/${encodeURIComponent(targetUserId)}/status`),
    // Followers / following lists for a user (cursor pagination).
    followers: (userId, { cursor, limit = 20 } = {}) =>
      request('GET', `/profiles/${encodeURIComponent(userId)}/followers`, {
        query: { cursor, limit },
      }),
    following: (userId, { cursor, limit = 20 } = {}) =>
      request('GET', `/profiles/${encodeURIComponent(userId)}/following`, {
        query: { cursor, limit },
      }),
  },

  notifications: {
    // Activity derived from follows, likes, and replies for the current user.
    list: ({ limit = 50 } = {}) =>
      request('GET', '/notifications', { query: { limit } }),
  },
};

export default api;
