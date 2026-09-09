import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Animated,
  AccessibilityInfo,
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getCaseFile } from '../data/caseFiles.mjs';
import { createCaseSession, getCaseWalletView } from '../utils/caseFilesEngine.mjs';
import { transitionCaseQuest as transitionCaseSession } from '../utils/caseQuestFeedback.mjs';
import { getCaseQuestProgress, getCaseQuestSummary } from '../utils/caseQuestProgress.mjs';
import PracticeBrand from '../components/PracticeBrand';

// Reuse the Daily Run / Practice Arcade palette and app-loaded Gmarket fonts.
// Pixel orange source: EasyTree Moodboard v2, Figma node 30509:6.
const COLORS = { ink: '#17120F', muted: '#746558', paper: '#FFF8F0', cream: '#FFF0DF', orange: '#FF6813', orangeDark: '#A93B00', pink: '#FFB0BE', navy: '#13253F', blue: '#2358D7', green: '#167650' };
const ORANGE_MARK = require('../assets/easygo/quest-orange.png');
const CASE_ART = {
  'wrong-network': { accent: '#A93B00', label: 'THE MISSING USDC', title: '사라진 USDC', description: '보냈다는데 지갑은 0? 거래내역을 따라 숨어 있는 잔액을 찾아요.', difficulty: '안내와 함께 · 60초' },
  'address-mismatch': { accent: '#8D4288', label: 'THE LOOK-ALIKE', title: '닮은 주소의 함정', description: '앞뒤가 같아도 같은 주소일까요? 친구의 요청과 영수증을 대조해요.', difficulty: '스스로 수사 · 90초' },
  'first-delivery': { accent: '#A93B00', label: 'SPECIAL DELIVERY', title: '첫 번째 배달', description: '토큰부터 받는 주소까지 직접 설정하고 가상 USDC를 전달해요.', difficulty: '직접 조작 · 90초' },
};

function Text({ style, ...props }) {
  const flat = StyleSheet.flatten(style) || {};
  // Preserve whole-address monospace; avoid synthesizing bold over Gmarket.
  const font = flat.fontFamily ? {} : { fontFamily: Number(flat.fontWeight || 400) >= 700 ? 'GmarketBold' : 'GmarketMedium', fontWeight: 'normal' };
  return <NativeText {...props} style={[style, font]} />;
}

function OrangeMark({ size = 32 }) {
  return <Image accessible={false} source={ORANGE_MARK} resizeMode="contain" style={{ width: size, height: size }} />;
}

function ActionFeedback({ feedback }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => AccessibilityInfo.isReduceMotionEnabled()).then((value) => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!feedback || Platform.OS !== 'ios') return;
    try { AccessibilityInfo.announceForAccessibility(feedback.title + ' ' + feedback.message); } catch { /* Visual feedback remains available. */ }
  }, [feedback]);
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!feedback || reduceMotion || feedback.tone !== 'success') return;
    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [feedback, reduceMotion, scale]);
  if (!feedback) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.actionFeedback, feedback.tone === 'retry' && styles.actionRetry]}>
      <Animated.View accessible={false} style={{ transform: [{ scale }] }}>
        {feedback.tone === 'success' ? <OrangeMark size={30} /> : <Ionicons name="bulb-outline" size={24} color={COLORS.orangeDark} />}
      </Animated.View>
      <View style={styles.flex}>
        <Text style={styles.actionTitle}>{feedback.title}</Text>
        <Text style={styles.actionMessage}>{feedback.message}</Text>
      </View>
    </View>
  );
}

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
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, dark && styles.buttonDarkText]}>{children}</Text>
      {icon ? <Ionicons name={icon} size={19} color={dark ? '#FFF' : COLORS.ink} /> : null}
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
      <PracticeBrand name={children} size={24} />
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

function Catalog({ solvedCases, onSelect, onClose }) {
  const summary = getCaseQuestSummary(solvedCases);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.brandSticker}><Text style={styles.heroLabel}>COINEASY QUEST CLUB</Text></View>
          <OrangeMark size={72} />
        </View>
        <Text style={styles.heroTitle}>{summary.allComplete ? '오늘의 퀘스트\n모두 완료!' : '3개의 퀘스트,\n확실한 첫 실전.'}</Text>
        <Text style={styles.heroBody}>{summary.allComplete ? '잔액 찾기 · 주소 판별 · 가상 전송까지 해냈어요.' : '요청 확인 → 직접 조작 → 완료 도장.\n각 퀘스트의 마지막 완료 버튼까지 도전하세요.'}</Text>
        <Text style={styles.questCount}>{summary.count} / {summary.total} 퀘스트 완료</Text>
        <View accessibilityLabel={`${solvedCases.length}개 사건 해결`} style={styles.notebook}>
          {Object.keys(CASE_ART).map((id, index) => (
            <View key={id} style={[styles.stamp, solvedCases.includes(id) && styles.stampSolved]}>
              {solvedCases.includes(id) ? <OrangeMark size={24} /> : null}
              <Text style={[styles.stampText, solvedCases.includes(id) && styles.stampSolvedText]}>
                {solvedCases.includes(id) ? '✓' : '○'} FILE 0{index + 1}
              </Text>
            </View>
          ))}
        </View>
        {summary.allComplete ? <Button onPress={onClose} icon="checkmark-circle">연습 마치기</Button> : (
          <Button onPress={() => onSelect(summary.nextId)} icon="arrow-forward">{summary.count ? '남은 퀘스트 이어하기' : '첫 퀘스트 시작하기'}</Button>
        )}
      </View>
      <Text style={styles.sectionTitle}>{summary.allComplete ? '완료한 퀘스트 · 재도전은 선택이에요' : '퀘스트 목록'}</Text>
      {Object.entries(CASE_ART).map(([id, art], index) => (
        <TouchableOpacity key={id} accessibilityRole="button" activeOpacity={0.85} onPress={() => onSelect(id)} style={styles.catalogCard}>
          <View style={styles.catalogCardTop}>
            <View style={[styles.catalogIcon, { backgroundColor: index === 1 ? '#FFE2E8' : COLORS.cream }]}><OrangeMark size={48} /><View style={styles.questNumber}><Text style={styles.questNumberText}>{String(index + 1).padStart(2, '0')}</Text></View></View>
            <View style={styles.flex}>
              <Text style={[styles.catalogKicker, { color: art.accent }]}>{solvedCases.includes(id) ? '✓ 완료' : '미완료'} · QUEST 0{index + 1}</Text>
              <Text style={styles.catalogTitle}>{art.title}</Text>
            </View>
          </View>
          <Text style={styles.catalogBody}>{art.description}</Text>
          <View style={styles.catalogFooter}>
            <Text style={styles.catalogMeta}>{art.difficulty}</Text>
            <Text style={[styles.catalogCTA, { color: art.accent }]}>{solvedCases.includes(id) ? '선택 재도전' : '퀘스트 시작'} →</Text>
          </View>
        </TouchableOpacity>
      ))}
      <Text style={styles.footnote}>완료 도장은 이번 연습 안에서만 유지돼요. Case Files를 닫으면 초기화되며 Orange 보상은 지급되지 않아요.</Text>
      <Text style={styles.footnote}>로고는 네트워크·토큰 식별용입니다. 공식 지갑·탐색기 또는 제휴 서비스가 아닌 EasyGo의 가상 연습 화면입니다.</Text>
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
        <View style={styles.contactAvatar}>{scene.contactEmoji === '🍊' ? <OrangeMark size={40} /> : <Text style={styles.contactEmoji}>{scene.contactEmoji}</Text>}</View>
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
            <View style={styles.row}><PracticeBrand name="USDC" /><Text style={styles.requestAmount}>{scene.expectedAmount} USDC</Text></View>
            <View style={styles.row}><PracticeBrand name={scene.expectedNetwork} /><Text style={styles.fieldLabel}>{scene.expectedNetwork}</Text></View>
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
      <PracticeBrand name="EasyGo" size={36} />
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
        <PracticeBrand name="USDC" size={41} />
        <View style={styles.flex}><Text style={styles.tokenName}>USDC</Text><Text style={styles.transactionMeta}>연습용 토큰</Text></View>
        <Text style={styles.tokenBalance}>{balance}</Text>
      </View>
    </>
  );
}

function InvestigationWallet({ scene, network, balance, onNetwork, onOpenReceipt, onVerify, solved, readyToFinish }) {
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
        {scene.caseId === 'wrong-network' && !solved ? <Button disabled={!readyToFinish || network !== scene.expectedNetwork} icon="checkmark-circle-outline" onPress={onVerify}>잔액 확인 · 퀘스트 완료하기</Button> : null}
        {scene.caseId === 'address-mismatch' && !solved ? <Button secondary icon="receipt-outline" onPress={onOpenReceipt}>영수증의 받는 주소 확인</Button> : null}
        <Text style={styles.footnote}>네트워크를 바꾸면 표시할 잔액만 달라져요.</Text>
      </View>
    </View>
  );
}

function ReceiptPane({ scene, receipt, expanded, onExpand, requestExpanded, onExpandRequest, inspected, onInspect, onClassify, onWallet, onCompleteDelivery, solved, readyToFinish }) {
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
          <View style={styles.row}><PracticeBrand name="EasyGo" size={30} /><Text style={styles.explorerTitle}>EasyGo Explorer</Text></View>
          <View style={styles.statusPill}><Text style={styles.statusText}>연습 영수증</Text></View>
        </View>
        <Text style={styles.darkMuted}>Transaction details</Text>
        <Text style={styles.darkMuted}>가상 거래 · 실제 탐색기와 연결되지 않아요</Text>
        <Text style={styles.hash}>{receipt.hash}</Text>
      </View>
      <View style={styles.paneBody}>
        <TouchableOpacity accessibilityRole="button" onPress={() => onInspect('status')} style={styles.receiptRow}>
          <View style={styles.rowBetween}><Text style={styles.darkMuted}>Status · 처리 상태</Text><Ionicons name={inspected.includes('status') ? 'checkmark-circle' : 'information-circle-outline'} size={19} color="#91B7EB" /></View>
          <Text style={[styles.receiptValue, styles.statusGood]}>✓ {receipt.status}</Text>
          <Text style={styles.darkMuted}>{inspected.includes('status') ? '✓ 단서 확인됨' : '탭해서 단서 확인'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => onInspect('network')} style={styles.receiptRow}>
          <View style={styles.rowBetween}><Text style={styles.darkMuted}>Network · 거래가 기록된 곳</Text><Ionicons name={inspected.includes('network') ? 'checkmark-circle' : 'information-circle-outline'} size={19} color="#91B7EB" /></View>
          <View style={styles.row}><PracticeBrand name={receipt.network} /><Text style={styles.receiptValue}>{receipt.network}</Text></View>
          <Text style={styles.darkMuted}>{inspected.includes('network') ? '✓ 단서 확인됨' : '탭해서 단서 확인'}</Text>
        </TouchableOpacity>
        <View style={styles.receiptRow}><Text style={styles.darkMuted}>Amount · 전송량</Text><View style={styles.row}><PracticeBrand name={receipt.token} /><Text style={styles.receiptValue}>{receipt.amount} {receipt.token}</Text></View></View>
        <Address dark label={`${scene.contactName}의 요청 주소`} value={scene.expectedAddress} expanded={requestExpanded} onToggle={onExpandRequest} />
        <Address dark label="To · 받는 전체 주소" value={receipt.to} expanded={expanded} onToggle={onExpand} />
        <Text style={[styles.footnote, styles.darkMuted]}>{inspected.includes('to') ? '✓ 전체 주소 대조 완료' : '두 주소를 모두 펼치면 주소 단서가 체크돼요.'}</Text>
        {!solved && scene.caseId === 'first-delivery' ? (
          <Button dark disabled={!readyToFinish} icon="checkmark-circle-outline" onPress={onCompleteDelivery}>퀘스트 완료하기</Button>
        ) : !solved && scene.caseId === 'address-mismatch' ? (
          <>
            <Button dark disabled={!readyToFinish} onPress={() => onClassify('mismatch')}>주소가 달라요 · 판별 완료</Button>
            <Button secondary disabled={!readyToFinish} onPress={() => onClassify('match')}>같은 주소예요 · 판별하기</Button>
          </>
        ) : <Button dark icon="wallet-outline" onPress={onWallet}>지갑에서 결과 확인</Button>}
      </View>
    </View>
  );
}

function DeliveryWallet({ scene, draft, review, balance, eth, recipientBalance, deliveryMessage, onEdit, onFillAddress, onReview, onConfirm, onCancelReview, onOpenReceipt, sent }) {
  return (
    <View style={styles.pane}>
      <WalletHeader name="내 연습 지갑" />
      <View style={styles.paneBody}>
        <WalletBalance balance={balance} />
        <View style={styles.row}><PracticeBrand name="ETH" /><Text style={styles.fieldLabel}>가상 가스 잔액 · {eth} ETH</Text></View>
        {sent ? (
          <>
            <View style={styles.requestCard}><View style={styles.row}><PracticeBrand name="Base" /><Text style={styles.requestTitle}>{scene.contactName}의 Base 연습 지갑</Text></View><Text style={styles.requestAmount}>{recipientBalance} USDC</Text><Text style={styles.successBody}>{deliveryMessage}</Text></View>
            <Button onPress={onOpenReceipt} icon="receipt-outline">전송 영수증 열기</Button>
          </>
        ) : review ? (
          <View style={styles.review}>
            <Text style={styles.reviewTitle}>보내기 전, 한 번 더</Text>
            <View style={styles.rowBetween}><Text style={styles.fieldLabel}>보낼 금액</Text><View style={styles.row}><PracticeBrand name={review.token} /><Text style={styles.reviewValue}>{review.amount} {review.token}</Text></View></View>
            <View style={styles.rowBetween}><Text style={styles.fieldLabel}>네트워크</Text><View style={styles.row}><PracticeBrand name={review.network} /><Text style={styles.reviewValue}>{review.network}</Text></View></View>
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

function QuestGuide({ progress, activeTab, onOpenTab }) {
  const target = progress.current?.tab;
  const labels = { chat: '메시지', wallet: '연습 지갑', receipt: '영수증' };
  return (
    <View style={styles.questGuide}>
      <View style={styles.row}><OrangeMark size={24} /><Text style={styles.requestTitle}>완료까지 할 일</Text></View>
      {progress.steps.map((item, index) => (
        <View key={item.id} style={styles.row}>
          <Ionicons name={item.done ? 'checkmark-circle' : progress.current?.id === item.id ? 'play-circle' : 'ellipse-outline'} size={20} color={item.done ? COLORS.green : COLORS.blue} />
          <Text style={[styles.questStep, item.done && styles.questStepDone]}>{index + 1}. {item.label}{item.done ? ' · 완료' : ''}</Text>
        </View>
      ))}
      {target && target !== activeTab ? <Button secondary onPress={() => onOpenTab(target)} icon="arrow-forward">다음 할 일 · {labels[target]} 열기</Button> : null}
    </View>
  );
}

function Result({ title, response, explanation, summary, onNext, onReplay, onCatalog, onEvidence, onClose }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.success}>
      <View style={styles.completionSeal}><OrangeMark size={96} /><View style={styles.completionCheck}><Ionicons name="checkmark" size={22} color="#FFF" /></View></View>
      <Text accessibilityRole="header" style={styles.completionTitle}>{summary.allComplete ? '퀘스트 3개 모두 완료!' : '퀘스트 완료!'}</Text>
      <Text style={styles.successKicker}>QUEST COMPLETE · {summary.count}/{summary.total} 완료 도장</Text>
      <Text style={styles.successTitle}>{title}</Text>
      <Bubble>{response}</Bubble>
      <Text style={styles.requestTitle}>이번에 해낸 것</Text>
      <Text style={styles.successBody}>{explanation}</Text>
      <Text style={styles.footnote}>실제 자산은 움직이지 않았어요. 도장은 이번 연습에만 남으며 Orange 보상은 없어요.</Text>
      {summary.allComplete ? <Button icon="checkmark-circle" onPress={onClose}>연습 마치기</Button> : <Button icon="arrow-forward" onPress={onNext}>다음 퀘스트 시작하기</Button>}
      <Button secondary onPress={onCatalog}>퀘스트 목록 보기</Button>
      <Button secondary icon="receipt-outline" onPress={onEvidence}>완료한 영수증 다시 보기</Button>
      <Button secondary icon="refresh" onPress={onReplay}>선택 · 다른 단서로 재도전</Button>
    </View>
  );
}

export default function CaseFiles({ navigation }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [solvedCases, setSolvedCases] = useState([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [reviewEvidence, setReviewEvidence] = useState(false);
  const variants = useRef({});
  const appState = useRef(AppState.currentState || 'active');
  const scroll = useRef(null);
  const fixture = session ? getCaseFile(session.caseId, session.variant) : null;
  const wallet = session ? getCaseWalletView(session) : null;
  const solved = session?.phase === 'complete';
  const sent = session?.phase === 'sent' || solved;
  const progress = getCaseQuestProgress(session);
  const summary = getCaseQuestSummary(solvedCases, solved ? session.caseId : null);
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
    Keyboard.dismiss();
    setSession(null);
    setReviewEvidence(false);
    setActiveTab('chat');
    setHintOpen(false);
  }, []);

  const start = useCallback((caseId) => {
    tap();
    Keyboard.dismiss();
    setReviewEvidence(false);
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
    Keyboard.dismiss();
    setReviewEvidence(false);
    AccessibilityInfo.announceForAccessibility('퀘스트 완료! 완료 도장을 받았어요.');
    try { Promise.resolve(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(() => {}); } catch { /* Optional feedback. */ }
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
    if (summary.nextId) start(summary.nextId);
    else toCatalog();
  };
  const receipt = session?.caseId === 'first-delivery' && !sent ? null : fixture?.receipt;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        {session ? <TouchableOpacity accessibilityLabel="사건 목록으로 돌아가기" accessibilityRole="button" onPress={toCatalog} style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={COLORS.ink} /></TouchableOpacity> : null}
        <OrangeMark size={36} />
        <View style={styles.headerCopy}><Text style={styles.kicker}>COINEASY · PRACTICE QUESTS</Text><Text style={styles.headerTitle}>Case Files</Text></View>
        <TouchableOpacity accessibilityLabel="Case Files 닫기" accessibilityRole="button" onPress={close} style={styles.iconButton}><Ionicons name="close" size={26} color={COLORS.ink} /></TouchableOpacity>
      </View>
      <View style={styles.modeStrip}><Ionicons name="game-controller-outline" size={16} color="#805020" /><Text style={styles.modeText}>연습 모드 · 가상 자산</Text></View>
      {!session || !scene || !wallet ? <Catalog solvedCases={solvedCases} onSelect={start} onClose={close} /> : solved && !reviewEvidence ? (
        <ScrollView key={session.caseId + '-complete'} contentContainerStyle={styles.content}>
          <Result title={session.caseId === 'wrong-network' ? '숨은 잔액 발견!' : session.caseId === 'address-mismatch' ? '주소의 함정 포착!' : '첫 배달 성공!'}
            response={fixture.solvedMessage} explanation={session.result?.takeaway || fixture.takeaway}
            summary={summary} onNext={nextCase} onReplay={() => start(session.caseId)} onCatalog={toCatalog} onClose={close}
            onEvidence={() => { setReviewEvidence(true); openTab('receipt'); }} />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.missionTop}>
            <View style={styles.rowBetween}><Text style={styles.missionTitle}>{CASE_ART[session.caseId]?.title}</Text><Text style={styles.evidenceCount}>{solved ? '✓ 완료' : `${progress.done}/${progress.total} 단계`}</Text></View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.done }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.done / progress.total * 100}%` }]} /></View>
            {!solved ? <ActionFeedback feedback={session.feedback} /> : null}
            <Text accessibilityLiveRegion="polite" style={styles.objective}>{solved ? '완료한 기록을 둘러보는 중이에요.' : `지금 할 일 · ${progress.current?.instruction}`}</Text>
          </View>
          <Tabs activeTab={activeTab} onChange={openTab} />
          <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {solved ? <Button onPress={() => setReviewEvidence(false)}>퀘스트 완료 화면으로</Button> : <QuestGuide progress={progress} activeTab={activeTab} onOpenTab={openTab} />}
            {session.notice && !session.feedback ? <View accessibilityLiveRegion="polite" style={styles.notice}><Ionicons name="bulb-outline" size={20} color="#734614" /><Text style={styles.noticeText}>{session.notice.message}</Text></View> : null}
            {activeTab === 'chat' ? (
              <ChatPane scene={scene} expanded={session.expanded.request} onExpand={() => expand('request')} onOpenWallet={() => openTab('wallet')} solved={solved} resultText={fixture.solvedMessage} />
            ) : activeTab === 'wallet' ? (
              session.caseId === 'first-delivery' ? (
                <DeliveryWallet scene={scene} draft={session.draft} review={session.review} balance={wallet.usdc} eth={wallet.eth} recipientBalance={wallet.recipientUsdc} deliveryMessage={progress.deliveryMessage} sent={sent} onEdit={edit} onFillAddress={() => edit('address', fixture.contact.address)} onReview={() => dispatch({ type: 'REVIEW_TRANSFER' })} onConfirm={() => dispatch({ type: 'CONFIRM_TRANSFER' })} onCancelReview={() => dispatch({ type: 'PAUSE' })} onOpenReceipt={() => openTab('receipt')} />
              ) : (
                <InvestigationWallet scene={scene} network={wallet.network} balance={wallet.usdc} solved={solved} readyToFinish={progress.readyToFinish} onNetwork={(network) => dispatch({ type: 'SWITCH_NETWORK', network })} onOpenReceipt={() => openTab('receipt')} onVerify={() => dispatch({ type: 'RESOLVE_NETWORK' })} />
              )
            ) : (
              <ReceiptPane scene={scene} receipt={receipt} expanded={session.expanded.to} onExpand={() => expand('to')} requestExpanded={session.expanded.request} onExpandRequest={() => expand('request')} inspected={session.inspected} onInspect={inspect} onClassify={(answer) => dispatch({ type: 'REPORT_MISMATCH', answer })} onWallet={() => openTab('wallet')} onCompleteDelivery={() => dispatch({ type: 'COMPLETE_DELIVERY' })} solved={solved} readyToFinish={progress.readyToFinish} />
            )}
            {!solved ? (
              <>
                <Button secondary icon="bulb-outline" onPress={() => setHintOpen((current) => !current)}>{hintOpen ? '힌트 접기' : '막혔나요? 힌트 보기'}</Button>
                {hintOpen ? <View style={styles.hint}><Text style={styles.hintText}>{session.caseId === 'first-delivery' && !sent ? '메시지에서 친구의 금액·토큰·네트워크·전체 주소를 확인하세요. 전송을 마친 뒤에도 영수증을 열어 확인하면 사건이 끝나요.' : '메시지와 영수증에서 전체 주소를 모두 펼쳐 보세요. Status와 Network도 눌러 확인하세요. 앞뒤가 같아도 주소 중간이 다를 수 있어요.'}</Text></View> : null}
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: '#FFD0A8', borderBottomWidth: 2, borderBottomColor: COLORS.ink },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 9, fontWeight: '800', color: COLORS.orangeDark, letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  modeStrip: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#FFF0DF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3DCC2' },
  modeText: { fontSize: 12, fontWeight: '700', color: '#805020' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  hero: { borderRadius: 22, backgroundColor: '#FFD2A8', borderWidth: 2, borderBottomWidth: 5, borderColor: COLORS.ink, padding: 20, gap: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  heroLabel: { fontSize: 10, lineHeight: 16, fontWeight: '900', letterSpacing: 0.5, color: COLORS.ink },
  brandSticker: { flexShrink: 1, backgroundColor: '#FFFEFC', borderWidth: 1.5, borderColor: COLORS.ink, paddingHorizontal: 10, paddingVertical: 8 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 27, lineHeight: 38, color: COLORS.ink, fontWeight: '900' },
  heroBody: { fontSize: 15, lineHeight: 23, color: '#623519' },
  notebook: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#B38560', borderStyle: 'dashed', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8 },
  stampSolved: { backgroundColor: COLORS.cream, borderColor: COLORS.orangeDark, borderStyle: 'solid' },
  stampText: { fontSize: 12, fontWeight: '800', color: '#704A2A' },
  stampSolvedText: { color: COLORS.orangeDark },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.ink },
  catalogCard: { borderWidth: 2, borderBottomWidth: 4, borderColor: COLORS.ink, backgroundColor: '#FFFEFC', borderRadius: 18, overflow: 'hidden' },
  catalogCardTop: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 12, gap: 12 },
  catalogIcon: { width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: '#D7AA82', justifyContent: 'center', alignItems: 'center' },
  questNumber: { position: 'absolute', right: -6, bottom: -5, minWidth: 28, minHeight: 24, alignItems: 'center', justifyContent: 'center', padding: 3, backgroundColor: COLORS.ink, borderRadius: 4 },
  questNumberText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  catalogEmoji: { fontSize: 32 },
  catalogKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  catalogTitle: { fontSize: 18, lineHeight: 26, fontWeight: '800', color: COLORS.ink, marginTop: 5 },
  catalogBody: { paddingHorizontal: 18, fontSize: 14, lineHeight: 21, color: COLORS.muted },
  catalogFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 15, borderTopWidth: 1, borderColor: '#E9D5C2', backgroundColor: COLORS.cream, paddingHorizontal: 18, paddingVertical: 12 },
  catalogMeta: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  catalogCTA: { fontSize: 14, fontWeight: '800', color: COLORS.blue },
  footnote: { fontSize: 12, lineHeight: 18, color: COLORS.muted, textAlign: 'center' },
  missionTop: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 6 },
  missionTitle: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '800', color: COLORS.ink },
  objective: { fontSize: 13, lineHeight: 20, color: COLORS.muted },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 7 },
  tab: { minHeight: 48, flex: 1, paddingHorizontal: 8, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 15, backgroundColor: '#EDEAE3' },
  tabSelected: { backgroundColor: COLORS.ink },
  tabText: { fontSize: 13, color: COLORS.muted, fontWeight: '700' },
  tabSelectedText: { color: '#FFF' },
  pane: { backgroundColor: '#FFF', borderRadius: 23, borderColor: '#DFE5E8', borderWidth: 1, overflow: 'hidden' },
  paneHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 17, borderBottomWidth: 1, borderColor: '#E9EDEF' },
  contactAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  contactEmoji: { fontSize: 25 },
  contactName: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  contactMeta: { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  paneBody: { padding: 16, gap: 13 },
  chatBody: { backgroundColor: '#FFF5E9', padding: 15, gap: 14 },
  dayLabel: { alignSelf: 'center', color: '#6C7B73', fontSize: 12, fontWeight: '600', paddingVertical: 5 },
  bubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 17, borderBottomLeftRadius: 4, backgroundColor: '#FFF', padding: 14, borderWidth: 1, borderColor: '#E6EBE7' },
  bubbleMine: { alignSelf: 'flex-end', borderBottomLeftRadius: 17, borderBottomRightRadius: 4, backgroundColor: '#FFD2A8', borderColor: '#E7AC7B' },
  bubbleText: { fontSize: 15, lineHeight: 23, color: '#253C34' },
  bubbleMineText: { color: '#703007' },
  requestCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DAE4DF', borderRadius: 16, padding: 14, gap: 12 },
  requestTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  requestAmount: { fontSize: 21, fontWeight: '800', color: COLORS.ink },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  address: { backgroundColor: '#F1F5FC', borderWidth: 1, borderColor: '#DAE4F7', borderRadius: 13, padding: 12, gap: 7, minHeight: 78 },
  addressDark: { backgroundColor: '#1C3455', borderColor: '#355073' },
  addressText: { fontSize: 13, lineHeight: 21, color: '#183F83', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  smallLink: { color: COLORS.blue, fontSize: 12, fontWeight: '600' },
  button: { minHeight: 50, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: COLORS.ink, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  buttonText: { color: COLORS.ink, fontSize: 14, lineHeight: 21, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  buttonSecondary: { backgroundColor: '#FFFEFC', borderWidth: 1.5, borderBottomWidth: 3, borderColor: '#BCAA9B' },
  buttonSecondaryText: { color: COLORS.ink },
  buttonDark: { backgroundColor: COLORS.blue },
  buttonDarkText: { color: '#FFF' },
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
  success: { backgroundColor: '#FFE0BD', borderWidth: 2, borderBottomWidth: 5, borderColor: COLORS.ink, borderRadius: 22, padding: 20, gap: 14 },
  successKicker: { color: COLORS.orangeDark, fontSize: 11, lineHeight: 19, fontWeight: '900', letterSpacing: 0.3, textAlign: 'center' },
  successTitle: { fontSize: 22, lineHeight: 32, color: COLORS.ink, fontWeight: '900' },
  successBody: { color: '#62412A', fontSize: 14, lineHeight: 24 },
  successEmoji: { fontSize: 40 },
  questCount: { fontSize: 17, fontWeight: '800', color: '#623519' },
  questGuide: { padding: 16, gap: 10, borderRadius: 14, backgroundColor: '#FFFEFC', borderWidth: 1.5, borderLeftWidth: 5, borderColor: '#E0BD9D', borderLeftColor: COLORS.orange },
  questStep: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', color: COLORS.ink },
  questStepDone: { color: COLORS.green },
  progressTrack: { height: 6, backgroundColor: '#E3E4DE', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: COLORS.orange },
  actionFeedback: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, backgroundColor: '#FFE0BD', borderRadius: 10, borderWidth: 1, borderColor: '#DDB08A' },
  actionRetry: { backgroundColor: '#FFF1DB', borderColor: '#D7B778' },
  actionTitle: { color: COLORS.orangeDark, fontWeight: '800', fontSize: 12, lineHeight: 18 },
  actionMessage: { color: '#62412A', fontSize: 11, lineHeight: 17 },
  completionSeal: { alignSelf: 'center', width: 116, height: 116, borderRadius: 20, borderWidth: 2, borderColor: COLORS.ink, backgroundColor: '#FFFEFC', alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  completionCheck: { position: 'absolute', bottom: -7, right: -7, width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: COLORS.ink, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  completionTitle: { fontSize: 25, lineHeight: 36, fontWeight: '900', color: COLORS.ink, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#DFE6E9' },
});
