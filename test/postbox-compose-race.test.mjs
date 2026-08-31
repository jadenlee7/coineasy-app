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

let helperSequence = 0;
async function loadComposeHelpers() {
  const source = read('../components/Postbox.js');
  const helpers = section(
    source,
    'function postboxReplyParentId',
    'export default function Postbox',
  );
  const encoded = Buffer.from(helpers).toString('base64');
  return import(`data:text/javascript;base64,${encoded}#${helperSequence++}`);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('compose identity includes mode, edit id, reply parent, and every open generation', async () => {
  const {
    createPostboxComposeTarget,
    postboxComposeTargetKey,
    samePostboxComposeTarget,
  } = await loadComposeHelpers();
  const editedPost = {
    value: {
      stream_id: 'post-x',
      content: { body: 'draft x', media: [], mentions: [] },
    },
  };
  const editX = createPostboxComposeTarget({ editedPost, openGeneration: 7 });
  const editXCopy = createPostboxComposeTarget({ editedPost, openGeneration: 7 });
  const editXReopened = createPostboxComposeTarget({ editedPost, openGeneration: 8 });
  const postY = createPostboxComposeTarget({ openGeneration: 8 });
  const replyY = createPostboxComposeTarget({
    openGeneration: 8,
    replyTo: { stream_id: 'parent-y' },
  });
  const replyZ = createPostboxComposeTarget({
    openGeneration: 8,
    replyTo: { stream_id: 'parent-z' },
  });

  assert.deepEqual(editX, {
    mode: 'edit',
    editedPostId: 'post-x',
    replyParentId: null,
    openGeneration: 7,
  });
  assert.equal(samePostboxComposeTarget(editX, editXCopy), true);
  assert.equal(samePostboxComposeTarget(editX, editXReopened), false);
  assert.equal(samePostboxComposeTarget(editX, postY), false);
  assert.equal(samePostboxComposeTarget(replyY, replyZ), false);
  assert.notEqual(postboxComposeTargetKey(editX), postboxComposeTargetKey(editXReopened));
  assert.notEqual(postboxComposeTargetKey(postY), postboxComposeTargetKey(replyY));
});

test('a reopened post or reply draft contains none of the prior edit body, media, category, or mentions', async () => {
  const { createPostboxDraft, postboxCategoryRequiresAccess } = await loadComposeHelpers();
  const media = [{ url: 'https://cdn.easygo.example/x.png' }];
  const mentions = [{ did: 'did:privy:x', username: '@x' }];
  const editDraft = createPostboxDraft({
    value: {
      stream_id: 'post-x',
      context: 'category-x',
      context_details: { context_details: { displayName: '#x' } },
      content: { body: 'secret x draft', media, mentions },
    },
  });
  const cleanDraft = createPostboxDraft(null);

  assert.equal(editDraft.message, 'secret x draft');
  assert.deepEqual(editDraft.media, media);
  assert.deepEqual(editDraft.mentions, mentions);
  assert.notEqual(editDraft.media, media);
  assert.notEqual(editDraft.mentions, mentions);
  assert.deepEqual(cleanDraft, {
    category: false,
    media: [],
    mentions: [],
    message: '',
  });
  assert.equal(postboxCategoryRequiresAccess(editDraft.category), false);
  assert.equal(postboxCategoryRequiresAccess(cleanDraft.category), false);
  assert.equal(postboxCategoryRequiresAccess({
    content: { accessRules: [{ type: 'token' }] },
  }), true);
});

test('edit payload omits unchanged legacy media, clears removed media, and submits changed media for server screening', async () => {
  const { createPostboxEditPayload } = await loadComposeHelpers();
  const originalMedia = [{ url: 'https://legacy.easygo.example/original.png' }];

  assert.deepEqual(
    createPostboxEditPayload('unchanged media', [{ url: originalMedia[0].url }], originalMedia),
    { body: 'unchanged media' },
  );
  assert.deepEqual(
    createPostboxEditPayload('remove media', [], originalMedia),
    { body: 'remove media', mediaUrl: null },
  );
  assert.deepEqual(
    createPostboxEditPayload(
      'change media',
      [{ url: 'https://new.easygo.example/rejected.png' }],
      originalMedia,
    ),
    { body: 'change media', mediaUrl: 'https://new.easygo.example/rejected.png' },
  );
  assert.deepEqual(createPostboxEditPayload('no media', [], []), { body: 'no media' });
});

test('postbox maps only stable safety codes to generic alerts without rejected content or rule details', async () => {
  const { postboxSafetyAlert } = await loadComposeHelpers();
  const contentAlert = postboxSafetyAlert({
    body: {
      error: 'post_content_rejected',
      rejectedText: 'private rejected input',
      ruleId: 'private_rule',
    },
  });
  const mediaAlert = postboxSafetyAlert({
    body: {
      error: 'post_media_rejected',
      mediaUrl: 'https://private.example/rejected.png',
    },
  });

  assert.deepEqual(contentAlert, {
    title: 'Post not published',
    message: 'This text may violate EasyGo safety rules. Edit it and try again.',
  });
  assert.deepEqual(mediaAlert, {
    title: 'Remove media to continue',
    message: 'EasyGo cannot screen or publish media yet. Remove it and try again.',
  });
  assert.equal(postboxSafetyAlert({ body: { error: 'bad_input' } }), null);
  assert.doesNotMatch(
    JSON.stringify({ contentAlert, mediaAlert }),
    /private rejected input|private_rule|private\.example/i,
  );
});

test('an X completion fails the same comparator after Y opens and performs no continuation effects', async () => {
  const { createPostboxComposeTarget, samePostboxComposeTarget } = await loadComposeHelpers();
  const gate = deferred();
  const targetX = createPostboxComposeTarget({
    editedPost: { value: { stream_id: 'post-x' } },
    openGeneration: 3,
  });
  const targetY = createPostboxComposeTarget({
    openGeneration: 4,
    replyTo: { stream_id: 'parent-y' },
  });
  let liveTarget = targetX;
  let callbacks = 0;
  let clears = 0;
  let closes = 0;
  const finishX = (async () => {
    await gate.promise;
    if (!samePostboxComposeTarget(liveTarget, targetX)) return;
    clears += 1;
    callbacks += 1;
    closes += 1;
  })();

  liveTarget = targetY;
  gate.resolve();
  await finishX;
  assert.deepEqual({ callbacks, clears, closes }, { callbacks: 0, clears: 0, closes: 0 });
});

test('the modal commits a fresh Postbox generation before the sheet can present', () => {
  const source = read('../components/modals/PostboxModal.js');
  const appSource = read('../App.js');
  const prepare = section(source, 'const preparePresent = useCallback(() => {', '    const close = useCallback');
  const commit = section(source, 'useLayoutEffect(() => {', '    return(');

  assert.match(source, /const \[openGeneration, setOpenGeneration\] = useState\(0\);/);
  assert.match(source, /const modalSheetRef = useRef\(null\);/);
  assert.match(source, /const liveOpenGenerationRef = useRef\(0\);/);
  assert.match(source, /const pendingPresentGenerationRef = useRef\(null\);/);
  assertOrdered(prepare, [
    'const nextGeneration = liveOpenGenerationRef.current + 1;',
    'liveOpenGenerationRef.current = nextGeneration;',
    'pendingPresentGenerationRef.current = nextGeneration;',
    'setOpenGeneration(nextGeneration);',
  ], 'prepare presentation');
  assert.doesNotMatch(prepare, /modalSheetRef\.current\?\.present\(\)/);
  assert.match(source, /useImperativeHandle\(modalPostBoxRef, \(\) => \(\{\s*present: preparePresent,\s*close,/);
  assertOrdered(commit, [
    'if (pendingPresentGenerationRef.current !== openGeneration) return;',
    'pendingPresentGenerationRef.current = null;',
    'modalSheetRef.current?.present();',
  ], 'post-commit presentation');
  assert.match(source, /<BottomSheetModal\s+ref=\{modalSheetRef\}/);
  assert.match(source, /<Postbox key=\{composeKey\} openGeneration=\{openGeneration\} \/>/);
  assert.doesNotMatch(source, /onChange=.*setOpenGeneration/);

  assert.match(appSource, /const handleModalPostBoxPress = useCallback\(\(\) => modalPostBoxRef\.current\?\.present\(\), \[\]\);/);
  const showPostbox = section(appSource, 'function showPostbox(callback) {', '    function hidePostbox()');
  assertOrdered(showPostbox, [
    'callbackPostShared = callback ?? defaultCallbackPostShared;',
    'handleModalPostBoxPress()',
  ], 'App to guarded modal presentation');
});

test('mention and access completions require their captured identity and request generation', () => {
  const source = read('../components/Postbox.js');
  const mentions = section(source, 'async function getListFollow()', '    async function checkAccess');
  const access = section(source, 'async function checkAccess', '    /** Pre-select category');

  assertOrdered(mentions, [
    'const operationLease = lease;',
    'const operationUserId = user?.id || null;',
    'const requestGeneration = ++mentionRequestGenerationRef.current;',
    'isCurrentLease(operationLease)',
    'requestGeneration === mentionRequestGenerationRef.current',
    'liveMentionOwnerUserIdRef.current === operationUserId',
    'api.follows.followers(operationUserId',
    'api.follows.following(operationUserId',
    'if (!isCurrentRequest()) return;',
    'setFullListFollow([...followers, ...following]);',
  ], 'mention request ownership');
  assert.match(mentions, /catch \(error\) \{\s*if \(!isCurrentRequest\(\)\) return;/);

  assertOrdered(access, [
    'const operationTarget = composeTarget;',
    'const operationCategoryIdentity = categoryIdentity(temp_cat);',
    'const requestGeneration = ++accessRequestGenerationRef.current;',
    'const isCurrentSelection = () => Boolean(',
    'requestGeneration === accessRequestGenerationRef.current',
    'selectedCategoryIdentityRef.current === operationCategoryIdentity',
    'if (!postboxCategoryRequiresAccess(temp_cat)) {',
    'if (isCurrentSelection()) setHasAccess(true);',
    'if (!operationLease || !isCurrentComposeTarget(operationTarget, operationLease)) return;',
    'if (isCurrentRequest()) setHasAccess(false);',
    'await checkContextAccess',
    'if (isCurrentRequest()) setHasAccess(true);',
  ], 'category access ownership');
});

test('send and edit fence every clear, callback, close, error, and loading completion', () => {
  const source = read('../components/Postbox.js');
  const reset = section(source, 'useEffect(() => {\n        const nextDraft', '    useEffect(() => {\n        void getListFollow');
  const edit = section(source, 'async function edit()', '    /** Create a root post');
  const send = section(source, 'async function send()', '    /** Will show connect modal');

  for (const marker of [
    'mentionsRef.current = nextDraft.mentions;',
    'setMessage(nextDraft.message);',
    'setListMedia(nextDraft.media);',
    'setCategorySelected(nextDraft.category);',
    'setHasAccess(!postboxCategoryRequiresAccess(nextDraft.category));',
    'setMentionsBoxVis(false);',
    'setCurrentMention(null);',
    'setLoading(false);',
  ]) assert.match(reset, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(reset, /\}, \[composeTargetKey,/);

  assertOrdered(edit, [
    'const operationTarget = composeTarget;',
    'const operationEditedPost = editedPost;',
    'const editPayload = createPostboxEditPayload(',
    'const operation = beginComposeOperation(operationLease, operationTarget);',
    'await updatePost(postId, editPayload)',
    'if (!isCurrentComposeOperation(operation)) return;',
    'operationEditedPost?.callback?.(',
    'isCurrentComposeOperation(operation)',
    'hidePostbox();',
    'finishComposeOperation(operation);',
  ], 'edit continuation');
  assert.match(edit, /catch\(error\) \{\s*if \(!isCurrentComposeOperation\(operation\)\) return;[\s\S]*?postboxSafetyAlert\(error\)/);

  assertOrdered(send, [
    'const operationTarget = composeTarget;',
    'const operationCallback = callbackPostShared || defaultCallbackPostShared;',
    'operation = beginComposeOperation(operationLease, operationTarget);',
    ': await createPost({ body: publishBody, mediaUrl });',
    'if (!isCurrentComposeOperation(operation)) return;',
    'setMessage("");',
    'mentionsRef.current = [];',
    'await operationCallback?.(_callbackContent);',
    'if (!isCurrentComposeOperation(operation)) return;',
    'hidePostbox();',
  ], 'send continuation');
  assert.match(send, /catch\(e\) \{\s*if \(!operation \|\| !isCurrentComposeOperation\(operation\)\) return;/);
  assert.match(send, /postboxSafetyAlert\(e\)[\s\S]*?'Could not publish'/);
  assert.doesNotMatch(send, /console\.(?:log|warn|error)\([^\n]*e\)/);
  assert.match(send, /finally \{\s*if \(operation\) finishComposeOperation\(operation\);/);
});

test('post and reply create/update hooks preserve current-lease API errors for the postbox safety UI', () => {
  const postsSource = read('../hooks/usePosts.js');
  const repliesSource = read('../hooks/useReplies.js');
  const createPost = section(postsSource, '  const create = useCallback(async (payload) => {', '  const remove = useCallback');
  const updatePost = section(postsSource, '  const update = useCallback(async (postId, payload) => {', '  useEffect(() => {');
  const createReply = section(repliesSource, '  const create = useCallback(async (payload) => {', '  const remove = useCallback');

  for (const [label, source] of [
    ['create post', createPost],
    ['update post', updatePost],
    ['create reply', createReply],
  ]) {
    assertOrdered(source, [
      'catch (cause) {',
      'if (!isCurrentLease(operationLease)) return null;',
      'const nextError = cause instanceof Error ? cause : new Error(String(cause));',
      'setError(nextError);',
      'throw nextError;',
    ], label);
    assert.doesNotMatch(source, /setError\(nextError\);\s*return null;/);
  }
});
