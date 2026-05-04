// utils/orbisCompat.js
//
// Temporary scaffold to keep the legacy Coineasy screens compiling and running
// while we migrate off Orbis. Orbis (the SaaS) was discontinued, so every method
// here is a noop that returns an empty/successful response shape so existing
// `useContext(GlobalContext).orbis.<x>(...)` callsites do not crash.
//
// This file is INTENTIONALLY a dead-end: subsequent PRs will replace each
// callsite with the new social hooks (usePosts, useReplies, useSocialProfile,
// useFollow, useFeed) wired to the EasyGo backend. Once no callsites remain,
// this file (and the orbis-sdk dependency) will be deleted.
//
// See docs/MIGRATION_NOTES.md for the migration plan.

function warnOnce(method) {
  if (!warnOnce.seen) warnOnce.seen = new Set();
  if (warnOnce.seen.has(method)) return;
  warnOnce.seen.add(method);
  if (__DEV__) {
    console.warn(
      `[orbisCompat] ${method}() called — Orbis is deprecated. ` +
      `Replace this callsite with the EasyGo backend hook (see docs/MIGRATION_NOTES.md).`
    );
  }
}

// Orbis API surface used by App.js and screens/components.
// All return shapes mirror the original SDK so legacy code does not need defensive checks.
export function createOrbisCompat() {
  const empty = { data: [], error: null };
  const emptyProfile = {
    data: {
      details: {
        profile: { username: null, pfp: null, description: null, data: {} },
      },
    },
    error: null,
  };

  return {
    // ---- Auth ----
    isConnected: async () => { warnOnce("isConnected"); return { status: 0 }; },
    connect_v2: async () => { warnOnce("connect_v2"); return { status: 0 }; },
    logout: async () => { warnOnce("logout"); return { status: 200 }; },

    // ---- Profile ----
    getProfile: async () => { warnOnce("getProfile"); return emptyProfile; },
    updateProfile: async () => { warnOnce("updateProfile"); return { status: 200 }; },

    // ---- Posts / replies / contexts ----
    getPosts: async () => { warnOnce("getPosts"); return empty; },
    getPost: async () => { warnOnce("getPost"); return empty; },
    createPost: async () => { warnOnce("createPost"); return { status: 0 }; },
    editPost: async () => { warnOnce("editPost"); return { status: 0 }; },
    deletePost: async () => { warnOnce("deletePost"); return { status: 0 }; },
    react: async () => { warnOnce("react"); return { status: 0 }; },

    // ---- Follow / block / mute ----
    setFollow: async () => { warnOnce("setFollow"); return { status: 0 }; },
    getIsFollowing: async () => { warnOnce("getIsFollowing"); return { data: false, error: null }; },

    // ---- Notifications ----
    getNotifications: async () => { warnOnce("getNotifications"); return empty; },
    setNotificationsReadTime: async () => { warnOnce("setNotificationsReadTime"); return { status: 0 }; },

    // ---- Raw query API used for contexts/categories ----
    api: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => { warnOnce("api.from.select.eq.order"); return empty; },
          }),
          order: async () => { warnOnce("api.from.select.order"); return empty; },
        }),
      }),
    },
  };
}

export default createOrbisCompat;
