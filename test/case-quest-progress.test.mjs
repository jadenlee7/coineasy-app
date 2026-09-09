import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getCaseFile } from '../data/caseFiles.mjs';
import { createCaseSession, transitionCaseSession as step } from '../utils/caseFilesEngine.mjs';
import { CASE_QUEST_IDS, getCaseQuestProgress as progress, getCaseQuestSummary as summary } from '../utils/caseQuestProgress.mjs';

function evidence(state) {
  state = step(state, { type: 'OPEN_RECEIPT' });
  for (const field of ['status', 'network']) state = step(state, { type: 'INSPECT_FIELD', field });
  for (const field of ['request', 'to']) if (!state.expanded[field]) state = step(state, { type: 'EXPAND_ADDRESS', field });
  return state;
}

test('quest guidance is evidence-driven, points to the next missing clue and keeps read requests checked', () => {
  let state = createCaseSession('wrong-network');
  assert.equal(progress(state).current.id, 'request');
  assert.equal(progress(state).readyToFinish, false);
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'request' });
  state = step(state, { type: 'EXPAND_ADDRESS', field: 'request' });
  assert.equal(progress(state).steps[0].done, true);
  assert.equal(progress(state).current.tab, 'receipt');
  state = step(state, { type: 'OPEN_RECEIPT' });
  assert.match(progress(state).current.instruction, /Status/);
  state = step(state, { type: 'INSPECT_FIELD', field: 'status' });
  assert.match(progress(state).current.instruction, /Network/);
  state = step(state, { type: 'INSPECT_FIELD', field: 'network' });
  assert.match(progress(state).current.instruction, /전체 주소/);
  assert.equal(progress(state).readyToFinish, false);
  state = evidence(state);
  assert.equal(progress(state).current.tab, 'wallet');
  assert.equal(progress(state).readyToFinish, true);
  assert.equal(progress(step(state, { type: 'RESOLVE_NETWORK' })).complete, false);
  state = step(state, { type: 'SWITCH_NETWORK', network: 'Base' });
  state = step(state, { type: 'RESOLVE_NETWORK' });
  assert.equal(progress(state).done, progress(state).total);
  assert.equal(progress(state).current, null);
});

test('all three cases and authored variants can reach an explicit quest end', () => {
  for (const id of CASE_QUEST_IDS) for (let variant = 0; variant < 3; variant++) {
    let state = createCaseSession(id, variant);
    state = step(state, { type: 'EXPAND_ADDRESS', field: 'request' });
    if (id === 'first-delivery') {
      const file = getCaseFile(id, variant);
      for (const [field, value] of Object.entries({ network: 'Base', token: 'USDC', address: file.contact.address, amount: file.amount })) state = step(state, { type: 'UPDATE_DRAFT', field, value });
      state = step(state, { type: 'REVIEW_TRANSFER' });
      assert.equal(progress(state).current.id, 'send');
      state = step(state, { type: 'CONFIRM_TRANSFER' });
      assert.equal(progress(state).current.id, 'evidence');
      assert.equal(progress(state).readyToFinish, false, 'sending is not quest completion');
      state = evidence(state);
      assert.equal(progress(state).current.id, 'finish');
      state = step(state, { type: 'COMPLETE_DELIVERY' });
    } else {
      state = evidence(state);
      if (id === 'wrong-network') {
        state = step(state, { type: 'SWITCH_NETWORK', network: 'Base' });
        state = step(state, { type: 'RESOLVE_NETWORK' });
      } else {
        const wrong = step(state, { type: 'REPORT_MISMATCH', answer: 'match' });
        assert.equal(progress(wrong).complete, false);
        state = step(state, { type: 'REPORT_MISMATCH', answer: 'mismatch' });
      }
    }
    assert.equal(progress(state).complete, true);
    assert.equal(progress(state).done, progress(state).total);
    assert.equal(state.transferCount, id === 'first-delivery' ? 1 : 0);
  }
});

test('quest summary never cycles to the first case and replay cannot duplicate a stamp', () => {
  const solved = [];
  for (const id of CASE_QUEST_IDS) {
    assert.equal(summary(solved).nextId, id);
    solved.push(id);
  }
  assert.deepEqual(summary(solved), { count: 3, total: 3, nextId: null, allComplete: true });
  assert.deepEqual(summary([...solved, ...solved, 'unknown']), summary(solved));
  assert.equal(summary(['first-delivery'], 'address-mismatch').nextId, 'wrong-network');
  assert.equal(summary([], 'wrong-network').count, 1, 'completion screen does not wait for the stamp effect');
  assert.equal(summary([]).count, 0, 'fresh navigation session has no prior stamps');
  assert.equal(progress(null), null);
  assert.equal(progress({ caseId: 'unknown' }), null);
});

test('completed delivery remains complete when the player revisits the receipt and wallet', () => {
  for (let variant = 0; variant < 3; variant++) {
    let state = createCaseSession('first-delivery', variant);
    const file = getCaseFile(state.caseId, variant);
    assert.equal(progress(state).deliveryMessage, null);
    for (const [field, value] of Object.entries({ network: 'Base', token: 'USDC', address: file.contact.address, amount: file.amount })) state = step(state, { type: 'UPDATE_DRAFT', field, value });
    state = step(state, { type: 'REVIEW_TRANSFER' });
    assert.equal(progress(state).deliveryMessage, null);
    state = step(state, { type: 'CONFIRM_TRANSFER' });
    assert.match(progress(state).deliveryMessage, /아직 퀘스트가 끝난 건 아니에요/);
    state = evidence(state);
    assert.match(progress(state).deliveryMessage, /완료 버튼/);
    state = step(state, { type: 'COMPLETE_DELIVERY' });
    for (const event of [{ type: 'OPEN_RECEIPT' }, { type: 'SWITCH_NETWORK', network: 'Ethereum' }, { type: 'SWITCH_NETWORK', network: 'Base' }]) {
      state = step(state, event);
      assert.equal(progress(state).complete, true);
      assert.match(progress(state).deliveryMessage, /영수증 확인까지 완료했어요/);
      assert.doesNotMatch(progress(state).deliveryMessage, /아직|완료 버튼/);
      assert.equal(state.transferCount, 1);
    }
  }
  const screen = readFileSync(new URL('../screens/CaseFiles.js', import.meta.url), 'utf8');
  assert.match(screen, /deliveryMessage=\{progress.deliveryMessage\}/);
  assert.match(screen, /style=\{styles.successBody\}>\{deliveryMessage\}/);
});

test('provider marks are original bundled assets and completion has a dedicated branch', () => {
  for (const [name, sha] of [
    ['Base_square_blue.png', '0349f32fd13e2208c503ca25e427c80ebbd2699ae789edad9a00913450c14a3d'],
    ['USDC Token @192w.png', 'ef1ff6b785b4b656ac70a1b1c09ef52ca31c67f76966fe75040f3bd831b5a64d'],
    ['ethereum-diamond-black.png', '836339466e52821ec7c7b2088e30a87af27b23f5557d00178e7052a711857352'],
  ]) {
    const bytes = readFileSync(new URL('../assets/brands/' + name, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
  }
  const screen = readFileSync(new URL('../screens/CaseFiles.js', import.meta.url), 'utf8');
  assert.match(screen, /solved && !reviewEvidence/);
  assert.match(screen, /퀘스트 3개 모두 완료/);
  assert.match(screen, /연습 마치기/);
  assert.doesNotMatch(screen, /% ids.length/);
  const marks = readFileSync(new URL('../components/PracticeBrand.js', import.meta.url), 'utf8');
  assert.doesNotMatch(marks, /tintColor|https?:|uri:/);
});

test('CoinEasy quest branding uses the exact Figma orange and existing app fonts', () => {
  const orange = readFileSync(new URL('../assets/easygo/quest-orange.png', import.meta.url));
  assert.equal(createHash('sha256').update(orange).digest('hex'), 'adeb650af68f4d603de108906fbfe8c5171114683c0d01a962ff630dbadead7d');
  const screen = readFileSync(new URL('../screens/CaseFiles.js', import.meta.url), 'utf8');
  assert.match(screen, /require\('\.\.\/assets\/easygo\/quest-orange.png'\)/);
  assert.match(screen, /GmarketBold/);
  assert.match(screen, /GmarketMedium/);
  assert.match(screen, /flat.fontFamily \? \{\}/, 'keep address monospace intact');
  assert.match(screen, /COINEASY QUEST CLUB/);
  assert.doesNotMatch(screen, /localhost:3845|api\/mcp\/asset/);
});
