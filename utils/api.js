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
  } catch (e) {
    console.warn('[api] token provider failed', e);
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
// See backend/src/routes/{auth,orange,swap,telegram}.js
// ---------------------------------------------------------------------------
export const api = {
  // auth
  syncProfile: () => request('POST', '/auth/sync', {}),
  me: () => request('GET', '/auth/me'),

  // orange (🍊 hype point ledger)
  orangeBalance: (address) => request('GET', `/orange/balance/${address}`),
  orangeHistory: (address, { limit = 50 } = {}) =>
    request('GET', `/orange/history/${address}`, { query: { limit } }),

  // swap (Squid via backend proxy)
  swapQuote: (params) => request('POST', '/swap/quote', { body: params }),
  swapLog: (entry) => request('POST', '/swap/log', { body: entry }),
};

export default api;
