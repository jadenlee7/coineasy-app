import test from 'node:test';
import assert from 'node:assert/strict';
import { getCaseFile } from '../data/caseFiles.mjs';
import { createCaseSession, getCaseWalletView, transitionCaseSession as engineStep } from '../utils/caseFilesEngine.mjs';
import { transitionCaseQuest as step, getCaseActionFeedback } from '../utils/caseQuestFeedback.mjs';

function review() {
  let state = createCaseSession('first-delivery');
  const file = getCaseFile(state.caseId);
  for (const [field, value] of Object.entries({ network: 'Base', token: 'USDC', address: file.contact.address, amount: file.amount })) state = step(state, { type: 'UPDATE_DRAFT', field, value });
  return step(state, { type: 'REVIEW_TRANSFER' });
}

test('request and evidence give immediate factual progress; repeats do not replay feedback', () => {
  let state = step(createCaseSession('wrong-network'), { type: 'EXPAND_ADDRESS', field: 'request' });
  assert.equal(state.feedback.title, '친구 요청 확인!');
  const requestFeedback = state.feedback;
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'request' });
  assert.equal(state.feedback, requestFeedback);
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'request' });
  state = step(state, { type: 'OPEN_RECEIPT' });
  state = step(state, { type: 'INSPECT_FIELD', field: 'status' });
  assert.match(state.feedback.message, /단서 1\/3/);
  const firstClueFeedback = state.feedback;
  state = step(state, { type: 'INSPECT_FIELD', field: 'status' });
  assert.equal(state.feedback, firstClueFeedback);
  state = step(state, { type: 'INSPECT_FIELD', field: 'network' });
  assert.match(state.feedback.message, /단서 2\/3/);
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'to' });
  assert.equal(state.feedback.title, '전체 주소 대조!');
  assert.match(state.feedback.message, /단서 3\/3/);
  assert.notEqual(state.phase, 'complete');
});

test('network feedback reflects the displayed balance without implying a transfer', () => {
  for (let variant = 0; variant < 3; variant++) {
    let state = step(createCaseSession('wrong-network', variant), { type: 'SWITCH_NETWORK', network: 'Base' });
    assert.equal(state.feedback.title, 'Base에서 ' + getCaseWalletView(state).usdc + ' USDC 발견!');
    assert.match(state.feedback.message, /자산을 옮기지는 않았어요/);
    const found = state.feedback;
    state = step(state, { type: 'SWITCH_NETWORK', network: 'Base' });
    assert.equal(state.feedback, found);
    state = step(state, { type: 'SWITCH_NETWORK', network: 'Ethereum' });
    assert.equal(state.feedback.tone, 'info');
    assert.equal(state.feedback.title, 'Ethereum 잔액은 0 USDC');
    assert.equal(state.transferCount, 0);
  }
});

test('review is not sending and editing or pausing cannot leave stale approval', () => {
  const state = review();
  assert.equal(state.feedback.title, '전송 전 점검 통과!');
  assert.match(state.feedback.message, /아직 보내지 않았어요/);
  assert.equal(state.transferCount, 0);
  for (const event of [{ type: 'UPDATE_DRAFT', field: 'amount', value: '1' }, { type: 'SWITCH_NETWORK', network: 'Base' }]) {
    const changed = step(state, event);
    assert.equal(changed.phase, 'draft');
    assert.equal(changed.feedback, null);
    assert.equal(step(changed, { type: 'CONFIRM_TRANSFER' }).transferCount, 0);
  }
  const paused = step(state, { type: 'PAUSE' });
  assert.equal(paused.phase, 'draft');
  assert.equal(paused.feedback.tone, 'retry');
  assert.match(paused.feedback.message, /검토/);
});

test('virtual transfer feedback happens once and requires receipt inspection before completion', () => {
  let state = step(review(), { type: 'CONFIRM_TRANSFER' });
  assert.equal(state.feedback.title, '가상 전송 성공!');
  assert.match(state.feedback.message, /영수증 확인이 남았어요/);
  assert.equal(state.phase, 'sent');
  assert.equal(step(state, { type: 'CONFIRM_TRANSFER' }), state);
  state = step(state, { type: 'COMPLETE_DELIVERY' });
  assert.equal(state.feedback.tone, 'retry');
  assert.equal(state.phase, 'sent');
  assert.equal(state.transferCount, 1);
  state = step(state, { type: 'OPEN_RECEIPT' });
  for (const field of ['status', 'network']) state = step(state, { type: 'INSPECT_FIELD', field });
  for (const field of ['request', 'to']) state = step(state, { type: 'EXPAND_ADDRESS', field });
  state = step(state, { type: 'COMPLETE_DELIVERY' });
  assert.equal(state.phase, 'complete');
  assert.equal(step(state, { type: 'CONFIRM_TRANSFER' }), state);
});

test('wrong answers retain evidence and give a targeted correction, not a reset', () => {
  let state = step(createCaseSession('address-mismatch'), { type: 'OPEN_RECEIPT' });
  for (const field of ['status', 'network']) state = step(state, { type: 'INSPECT_FIELD', field });
  for (const field of ['request', 'to']) state = step(state, { type: 'EXPAND_ADDRESS', field });
  const wrong = step(state, { type: 'REPORT_MISMATCH', answer: 'match' });
  assert.deepEqual(wrong.inspected, state.inspected);
  assert.equal(wrong.feedback.tone, 'retry');
  assert.match(wrong.feedback.message, /중간 글자/);
  const complete = step(wrong, { type: 'REPORT_MISMATCH', answer: 'mismatch' });
  assert.equal(complete.phase, 'complete');
  assert.equal(getCaseActionFeedback(wrong, complete), null, 'dedicated completion screen owns final feedback');
});

test('invalid or inert inputs cannot generate praise or alter state', () => {
  assert.equal(getCaseActionFeedback(null, null), null);
  assert.equal(step(null, { type: 'CONFIRM_TRANSFER' }), null);
  const state = createCaseSession('wrong-network');
  for (const event of [null, {}, { type: 'INSPECT_FIELD', field: 'fake' }, { type: 'SWITCH_NETWORK', network: 'unknown' }]) assert.equal(step(state, event), state);
});

test('feedback never changes engine state across authored completions and mixed event sequences', () => {
  const gameplay = ({ feedback, ...state }) => state;
  for (const id of ['wrong-network', 'address-mismatch', 'first-delivery']) for (let variant = 0; variant < 3; variant++) {
    const file = getCaseFile(id, variant);
    const evidence = [{ type: 'OPEN_RECEIPT' }, { type: 'INSPECT_FIELD', field: 'status' }, { type: 'INSPECT_FIELD', field: 'network' }, { type: 'EXPAND_ADDRESS', field: 'to' }];
    const validDraft = Object.entries({ network: 'Base', token: 'USDC', address: file.contact.address, amount: file.amount }).map(([field, value]) => ({ type: 'UPDATE_DRAFT', field, value }));
    const send = [...validDraft, { type: 'REVIEW_TRANSFER' }, { type: 'CONFIRM_TRANSFER' }];
    const finish = id === 'wrong-network' ? [{ type: 'SWITCH_NETWORK', network: 'Base' }, { type: 'RESOLVE_NETWORK' }]
      : [{ type: id === 'first-delivery' ? 'COMPLETE_DELIVERY' : 'REPORT_MISMATCH', answer: 'mismatch' }];
    const completedPath = [{ type: 'EXPAND_ADDRESS', field: 'request' }, ...(id === 'first-delivery' ? send : []), ...evidence, ...finish];
    const mixed = [...completedPath, { type: 'PAUSE' }, { type: 'SWITCH_NETWORK', network: 'Ethereum' },
      { type: 'UPDATE_DRAFT', field: 'address', value: 'bad' }, { type: 'UPDATE_DRAFT', field: 'amount', value: '0' },
      { type: 'REPORT_MISMATCH', answer: 'match' }, { type: 'INSPECT_FIELD', field: 'unknown' }, null];
    const run = (events) => {
      let engine = createCaseSession(id, variant);
      let decorated = createCaseSession(id, variant);
      for (const event of events) {
        const previous = structuredClone(decorated);
        const next = step(decorated, event);
        assert.deepEqual(decorated, previous, 'feedback must not mutate prior state');
        engine = engineStep(engine, event);
        decorated = next;
        assert.deepEqual(gameplay(decorated), engine, 'only feedback metadata may differ');
        assert.deepEqual(getCaseWalletView(decorated), getCaseWalletView(engine));
      }
      return decorated;
    };
    assert.equal(run(completedPath).phase, 'complete');
    let seed = 17 + variant;
    run(Array.from({ length: 300 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return mixed[seed % mixed.length]; }));
  }
});
