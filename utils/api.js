// utils/api.js
// EasyGo backend API client (Phase 1).
// Wraps fetch with EXPO_PUBLIC_BACKEND_URL. Private/viewer-relative calls use
// an owner-bound Privy access token; explicitly public calls remain anonymous.
// See backend/src/middleware/auth.js (server-side requireAuth) and EASYGO_BUILD_PLAN.md §11.
// All endpoints return parsed JSON on 2xx, throw ApiError otherwise.

import { createApiAuthRegistry } from './apiAuth.mjs';

export { ApiAuthBindingError } from './apiAuth.mjs';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ---------------------------------------------------------------------------
// Token provider — set once at app boot via Privy hook (see hooks/useAuthSync.js)
// ---------------------------------------------------------------------------
const apiAuth = createApiAuthRegistry({
  onOptionalProviderError: () => console.warn('[api] token provider failed'),
});

export function setApiTokenProvider(fn, ownerUserId) {
  // The active app bridge always supplies ownerUserId. An ownerless provider is
  // retained only for compatibility with optional-auth registry consumers;
  // bound EasyGo endpoints reject it before fetch.
  apiAuth.setTokenProvider(fn, ownerUserId);
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
async function request(
  method,
  path,
  { body, query, auth = false, signal, boundAuth = false, expectedAuthUserId } = {},
) {
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
  if (boundAuth || auth) {
    Object.assign(
      headers,
      boundAuth
        ? await apiAuth.resolveBoundAuthHeader(expectedAuthUserId)
        : await apiAuth.resolveOptionalAuthHeader(),
    );
  }

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
  syncProfile: ({ signal, expectedAuthUserId } = {}) => request('POST', '/auth/sync', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),
  me: ({ signal, expectedAuthUserId } = {}) => request('GET', '/auth/me', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),
  siweNonce: (address, { signal, expectedAuthUserId } = {}) => (
    request('POST', '/auth/siwe/nonce', {
      body: { address },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  siweVerify: ({ message, signature, signal, expectedAuthUserId }) =>
    request('POST', '/auth/siwe/verify', {
      body: { message, signature },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),

  // privacy + consent (Path C v2 S3)
  consent: ({ signal, expectedAuthUserId } = {}) => request('GET', '/me/consent', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),
  updateConsent: (body, { signal, expectedAuthUserId } = {}) => (
    request('PUT', '/me/consent', {
      body,
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  exportMyData: ({ signal, expectedAuthUserId } = {}) => request('GET', '/me/data', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),
  exportMySocialData: ({ signal, expectedAuthUserId } = {}) => (
    request('GET', '/me/social-export', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  registerPushToken: ({ token, platform, signal, expectedAuthUserId }) => (
    request('PUT', '/me/push-token', {
      body: { token, platform },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  unregisterPushToken: ({ token, signal, expectedAuthUserId }) => (
    request('DELETE', '/me/push-token', {
      body: { token },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  accountDeletionStatus: ({ signal, expectedAuthUserId } = {}) => (
    request('GET', '/me/account-deletion', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  accountDeletionReauthChallenge: ({
    clientRequestId,
    expectedAuthUserId,
    signal,
  }) => (
    request('POST', '/me/account-deletion/reauth/challenge', {
      body: {
        clientRequestId,
        expectedPrivyDid: expectedAuthUserId,
      },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  accountDeletionReauthVerify: ({
    challengeId,
    clientRequestId,
    expectedAuthUserId,
    identityToken,
    nonce,
    signal,
    state,
  }) => (
    request('POST', '/me/account-deletion/reauth/verify', {
      body: {
        challengeId,
        clientRequestId,
        expectedPrivyDid: expectedAuthUserId,
        identityToken,
        nonce,
        state,
      },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  requestAccountDeletion: ({
    challengeId,
    clientRequestId,
    reauthProof,
    walletRiskAcknowledged,
    expectedAuthUserId,
    signal,
  }) => (
    request('POST', '/me/account-deletion', {
      body: {
        confirmation: 'DELETE_MY_EASYGO_ACCOUNT',
        challengeId,
        clientRequestId,
        expectedPrivyDid: expectedAuthUserId,
        reauthProof,
        walletRiskAcknowledged: walletRiskAcknowledged === true,
      },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),

  // ENS identity (Path C v2 S4; backend flag remains off by default)
  subnameStatus: ({ signal, expectedAuthUserId } = {}) => (
    request('GET', '/identity/subname', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  subnameChallenge: ({ signal, expectedAuthUserId } = {}) => (
    request('POST', '/identity/subname/challenge', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  issueSubname: ({ message, signature, signal, expectedAuthUserId }) =>
    request('POST', '/identity/issue-subname', {
      body: { message, signature },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),
  segments: ({ signal, expectedAuthUserId } = {}) => request('GET', '/segments', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),

  // quests (Path C v2 S6; backend flag remains off by default)
  quests: ({ signal, expectedAuthUserId } = {}) => request('GET', '/quests', {
    signal,
    boundAuth: true,
    expectedAuthUserId,
  }),
  startQuest: (questId, {
    walletSharingOptIn = false,
    signal,
    expectedAuthUserId,
  } = {}) =>
    request('POST', `/quests/${encodeURIComponent(questId)}/start`, {
      body: { walletSharingOptIn },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),
  completeQuest: (questId, proof, { signal, expectedAuthUserId } = {}) =>
    request('POST', `/quests/${encodeURIComponent(questId)}/complete`, {
      body: proof,
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),

  // staged social retirement metadata (S8; mode defaults to active)
  socialStatus: () => request('GET', '/social/status', { auth: false }),

  // orange (🍊 hype point ledger)
  orangeBalance: (_address, { signal, expectedAuthUserId } = {}) => (
    request('GET', '/orange/balance', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  orangeHistory: (_address, { limit = 50, signal, expectedAuthUserId } = {}) =>
    request('GET', '/orange/history', {
      query: { limit },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),
  orangeRewardStatus: ({ signal, expectedAuthUserId } = {}) => (
    request('GET', '/orange/rewards/status', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  orangeClaimFirstReward: ({ signal, expectedAuthUserId } = {}) => (
    request('POST', '/orange/claims/first-reward', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  orangeClaimDailyCheckin: ({ signal, expectedAuthUserId } = {}) => (
    request('POST', '/orange/claims/daily-checkin', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    })
  ),
  orangeClaimCourseQuiz: ({ courseId, sectionId, signal, expectedAuthUserId }) =>
    request('POST', '/orange/claims/course-quiz', {
      body: { courseId, sectionId },
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),
  // -------------------------------------------------------------------------
  // social (PR #9 backend: profiles, posts, follows, likes)
  // All endpoints return shapes documented in backend/README.md "Social (PR #9)".
  // -------------------------------------------------------------------------
  profiles: {
    // Current authenticated user's full profile (private fields + counts).
    me: ({ signal, expectedAuthUserId } = {}) => request('GET', '/profiles/me', {
      signal,
      boundAuth: true,
      expectedAuthUserId,
    }),
    // Update current user's editable profile fields. body: { username?, displayName?, bio?, pfp? }
    updateMe: (body, { signal, expectedAuthUserId } = {}) => (
      request('PUT', '/profiles/me', {
        body,
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    // Server routes retain an anonymous projection, but the signed-in EasyGo
    // app binds viewer-relative reads so account block rules are enforced.
    get: (userId, { signal, expectedAuthUserId } = {}) => (
      request('GET', `/profiles/${encodeURIComponent(userId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    byUsername: (username, { signal, expectedAuthUserId } = {}) =>
      request('GET', `/profiles/by-username/${encodeURIComponent(username)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Prefix/substring discovery across username and display name.
    search: (query, { limit = 20, signal, expectedAuthUserId } = {}) =>
      request('GET', '/profiles/search', {
        query: { q: query, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
  },

  posts: {
    // Reverse-chron home feed (cursor pagination).
    feed: ({ cursor, limit = 20, q, tag, signal, expectedAuthUserId } = {}) =>
      request('GET', '/posts', {
        query: { cursor, limit, q, tag },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // A user's posts timeline (cursor pagination).
    timeline: (userId, {
      cursor,
      limit = 20,
      signal,
      expectedAuthUserId,
    } = {}) =>
      request('GET', `/posts/by-author/${encodeURIComponent(userId)}`, {
        query: { cursor, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Single post by id.
    get: (postId, { signal, expectedAuthUserId } = {}) => (
      request('GET', `/posts/${encodeURIComponent(postId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    // Replies for a post (cursor pagination).
    replies: (postId, {
      cursor,
      limit = 20,
      signal,
      expectedAuthUserId,
    } = {}) =>
      request('GET', `/posts/${encodeURIComponent(postId)}/replies`, {
        query: { cursor, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Create a new post (top-level or reply if parentPostId set).
    // body: { body, parentPostId?, mediaUrl? }
    create: (body, { signal, expectedAuthUserId } = {}) => (
      request('POST', '/posts', {
        body,
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    // Edit own post body/media.
    update: (postId, body, { signal, expectedAuthUserId } = {}) =>
      request('PUT', `/posts/${encodeURIComponent(postId)}`, {
        body,
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Soft-delete own post.
    remove: (postId, { signal, expectedAuthUserId } = {}) => (
      request('DELETE', `/posts/${encodeURIComponent(postId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    // Report another user's post. The backend persists one report per
    // reporter/post pair and returns no reporter, count, or moderation data.
    report: (postId, reason, { signal, expectedAuthUserId } = {}) => (
      request('POST', `/posts/${encodeURIComponent(postId)}/report`, {
        body: { reason },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    // Like / unlike a post.
    like: (postId, { signal, expectedAuthUserId } = {}) => (
      request('POST', `/posts/${encodeURIComponent(postId)}/like`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    unlike: (postId, { signal, expectedAuthUserId } = {}) =>
      request('DELETE', `/posts/${encodeURIComponent(postId)}/like`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
  },

  follows: {
    // Follow / unfollow a user.
    follow: (targetUserId, { signal, expectedAuthUserId } = {}) =>
      request('POST', `/follows/${encodeURIComponent(targetUserId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    unfollow: (targetUserId, { signal, expectedAuthUserId } = {}) =>
      request('DELETE', `/follows/${encodeURIComponent(targetUserId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Is the current viewer following targetUserId?
    status: (targetUserId, { signal, expectedAuthUserId } = {}) =>
      request('GET', `/follows/${encodeURIComponent(targetUserId)}/status`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    // Followers / following lists for a user (cursor pagination).
    followers: (userId, {
      cursor,
      limit = 20,
      signal,
      expectedAuthUserId,
    } = {}) =>
      request('GET', `/profiles/${encodeURIComponent(userId)}/followers`, {
        query: { cursor, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
    following: (userId, {
      cursor,
      limit = 20,
      signal,
      expectedAuthUserId,
    } = {}) =>
      request('GET', `/profiles/${encodeURIComponent(userId)}/following`, {
        query: { cursor, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
  },

  blocks: {
    list: ({ cursor, limit = 50, signal, expectedAuthUserId } = {}) => (
      request('GET', '/blocks', {
        query: { cursor, limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    block: (targetUserId, { signal, expectedAuthUserId } = {}) => (
      request('POST', `/blocks/${encodeURIComponent(targetUserId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
    unblock: (targetUserId, { signal, expectedAuthUserId } = {}) => (
      request('DELETE', `/blocks/${encodeURIComponent(targetUserId)}`, {
        signal,
        boundAuth: true,
        expectedAuthUserId,
      })
    ),
  },

  notifications: {
    // Activity derived from follows, likes, and replies for the current user.
    list: ({ limit = 50, signal, expectedAuthUserId } = {}) =>
      request('GET', '/notifications', {
        query: { limit },
        signal,
        boundAuth: true,
        expectedAuthUserId,
      }),
  },
};

export default api;
