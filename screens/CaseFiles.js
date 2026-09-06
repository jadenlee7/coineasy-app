import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getCaseFile } from '../data/caseFiles.mjs';
import { createCaseSession, getCaseWalletView, transitionCaseSession } from '../utils/caseFilesEngine.mjs';

const COLORS = { ink: '#1D211F', muted: '#65716A', paper: '#FFF9F1', orange: '#FF6813', navy: '#13253F', blue: '#2358D7', green: '#167650' };
const CASE_ART = {
  'wrong-network': { emoji: '🕵️', accent: '#2358D7', label: 'THE MISSING USDC', title: '사라진 USDC', description: '보냈다는데 지갑은 0? 거래내역을 따라 숨어 있는 잔액을 찾아요.', difficulty: '안내와 함께 · 60초' },
  'address-mismatch': { emoji: '👀', accent: '#8D4288', label: 'THE LOOK-ALIKE', title: '닮은 주소의 함정', description: '앞뒤가 같아도 같은 주소일까요? 친구의 요청과 영수증을 대조해요.', difficulty: '스스로 수사 · 90초' },
  'first-delivery': { emoji: '📦', accent: '#CB5000', label: 'SPECIAL DELIVERY', title: '첫 번째 배달', description: '토큰부터 받는 주소까지 직접 설정하고 가상 USDC를 전달해요.', difficulty: '직접 조작 · 90초' },
};

function tap() {
  try { Promise.resolve(Haptics.selectionAsync()).catch(() => {}); } catch { /* Haptics is optional. */ }
}

function Button({ children, onPress, secondary = false, disabled = false, icon, dark = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, dark && styles.buttonDark, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{children}</Text>
      {icon ? <Ionicons name={icon} size={19} color={secondary ? COLORS.ink : '#FFF'} /> : null}
    </TouchableOpacity>
  );
}

function Chip({ children, selected, onPress, dark = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, dark && styles.chipDark, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, dark && styles.lightText, selected && styles.chipSelectedText]}>{children}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={15} color="#FFF" /> : null}
    </TouchableOpacity>
  );
}

function Address({ label, value, expanded, onToggle, dark = false }) {
  const shortAddress = typeof value === 'string' ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${expanded ? value : shortAddress}, ${expanded ? '접기' : '전체 주소 보기'}`}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={[styles.address, dark && styles.addressDark]}
    >
      <View style={styles.rowBetween}>
        <Text style={[styles.fieldLabel, dark && styles.darkMuted]}>{label}</Text>
        <Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={18} color={dark ? '#B2C9EB' : COLORS.blue} />
      </View>
      <Text selectable={expanded} style={[styles.addressText, dark && styles.lightText]}>{expanded ? value : shortAddress}</Text>
      <Text style={[styles.smallLink, dark && styles.darkMuted]}>{expanded ? '전체 주소 · 탭하여 접기' : '전체 주소 확인하기'}</Text>
    </TouchableOpacity>
  );
}

function Bubble({ children, mine = false }) {
  return <View style={[styles.bubble, mine && styles.bubbleMine]}><Text style={[styles.bubbleText, mine && styles.bubbleMineText]}>{children}</Text></View>;
}

function Field({ label, value, onChangeText, numeric = false, placeholder }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        maxLength={numeric ? 16 : 64}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#828C93"
        style={[styles.input, !numeric && styles.addressInput]}
        value={value}
      />
    </View>
  );
}

function Catalog({ solvedCases, onSelect }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>EASYGO DETECTIVE CLUB</Text>
          <Text style={styles.heroEmoji}>🍊</Text>
        </View>
        <Text style={styles.heroTitle}>단서를 누르면,{`\n`}사건이 풀린다.</Text>
        <Text style={styles.heroBody}>친구의 DM에서 시작해 지갑과 영수증까지.{`\n`}이번엔 직접 움직여 볼 차례예요.</Text>
        <View accessibilityLabel={`${solvedCases.length}개 사건 해결`} style={styles.notebook}>
          {Object.keys(CASE_ART).map((id, index) => (
            <View key={id} style={[styles.stamp, solvedCases.includes(id) && styles.stampSolved]}>
              <Text style={[styles.stampText, solvedCases.includes(id) && styles.stampSolvedText]}>
                {solvedCases.includes(id) ? '✓' : '○'} FILE 0{index + 1}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.sectionTitle}>오늘의 사건 수첩</Text>
      {Object.entries(CASE_ART).map(([id, art], index) => (
        <TouchableOpacity key={id} accessibilityRole="button" activeOpacity={0.85} onPress={() => onSelect(id)} style={styles.catalogCard}>
          <View style={styles.catalogCardTop}>
            <View style={[styles.catalogIcon, { backgroundColor: `${art.accent}12` }]}><Text style={styles.catalogEmoji}>{art.emoji}</Text></View>
            <View style={styles.flex}>
              <Text style={[styles.catalogKicker, { color: art.accent }]}>CASE FILE 0{index + 1}</Text>
              <Text style={styles.catalogTitle}>{art.title}</Text>
            </View>
          </View>
          <Text style={styles.catalogBody}>{art.description}</Text>
          <View style={styles.catalogFooter}>
            <Text style={styles.catalogMeta}>{art.difficulty}</Text>
            <Text style={[styles.catalogCTA, { color: art.accent }]}>{solvedCases.includes(id) ? '다른 단서로 재도전' : '사건 열기'} →</Text>
          </View>
        </TouchableOpacity>
      ))}
      <Text style={styles.footnote}>수집한 도장은 이 화면을 나갈 때 초기화돼요.</Text>
    </ScrollView>
  );
}

function Tabs({ activeTab, onChange }) {
  return (
    <View style={styles.tabs}>
      {[['chat', '메시지', 'chatbubbles-outline'], ['wallet', '연습 지갑', 'wallet-outline'], ['receipt', '영수증', 'receipt-outline']].map(([id, label, icon]) => (
        <TouchableOpacity
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === id }}
          onPress={() => onChange(id)}
          style={[styles.tab, activeTab === id && styles.tabSelected]}
        >
          <Ionicons name={icon} size={18} color={activeTab === id ? '#FFF' : COLORS.muted} />
          <Text style={[styles.tabText, activeTab === id && styles.tabSelectedText]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ChatPane({ scene, expanded, onExpand, onOpenWallet, solved, resultText }) {
  return (
    <View style={styles.pane}>
      <View style={styles.paneHeader}>
        <Text style={styles.contactEmoji}>{scene.contactEmoji}</Text>
        <View style={styles.flex}>
          <Text style={styles.contactName}>{scene.contactName}</Text>
          <Text style={styles.contactMeta}>사건 속 친구 · 연습 대화</Text>
        </View>
        <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.green} />
      </View>
      <View style={styles.chatBody}>
        <Text style={styles.dayLabel}>오늘의 사건</Text>
        <Bubble>{scene.openingText}</Bubble>
        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>{scene.caseId === 'first-delivery' ? '📦 친구의 요청' : '📌 대조할 친구 지갑'}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.requestAmount}>{scene.expectedAmount} USDC</Text>
            <Text style={styles.fieldLabel}>{scene.expectedNetwork}</Text>
          </View>
          <Address label={`${scene.contactName}의 주소`} value={scene.expectedAddress} expanded={expanded} onToggle={onExpand} />
        </View>
        <Bubble mine>{solved ? '단서 확인 완료! 이제 알겠어 😎' : '잠깐, 내가 직접 확인해 볼게 🔎'}</Bubble>
        {solved ? <Bubble>{resultText}</Bubble> : (
          <Button icon="arrow-forward" onPress={onOpenWallet}>{scene.caseId === 'first-delivery' ? '연습 지갑에서 준비하기' : '지갑 거래내역 살펴보기'}</Button>
        )}
      </View>
    </View>
  );
}

function WalletHeader({ name }) {
  return (
    <View style={styles.paneHeader}>
      <View style={styles.explorerLogo}><Ionicons name="wallet" size={18} color="#FFF" /></View>
      <View style={styles.flex}>
        <Text style={styles.contactName}>{name}</Text>
        <Text style={styles.contactMeta}>Practice Wallet · 가상 자산</Text>
      </View>
    </View>
  );
}

function WalletBalance({ balance }) {
  return (
    <>
      <View><Text style={styles.fieldLabel}>선택한 네트워크의 잔액</Text><Text style={styles.walletBalance}>{balance} <Text style={styles.walletUnit}>USDC</Text></Text></View>
      <View style={styles.tokenRow}>
        <View style={styles.tokenIcon}><Text style={styles.tokenIconText}>$</Text></View>
        <View style={styles.flex}><Text style={styles.tokenName}>USDC</Text><Text style={styles.transactionMeta}>연습용 토큰</Text></View>
        <Text style={styles.tokenBalance}>{balance}</Text>
      </View>
    </>
  );
}

function InvestigationWallet({ scene, network, balance, onNetwork, onOpenReceipt, onVerify, solved }) {
  return (
    <View style={styles.pane}>
      <WalletHeader name={`${scene.contactName}의 연습 지갑`} />
      <View style={styles.paneBody}>
        <Text style={styles.fieldLabel}>표시 네트워크</Text>
        <View style={styles.row}>{scene.networks.map((item) => <Chip key={item} selected={network === item} onPress={() => onNetwork(item)}>{item}</Chip>)}</View>
        <WalletBalance balance={balance} />
        <View style={styles.rowBetween}><Text style={styles.requestTitle}>공유받은 거래내역</Text><Text style={styles.fieldLabel}>1건</Text></View>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenReceipt} style={styles.transaction}>
          <View style={styles.transactionIcon}><Ionicons name="arrow-down" size={22} color={COLORS.green} /></View>
          <View style={styles.flex}><Text style={styles.transactionTitle}>USDC 전송 영수증</Text><Text style={styles.transactionMeta}>상세 내역 확인하기</Text></View>
          <Text style={styles.tokenName}>{scene.receipt.amount}</Text><Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </TouchableOpacity>
        {scene.caseId === 'wrong-network' && !solved ? <Button icon="checkmark-circle-outline" onPress={onVerify}>이 지갑에서 입금 확인</Button> : null}
        {scene.caseId === 'address-mismatch' && !solved ? <Button secondary icon="receipt-outline" onPress={onOpenReceipt}>영수증의 받는 주소 확인</Button> : null}
        <Text style={styles.footnote}>네트워크를 바꾸면 표시할 잔액만 달라져요.</Text>
      </View>
    </View>
  );
}

function ReceiptPane({ scene, receipt, expanded, onExpand, requestExpanded, onExpandRequest, inspected, onInspect, onClassify, onWallet, onCompleteDelivery, solved }) {
  if (!receipt) {
    return (
      <View style={styles.pane}><View style={styles.paneBody}>
        <Text style={styles.heroEmoji}>🧾</Text><Text style={styles.sectionTitle}>아직 영수증이 없어요</Text>
        <Text style={styles.objective}>연습 지갑에서 전송을 완료하면 이곳에서 결과를 확인할 수 있어요.</Text>
        <Button onPress={onWallet}>연습 지갑 열기</Button>
      </View></View>
    );
  }
  return (
    <View style={[styles.pane, styles.explorer]}>
      <View style={styles.explorerTop}>
        <View style={styles.rowBetween}>
          <View style={styles.row}><View style={styles.explorerLogo}><Ionicons name="cube" size={19} color="#FFF" /></View><Text style={styles.explorerTitle}>EasyGo Explorer</Text></View>
          <View style={styles.statusPill}><Text style={styles.statusText}>연습 영수증</Text></View>
        </View>
        <Text style={styles.darkMuted}>Transaction details</Text>
        <Text style={styles.hash}>{receipt.hash}</Text>
      </View>
      <View style={styles.paneBody}>
        <TouchableOpacity accessibilityRole="button" onPress={() => onInspect('status')} style={styles.receiptRow}>
          <View style={styles.rowBetween}><Text style={styles.darkMuted}>Status · 처리 상태</Text><Ionicons name={inspected.includes('status') ? 'checkmark-circle' : 'information-circle-outline'} size={19} color="#91B7EB" /></View>
          <Text style={[styles.receiptValue, styles.statusGood]}>✓ {receipt.status}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => onInspect('network')} style={styles.receiptRow}>
          <View style={styles.rowBetween}><Text style={styles.darkMuted}>Network · 거래가 기록된 곳</Text><Ionicons name={inspected.includes('network') ? 'checkmark-circle' : 'information-circle-outline'} size={19} color="#91B7EB" /></View>
          <Text style={styles.receiptValue}>{receipt.network}</Text>
        </TouchableOpacity>
        <View style={styles.receiptRow}><Text style={styles.darkMuted}>Amount · 전송량</Text><Text style={styles.receiptValue}>{receipt.amount} {receipt.token}</Text></View>
        <Address dark label={`${scene.contactName}의 요청 주소`} value={scene.expectedAddress} expanded={requestExpanded} onToggle={onExpandRequest} />
        <Address dark label="To · 받는 전체 주소" value={receipt.to} expanded={expanded} onToggle={onExpand} />
        <Text style={[styles.footnote, styles.darkMuted]}>파란 항목을 눌러 단서를 확인해 보세요.</Text>
        {!solved && scene.caseId === 'first-delivery' ? (
          <Button dark icon="checkmark-circle-outline" onPress={onCompleteDelivery}>영수증 확인 완료</Button>
        ) : !solved && scene.caseId === 'address-mismatch' ? (
          <>
            <Button dark onPress={() => onClassify('mismatch')}>친구 주소와 달라요</Button>
            <Button secondary onPress={() => onClassify('match')}>같은 주소가 맞아요</Button>
          </>
        ) : <Button dark icon="wallet-outline" onPress={onWallet}>지갑에서 결과 확인</Button>}
      </View>
    </View>
  );
}

function DeliveryWallet({ scene, draft, review, balance, eth, recipientBalance, onEdit, onFillAddress, onReview, onConfirm, onCancelReview, onOpenReceipt, sent }) {
  return (
    <View style={styles.pane}>
      <WalletHeader name="내 연습 지갑" />
      <View style={styles.paneBody}>
        <WalletBalance balance={balance} />
        <Text style={styles.fieldLabel}>가상 가스 잔액 · {eth} ETH</Text>
        {sent ? (
          <>
            <View style={styles.requestCard}><Text style={styles.requestTitle}>{scene.contactEmoji} {scene.contactName}의 Base 연습 지갑</Text><Text style={styles.requestAmount}>{recipientBalance} USDC</Text><Text style={styles.successBody}>📦 배달 완료! 새 영수증에서 한 번 더 확인해요.</Text></View>
            <Button onPress={onOpenReceipt} icon="receipt-outline">전송 영수증 열기</Button>
          </>
        ) : review ? (
          <View style={styles.review}>
            <Text style={styles.reviewTitle}>보내기 전, 한 번 더</Text>
            <View style={styles.rowBetween}><Text style={styles.fieldLabel}>보낼 금액</Text><Text style={styles.reviewValue}>{review.amount} {review.token}</Text></View>
            <View style={styles.rowBetween}><Text style={styles.fieldLabel}>네트워크</Text><Text style={styles.reviewValue}>{review.network}</Text></View>
            <Text style={styles.fieldLabel}>받는 주소 전체</Text><Text style={styles.addressText}>{review.address}</Text>
            <View style={styles.rowBetween}><Text style={styles.fieldLabel}>연습용 가스</Text><Text style={styles.reviewValue}>{scene.feeEth} ETH</Text></View>
            <Text style={styles.footnote}>이 연습에서만 잔액과 거래내역이 바뀝니다.</Text>
            <Button icon="paper-plane-outline" onPress={onConfirm}>연습 전송 확인</Button>
            <Button secondary onPress={onCancelReview}>수정하기</Button>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>친구에게 보내기</Text>
            <Text style={styles.fieldLabel}>토큰</Text>
            <View style={styles.row}>{['USDC', 'ETH'].map((item) => <Chip key={item} selected={draft.token === item} onPress={() => onEdit('token', item)}>{item}</Chip>)}</View>
            <Text style={styles.fieldLabel}>네트워크</Text>
            <View style={styles.row}>{scene.networks.map((item) => <Chip key={item} selected={draft.network === item} onPress={() => onEdit('network', item)}>{item}</Chip>)}</View>
            <Field label="받는 주소" value={draft.address} onChangeText={(value) => onEdit('address', value)} placeholder="0x… 전체 주소 입력" />
            <Button secondary icon="download-outline" onPress={onFillAddress}>친구 요청의 주소 가져오기</Button>
            <Field numeric label="보낼 금액" value={draft.amount} onChangeText={(value) => onEdit('amount', value)} placeholder="0.00" />
            <Button icon="arrow-forward" onPress={onReview}>전송 내용 검토</Button>
          </>
        )}
      </View>
    </View>
  );
}

function Result({ title, response, explanation, onNext, onReplay, onLayout }) {
  return (
    <View accessibilityLiveRegion="polite" onLayout={onLayout} style={styles.success}>
      <View style={styles.rowBetween}><Text style={styles.successKicker}>CASE CLOSED · 도장 획득</Text><Text style={styles.successEmoji}>🍊</Text></View>
      <Text style={styles.successTitle}>{title}</Text>
      <Bubble>{response}</Bubble>
      <Text style={styles.successBody}>{explanation}</Text>
      <Button icon="arrow-forward" onPress={onNext}>다음 사건 열기</Button>
      <Button secondary icon="refresh" onPress={onReplay}>바뀐 단서로 다시 도전</Button>
    </View>
  );
}

export default function CaseFiles({ navigation }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [solvedCases, setSolvedCases] = useState([]);
  const [hintOpen, setHintOpen] = useState(false);
  const variants = useRef({});
  const appState = useRef(AppState.currentState || 'active');
  const scroll = useRef(null);
  const fixture = session ? getCaseFile(session.caseId, session.variant) : null;
  const wallet = session ? getCaseWalletView(session) : null;
  const solved = session?.phase === 'complete';
  const sent = session?.phase === 'sent' || solved;
  const scene = fixture ? {
    caseId: fixture.id,
    contactName: fixture.contact.name,
    contactEmoji: fixture.contact.emoji,
    expectedAddress: fixture.contact.address,
    expectedAmount: fixture.amount,
    expectedNetwork: fixture.network,
    openingText: fixture.requestMessage,
    networks: ['Base', 'Ethereum'],
    receipt: fixture.receipt,
    feeEth: fixture.feeEth,
  } : null;

  const dispatch = useCallback((event) => {
    if (appState.current !== 'active') return;
    tap();
    setSession((current) => current ? transitionCaseSession(current, event) : current);
  }, []);

  const toCatalog = useCallback(() => {
    setSession(null);
    setActiveTab('chat');
    setHintOpen(false);
  }, []);

  const start = useCallback((caseId) => {
    tap();
    const variant = variants.current[caseId] || 0;
    variants.current[caseId] = variant + 1;
    setSession(createCaseSession(caseId, variant));
    setActiveTab('chat');
    setHintOpen(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const close = useCallback(() => {
    toCatalog();
    setSolvedCases([]);
    variants.current = {};
    navigation?.goBack();
  }, [navigation, toCatalog]);

  const openTab = useCallback((tab) => {
    if (appState.current !== 'active' || tab === activeTab) return;
    // Leaving a transfer review requires a fresh review before it can be confirmed.
    tap();
    setSession((current) => {
      if (!current) return current;
      const paused = transitionCaseSession(current, { type: 'PAUSE' });
      return tab === 'receipt' ? transitionCaseSession(paused, { type: 'OPEN_RECEIPT' }) : paused;
    });
    setActiveTab(tab);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
      if (nextState !== 'active') setSession((current) => current ? transitionCaseSession(current, { type: 'PAUSE' }) : current);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('blur', () => {
      toCatalog();
      setSolvedCases([]);
      variants.current = {};
    });
    return unsubscribe;
  }, [navigation, toCatalog]);

  useEffect(() => {
    if (!solved || !session) return;
    setSolvedCases((current) => current.includes(session.caseId) ? current : [...current, session.caseId]);
  }, [solved, session?.caseId]);

  useEffect(() => {
    // Bottom-of-form actions must not leave validation feedback above the viewport.
    if (!session?.notice && session?.phase !== 'review') return;
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [session?.notice, session?.phase]);

  const inspect = (field) => dispatch({ type: 'INSPECT_FIELD', field });
  const expand = (field) => dispatch({ type: 'EXPAND_ADDRESS', field });
  const edit = (field, value) => dispatch({ type: 'UPDATE_DRAFT', field, value });
  const nextCase = () => {
    const ids = Object.keys(CASE_ART);
    start(ids[(ids.indexOf(session.caseId) + 1) % ids.length]);
  };
  const receipt = session?.caseId === 'first-delivery' && !sent ? null : fixture?.receipt;
  const objective = session?.caseId === 'wrong-network'
    ? '메시지 → 영수증의 단서 3개 → 지갑 네트워크를 확인해요.'
    : session?.caseId === 'address-mismatch'
      ? '친구가 준 주소와 영수증의 전체 주소를 나란히 대조해요.'
      : '친구의 요청대로 준비 → 검토 → 연습 전송 → 영수증 확인.';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        {session ? <TouchableOpacity accessibilityLabel="사건 목록으로 돌아가기" accessibilityRole="button" onPress={toCatalog} style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={COLORS.ink} /></TouchableOpacity> : null}
        <View style={styles.headerCopy}><Text style={styles.kicker}>PRACTICE STORIES</Text><Text style={styles.headerTitle}>Case Files</Text></View>
        <TouchableOpacity accessibilityLabel="Case Files 닫기" accessibilityRole="button" onPress={close} style={styles.iconButton}><Ionicons name="close" size={26} color={COLORS.ink} /></TouchableOpacity>
      </View>
      <View style={styles.modeStrip}><Ionicons name="game-controller-outline" size={16} color="#805020" /><Text style={styles.modeText}>연습 모드 · 가상 자산</Text></View>
      {!session || !scene || !wallet ? <Catalog solvedCases={solvedCases} onSelect={start} /> : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.missionTop}>
            <View style={styles.rowBetween}><Text style={styles.missionTitle}>{CASE_ART[session.caseId]?.title}</Text><Text style={styles.evidenceCount}>{solved ? '✓ 해결' : `단서 ${session.inspected.length}/3`}</Text></View>
            <Text style={styles.objective}>{objective}</Text>
          </View>
          <Tabs activeTab={activeTab} onChange={openTab} />
          <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {session.notice ? <View accessibilityLiveRegion="polite" style={styles.notice}><Ionicons name="bulb-outline" size={20} color="#734614" /><Text style={styles.noticeText}>{session.notice.message}</Text></View> : null}
            {activeTab === 'chat' ? (
              <ChatPane scene={scene} expanded={session.expanded.request} onExpand={() => expand('request')} onOpenWallet={() => openTab('wallet')} solved={solved} resultText={fixture.solvedMessage} />
            ) : activeTab === 'wallet' ? (
              session.caseId === 'first-delivery' ? (
                <DeliveryWallet scene={scene} draft={session.draft} review={session.review} balance={wallet.usdc} eth={wallet.eth} recipientBalance={wallet.recipientUsdc} sent={sent} onEdit={edit} onFillAddress={() => edit('address', fixture.contact.address)} onReview={() => dispatch({ type: 'REVIEW_TRANSFER' })} onConfirm={() => dispatch({ type: 'CONFIRM_TRANSFER' })} onCancelReview={() => dispatch({ type: 'PAUSE' })} onOpenReceipt={() => openTab('receipt')} />
              ) : (
                <InvestigationWallet scene={scene} network={wallet.network} balance={wallet.usdc} solved={solved} onNetwork={(network) => dispatch({ type: 'SWITCH_NETWORK', network })} onOpenReceipt={() => openTab('receipt')} onVerify={() => dispatch({ type: 'RESOLVE_NETWORK' })} />
              )
            ) : (
              <ReceiptPane scene={scene} receipt={receipt} expanded={session.expanded.to} onExpand={() => expand('to')} requestExpanded={session.expanded.request} onExpandRequest={() => expand('request')} inspected={session.inspected} onInspect={inspect} onClassify={(answer) => dispatch({ type: 'REPORT_MISMATCH', answer })} onWallet={() => openTab('wallet')} onCompleteDelivery={() => dispatch({ type: 'COMPLETE_DELIVERY' })} solved={solved} />
            )}
            {solved ? (
              <Result title={session.caseId === 'wrong-network' ? '숨은 잔액 발견!' : session.caseId === 'address-mismatch' ? '주소의 함정 포착!' : '첫 배달 성공!'} response={fixture.solvedMessage} explanation={session.result?.takeaway || fixture.takeaway} onNext={nextCase} onReplay={() => start(session.caseId)} onLayout={(event) => scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false })} />
            ) : (
              <>
                <Button secondary icon="bulb-outline" onPress={() => setHintOpen((current) => !current)}>{hintOpen ? '힌트 접기' : '막혔나요? 힌트 보기'}</Button>
                {hintOpen ? <View style={styles.hint}><Text style={styles.hintText}>{session.caseId === 'first-delivery' && !sent ? '메시지에서 친구의 금액·토큰·네트워크·전체 주소를 확인하세요. 전송을 마친 뒤에도 영수증을 열어 확인하면 사건이 끝나요.' : '메시지와 영수증에서 전체 주소를 모두 펼쳐 보세요. Status와 Network도 눌러 확인하세요. 앞뒤가 같아도 주소 중간이 다를 수 있어요.'}</Text></View> : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 12, fontWeight: '800', color: COLORS.orange, letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  modeStrip: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#FFF0DF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3DCC2' },
  modeText: { fontSize: 12, fontWeight: '700', color: '#805020' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  hero: { borderRadius: 25, backgroundColor: '#FFD2A8', borderWidth: 2, borderColor: COLORS.ink, padding: 22, gap: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#78310A' },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 30, lineHeight: 39, color: COLORS.ink, fontWeight: '900' },
  heroBody: { fontSize: 15, lineHeight: 23, color: '#623519' },
  notebook: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  stamp: { borderWidth: 1.5, borderColor: '#B38560', borderStyle: 'dashed', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12 },
  stampSolved: { backgroundColor: '#E6F5E9', borderColor: COLORS.green, borderStyle: 'solid' },
  stampText: { fontSize: 12, fontWeight: '800', color: '#704A2A' },
  stampSolvedText: { color: COLORS.green },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.ink },
  catalogCard: { borderWidth: 1.5, borderColor: '#DFD7CB', backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden' },
  catalogCardTop: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 12, gap: 12 },
  catalogIcon: { width: 59, height: 59, borderRadius: 17, backgroundColor: '#F2F5FC', justifyContent: 'center', alignItems: 'center' },
  catalogEmoji: { fontSize: 32 },
  catalogKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  catalogTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginTop: 5 },
  catalogBody: { paddingHorizontal: 18, fontSize: 14, lineHeight: 21, color: COLORS.muted },
  catalogFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, borderTopWidth: 1, borderColor: '#ECE8E1', paddingHorizontal: 18, paddingVertical: 12 },
  catalogMeta: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  catalogCTA: { fontSize: 14, fontWeight: '800', color: COLORS.blue },
  footnote: { fontSize: 12, lineHeight: 18, color: COLORS.muted, textAlign: 'center' },
  missionTop: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 6 },
  missionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.ink },
  objective: { fontSize: 13, lineHeight: 20, color: COLORS.muted },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 7 },
  tab: { minHeight: 48, flex: 1, paddingHorizontal: 8, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 15, backgroundColor: '#EDEAE3' },
  tabSelected: { backgroundColor: COLORS.ink },
  tabText: { fontSize: 13, color: COLORS.muted, fontWeight: '700' },
  tabSelectedText: { color: '#FFF' },
  pane: { backgroundColor: '#FFF', borderRadius: 23, borderColor: '#DFE5E8', borderWidth: 1, overflow: 'hidden' },
  paneHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 17, borderBottomWidth: 1, borderColor: '#E9EDEF' },
  contactEmoji: { fontSize: 25, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE1B8', textAlign: 'center', lineHeight: 44, overflow: 'hidden' },
  contactName: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  contactMeta: { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  paneBody: { padding: 16, gap: 13 },
  chatBody: { backgroundColor: '#F2F6F5', padding: 15, gap: 14 },
  dayLabel: { alignSelf: 'center', color: '#6C7B73', fontSize: 12, fontWeight: '600', paddingVertical: 5 },
  bubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 17, borderBottomLeftRadius: 4, backgroundColor: '#FFF', padding: 14, borderWidth: 1, borderColor: '#E6EBE7' },
  bubbleMine: { alignSelf: 'flex-end', borderBottomLeftRadius: 17, borderBottomRightRadius: 4, backgroundColor: '#FFDDC0', borderColor: '#FFCCAA' },
  bubbleText: { fontSize: 15, lineHeight: 23, color: '#253C34' },
  bubbleMineText: { color: '#703007' },
  requestCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DAE4DF', borderRadius: 16, padding: 14, gap: 12 },
  requestTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  requestAmount: { fontSize: 21, fontWeight: '800', color: COLORS.ink },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  address: { backgroundColor: '#F1F5FC', borderWidth: 1, borderColor: '#DAE4F7', borderRadius: 13, padding: 12, gap: 7, minHeight: 78 },
  addressDark: { backgroundColor: '#1C3455', borderColor: '#355073' },
  addressText: { fontSize: 13, lineHeight: 21, color: '#183F83', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  smallLink: { color: COLORS.blue, fontSize: 12, fontWeight: '600' },
  button: { minHeight: 48, borderRadius: 15, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  buttonText: { color: '#FFF', fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  buttonSecondary: { backgroundColor: '#F0F2F2', borderWidth: 1, borderColor: '#D9DFDE' },
  buttonSecondaryText: { color: COLORS.ink },
  buttonDark: { backgroundColor: COLORS.blue },
  disabled: { opacity: 0.45 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#CDD7E3', backgroundColor: '#F6F8FC', gap: 6 },
  chipDark: { borderColor: '#365579', backgroundColor: '#1B3555' },
  chipSelected: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  chipText: { color: '#45617B', fontSize: 13, fontWeight: '700' },
  chipSelectedText: { color: '#FFF' },
  walletBalance: { fontSize: 38, lineHeight: 47, fontWeight: '800', color: COLORS.ink, marginVertical: 8 },
  walletUnit: { fontSize: 16, color: COLORS.muted },
  tokenIcon: { height: 41, width: 41, borderRadius: 21, backgroundColor: '#2775CA', justifyContent: 'center', alignItems: 'center' },
  tokenIconText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ECF0F3' },
  tokenName: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  tokenBalance: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  transaction: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  transactionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EBF4EE', alignItems: 'center', justifyContent: 'center' },
  transactionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  transactionMeta: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  explorer: { backgroundColor: COLORS.navy, borderColor: '#1F3858' },
  explorerTop: { padding: 18, backgroundColor: '#102038', gap: 12 },
  explorerTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  explorerLogo: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.blue, justifyContent: 'center', alignItems: 'center' },
  hash: { fontSize: 13, color: '#A9C5EF', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), lineHeight: 21 },
  darkMuted: { color: '#A8BDD8' },
  lightText: { color: '#F5F8FF' },
  receiptRow: { minHeight: 56, paddingVertical: 13, gap: 7, borderBottomWidth: 1, borderColor: '#2B4261' },
  receiptValue: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  statusGood: { color: '#79E1AF' },
  statusPill: { backgroundColor: '#1A4A41', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#98F0C2', fontSize: 12, fontWeight: '700' },
  evidenceCount: { color: COLORS.blue, fontSize: 12, fontWeight: '700' },
  formField: { gap: 7 },
  input: { borderWidth: 1, borderColor: '#CCD7E2', backgroundColor: '#FAFCFE', borderRadius: 13, minHeight: 50, paddingHorizontal: 13, paddingVertical: 11, color: COLORS.ink, fontSize: 21, fontWeight: '600' },
  addressInput: { fontSize: 13, fontWeight: '400', minHeight: 54 },
  review: { backgroundColor: '#F0F5FD', borderColor: '#CFDCF4', borderWidth: 1, borderRadius: 18, padding: 17, gap: 14 },
  reviewTitle: { fontSize: 20, color: COLORS.ink, fontWeight: '800' },
  reviewValue: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  notice: { backgroundColor: '#FFF0DB', borderColor: '#EEC68D', borderWidth: 1, padding: 14, borderRadius: 16, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 21, color: '#734614' },
  hint: { padding: 14, backgroundColor: '#F4F5FA', borderRadius: 14 },
  hintText: { fontSize: 13, lineHeight: 20, color: '#536575' },
  success: { backgroundColor: '#E9F7EC', borderWidth: 1.5, borderColor: '#88BC95', borderRadius: 23, padding: 20, gap: 12 },
  successKicker: { color: COLORS.green, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  successTitle: { fontSize: 25, lineHeight: 32, color: '#154B31', fontWeight: '900' },
  successBody: { color: '#35644B', fontSize: 15, lineHeight: 23 },
  successEmoji: { fontSize: 40 },
  divider: { height: 1, backgroundColor: '#DFE6E9' },
});
