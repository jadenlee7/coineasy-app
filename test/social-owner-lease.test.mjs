import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function callsFor(source, callPrefix) {
  const calls = [];
  let offset = 0;

  while (offset < source.length) {
    const start = source.indexOf(callPrefix, offset);
    if (start === -1) break;

    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      if (source[end] === '(') depth += 1;
      if (source[end] === ')') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    calls.push(source.slice(start, end));
    offset = end;
  }

  return calls;
}

function assertOwnerBoundCalls(source, expectedCalls) {
  for (const [callPrefix, expectedCount] of Object.entries(expectedCalls)) {
    const calls = callsFor(source, callPrefix);
    assert.equal(calls.length, expectedCount, `${callPrefix} call count`);
    for (const call of calls) {
      assert.match(
        call,
        /expectedAuthUserId:\s*operationLease\.ownerUserId/,
        `${callPrefix} must bind the captured operation owner`,
      );
    }
  }
}

test('social hooks capture an owner lease and bind every owner-sensitive API call', () => {
  const posts = read('../hooks/usePosts.js');
  const replies = read('../hooks/useReplies.js');
  const follow = read('../hooks/useFollow.js');
  const notifications = read('../hooks/useNotifications.js');

  for (const source of [posts, replies, follow, notifications]) {
    assert.match(source, /useDeviceAccountOperationLease/);
    assert.match(source, /const \{ lease, isCurrentLease \} = useDeviceAccountOperationLease\(\)/);
    assert.match(source, /const operationLease = lease;/);
    assert.match(source, /!operationLease \|\| !isCurrentLease\(operationLease\)/);
  }

  assertOwnerBoundCalls(posts, {
    'api.posts.feed(': 1,
    'api.posts.timeline(': 1,
    'api.posts.create(': 1,
    'api.posts.update(': 1,
    'api.posts.remove(': 1,
  });
  assertOwnerBoundCalls(replies, {
    'api.posts.replies(': 2,
    'api.posts.create(': 1,
    'api.posts.remove(': 1,
  });
  assertOwnerBoundCalls(follow, {
    'api.follows.follow(': 1,
    'api.follows.unfollow(': 1,
    'api.follows.status(': 1,
  });
  assertOwnerBoundCalls(notifications, {
    'api.notifications.list(': 1,
  });
});

test('social hooks suppress stale completions and cross-session post events', () => {
  const posts = read('../hooks/usePosts.js');
  const replies = read('../hooks/useReplies.js');
  const follow = read('../hooks/useFollow.js');
  const notifications = read('../hooks/useNotifications.js');

  assert.ok(count(posts, /await /g) >= 5);
  assert.ok(count(posts, /isCurrentLease\(operationLease\)/g) >= 16);
  assert.ok(count(replies, /await /g) >= 4);
  assert.ok(count(replies, /isCurrentLease\(operationLease\)/g) >= 13);
  assert.ok(count(follow, /await /g) >= 3);
  assert.ok(count(follow, /isCurrentLease\(operationLease\)/g) >= 3);
  assert.ok(count(follow, /isCurrentQueue\(queue\)/g) >= 4);
  assert.ok(count(follow, /isCurrentRequest\(\)/g) >= 8);
  assert.ok(count(notifications, /await /g) >= 1);
  assert.ok(count(notifications, /isCurrentLease\(operationLease\)/g) >= 4);

  for (const source of [posts, replies]) {
    assert.match(source, /const subscriptionLease = lease;/);
    assert.match(source, /subscribeSocialPostEvents\(\(event\) => \{[\s\S]*?!isCurrentLease\(subscriptionLease\)[\s\S]*?\) return;/);
  }

  for (const source of [posts, replies]) {
    const publications = count(source, /publishSocialPostEvent\(/g);
    assert.ok(publications > 0);
    assert.match(source, /await api\.posts\.(?:create|remove|update)[\s\S]*?if \(!isCurrentLease\(operationLease\)\) return/);
  }
});

test('like mutations bind and retain the lease captured at tap time', () => {
  const post = read('../components/Post.js');
  const likeCta = post.slice(
    post.indexOf('export const LikeCTA'),
    post.indexOf('export const RepostCTA'),
  );

  assert.match(likeCta, /const \{ lease, isCurrentLease \} = useDeviceAccountOperationLease\(\)/);
  assert.match(likeCta, /const operationLease = lease;/);
  assertOwnerBoundCalls(likeCta, {
    'api.posts.like(': 1,
    'api.posts.unlike(': 1,
  });
  assert.match(
    likeCta,
    /await api\.posts\.like[\s\S]*?: await api\.posts\.unlike[\s\S]*?if \(!isCurrentLease\(operationLease\)\) return;/,
  );
  assert.match(likeCta, /finally \{\s*if \(isCurrentLease\(operationLease\)\) setLikeLoading\(false\);/);
});

test('a refresh releases stale pagination latches without accepting late rows', () => {
  const posts = read('../hooks/usePosts.js');
  const replies = read('../hooks/useReplies.js');

  for (const source of [posts, replies]) {
    assert.match(
      source,
      /loadingMoreRef\.current = false;\s*setLoadingMore\(false\);\s*const requestId = \+\+requestIdRef\.current;/,
    );
    assert.match(source, /\|\| refreshingRef\.current\s*\|\| loadingMoreRef\.current/);
    assert.match(
      source,
      /if \(!isCurrentLease\(operationLease\) \|\| requestId !== requestIdRef\.current\) return \[\];/,
    );
  }
});
