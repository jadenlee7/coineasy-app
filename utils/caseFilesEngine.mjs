import { getCaseFile } from '../data/caseFiles.mjs';

function cents(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function amount(value) { return (value / 100).toFixed(2); }
function notice(state, message, tone = 'info') { return { ...state, notice: { tone, message } }; }
function evidenceReady(state) {
  return state.receiptOpened && ['status', 'network', 'to'].every((field) => state.inspected.includes(field));
}
function finish(state, file) {
  return { ...state, phase: 'complete', notice: null, result: { message: file.solvedMessage, takeaway: file.takeaway } };
}

export function createCaseSession(caseId, variant = 0) {
  const file = getCaseFile(caseId, variant);
  if (!file) return null;
  return {
    caseId, variant: variant % 3,
    phase: caseId === 'first-delivery' ? 'draft' : 'investigate',
    selectedNetwork: file.initialNetwork, receiptOpened: false,
    expanded: { request: false, to: false }, inspected: [],
    draft: { network: 'Ethereum', token: 'USDC', address: '', amount: '' },
    review: null, transferCount: 0, notice: null, result: null,
  };
}

function transferError(draft, file) {
  if (draft.network !== file.network) return '친구가 요청한 네트워크는 Base예요. 지갑의 네트워크를 바꿔보세요.';
  if (draft.token !== file.token) return '친구의 요청은 USDC예요. 토큰을 다시 선택해요.';
  if (!/^0x[0-9a-fA-F]{40}$/.test(draft.address)) return '받는 주소는 0x로 시작하는 전체 주소가 필요해요.';
  if (draft.address.toLowerCase() !== file.contact.address.toLowerCase()) return '친구의 전체 주소와 달라요. 요청에 있는 주소와 대조해요.';
  const value = cents(draft.amount);
  if (value === null || value <= 0) return '0보다 큰 금액을 소수점 두 자리까지 입력해요.';
  if (value > cents(file.initialBalance)) return '연습 잔액보다 큰 금액이에요. 요청 금액을 다시 확인해요.';
  if (value !== cents(file.amount)) return `친구가 요청한 금액은 ${file.amount} USDC예요.`;
  return null;
}

export function getCaseWalletView(state) {
  const file = state && getCaseFile(state.caseId, state.variant);
  if (!file) return null;
  const onBase = state.selectedNetwork === 'Base';
  const delivered = state.transferCount === 1;
  const isDelivery = state.caseId === 'first-delivery';
  return {
    network: state.selectedNetwork,
    usdc: !onBase ? '0.00' : isDelivery
      ? amount(cents(file.initialBalance) - (delivered ? cents(file.amount) : 0))
      : state.caseId === 'wrong-network' ? file.amount : '0.00',
    eth: onBase ? (delivered ? '0.000998' : file.initialEth) : '0.000000',
    transferCount: state.transferCount,
    recipientUsdc: isDelivery && delivered ? file.amount : '0.00',
  };
}

export function transitionCaseSession(state, event) {
  const file = state && getCaseFile(state.caseId, state.variant);
  if (!file || !event || typeof event.type !== 'string' || !Array.isArray(state.inspected)
      || !state.expanded || !state.draft) return state;
  if (state.phase === 'complete' && !['OPEN_RECEIPT', 'EXPAND_ADDRESS', 'INSPECT_FIELD', 'SWITCH_NETWORK'].includes(event.type)) return state;
  const delivery = state.caseId === 'first-delivery';
  switch (event.type) {
    case 'PAUSE':
      return state.phase === 'review'
        ? notice({ ...state, phase: 'draft', review: null }, '다시 돌아왔어요. 내용을 검토한 뒤 연습 전송을 진행해요.')
        : state;
    case 'OPEN_RECEIPT':
      if (delivery && !['sent', 'complete'].includes(state.phase)) return notice(state, '연습 전송을 마치면 영수증이 생겨요.');
      return { ...state, receiptOpened: true, notice: null };
    case 'EXPAND_ADDRESS': {
      if (!['request', 'to'].includes(event.field)) return state;
      if (event.field === 'to' && !state.receiptOpened) return state;
      const expanded = { ...state.expanded, [event.field]: !state.expanded[event.field] };
      const inspected = expanded.request && expanded.to && state.receiptOpened
        ? [...new Set([...state.inspected, 'to'])] : state.inspected;
      return { ...state, expanded, inspected, notice: null };
    }
    case 'INSPECT_FIELD':
      if (!state.receiptOpened || !['status', 'network', 'to'].includes(event.field)) return state;
      if (event.field === 'to' && !(state.expanded.to && state.expanded.request)) {
        return notice(state, '요청 주소와 영수증 주소를 모두 펼쳐 전체를 대조해요.');
      }
      return { ...state, inspected: [...new Set([...state.inspected, event.field])], notice: null };
    case 'SWITCH_NETWORK': {
      if (!['Base', 'Ethereum'].includes(event.network)) return state;
      const next = { ...state, selectedNetwork: event.network, notice: null };
      if (delivery && ['draft', 'review'].includes(state.phase)) {
        return { ...next, phase: 'draft', review: null, draft: { ...state.draft, network: event.network } };
      }
      return next;
    }
    case 'RESOLVE_NETWORK':
      if (state.caseId !== 'wrong-network' || state.phase !== 'investigate') return state;
      if (!evidenceReady(state)) return notice(state, '영수증의 상태·네트워크·전체 수신주소를 먼저 확인해요.');
      if (state.selectedNetwork !== file.network) return notice(state, '영수증의 네트워크와 지갑에 표시된 네트워크를 맞춰보세요.');
      return finish(state, file);
    case 'REPORT_MISMATCH':
      if (state.caseId !== 'address-mismatch' || state.phase !== 'investigate') return state;
      if (!evidenceReady(state)) return notice(state, '상태·네트워크를 확인하고 요청과 영수증의 전체 주소를 대조해요.');
      if (event.answer !== 'mismatch') return notice(state, '앞뒤는 같지만 중간 글자가 달라요. 전체 주소를 다시 대조해요.', 'error');
      return finish(state, file);
    case 'UPDATE_DRAFT':
      if (!delivery || !['draft', 'review'].includes(state.phase) || typeof event.value !== 'string') return state;
      if (!['network', 'token', 'address', 'amount'].includes(event.field)) return state;
      if (event.value.length > (event.field === 'address' ? 64 : 20)) return state;
      if (event.field === 'network' && !['Base', 'Ethereum'].includes(event.value)) return state;
      if (event.field === 'token' && !['USDC', 'ETH'].includes(event.value)) return state;
      return { ...state, phase: 'draft', review: null, notice: null,
        selectedNetwork: event.field === 'network' ? event.value : state.selectedNetwork,
        draft: { ...state.draft, [event.field]: event.value } };
    case 'REVIEW_TRANSFER': {
      if (!delivery || state.phase !== 'draft') return state;
      const error = transferError(state.draft, file);
      if (error) return notice(state, error, 'error');
      return { ...state, phase: 'review', review: { ...state.draft }, notice: null };
    }
    case 'CONFIRM_TRANSFER': {
      if (!delivery || state.phase !== 'review' || state.transferCount !== 0 || !state.review) return state;
      if (transferError(state.draft, file) || ['network', 'token', 'address', 'amount'].some((key) => state.review[key] !== state.draft[key])) {
        return notice({ ...state, phase: 'draft', review: null }, '내용이 바뀌었어요. 다시 검토해요.', 'error');
      }
      return notice({ ...state, phase: 'sent', transferCount: 1, review: null,
        receiptOpened: false, inspected: [], expanded: { ...state.expanded, to: false } },
      '가상 USDC가 도착했어요! 영수증의 상태·네트워크·받는 주소까지 확인해요.', 'success');
    }
    case 'COMPLETE_DELIVERY':
      if (!delivery || state.phase !== 'sent' || state.transferCount !== 1) return state;
      if (!evidenceReady(state)) return notice(state, '완료 영수증에서 상태·네트워크·전체 수신주소를 확인해요.');
      return finish(state, file);
    default:
      return state;
  }
}
