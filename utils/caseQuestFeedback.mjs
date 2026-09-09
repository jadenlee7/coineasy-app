import { getCaseFile } from '../data/caseFiles.mjs';
import { getCaseWalletView, transitionCaseSession } from './caseFilesEngine.mjs';

// Feedback describes a real local state change; it never awards currency,
// adds evidence, advances a quest, or delays the player's next action.
export function getCaseActionFeedback(before, after) {
  if (!before || !after || before === after || before.phase === 'complete' || after.phase === 'complete') return null;
  const file = getCaseFile(after.caseId, after.variant);
  if (!file) return null;
  if (after.notice && after.notice !== before.notice && after.notice.tone !== 'success') {
    return { tone: 'retry', title: '여기만 다시 확인해요', message: after.notice.message };
  }
  if (after.transferCount > before.transferCount) {
    return { tone: 'success', title: '가상 전송 성공!', message: file.amount + ' USDC 도착 · 영수증 확인이 남았어요' };
  }
  if (after.phase === 'review' && before.phase !== 'review') {
    return { tone: 'success', title: '전송 전 점검 통과!', message: '네트워크·토큰·주소·금액 일치 · 아직 보내지 않았어요' };
  }
  const added = after.inspected.filter((field) => !before.inspected.includes(field));
  if (added.length) {
    const names = { status: '처리 상태 확인!', network: '네트워크 확인!', to: '전체 주소 대조!' };
    return { tone: 'success', title: names[added[0]], message: '단서 ' + after.inspected.length + '/3 확보' + (after.inspected.length === 3 ? ' · 이제 마지막 판단을 해보세요' : ' · 다음 단서를 찾아요') };
  }
  if (after.requestRead && !before.requestRead) {
    return { tone: 'success', title: '친구 요청 확인!', message: file.amount + ' USDC · ' + file.network + ' · 전체 주소 확인' };
  }
  if (before.selectedNetwork !== after.selectedNetwork) {
    const wallet = getCaseWalletView(after);
    return { tone: wallet.usdc === '0.00' ? 'info' : 'success',
      title: wallet.usdc === '0.00' ? after.selectedNetwork + ' 잔액은 0 USDC' : after.selectedNetwork + '에서 ' + wallet.usdc + ' USDC 발견!',
      message: '표시 네트워크만 변경 · 자산을 옮기지는 않았어요' };
  }
  return null;
}

export function transitionCaseQuest(state, event) {
  const next = transitionCaseSession(state, event);
  const feedback = getCaseActionFeedback(state, next);
  if (feedback) return { ...next, feedback: { ...feedback, revision: (state.feedback?.revision || 0) + 1 } };
  // Remove stale praise when editing or pausing a reviewed draft. Pure repeats
  // do not generate another positive signal or another completion stamp.
  if (next !== state && state?.feedback && (event?.type === 'UPDATE_DRAFT' || event?.type === 'PAUSE' || (state.phase === 'review' && next.phase !== 'review'))) return { ...next, feedback: null };
  return next;
}
