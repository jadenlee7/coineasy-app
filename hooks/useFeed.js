// hooks/useFeed.js
//
// Screen-facing feed wrapper. Home, author, category, search, and news screens
// share the same EasyGo post state while supplying their own filter options.
// See docs/MIGRATION_NOTES.md.

import usePosts from "./usePosts";

export function useFeed(feedKey = "home", options = {}) {
  const normalizedOptions =
    feedKey && typeof feedKey === "object" ? feedKey : options;
  const postState = usePosts(normalizedOptions);

  return {
    ...postState,
    items: postState.posts,
    feedKey: typeof feedKey === "string" ? feedKey : "home",
  };
}

export default useFeed;
