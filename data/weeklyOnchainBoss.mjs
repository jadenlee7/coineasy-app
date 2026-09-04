export const WEEKLY_ONCHAIN_BOSS_W0_VERSION = 1;

// Activation stays fail-closed until the Build 112 founder smoke, five-person
// beginner playtest, and owner approvals are recorded.
export const WEEKLY_ONCHAIN_BOSS_W0_ENABLED = false;

export const WEEKLY_ONCHAIN_BOSS_W0 = Object.freeze({
  accent: '#6E4AFF',
  eyebrow: 'BASE SAFETY RAID · W0 OFFLINE',
  id: 'base-safety-raid-w0',
  subtitle: '고정 훈련 화면에서 네 가지 안전 신호를 찾아 보스를 막아라',
  title: 'Weekly Onchain Boss',
  acts: Object.freeze([
    Object.freeze({
      id: 'ready-check',
      eyebrow: 'ACT 1 · READY CHECK',
      title: '출발 전 신원 확인',
      prompt: '이 훈련 화면에서 계속 확인해도 되는 조합을 고르세요.',
      scene: 'identity',
      fields: Object.freeze([
        Object.freeze({ id: 'account', label: 'Training account', value: 'EasyGo Rookie #07' }),
        Object.freeze({ id: 'network', label: 'Network', value: 'Base' }),
        Object.freeze({ id: 'chain', label: 'Chain ID', value: '8453' }),
        Object.freeze({ id: 'address', label: 'Public address', value: '0xB453…07A1' }),
      ]),
      choices: Object.freeze([
        Object.freeze({
          id: 'base-public-only',
          label: 'Base · 8453 · 공개 주소만 대조',
          correct: true,
        }),
        Object.freeze({
          id: 'secret-recovery',
          label: '복구 문구까지 받아서 계정 확인',
          correct: false,
        }),
      ]),
      success: 'READY! 네트워크와 chain ID, 공개 주소만 확인하면 돼요.',
      retry: '복구 문구와 개인키는 확인 자료가 아니에요. 절대 요청하거나 공유하지 마세요.',
    }),
    Object.freeze({
      id: 'receipt-trail',
      eyebrow: 'ACT 2 · RECEIPT TRAIL',
      title: '영수증의 어긋난 단서',
      prompt: '완료 영수증이지만 받는 사람과 맞지 않는 필드를 찾으세요.',
      scene: 'receipt',
      reference: '예상한 받는 주소 끝자리 · CAFE',
      fields: Object.freeze([
        Object.freeze({ id: 'status', label: 'Status', value: 'Success' }),
        Object.freeze({ id: 'network', label: 'Network', value: 'Base' }),
        Object.freeze({ id: 'to', label: 'To', value: '0x91A8…BEEF' }),
        Object.freeze({ id: 'confirmations', label: 'Confirmations', value: '128' }),
      ]),
      choices: Object.freeze([
        Object.freeze({ id: 'status', label: 'Status', correct: false }),
        Object.freeze({ id: 'network', label: 'Network', correct: false }),
        Object.freeze({ id: 'to', label: 'To', correct: true }),
        Object.freeze({ id: 'confirmations', label: 'Confirmations', correct: false }),
      ]),
      success: 'TRAIL FOUND! Success여도 To가 예상 주소와 다르면 멈춰야 해요.',
      retry: '그 필드는 정상이에요. 예상한 받는 주소와 영수증의 To를 직접 대조하세요.',
    }),
    Object.freeze({
      id: 'scam-ambush',
      eyebrow: 'ACT 3 · SCAM AMBUSH',
      title: '가짜 지원팀의 기습',
      prompt: '완료 직후 도착한 이 메시지에 가장 안전한 첫 대응은?',
      scene: 'message',
      sender: 'EasyGo_Help_8453 · 연습 발신자',
      message: '방금 거래에 문제가 생겼습니다. 3분 안에 복구 문구를 입력하면 되돌려 드립니다.',
      choices: Object.freeze([
        Object.freeze({
          id: 'leave-and-verify',
          label: '대화를 끝내고 앱의 공식 지원 화면에서 확인',
          correct: true,
        }),
        Object.freeze({
          id: 'follow-urgent-request',
          label: '시간 안에 복구 문구를 입력',
          correct: false,
        }),
      ]),
      success: 'AMBUSH BLOCKED! 긴급함과 비밀정보 요구가 함께 나오면 즉시 멈춰요.',
      retry: '운영팀도 복구 문구나 개인키를 요구하지 않아요. 대화를 끝내고 공식 화면을 직접 여세요.',
    }),
    Object.freeze({
      id: 'quote-shield',
      eyebrow: 'ACT 4 · QUOTE SHIELD',
      title: '마지막 안전 결정',
      prompt: '이 고정 연습 견적을 본 뒤 선택할 마지막 행동은?',
      scene: 'quote',
      fields: Object.freeze([
        Object.freeze({ id: 'pay', label: 'Pay', value: '50.00 USDC' }),
        Object.freeze({ id: 'expected', label: 'Expected', value: '0.0205 ETH' }),
        Object.freeze({ id: 'minimum', label: 'Minimum', value: '0.0188 ETH' }),
        Object.freeze({ id: 'fee', label: 'Fee', value: '$0.08' }),
        Object.freeze({ id: 'impact', label: 'Price impact', value: '7.9%' }),
        Object.freeze({ id: 'expires', label: 'Expires', value: '00:00' }),
      ]),
      choices: Object.freeze([
        Object.freeze({
          id: 'stop-and-recheck',
          label: '멈추고 다시 확인',
          correct: true,
        }),
        Object.freeze({
          id: 'trust-expected-only',
          label: '예상 수령액만 보고 안전하다고 판단',
          correct: false,
        }),
      ]),
      success: 'SHIELD LOCK! 만료와 큰 가격 영향을 봤다면 멈추고 새 조건을 다시 확인해요.',
      retry: 'Expected만으로는 안전을 판단할 수 없어요. 만료·영향·Minimum을 함께 확인하세요.',
    }),
  ]),
});

export function getWeeklyOnchainBossAct(actId) {
  return WEEKLY_ONCHAIN_BOSS_W0.acts.find((act) => act.id === actId) || null;
}
