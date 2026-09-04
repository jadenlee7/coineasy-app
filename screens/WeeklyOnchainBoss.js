import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useDeviceAccountOperationLease } from '../contexts/DeviceAccountDataContext';
import { WEEKLY_ONCHAIN_BOSS_W0 } from '../data/weeklyOnchainBoss.mjs';
import {
  advanceWeeklyOnchainBossAct,
  answerWeeklyOnchainBossAct,
  createWeeklyOnchainBossSession,
  sameWeeklyOnchainBossLease,
  shouldInvalidateWeeklyOnchainBossForAppState,
  summarizeWeeklyOnchainBossSession,
} from '../utils/weeklyOnchainBossEngine.mjs';

const BRAND = Object.freeze({
  background: '#120E1F',
  black: '#17120F',
  cream: '#FFF5E8',
  green: '#1F9D62',
  orange: '#FF6813',
  purple: '#6E4AFF',
  red: '#D92D20',
  white: '#FFFEFC',
});

function Header({ onClose }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityLabel="Weekly Boss 닫기"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onClose}
        style={styles.iconButton}
      >
        <Ionicons color={BRAND.white} name="close" size={25} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.headerKicker}>BASE SAFETY RAID</Text>
        <Text numberOfLines={1} style={styles.headerTitle}>Weekly Onchain Boss</Text>
      </View>
      <View style={styles.w0Pill}>
        <Text style={styles.w0PillText}>W0</Text>
      </View>
    </View>
  );
}

function SafetyBanner() {
  return (
    <View accessibilityRole="summary" style={styles.safetyBanner}>
      <Ionicons color="#FFD5B8" name="shield-checkmark" size={19} />
      <Text style={styles.safetyText}>
        CURATED OFFLINE RAID · 고정 훈련 데이터 · 실제 견적 아님 · 서명·전송·자산 이동 없음
      </Text>
    </View>
  );
}

function Intro({ notice, onStart }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>{WEEKLY_ONCHAIN_BOSS_W0.eyebrow}</Text>
        <Text style={styles.heroEmoji}>🐲</Text>
        <Text style={styles.heroTitle}>4개의 단서로{`\n`}Base Safety Boss를 막아라</Text>
        <Text style={styles.heroBody}>{WEEKLY_ONCHAIN_BOSS_W0.subtitle}</Text>
      </View>
      <SafetyBanner />
      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice}>
          <Ionicons color="#FFD5B8" name="refresh-circle" size={19} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <View style={styles.raidMap}>
        {WEEKLY_ONCHAIN_BOSS_W0.acts.map((act, index) => (
          <View key={act.id} style={styles.mapAct}>
            <View style={styles.mapNumber}>
              <Text style={styles.mapNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.mapCopy}>
              <Text style={styles.mapEyebrow}>{act.eyebrow}</Text>
              <Text style={styles.mapTitle}>{act.title}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={onStart} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>오프라인 레이드 시작</Text>
        <Ionicons color="#FFF" name="flash" size={20} />
      </TouchableOpacity>
      <Text style={styles.localOnlyText}>
        진행·점수는 현재 세션에서만 보이며 저장되거나 지급되지 않습니다.
      </Text>
    </ScrollView>
  );
}

function RaidStatus({ session }) {
  const progress = ((session.actIndex + 1) / WEEKLY_ONCHAIN_BOSS_W0.acts.length) * 100;
  const shields = Array.from(
    { length: 3 },
    (_, index) => index < session.shields ? '◆' : '◇',
  ).join(' ');
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>RAID {session.actIndex + 1}/4</Text>
        <Text accessibilityLabel={`${session.shields} safety shields`} style={styles.shields}>
          {shields}
        </Text>
        <Text style={styles.score}>{session.score} PTS</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.bossRow}>
        <Text style={styles.bossEmoji}>🐲</Text>
        <View style={styles.bossCopy}>
          <View style={styles.bossMetaRow}>
            <Text style={styles.bossLabel}>BOSS SIGNAL</Text>
            <Text style={styles.bossValue}>{session.bossHealth}%</Text>
          </View>
          <View style={styles.bossTrack}>
            <View style={[styles.bossFill, { width: `${session.bossHealth}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function EvidenceGrid({ act, answer, onChoose }) {
  const directChoice = act.choices.every((choice) => (
    act.fields?.some((field) => field.id === choice.id)
  ));

  return (
    <View style={styles.fieldsGrid}>
      {act.fields.map((field) => {
        const selected = answer?.choiceId === field.id;
        const correct = selected && answer.correct;
        const wrong = selected && !answer.correct;
        const fieldStyle = [
          styles.field,
          selected && styles.fieldSelected,
          correct && styles.fieldCorrect,
          wrong && styles.fieldWrong,
        ];
        const content = (
          <>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <View style={styles.fieldValueRow}>
              <Text style={styles.fieldValue}>{field.value}</Text>
              {correct ? <Ionicons color={BRAND.green} name="checkmark-circle" size={20} /> : null}
              {wrong ? <Ionicons color={BRAND.red} name="close-circle" size={20} /> : null}
            </View>
          </>
        );

        return directChoice ? (
          <TouchableOpacity
            accessibilityLabel={`${field.label}, ${field.value}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(answer), selected }}
            activeOpacity={0.78}
            disabled={Boolean(answer)}
            key={field.id}
            onPress={() => onChoose(field.id)}
            style={fieldStyle}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={field.id} style={fieldStyle}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

function Scene({ act, answer, onChoose }) {
  return (
    <View style={styles.sceneCard}>
      {act.scene === 'quote' ? (
        <View style={styles.snapshotRow}>
          <View>
            <Text style={styles.snapshotTitle}>PRACTICE SNAPSHOT</Text>
            <Text style={styles.snapshotSubtitle}>NOT LIVE MARKET DATA</Text>
          </View>
          <Ionicons color={BRAND.orange} name="timer-outline" size={24} />
        </View>
      ) : null}
      {act.reference ? (
        <View style={styles.referenceCard}>
          <Ionicons color={BRAND.purple} name="flag" size={17} />
          <Text style={styles.referenceText}>{act.reference}</Text>
        </View>
      ) : null}
      {act.scene === 'message' ? (
        <View style={styles.messageCard}>
          <View style={styles.senderRow}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderAvatarText}>🤖</Text>
            </View>
            <View style={styles.senderCopy}>
              <Text style={styles.sender}>{act.sender}</Text>
              <Text style={styles.timestamp}>방금 전 · 고정 연습 메시지</Text>
            </View>
          </View>
          <Text style={styles.message}>{act.message}</Text>
        </View>
      ) : (
        <EvidenceGrid act={act} answer={answer} onChoose={onChoose} />
      )}
    </View>
  );
}

function Choices({ act, answer, onChoose }) {
  const choicesAreFields = act.choices.every((choice) => (
    act.fields?.some((field) => field.id === choice.id)
  ));
  if (choicesAreFields) return null;

  return (
    <View style={styles.choices}>
      {act.choices.map((choice) => {
        const selected = answer?.choiceId === choice.id;
        const selectedCorrect = selected && answer.correct;
        const selectedWrong = selected && !answer.correct;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(answer), selected }}
            activeOpacity={0.82}
            disabled={Boolean(answer)}
            key={choice.id}
            onPress={() => onChoose(choice.id)}
            style={[
              styles.choiceButton,
              selected && (answer.correct ? styles.fieldCorrect : styles.fieldWrong),
            ]}
          >
            <Ionicons
              color={selectedCorrect ? BRAND.green : selectedWrong ? BRAND.red : BRAND.purple}
              name={selectedCorrect ? 'checkmark-circle' : selectedWrong ? 'close-circle' : 'shield-outline'}
              size={22}
            />
            <Text style={styles.choiceText}>{choice.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Feedback({ answer }) {
  if (!answer) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.feedback, answer.correct ? styles.feedbackCorrect : styles.feedbackWrong]}
    >
      <Ionicons
        color={answer.correct ? BRAND.green : BRAND.red}
        name={answer.correct ? 'flash' : 'refresh-circle'}
        size={22}
      />
      <Text style={styles.feedbackText}>{answer.feedback}</Text>
      {answer.points > 0 ? <Text style={styles.points}>+{answer.points}</Text> : null}
    </View>
  );
}

function RaidAct({ act, answer, finalAct, onChoose, onNext, session }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <RaidStatus session={session} />
      <Text style={styles.actEyebrow}>{act.eyebrow}</Text>
      <Text style={styles.actTitle}>{act.title}</Text>
      <Text style={styles.actPrompt}>{act.prompt}</Text>
      <Scene act={act} answer={answer} onChoose={onChoose} />
      <Choices act={act} answer={answer} onChoose={onChoose} />
      <Feedback answer={answer} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !answer }}
        activeOpacity={0.84}
        disabled={!answer}
        onPress={onNext}
        style={[styles.primaryButton, !answer && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{finalAct ? '레이드 결과 보기' : '다음 ACT'}</Text>
        <Ionicons color="#FFF" name="arrow-forward" size={20} />
      </TouchableOpacity>
      <Text style={styles.trainingNote}>오답이어도 이유를 읽고 다음 안전 신호를 연습할 수 있어요.</Text>
    </ScrollView>
  );
}

function Result({ onClose, onReplay, result }) {
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.resultContent]} showsVerticalScrollIndicator={false}>
      <Text style={styles.resultEmoji}>{result.cleared ? '🏆' : '🛡️'}</Text>
      <Text style={styles.resultKicker}>BASE SAFETY RAID · W0</Text>
      <Text style={styles.resultTitle}>{result.cleared ? 'BOSS CLEAR!' : 'SAFETY REVIEW'}</Text>
      <Text style={styles.resultSubtitle}>
        {result.cleared
          ? '네 가지 안전 신호를 한 번에 모두 찾았어요.'
          : '놓친 신호를 다시 보고 완벽 방어에 도전해 보세요.'}
      </Text>
      <View style={styles.resultGrid}>
        <View style={styles.resultStat}>
          <Text style={styles.resultValue}>{result.correctCount}/{result.actCount}</Text>
          <Text style={styles.resultLabel}>Safety hits</Text>
        </View>
        <View style={styles.resultStat}>
          <Text style={styles.resultValue}>{result.score}</Text>
          <Text style={styles.resultLabel}>Session score</Text>
        </View>
      </View>
      <View style={styles.takeawayCard}>
        <Text style={styles.takeawayLabel}>FINAL RULE</Text>
        <Text style={styles.takeawayText}>
          계정·영수증·메시지·견적 중 하나라도 어긋나면 멈추고 다시 확인하세요.
        </Text>
      </View>
      <Text style={styles.localOnlyText}>
        이 결과는 학습용이며 배지·Orange·자산으로 저장되거나 지급되지 않습니다.
      </Text>
      <TouchableOpacity accessibilityRole="button" onPress={onReplay} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>다시 도전</Text>
        <Ionicons color="#FFF" name="refresh" size={20} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Practice Arcade로 돌아가기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function WeeklyOnchainBoss({ navigation }) {
  const { lease } = useDeviceAccountOperationLease();
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState(null);
  const sessionRef = useRef(session);
  const appStateRef = useRef(AppState.currentState);
  const leaseRef = useRef(lease);
  sessionRef.current = session;

  const invalidateSession = useCallback((message) => {
    if (!sessionRef.current) return;
    sessionRef.current = null;
    setSession(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (shouldInvalidateWeeklyOnchainBossForAppState(previousState, nextState)) {
        invalidateSession('앱이 백그라운드로 이동해 안전을 위해 레이드가 초기화됐어요.');
      }
    });
    return () => subscription.remove();
  }, [invalidateSession]);

  useEffect(() => {
    const previousLease = leaseRef.current;
    leaseRef.current = lease;
    if (sameWeeklyOnchainBossLease(previousLease, lease)) return;
    invalidateSession('로그인 계정이 바뀌어 안전을 위해 레이드가 초기화됐어요.');
  }, [invalidateSession, lease]);

  const act = session?.status === 'playing'
    ? WEEKLY_ONCHAIN_BOSS_W0.acts[session.actIndex] || null
    : null;
  const answer = act
    ? session.answers.find((candidate) => candidate.actId === act.id) || null
    : null;
  const result = useMemo(
    () => session?.status === 'complete' ? summarizeWeeklyOnchainBossSession(session) : null,
    [session],
  );

  const start = useCallback(() => {
    Haptics.selectionAsync();
    setNotice('');
    setSession(createWeeklyOnchainBossSession());
  }, []);

  const choose = useCallback((choiceId) => {
    const next = answerWeeklyOnchainBossAct(session, choiceId);
    if (!next.accepted) return;
    setSession(next.session);
    Haptics.notificationAsync(
      next.answer.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, [session]);

  const advance = useCallback(() => {
    const next = advanceWeeklyOnchainBossAct(session);
    if (!next.advanced) return;
    Haptics.selectionAsync();
    setSession(next.session);
  }, [session]);

  const close = useCallback(() => {
    Haptics.selectionAsync();
    navigation?.goBack();
  }, [navigation]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <Header onClose={close} />
      {session ? <SafetyBanner /> : null}
      {!session ? (
        <Intro notice={notice} onStart={start} />
      ) : result ? (
        <Result onClose={close} onReplay={start} result={result} />
      ) : act ? (
        <RaidAct
          act={act}
          answer={answer}
          finalAct={session.actIndex === WEEKLY_ONCHAIN_BOSS_W0.acts.length - 1}
          onChoose={choose}
          onNext={advance}
          session={session}
        />
      ) : (
        <Intro notice="레이드 상태를 확인할 수 없어 안전하게 초기화했어요." onStart={start} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actEyebrow: { color: '#C9B9FF', fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1.2, marginTop: 18 },
  actPrompt: { color: '#D8D0E5', fontFamily: 'GmarketMedium', fontSize: 13, lineHeight: 21, marginBottom: 15, marginTop: 8 },
  actTitle: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 25, letterSpacing: -0.6, marginTop: 7 },
  bossCopy: { flex: 1 },
  bossEmoji: { fontSize: 32 },
  bossFill: { backgroundColor: '#FF4D6D', borderRadius: 5, height: 9 },
  bossLabel: { color: '#A89AB7', fontFamily: 'GmarketBold', fontSize: 8, letterSpacing: 1 },
  bossMetaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bossRow: { alignItems: 'center', flexDirection: 'row', gap: 11, marginTop: 13 },
  bossTrack: { backgroundColor: '#3A2E49', borderRadius: 5, height: 9, overflow: 'hidden' },
  bossValue: { color: '#FF9BAD', fontFamily: 'GmarketBold', fontSize: 9 },
  buttonDisabled: { opacity: 0.36 },
  choiceButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#D7C9E8', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 10, minHeight: 62, padding: 13 },
  choiceText: { color: BRAND.black, flex: 1, fontFamily: 'GmarketBold', fontSize: 12, lineHeight: 18 },
  choices: { gap: 9, marginBottom: 12 },
  content: { padding: 18, paddingBottom: 34 },
  feedback: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 9, marginBottom: 13, padding: 13 },
  feedbackCorrect: { backgroundColor: '#EAFBF2' },
  feedbackText: { color: '#2E2634', flex: 1, fontFamily: 'GmarketBold', fontSize: 11, lineHeight: 17 },
  feedbackWrong: { backgroundColor: '#FFF0EE' },
  field: { backgroundColor: '#FFFDFC', borderColor: '#DACDE8', borderRadius: 13, borderWidth: 2, minHeight: 70, padding: 11, width: '48.5%' },
  fieldCorrect: { backgroundColor: '#ECFDF3', borderColor: BRAND.green },
  fieldLabel: { color: '#806F8F', fontFamily: 'GmarketBold', fontSize: 8, marginBottom: 7, textTransform: 'uppercase' },
  fieldSelected: { borderColor: BRAND.purple },
  fieldValue: { color: BRAND.black, flex: 1, fontFamily: 'GmarketBold', fontSize: 11 },
  fieldValueRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  fieldWrong: { backgroundColor: '#FFF0EE', borderColor: BRAND.red },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  header: { alignItems: 'center', borderBottomColor: '#30263B', borderBottomWidth: 1, flexDirection: 'row', minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 },
  headerCopy: { flex: 1, paddingHorizontal: 11 },
  headerKicker: { color: '#C9B9FF', fontFamily: 'GmarketBold', fontSize: 8, letterSpacing: 1.1 },
  headerTitle: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 17, marginTop: 3 },
  hero: { alignItems: 'center', backgroundColor: '#241A31', borderColor: BRAND.purple, borderRadius: 24, borderWidth: 2, overflow: 'hidden', padding: 20 },
  heroBody: { color: '#D8D0E5', fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 19, marginTop: 11, textAlign: 'center' },
  heroEmoji: { fontSize: 63, marginVertical: 11 },
  heroKicker: { color: '#C9B9FF', fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1.2 },
  heroTitle: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 26, letterSpacing: -0.7, lineHeight: 34, textAlign: 'center' },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  localOnlyText: { color: '#AA9DB7', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 16, marginTop: 13, textAlign: 'center' },
  mapAct: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  mapCopy: { flex: 1 },
  mapEyebrow: { color: '#9E8EAE', fontFamily: 'GmarketBold', fontSize: 8, letterSpacing: 0.8 },
  mapNumber: { alignItems: 'center', backgroundColor: '#2E2140', borderColor: '#8E72FF', borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  mapNumberText: { color: '#E6DEFF', fontFamily: 'GmarketBold', fontSize: 13 },
  mapTitle: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 13, marginTop: 3 },
  message: { color: BRAND.black, fontFamily: 'GmarketMedium', fontSize: 13, lineHeight: 21, marginTop: 14 },
  messageCard: { backgroundColor: '#FFF9F4', borderColor: '#E43D63', borderRadius: 17, borderWidth: 2, padding: 15 },
  notice: { alignItems: 'center', backgroundColor: '#392740', borderColor: '#8A4A65', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 13, padding: 12 },
  noticeText: { color: '#FFE5EE', flex: 1, fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 16 },
  points: { color: '#A34300', fontFamily: 'GmarketBold', fontSize: 11 },
  primaryButton: { alignItems: 'center', backgroundColor: BRAND.orange, borderColor: '#FFE2CE', borderRadius: 17, borderWidth: 2, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 18, width: '100%' },
  primaryButtonText: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 14 },
  progressFill: { backgroundColor: BRAND.purple, borderRadius: 4, height: 7 },
  progressTrack: { backgroundColor: '#3A2E49', borderRadius: 4, height: 7, overflow: 'hidden' },
  raidMap: { backgroundColor: '#1D1628', borderColor: '#392F46', borderRadius: 19, borderWidth: 1, gap: 13, marginBottom: 16, padding: 15 },
  referenceCard: { alignItems: 'center', backgroundColor: '#F0EDFF', borderRadius: 12, flexDirection: 'row', gap: 7, marginBottom: 10, padding: 10 },
  referenceText: { color: '#4A36AF', flex: 1, fontFamily: 'GmarketBold', fontSize: 10 },
  resultContent: { alignItems: 'center', justifyContent: 'center', minHeight: 650 },
  resultEmoji: { fontSize: 72 },
  resultGrid: { flexDirection: 'row', gap: 10, marginBottom: 15, width: '100%' },
  resultKicker: { color: '#C9B9FF', fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1.1, marginTop: 8 },
  resultLabel: { color: '#8B7D94', fontFamily: 'GmarketMedium', fontSize: 9, marginTop: 4 },
  resultStat: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#CDBFEB', borderRadius: 17, borderWidth: 2, flex: 1, padding: 14 },
  resultSubtitle: { color: '#D3CADC', fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 19, marginBottom: 18, marginTop: 8, textAlign: 'center' },
  resultTitle: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 28, marginTop: 6 },
  resultValue: { color: '#5639D5', fontFamily: 'GmarketBold', fontSize: 22 },
  safetyBanner: { alignItems: 'center', backgroundColor: '#422917', borderBottomColor: '#6B452B', borderBottomWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  safetyText: { color: '#FFE3CF', flex: 1, fontFamily: 'GmarketMedium', fontSize: 9, lineHeight: 14 },
  sceneCard: { backgroundColor: BRAND.cream, borderColor: '#AE96E2', borderRadius: 20, borderWidth: 2, marginBottom: 12, padding: 15 },
  score: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 10 },
  screen: { backgroundColor: BRAND.background, flex: 1 },
  secondaryButton: { alignItems: 'center', borderColor: '#9B82FF', borderRadius: 17, borderWidth: 2, justifyContent: 'center', marginTop: 10, minHeight: 54, width: '100%' },
  secondaryButtonText: { color: '#DCD2FF', fontFamily: 'GmarketBold', fontSize: 13 },
  sender: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 11 },
  senderAvatar: { alignItems: 'center', backgroundColor: '#FFE7ED', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  senderAvatarText: { fontSize: 22 },
  senderCopy: { flex: 1 },
  senderRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  shields: { color: '#8FE0B4', fontFamily: 'GmarketBold', fontSize: 12 },
  snapshotRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  snapshotSubtitle: { color: '#8B7A91', fontFamily: 'GmarketMedium', fontSize: 8, marginTop: 3 },
  snapshotTitle: { color: '#6C42D6', fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 0.8 },
  statusCard: { backgroundColor: '#21182C', borderColor: '#443552', borderRadius: 17, borderWidth: 1, padding: 13 },
  statusLabel: { color: '#C9B9FF', flex: 1, fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 11, marginBottom: 9 },
  takeawayCard: { backgroundColor: '#2A1F38', borderColor: '#57436B', borderRadius: 18, borderWidth: 1, marginBottom: 3, padding: 16, width: '100%' },
  takeawayLabel: { color: '#C9B9FF', fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1, marginBottom: 6 },
  takeawayText: { color: BRAND.white, fontFamily: 'GmarketBold', fontSize: 13, lineHeight: 20 },
  timestamp: { color: '#8E7E88', fontFamily: 'GmarketMedium', fontSize: 9, marginTop: 3 },
  trainingNote: { color: '#A89BB3', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 16, marginTop: 11, textAlign: 'center' },
  w0Pill: { alignItems: 'center', backgroundColor: '#2E2140', borderRadius: 17, height: 34, justifyContent: 'center', width: 42 },
  w0PillText: { color: '#D7CBFF', fontFamily: 'GmarketBold', fontSize: 11 },
});
