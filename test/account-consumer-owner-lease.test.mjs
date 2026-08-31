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

test('consumer leases consult the provider live lease before passive cleanup', () => {
  const source = read('../contexts/DeviceAccountDataContext.js');

  assert.match(source, /isCurrentAccountLease: isCurrentLease,/);
  assert.match(source, /const \{ accountLease, isCurrentAccountLease \} = useDeviceAccountData\(\);/);
  assert.match(source, /sameDeviceAccountLease\(liveLeaseRef\.current, candidate\)[\s\S]*?&& isCurrentAccountLease\(candidate\)/);
});

test('nickname updates preserve owner-gating presentation data', () => {
  const source = read('../components/modals/NicknameModal.js');

  assert.match(source, /data: \{\s*\.\.\.current\?\.profile\?\.data,\s*\.\.\.adapted\.profile\?\.data,/);
  assert.match(source, /\? \{ \.\.\.\(current \|\| \{\}\), \.\.\.\(adapted\.profile\.data \|\| \{\}\) \}/);
  assert.doesNotMatch(source, /\? adapted : current/);
});

test('custom deletion, settings, consent, push, and course guards use the provider live lease', () => {
  const deletionPending = read('../screens/AccountDeletionPending.js');
  const settings = read('../components/modals/SettingsModal.js');
  const consent = read('../hooks/useConsent.js');
  const push = read('../components/modals/PushNotificationsModal.js');
  const course = read('../screens/Navigation/Trophies/CourseDetailScreen.js');

  assert.match(deletionPending, /isCurrentAccountLease\(deviceAccountLeaseRef\.current\)/);
  assert.match(deletionPending, /isCurrentAccountLease\(operation\.accountLease\)/);
  assert.match(deletionPending, /purgeLocalData\(ownerUserId, operation\.accountLease\)/);
  assert.match(deletionPending, /sealLocalData: \(\) => \{\s*requireCurrentOperation\(\);/);
  assert.match(settings, /isCurrentAccountLease\(expectedOperation\.accountLease\)/);
  assert.match(settings, /isCurrentAccountLease\(operation\.accountLease\)/);
  assert.match(settings, /getCurrentOwnerUserId:[\s\S]*?isCurrentAccountLease\(deviceAccountLeaseRef\.current\)/);
  assert.match(consent, /useDeviceAccountOperationLease/);
  assert.match(consent, /!isCurrentLease\(operationLease\)/);
  assert.match(push, /useDeviceAccountOperationLease/);
  assert.doesNotMatch(push, /mountedRef|leaseRef/);
  assert.match(course, /useDeviceAccountOperationLease/);
  assert.doesNotMatch(course, /courseMountedRef|courseLeaseRef/);
});

test('Android stale export cleanup failure always warns without account data', () => {
  const source = read('../components/modals/SettingsModal.js');
  const cleanupWarning = source.indexOf('if (androidCleanupFailed) {');
  const staleReturn = source.indexOf('if (!isCurrentExport()) return;', cleanupWarning);

  assert.notEqual(cleanupWarning, -1);
  assert.notEqual(staleReturn, -1);
  assert.ok(cleanupWarning < staleReturn);
  assert.match(source.slice(cleanupWarning, staleReturn), /partial JSON file may remain/);
});

test('follow-button completion cannot notify the next signed-in account', () => {
  const source = read('../components/User.js');
  const toggle = section(source, 'const toggleFollow = async', '  return (');

  assert.match(source, /useDeviceAccountOperationLease/);
  assertOrdered(toggle, [
    'const operationLease = lease;',
    'if (!operationLease || !isCurrentLease(operationLease)) return;',
    'await follow() : await unfollow()',
    'if (!isCurrentLease(operationLease)) return;',
    "Alert.alert('Could not update follow'",
    'onFollowChange?.(targetUserId, nextFollowing);',
  ], 'follow toggle');
});

test('profile async consumers gate owner-specific state, callbacks, alerts, and finally', () => {
  const source = read('../components/ProfileDetails.js');
  const commonFollowers = section(source, "    useEffect(() => {\n        const operationLease = lease;", '    const delay =');
  const copy = section(source, 'async function copy', '    async function handleWalletStatusPress');
  const wallet = section(source, 'async function handleWalletStatusPress', '    if(!profile)');
  const follow = section(source, 'async function follow(active)', '    const ProfileItem');
  const refresh = section(source, 'async function updateProfile()', '    const openLink');
  const openLink = section(source, 'const openLink = async', '    const [tabIndex');

  assert.match(source, /useDeviceAccountOperationLease/);
  assert.match(commonFollowers, /\.then\(\(\[selectedResult, ownResult\]\) => \{\s*if \(!active \|\| !isCurrentLease\(operationLease\)\) return;/);
  assert.match(commonFollowers, /if \(active && isCurrentLease\(operationLease\)\) \{/);
  assert.match(commonFollowers, /\.finally\(\(\) => \{\s*if \(active && isCurrentLease\(operationLease\)\) setCommonFollowLoading\(false\);/);

  assertOrdered(copy, [
    'const operationLease = lease;',
    'await delay(1000);',
    'if (!isCurrentLease(operationLease)) return;',
    'setAddressCopied(false)',
    'await Clipboard.setStringAsync(val);',
  ], 'copy address');
  assertOrdered(wallet, [
    'const operationLease = lease;',
    'await Linking.openURL(baseScanUrl);',
    'if (!isCurrentLease(operationLease)) return;',
    "Alert.alert('BaseScan unavailable'",
  ], 'BaseScan link');
  assertOrdered(follow, [
    'const operationLease = lease;',
    'await followUser() : await unfollowUser()',
    'if (!isCurrentLease(operationLease)) return;',
    "Alert.alert('Could not update follow'",
    'setUserInfo((current)',
  ], 'profile follow');
  assertOrdered(refresh, [
    'const operationLease = lease;',
    'await refreshProfile?.();',
    'if (!isCurrentLease(operationLease)) return;',
    'setUserInfo(details);',
    'setUser((current)',
  ], 'profile refresh');
  assert.match(refresh, /finally \{\s*if \(isCurrentLease\(operationLease\)\) setRefreshing\(false\)/);
  assertOrdered(openLink, [
    'const operationLease = lease;',
    'await Linking.openURL(url)',
    'if (!isCurrentLease(operationLease)) return;',
    "Alert.alert('Could not open URL '",
  ], 'profile external link');
});

test('postbox ignores account-A completions after the active lease changes', () => {
  const source = read('../components/Postbox.js');
  const suggestions = section(source, 'async function getListFollow()', '    async function checkAccess');
  const access = section(source, 'async function checkAccess', '    /** Pre-select category');
  const edit = section(source, 'async function edit()', '    /** Create a root post');
  const send = section(source, 'async function send()', '    /** Will show connect modal');

  assert.match(source, /useDeviceAccountOperationLease/);
  assert.doesNotMatch(source, /let mentions = \[\]/);
  assert.match(source, /const mentionsRef = useRef\(initialDraft\.mentions\);/);
  assert.match(source, /const operationMentions = \[\.\.\.mentionsRef\.current\];/);
  assert.match(source, /mentions: operationMentions/);
  assert.match(source, /mentionsRef\.current = \[\];/);
  assertOrdered(suggestions, [
    'const operationLease = lease;',
    'const operationUserId = user?.id || null;',
    'const requestGeneration = ++mentionRequestGenerationRef.current;',
    'liveMentionOwnerUserIdRef.current === operationUserId',
    'await Promise.all([',
    'api.follows.followers(operationUserId',
    'api.follows.following(operationUserId',
    'if (!isCurrentRequest()) return;',
    'setFullListFollow([...followers, ...following]);',
  ], 'mention suggestions');
  assert.match(suggestions, /catch \(error\) \{\s*if \(!isCurrentRequest\(\)\) return;[\s\S]*?setFullListFollow\(\[\]\);/);
  assert.match(access, /const requestGeneration = \+\+accessRequestGenerationRef\.current;/);
  assert.match(access, /selectedCategoryIdentityRef\.current === operationCategoryIdentity/);
  assert.match(access, /await checkContextAccess[\s\S]*?if \(isCurrentRequest\(\)\) setHasAccess\(true\);/);

  assertOrdered(edit, [
    'const operationLease = lease;',
    'const operationTarget = composeTarget;',
    'const editPayload = createPostboxEditPayload(',
    'const operation = beginComposeOperation(operationLease, operationTarget);',
    'await updatePost(postId, editPayload)',
    'if (!isCurrentComposeOperation(operation)) return;',
    "Alert.alert('Could not edit post'",
    'operationEditedPost?.callback?.(',
    'isCurrentComposeOperation(operation)',
    'hidePostbox();',
  ], 'edit post');
  assert.match(edit, /catch\(error\) \{\s*if \(!isCurrentComposeOperation\(operation\)\) return;[\s\S]*?postboxSafetyAlert\(error\)/);
  assert.match(edit, /finally \{\s*finishComposeOperation\(operation\);/);

  assertOrdered(send, [
    'const operationLease = lease;',
    'const operationTarget = composeTarget;',
    'operation = beginComposeOperation(operationLease, operationTarget);',
    ': await createPost({ body: publishBody, mediaUrl });',
    'if (!isCurrentComposeOperation(operation)) return;',
    'setMessage("");',
    'mentionsRef.current = [];',
    'await operationCallback?.(_callbackContent);',
    'if (!isCurrentComposeOperation(operation)) return;',
    'hidePostbox();',
  ], 'publish post');
  assert.match(send, /catch\(e\) \{\s*if \(!operation \|\| !isCurrentComposeOperation\(operation\)\) return;[\s\S]*?postboxSafetyAlert\(e\)[\s\S]*?'Could not publish'/);
  assert.doesNotMatch(send, /console\.(?:log|warn|error)\([^\n]*e\)/);
  assert.match(send, /finally \{\s*if \(operation\) finishComposeOperation\(operation\);/);
});

test('legacy connection continuation cannot reopen device-wide prompts for a new session', () => {
  const source = read('../App.js');
  const callback = section(source, 'async function callbackConnect', '    /** Show postbox');

  assert.match(source, /const accountTransitionRef = useRef\(null\);/);
  assert.match(source, /accountTransitionRef\.current = normalizedNextTransition;/);
  assertOrdered(callback, [
    'const expectedTransition = accountTransitionRef.current;',
    'if (!expectedTransition || !isCurrentTransition()) return;',
    'await Promise.all([',
    'if (!isCurrentTransition()) return;',
    'setPushNotifsVis(true);',
  ], 'legacy connect callback');
  assert.doesNotMatch(callback, /console\.log\(detailUser\)/);
});
