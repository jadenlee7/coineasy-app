import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CASE_FILES, getCaseFile } from '../data/caseFiles.mjs';
import { createCaseSession, getCaseWalletView, transitionCaseSession as step } from '../utils/caseFilesEngine.mjs';

function inspect(state) {
  state = step(state, { type: 'OPEN_RECEIPT' });
  for (const field of ['status', 'network']) state = step(state, { type: 'INSPECT_FIELD', field });
  for (const field of ['request', 'to']) {
    if (!state.expanded[field]) state = step(state, { type: 'EXPAND_ADDRESS', field });
  }
  return state;
}
function filled(variant = 0) {
  let state = createCaseSession('first-delivery', variant);
  const file = getCaseFile(state.caseId, variant);
  for (const [field, value] of Object.entries({ network: 'Base', token: 'USDC', address: file.contact.address, amount: file.amount })) {
    state = step(state, { type: 'UPDATE_DRAFT', field, value });
  }
  return state;
}

test('three authored variants retain valid fictional whole addresses and meaningful mismatch', () => {
  assert.equal(CASE_FILES.length, 3);
  for (const entry of CASE_FILES) {
    const variants = [0, 1, 2].map((variant) => getCaseFile(entry.id, variant));
    assert.equal(new Set(variants.map((file) => file.amount)).size, 3);
    for (const file of variants) {
      assert.match(file.contact.address, /^0x[0-9a-f]{40}$/);
      assert.match(file.receipt.hash, /^0x[0-9a-f]{64}$/);
      if (entry.id === 'address-mismatch') {
        assert.notEqual(file.contact.address, file.receipt.to);
        assert.equal(file.contact.address.slice(0, 8), file.receipt.to.slice(0, 8));
        assert.equal(file.contact.address.slice(-6), file.receipt.to.slice(-6));
      }
    }
    assert.deepEqual(getCaseFile(entry.id, 3), getCaseFile(entry.id, 0));
  }
  assert.equal(createCaseSession('unknown'), null);
  assert.equal(createCaseSession('wrong-network', -1), null);
});

test('network switch reveals an existing balance without creating a transfer', () => {
  let state = createCaseSession('wrong-network');
  assert.equal(getCaseWalletView(state).usdc, '0.00');
  state = step(state, { type: 'SWITCH_NETWORK', network: 'Base' });
  assert.equal(getCaseWalletView(state).usdc, getCaseFile(state.caseId).amount);
  assert.equal(getCaseWalletView(state).transferCount, 0);
  state = step(state, { type: 'RESOLVE_NETWORK' });
  assert.equal(state.phase, 'investigate');
  state = inspect(state);
  state = step(state, { type: 'RESOLVE_NETWORK' });
  assert.equal(state.phase, 'complete');
  assert.equal(state.transferCount, 0);
  assert.match(state.result.takeaway, /보는 기록/);
});

test('whole-address evidence is necessary and mismatch completion does not recover funds', () => {
  let state = createCaseSession('address-mismatch');
  state = step(state, { type: 'OPEN_RECEIPT' });
  state = step(state, { type: 'INSPECT_FIELD', field: 'to' });
  assert.equal(state.inspected.includes('to'), false);
  state = step(state, { type: 'REPORT_MISMATCH' });
  assert.equal(state.phase, 'investigate');
  state = inspect(state);
  assert.equal(step(state, { type: 'REPORT_MISMATCH', answer: 'match' }).phase, 'investigate');
  state = step(state, { type: 'REPORT_MISMATCH', answer: 'mismatch' });
  assert.equal(state.phase, 'complete');
  assert.equal(state.transferCount, 0);
  assert.equal(getCaseWalletView(state).usdc, '0.00');
  assert.match(state.result.message, /다시 확인/);
});

test('delivery is reviewed once, debited once, and only complete after receipt checks', () => {
  for (let variant = 0; variant < 3; variant++) {
    let state = filled(variant);
    const before = getCaseWalletView(state);
    const noReview = step(state, { type: 'CONFIRM_TRANSFER' });
    assert.equal(noReview.transferCount, 0);
    state = step(state, { type: 'REVIEW_TRANSFER' });
    assert.equal(state.phase, 'review');
    state = step(state, { type: 'CONFIRM_TRANSFER' });
    assert.equal(state.phase, 'sent');
    const duplicate = step(state, { type: 'CONFIRM_TRANSFER' });
    assert.strictEqual(duplicate, state);
    assert.equal(state.transferCount, 1);
    const wallet = getCaseWalletView(state);
    assert.equal(Number(wallet.usdc) + Number(wallet.recipientUsdc), Number(before.usdc));
    assert.equal(wallet.eth, '0.000998');
    assert.equal(step(state, { type: 'COMPLETE_DELIVERY' }).phase, 'sent');
    state = step(inspect(state), { type: 'COMPLETE_DELIVERY' });
    assert.equal(state.phase, 'complete');
    assert.strictEqual(step(state, { type: 'CONFIRM_TRANSFER' }), state);
  }
});

test('every edited review field and background pause require another review', () => {
  for (const [field, value] of Object.entries({ network: 'Ethereum', token: 'ETH', address: getCaseFile('first-delivery', 1).contact.address, amount: '1.00' })) {
    const reviewed = step(filled(), { type: 'REVIEW_TRANSFER' });
    const changed = step(reviewed, { type: 'UPDATE_DRAFT', field, value });
    assert.equal(changed.phase, 'draft');
    assert.equal(changed.review, null);
    assert.equal(step(changed, { type: 'CONFIRM_TRANSFER' }).transferCount, 0);
  }
  const reviewed = step(filled(), { type: 'REVIEW_TRANSFER' });
  const paused = step(reviewed, { type: 'PAUSE' });
  assert.deepEqual(paused.draft, reviewed.draft);
  assert.equal(paused.review, null);
  assert.equal(step(paused, { type: 'CONFIRM_TRANSFER' }).transferCount, 0);
  assert.equal(step(paused, { type: 'REVIEW_TRANSFER' }).phase, 'review');
});

test('closed cases keep evidence readable without allowing another balance mutation', () => {
  let state = step(step(filled(), { type: 'REVIEW_TRANSFER' }), { type: 'CONFIRM_TRANSFER' });
  state = step(inspect(state), { type: 'COMPLETE_DELIVERY' });
  const result = state.result;
  const before = getCaseWalletView(state);
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'to' });
  assert.equal(state.expanded.to, false);
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'to' });
  assert.equal(state.expanded.to, true);
  state = step(state, { type: 'OPEN_RECEIPT' });
  assert.equal(state.receiptOpened, true);
  state = step(state, { type: 'SWITCH_NETWORK', network: 'Ethereum' });
  assert.equal(getCaseWalletView(state).usdc, '0.00');
  state = step(state, { type: 'SWITCH_NETWORK', network: 'Base' });
  assert.deepEqual(getCaseWalletView(state), before);
  for (const event of [
    { type: 'UPDATE_DRAFT', field: 'amount', value: '1.00' },
    { type: 'REVIEW_TRANSFER' }, { type: 'CONFIRM_TRANSFER' }, { type: 'PAUSE' },
  ]) assert.strictEqual(step(state, event), state);
  assert.equal(state.phase, 'complete');
  assert.deepEqual(state.result, result);
});

test('invalid amounts and destinations remain recoverable drafts', () => {
  for (const value of ['', '0', '-1', 'NaN', 'Infinity', '1e1', '12.001', ' 12', '12,00', '999999', '1.00']) {
    const state = step(filled(), { type: 'UPDATE_DRAFT', field: 'amount', value });
    const invalid = step(state, { type: 'REVIEW_TRANSFER' });
    assert.equal(invalid.phase, 'draft', value);
    assert.equal(invalid.notice.tone, 'error');
    assert.equal(invalid.transferCount, 0);
  }
  for (const [field, value] of [['network', 'Ethereum'], ['token', 'ETH'], ['address', '0x71…CAFE'], ['address', getCaseFile('address-mismatch').receipt.to]]) {
    const state = step(filled(), { type: 'UPDATE_DRAFT', field, value });
    assert.equal(step(state, { type: 'REVIEW_TRANSFER' }).phase, 'draft');
  }
});

test('out-of-order actions and changed review snapshots cannot simulate a transfer', () => {
  const initial = createCaseSession('wrong-network');
  for (const type of ['CONFIRM_TRANSFER', 'REVIEW_TRANSFER', 'COMPLETE_DELIVERY', 'REPORT_MISMATCH']) {
    assert.strictEqual(step(initial, { type }), initial);
  }
  const reviewed = step(filled(), { type: 'REVIEW_TRANSFER' });
  const stale = { ...reviewed, draft: { ...reviewed.draft, amount: '13.00' } };
  const next = step(stale, { type: 'CONFIRM_TRANSFER' });
  assert.equal(next.phase, 'draft');
  assert.equal(next.transferCount, 0);
  assert.strictEqual(step(initial, { type: 'SWITCH_NETWORK', network: 'Unknown' }), initial);
  assert.strictEqual(step(initial, null), initial);
});

test('Case Files modules have no account, network, signing, storage or clipboard capability', () => {
  const sources = ['../data/caseFiles.mjs', '../utils/caseFilesEngine.mjs', '../utils/caseQuestProgress.mjs', '../utils/caseQuestFeedback.mjs', '../components/PracticeBrand.js', '../screens/CaseFiles.js']
    .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(sources, /\bfetch\s*\(|axios|@privy-io|utils\/api|AsyncStorage|SecureStore|Clipboard|Linking|WebView|sendTransaction|signMessage|signTypedData|writeContract|executeSquidRoute/);
  assert.doesNotMatch(sources, /completeDailyRun|saveDailyRunProgress|\/orange\//);
  const hub = readFileSync(new URL('../screens/DailyRunPracticeMissions.js', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../navigation/AppNavigator.js', import.meta.url), 'utf8');
  assert.match(hub, /navigate\('CaseFiles'\)/);
  assert.match(routes, /name="CaseFiles" component=\{CaseFiles\}/);
});
