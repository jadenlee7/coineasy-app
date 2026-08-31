import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrdered(source, markers, label) {
  let offset = 0;
  for (const marker of markers) {
    const next = source.indexOf(marker, offset);
    assert.notEqual(next, -1, `${label}: missing or out-of-order marker: ${marker}`);
    offset = next + marker.length;
  }
}

test('follow-list reads commit only for the captured owner, target, and request generation', () => {
  const source = read('../screens/Navigation/Follow/FollowNavigation.js');
  const load = section(source, 'const loadFollowLists = useCallback', '    useEffect(() => {');
  const effect = section(source, '    useEffect(() => {', '    const handleFollowChange');

  assert.match(source, /useDeviceAccountOperationLease/);
  assert.match(source, /const requestGenerationRef = useRef\(0\);/);
  assert.match(source, /const \[presentedTarget, setPresentedTarget\] = useState\(null\);/);
  assert.match(source, /liveOwnUserIdRef\.current = ownUserId;/);
  assert.match(source, /liveTargetUserIdRef\.current = targetUserId;/);
  assertOrdered(load, [
    'const operationLease = lease;',
    'const operationOwnUserId = ownUserId;',
    'const operationTargetUserId = targetUserId;',
    'const requestGeneration = ++requestGenerationRef.current;',
    'isCurrentLease(operationLease)',
    'requestGeneration === requestGenerationRef.current',
    'liveOwnUserIdRef.current === operationOwnUserId',
    'liveTargetUserIdRef.current === operationTargetUserId',
    'api.follows.followers(operationTargetUserId',
    'api.follows.following(operationTargetUserId',
    'if (!isCurrentRequest()) return;',
    'setFollowers(nextFollowers);',
  ], 'follow-list success');
  assert.match(load, /catch \(cause\) \{\s*if \(!isCurrentRequest\(\)\) return;\s*setError/);
  assert.match(load, /finally \{\s*if \(isCurrentRequest\(\)\) \{\s*setLoading\(false\);\s*setRefreshing\(false\);/);
  assert.match(effect, /return \(\) => \{\s*requestGenerationRef\.current \+= 1;/);
  assert.match(source, /const presentsCurrentTarget = sameFollowListTarget\([\s\S]*?presentedTarget,[\s\S]*?lease,[\s\S]*?ownUserId,[\s\S]*?targetUserId,/);
  assert.match(source, /if \(!presentsCurrentTarget \|\| loading\) \{/);
  assertOrdered(load, [
    'if (!operationLease || !isCurrentLease(operationLease)) return;',
    'presentedTargetRef.current = nextTarget;',
    'setPresentedTarget(nextTarget);',
    'setFollowers([]);',
    'setFollowing([]);',
  ], 'follow-list target presentation reset');
  assert.match(source, /const tabTargetKey = JSON\.stringify\(\[/);
  assert.match(source, /const tabIndex = tabSelection\.targetKey === tabTargetKey[\s\S]*?Math\.min\(tabSelection\.index, routes\.length - 1\)[\s\S]*?: initialIndex;/);
  assert.match(source, /setTabSelection\(\{\s*targetKey: tabTargetKey,[\s\S]*?Math\.min\(index, routes\.length - 1\)/);
});

test('single-post reads cannot publish an older post id or refresh generation', () => {
  const source = read('../screens/Navigation/PostDetails.js');
  const load = section(source, 'const loadPost = useCallback', '  useEffect(() => {');
  const effect = section(source, '  useEffect(() => {\n    loadPost();', '  const refreshAll');

  assert.match(source, /const requestGenerationRef = useRef\(0\);/);
  assert.match(source, /livePostIdRef\.current = postId;/);
  assertOrdered(load, [
    'const expectedLease = lease;',
    'const expectedPostId = postId;',
    'const requestGeneration = ++requestGenerationRef.current;',
    'isCurrentLease(expectedLease)',
    'requestGeneration === requestGenerationRef.current',
    'livePostIdRef.current === expectedPostId',
    'api.posts.get(expectedPostId',
    'if (!isCurrentRequest()) return null;',
    'setPost(next);',
  ], 'post read success');
  assert.match(load, /catch \(cause\) \{\s*if \(!isCurrentRequest\(\)\) return null;\s*setPostError/);
  assert.match(load, /finally \{\s*if \(isCurrentRequest\(\)\) setPostLoading\(false\);/);
  assert.match(effect, /return \(\) => \{\s*requestGenerationRef\.current \+= 1;/);
  assert.match(source, /const currentPost = postTargetId === postId \? post : null;/);
  assert.match(source, /const currentPostLoading = postTargetId === postId[\s\S]*?Boolean\(BACKEND_CONFIGURED && postId\);/);
  assert.match(source, /if \(!currentPost\) return;[\s\S]*?setReplyTo\(currentPost\);/);
  assert.doesNotMatch(source, /setReplyTo\(post\);/);
});

test('post menus compare EasyGo author ids instead of Privy identity subjects', () => {
  const source = read('../components/Post.js');

  assert.match(source, /const currentEasyGoUserId = getEasyGoUserId\(user\);/);
  assert.match(source, /const postAuthorUserId = post\?\.easygo\?\.authorId/);
  assert.match(source, /const isCurrentUserPost = currentEasyGoUserId/);
  assert.match(source, /\{isCurrentUserPost \?/);
  assert.doesNotMatch(source, /user\?\.did == post\.creator/);
});

test('follow mutations and status reads use a target-session queue with execution-time guards', () => {
  const source = read('../hooks/useFollow.js');
  const queue = section(source, 'const isCurrentQueue = useCallback', '  const follow = useCallback');
  const follow = section(source, 'const follow = useCallback', '  const unfollow = useCallback');
  const unfollow = section(source, 'const unfollow = useCallback', '  const refresh = useCallback');
  const refresh = section(source, 'const refresh = useCallback', '  useEffect(() => {');

  assert.match(source, /const liveTargetUserIdRef = useRef\(targetUserId\);/);
  assert.match(source, /const operationQueueRef = useRef\(null\);/);
  assert.match(source, /liveTargetUserIdRef\.current = targetUserId;/);
  assert.match(source, /operationQueueRef\.current\?\.lease !== lease/);
  assert.match(source, /operationQueueRef\.current\?\.targetUserId !== targetUserId/);
  assertOrdered(queue, [
    'operationQueueRef.current === queue',
    'isCurrentLease(queue.lease)',
    'liveTargetUserIdRef.current === queue.targetUserId',
    'const enqueueOperation = useCallback',
    'queue.lease !== operationLease',
    'queue.targetUserId !== operationTargetUserId',
    'queue.pending += 1;',
    'const run = () => {',
    'if (!isCurrentQueue(queue)) return null;',
    'const requestId = ++requestIdRef.current;',
    'requestId === requestIdRef.current',
    'const result = queue.tail.then(run, run);',
    'if (isCurrentQueue(queue) && queue.pending === 0) setLoading(false);',
    'queue.tail = settled.then(() => undefined, () => undefined);',
  ], 'follow operation queue');

  for (const [label, operation, apiCall] of [
    ['follow', follow, 'api.follows.follow(operationTargetUserId'],
    ['unfollow', unfollow, 'api.follows.unfollow(operationTargetUserId'],
    ['status', refresh, 'api.follows.status(operationTargetUserId'],
  ]) {
    assertOrdered(operation, [
      'const operationLease = lease;',
      'const operationTargetUserId = targetUserId;',
      'isCurrentLease(operationLease)',
      'enqueueOperation(operationLease, operationTargetUserId',
      apiCall,
      'if (!isCurrentRequest()) return null;',
    ], `${label} request`);
    assert.match(operation, /catch \(cause\) \{[\s\S]*?isCurrentRequest\(\)/, `${label} catch guard`);
    assert.doesNotMatch(operation, /const requestId = \+\+requestIdRef\.current;/);
  }
});

test('cancelled follow mutations do not surface as failure alerts', () => {
  const hook = read('../hooks/useFollow.js');
  const user = read('../components/User.js');
  const profile = read('../components/ProfileDetails.js');

  assert.ok((hook.match(/if \(!isCurrentRequest\(\)\) return null;/g) || []).length >= 4);
  for (const consumer of [user, profile]) {
    assert.match(consumer, /if \(succeeded == null\) return;\s*if \(!succeeded\) \{\s*Alert\.alert/);
  }
});

test('public profile presentation is bound to the current route target before effects run', () => {
  const source = read('../hooks/useSocialProfile.js');

  assert.match(source, /const liveUserIdRef = useRef\(userId\);/);
  assert.match(source, /liveUserIdRef\.current = userId;/);
  assert.match(source, /const targetUserId = userId;/);
  assert.match(source, /myReq === reqIdRef\.current[\s\S]*?liveUserIdRef\.current === targetUserId/);
  assert.match(source, /setState\(\{ targetUserId, profile: null, loading: true, error: null \}\);/);
  assert.match(source, /const ownsTarget = state\.targetUserId === userId;/);
  assert.match(source, /profile: ownsTarget \? state\.profile : null,/);
  assert.match(source, /loading: ownsTarget \? state\.loading : Boolean\(userId\),/);
});

test('post collections hide stale filters synchronously and reject pre-effect completions', () => {
  const source = read('../hooks/usePosts.js');

  assert.match(source, /liveTargetRef\.current = createPostsTarget\(lease,/);
  assert.match(source, /const operationTarget = createPostsTarget\(operationLease,/);
  assert.match(source, /const isCurrentTarget = \(\) => samePostsTarget\(liveTargetRef\.current, operationTarget\);/);
  assert.match(source, /if \(!isCurrentTarget\(\)\) return \[\];/);
  assert.match(source, /const ownsPresentedTarget = samePostsTarget\([\s\S]*?presentedTarget,[\s\S]*?liveTargetRef\.current,/);
  assert.match(source, /posts: ownsPresentedTarget \? posts : \[\],/);
  assert.match(source, /loading: ownsPresentedTarget[\s\S]*?Boolean\(autoLoad && BACKEND_CONFIGURED && lease\),/);
  assert.match(source, /!samePostsTarget\(liveTargetRef\.current, subscriptionTarget\)/);
});

test('people search results are query-owned before the search effect runs', () => {
  const source = read('../screens/Search.js');

  assert.match(source, /livePeopleQueryRef\.current = trimmedQuery;/);
  assert.match(source, /const targetQuery = trimmedQuery;/);
  assert.match(source, /livePeopleQueryRef\.current === targetQuery/);
  assert.match(source, /setPeopleTargetQuery\(targetQuery\);/);
  assert.match(source, /const presentsPeopleQuery = peopleTargetQuery === trimmedQuery;/);
  assert.match(source, /const visiblePeople = presentsPeopleQuery[\s\S]*?people\.filter\(\(details\) => !isBlockedAccount\(listBlockedUser,/);
  assert.match(source, /isBlockedAccount\(listBlockedUser, \{ userId, did: details\?\.did \}\)[\s\S]*?return;/);
  assert.match(source, /visiblePeople\.map\(\(details\) => renderUser\(details\)\)/);
  assert.match(source, /const currentViewerFollowingTargetKey = JSON\.stringify\(\[/);
  assert.match(source, /liveViewerFollowingTargetRef\.current = currentViewerFollowingTargetKey;/);
  assert.match(source, /requestId === viewerFollowingRequestRef\.current[\s\S]*?isCurrentLease\(operationLease\)/);
  assert.match(source, /const visibleViewerFollowingIds = viewerFollowingTargetKey === currentViewerFollowingTargetKey/);
  assert.match(source, /initialFollowing=\{visibleViewerFollowingIds\.has\(userId\)\}/);
});

test('reply collections are bound to the current post before effects run', () => {
  const source = read('../hooks/useReplies.js');

  assert.match(source, /liveTargetRef\.current = createRepliesTarget\(lease, \{ autoLoad, limit, postId \}\);/);
  assert.match(source, /const operationTarget = createRepliesTarget\(operationLease, \{ autoLoad, limit, postId \}\);/);
  assert.match(source, /if \(!isCurrentTarget\(\)\) return \[\];/);
  assert.match(source, /!sameRepliesTarget\(liveTargetRef\.current, subscriptionTarget\)/);
  assert.match(source, /const ownsPresentedTarget = sameRepliesTarget\([\s\S]*?presentedTarget,[\s\S]*?liveTargetRef\.current,/);
  assert.match(source, /replies: ownsPresentedTarget \? replies : \[\],/);
  assert.match(source, /loading: ownsPresentedTarget[\s\S]*?Boolean\(autoLoad && BACKEND_CONFIGURED && postId && lease\),/);
});
