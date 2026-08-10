import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../components/modals/PostSettingsModal.js', import.meta.url),
  'utf8',
);

function section(start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrdered(contents, markers, label) {
  let offset = 0;
  for (const marker of markers) {
    const next = contents.indexOf(marker, offset);
    assert.notEqual(next, -1, `${label}: missing or out-of-order marker: ${marker}`);
    offset = next + marker.length;
  }
}

function loadPresentationRegistry() {
  const start = source.indexOf('let nextPostSettingsOpenGeneration = 0;');
  const end = source.indexOf('export default function PostSettingsModal');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const registrySource = source.slice(start, end);
  return new Function(
    `${registrySource}\nreturn { beginPostSettingsPresentation, isCurrentPostSettingsPresentation, invalidatePostSettingsPresentation };`,
  )();
}

test('opening Y invalidates X even when Y represents the same post in a new sheet presentation', () => {
  const registry = loadPresentationRegistry();
  const post = {
    easygo: { postId: 'post-1' },
    creator_details: { did: 'did:creator-1' },
  };
  const x = registry.beginPostSettingsPresentation({ value: post, callbackDelete() {} });
  assert.equal(registry.isCurrentPostSettingsPresentation(x), true);

  const y = registry.beginPostSettingsPresentation({ value: post, callbackDelete() {} });
  assert.equal(y.postId, x.postId);
  assert.equal(y.creatorDid, x.creatorDid);
  assert.ok(y.openGeneration > x.openGeneration);
  assert.equal(registry.isCurrentPostSettingsPresentation(x), false);
  assert.equal(registry.isCurrentPostSettingsPresentation(y), true);

  registry.invalidatePostSettingsPresentation(x);
  assert.equal(registry.isCurrentPostSettingsPresentation(y), true);
  registry.invalidatePostSettingsPresentation(y);
  assert.equal(registry.isCurrentPostSettingsPresentation(y), false);
});

test('self-post ownership prefers EasyGo ids and retains a legacy DID fallback', () => {
  const ownership = section(
    'function isPostOwnedByUser',
    'export default function PostSettingsModal',
  );

  assert.match(source, /import \{ getEasyGoUserId \} from "\.\.\/\.\.\/utils\/socialPostAdapter";/);
  assertOrdered(ownership, [
    'const ownUserId = getEasyGoUserId(user);',
    'const authorUserId = post?.easygo?.authorId',
    '|| getEasyGoUserId(post?.creator_details)',
    '|| getEasyGoUserId(post?.creator);',
    'if (ownUserId && authorUserId) return ownUserId === authorUserId;',
    'const ownDid = user?.did || null;',
    'const creatorDid = post?.creator_details?.did || post?.creator || null;',
  ], 'post ownership');
  assert.match(source, /const ownsSelectedPost = isPostOwnedByUser\(user, editedPost\?\.value\);/);
  assert.match(source, /editedPost\?\.type == 'notCreator' && !ownsSelectedPost/);
  assert.doesNotMatch(source, /user\?\.did !== editedPost\?\.value\?\.creator_details\?\.did/);

  const getEasyGoUserId = (value) => {
    if (!value) return null;
    if (typeof value === 'object') {
      return value.easygo?.authorId
        || value.profile?.data?.easygoUserId
        || value.id
        || getEasyGoUserId(value.did);
    }
    return typeof value === 'string' && value.startsWith('easygo:')
      ? value.slice('easygo:'.length)
      : null;
  };
  const isPostOwnedByUser = new Function(
    'getEasyGoUserId',
    `${ownership}\nreturn isPostOwnedByUser;`,
  )(getEasyGoUserId);
  assert.equal(isPostOwnedByUser(
    { id: 'db-user-1', did: 'did:privy:user-1' },
    { easygo: { authorId: 'db-user-1' }, creator: 'easygo:db-user-1' },
  ), true);
  assert.equal(isPostOwnedByUser(
    { profile: { data: { easygoUserId: 'db-user-1' } }, did: 'did:privy:user-1' },
    { creator_details: { did: 'easygo:db-user-1' } },
  ), true);
  assert.equal(isPostOwnedByUser(
    { did: 'did:pkh:eip155:1:0xabc' },
    { creator_details: { did: 'did:pkh:eip155:1:0xabc' } },
  ), true);
  assert.equal(isPostOwnedByUser(
    { id: 'db-user-1' },
    { easygo: { authorId: 'db-user-2' } },
  ), false);
});

test('post settings presentation identity includes target and a process-wide open generation', () => {
  const target = section(
    'function createPostSettingsTarget',
    'function beginPostSettingsPresentation',
  );
  const begin = section(
    'function beginPostSettingsPresentation',
    'function isCurrentPostSettingsPresentation',
  );
  const current = section(
    'function isCurrentPostSettingsPresentation',
    'function invalidatePostSettingsPresentation',
  );

  assert.match(source, /let nextPostSettingsOpenGeneration = 0;/);
  assert.match(source, /let activePostSettingsPresentation = null;/);
  assert.match(target, /postId: post\?\.easygo\?\.postId \|\| post\?\.stream_id \|\| null/);
  assert.match(target, /creatorDid: post\?\.creator_details\?\.did \|\| post\?\.creator \|\| null/);
  assertOrdered(begin, [
    'const target = createPostSettingsTarget(source);',
    'postId: target.postId,',
    'creatorDid: target.creatorDid,',
    'openGeneration: ++nextPostSettingsOpenGeneration,',
    'activePostSettingsPresentation = presentation;',
  ], 'begin presentation');
  assertOrdered(current, [
    'activePostSettingsPresentation === candidate',
    'activePostSettingsPresentation.postId === candidate.postId',
    'activePostSettingsPresentation.creatorDid === candidate.creatorDid',
    'activePostSettingsPresentation.openGeneration === candidate.openGeneration',
  ], 'current presentation');
  assert.match(source, /presentationSourceRef\.current !== editedPost[\s\S]*?beginPostSettingsPresentation\(editedPost\)/);
  assert.match(source, /return \(\) => invalidatePostSettingsPresentation\(livePresentationRef\.current\);/);
});

test('operation capture combines the live account lease with immutable post presentation identity', () => {
  const currentOperation = section(
    'const isCurrentOperation =',
    '    const captureOperation =',
  );
  const capture = section(
    'const captureOperation =',
    '    const resetPresentationState =',
  );

  assertOrdered(currentOperation, [
    'isCurrentLease(operation.expectedLease)',
    'isCurrentPostSettingsPresentation(operation.expectedPresentation)',
    'operation.expectedPostId === operation.expectedPresentation.postId',
    'operation.expectedCreatorDid === operation.expectedPresentation.creatorDid',
    'operation.expectedOpenGeneration === operation.expectedPresentation.openGeneration',
  ], 'operation freshness');
  assertOrdered(capture, [
    'const expectedLease = lease;',
    'const expectedPresentation = livePresentationRef.current;',
    '!isCurrentLease(expectedLease)',
    '!isCurrentPostSettingsPresentation(expectedPresentation)',
    'return Object.freeze({',
    'expectedPostId: expectedPresentation.postId,',
    'expectedCreatorDid: expectedPresentation.creatorDid,',
    'expectedOpenGeneration: expectedPresentation.openGeneration,',
    'source: expectedPresentation.source,',
  ], 'operation capture');
});

test('a new target resets every visible subview, selection, loader, and in-flight animation', () => {
  const reset = section(
    'const resetPresentationState =',
    '    useEffect(() => {',
  );

  for (const animation of [1, 2, 3, 4, 5]) {
    assert.match(reset, new RegExp(`moveAnimation${animation}\\.stopAnimation\\(\\);`));
  }
  assertOrdered(reset, [
    'moveAnimation1.setValue(0);',
    'moveAnimation2.setValue(windowSize.width);',
    'setLoading(false);',
    'setSuccess(false);',
    'setChecked(undefined);',
    'setShowBlockBack(false);',
    'setShowHideBack(false);',
    'setShowMuteBack(false);',
    'setShowReportBack(false);',
    'setLoader(false);',
  ], 'presentation reset');
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*resetPresentationState\(\);\s*\}, \[openGeneration\]\);/);
});

test('dismiss clears only the captured menu object and cannot close a newer presentation', () => {
  const hide = section('function hide(operation)', '    async function editPost()');

  assertOrdered(hide, [
    'if (!isCurrentOperation(operation)) return false;',
    'invalidatePostSettingsPresentation(operation.expectedPresentation);',
    'setEditedPost((current) => (current === operation.source ? null : current));',
    'resetPresentationState();',
    'modalPostSettingsRef.current?.close()',
  ], 'guarded dismiss');
  assert.doesNotMatch(hide, /setEditedPost\(null\)/);
});

test('delete mutation completes for X but all callback, timer, reset, and close effects require X presentation', () => {
  const deletion = section('async function deletePost()', '    const doAnimation =');

  assertOrdered(deletion, [
    'const operation = captureOperation();',
    'const removed = await removePost(postId);',
    'if (removed && isCurrentLease(operation.expectedLease)) {',
    'operation.source?.callbackDelete?.();',
    'if (!isCurrentOperation(operation)) return;',
    'setSuccess(true);',
    'await sleep(1500);',
    'if (!isCurrentOperation(operation)) return;',
    'hide(operation);',
  ], 'delete post');
});

test('block, hide, and mute preserve the X mutation while suppressing stale Y UI effects', () => {
  for (const [label, start, end, mutation] of [
    ['block', 'const blockUser = async', '    const hidePost = async', 'await saveBlockedAccounts(temp_list);'],
    ['hide', 'const hidePost = async', '    const MuteUser = async', 'await saveHiddenPosts(temp_list);'],
    ['mute', 'const MuteUser = async', '    /** We hide the repost modal', 'await saveMutedAccounts(temp_list);'],
  ]) {
    const operation = section(start, end);
    assertOrdered(operation, [
      'const operation = captureOperation();',
      mutation,
      'if (!isCurrentOperation(operation)) return;',
      'showMessage({',
      'hide(operation)',
    ], `${label} operation`);
    assert.match(operation, /catch \{\s*if \(isCurrentOperation\(operation\)\) \{\s*setLoader\(false\);\s*Alert\.alert/);
  }
});

test('report timer and animation callbacks cannot mutate a replacement menu', () => {
  const animation = section('const doAnimation =', '    const showBlock =');
  const report = section('function sendReport', '    const onHidePress =');

  assertOrdered(animation, [
    'const expectedPresentation = livePresentationRef.current;',
    'if (!isCurrentPostSettingsPresentation(expectedPresentation)) return;',
    'Animated.parallel([',
    'if (!isCurrentPostSettingsPresentation(expectedPresentation)) return;',
    'return_function?.();',
  ], 'animation callback');
  assertOrdered(report, [
    'const operation = captureOperation();',
    'setTimeout(() => {',
    'if (!isCurrentOperation(operation)) return;',
    'setLoading(false);',
    'showMessage({',
    'hide(operation);',
  ], 'report timer');
});
