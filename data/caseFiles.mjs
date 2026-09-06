// Fictional local fixtures. No address or hash is looked up on a network.
export const CASE_FILES = Object.freeze([
  Object.freeze({ id: 'wrong-network', title: '사라진 USDC' }),
  Object.freeze({ id: 'address-mismatch', title: '닮은 주소의 함정' }),
  Object.freeze({ id: 'first-delivery', title: '첫 번째 배달' }),
]);

const CONTACTS = Object.freeze([
  { name: '귤리', emoji: '🍊', amount: '12.00', address: '0x71a800001111222233334444555566667777cafe' },
  { name: '모모', emoji: '🐱', amount: '8.50', address: '0x62b900002222333344445555666677778888beef' },
  { name: '두부', emoji: '🐸', amount: '21.25', address: '0x53c100003333444455556666777788889999dead' },
]);

export function getCaseFile(caseId, variant = 0) {
  const entry = CASE_FILES.find((candidate) => candidate.id === caseId);
  if (!entry || !Number.isSafeInteger(variant) || variant < 0) return null;
  const contact = CONTACTS[variant % CONTACTS.length];
  // Both ends match; abbreviated address matching must not solve this case.
  const recipient = caseId === 'address-mismatch'
    ? `${contact.address.slice(0, 18)}ffff${contact.address.slice(22)}`
    : contact.address;
  const delivery = caseId === 'first-delivery';
  return {
    ...entry,
    contact: { name: contact.name, emoji: contact.emoji, address: contact.address },
    network: 'Base', token: 'USDC', amount: contact.amount,
    initialNetwork: caseId === 'address-mismatch' ? 'Base' : 'Ethereum',
    initialBalance: '50.00', initialEth: '0.001000', feeEth: '0.000002',
    receipt: {
      status: 'Success', network: 'Base', token: 'USDC', amount: contact.amount,
      to: recipient, hash: `0x${String(variant % 3 + 1).repeat(64)}`,
    },
    requestMessage: delivery
      ? `내 Base 지갑으로 ${contact.amount} USDC 보내줄래? 아래 주소로 부탁해!`
      : `${contact.amount} USDC를 받았다는데 내 지갑은 0이야. 영수증을 같이 확인해 줄래?`,
    solvedMessage: caseId === 'wrong-network'
      ? '왔다ㅋㅋ Base에 이미 있던 잔액이었네! 네트워크를 다르게 보고 있었어.'
      : caseId === 'address-mismatch'
        ? '중간 글자가 다르네! 보낸 친구에게 주소를 다시 확인해 달라고 할게.'
        : '도착! 금액도 주소도 딱 맞아. 첫 배달 성공 🍊',
    takeaway: caseId === 'wrong-network'
      ? '네트워크 전환은 보는 기록을 바꿔요. 자산을 보내거나 다른 체인으로 옮기지 않아요.'
      : caseId === 'address-mismatch'
        ? '성공한 거래도 내 주소로 온 거래인지는 별개예요. 앞뒤뿐 아니라 전체 주소를 대조해요.'
        : '네트워크·토큰·전체 주소·금액을 검토하고, 완료 영수증까지 확인해요. 가스는 ETH로 따로 계산해요.',
  };
}
