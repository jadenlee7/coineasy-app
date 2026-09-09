import { CASE_FILES } from '../data/caseFiles.mjs';

export const CASE_QUEST_IDS = CASE_FILES.map((file) => file.id);

// Derived from actual engine evidence; navigation alone never completes a task.
export function getCaseQuestProgress(state) {
  if (!state || !CASE_QUEST_IDS.includes(state.caseId)) return null;
  const complete = state.phase === 'complete';
  const delivery = state.caseId === 'first-delivery';
  const transferred = state.transferCount === 1;
  const inspected = state.inspected || [];
  const evidence = state.receiptOpened && ['status', 'network', 'to'].every((key) => inspected.includes(key));
  const request = state.requestRead || inspected.includes('to') || complete;
  const evidenceInstruction = !state.receiptOpened ? '영수증을 열어 거래의 단서를 확인하세요.'
    : !inspected.includes('status') ? 'Status · 처리 상태를 눌러 성공 여부를 확인하세요.'
      : !inspected.includes('network') ? 'Network · 거래가 기록된 곳을 눌러 확인하세요.'
        : '요청 주소와 받는 주소를 모두 펼쳐 전체 주소를 비교하세요.';
  const steps = delivery ? [
    { id: 'request', label: '친구 요청 확인', done: request, tab: 'chat', instruction: '메시지에서 금액·Base·USDC를 읽고 친구의 전체 주소를 펼치세요.' },
    { id: 'send', label: '가상 전송하기', done: transferred || complete, tab: 'wallet', instruction: state.phase === 'review' ? '내용을 확인한 뒤 아래의 연습 전송 확인을 누르세요.' : '요청대로 입력하고 전송 내용 검토 → 연습 전송 확인을 누르세요.' },
    { id: 'evidence', label: '영수증 단서 3개 확인', done: evidence || complete, tab: 'receipt', instruction: evidenceInstruction },
    { id: 'finish', label: '퀘스트 완료하기', done: complete, tab: 'receipt', instruction: '단서를 모두 확인했어요. 영수증 아래의 퀘스트 완료하기를 누르세요.' },
  ] : [
    { id: 'request', label: '친구 요청 확인', done: request, tab: 'chat', instruction: '메시지를 읽고 친구의 전체 주소를 펼쳐 확인하세요.' },
    { id: 'evidence', label: '영수증 단서 3개 확인', done: evidence || complete, tab: 'receipt', instruction: evidenceInstruction },
    { id: 'finish', label: state.caseId === 'wrong-network' ? '잔액 찾고 퀘스트 완료' : '주소 판별하고 퀘스트 완료', done: complete,
      tab: state.caseId === 'wrong-network' ? 'wallet' : 'receipt',
      instruction: state.caseId === 'wrong-network' ? '지갑을 Base로 바꾸고 잔액을 확인한 뒤 퀘스트 완료하기를 누르세요.' : '두 전체 주소의 중간 글자를 비교하고 아래에서 판별을 완료하세요.' },
  ];
  const deliveryMessage = !delivery || !transferred ? null : complete
    ? '가상 전송과 영수증 확인까지 완료했어요. 완료한 기록을 다시 살펴볼 수 있어요.'
    : '가상 전송 성공! 아직 퀘스트가 끝난 건 아니에요. 영수증 확인 후 완료 버튼을 눌러주세요.';
  return { steps, current: steps.find((item) => !item.done) || null, done: steps.filter((item) => item.done).length, deliveryMessage,
    total: steps.length, readyToFinish: Boolean(evidence && (!delivery || transferred)), complete };
}

export function getCaseQuestSummary(solvedCases, justCompleted = null) {
  const solved = new Set([...solvedCases, justCompleted].filter((id) => CASE_QUEST_IDS.includes(id)));
  const remaining = CASE_QUEST_IDS.filter((id) => !solved.has(id));
  return { count: solved.size, total: CASE_QUEST_IDS.length, nextId: remaining[0] || null, allComplete: remaining.length === 0 };
}
