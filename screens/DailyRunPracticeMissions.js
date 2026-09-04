import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { PRACTICE_MISSIONS, getPracticeMission } from '../data/practiceMissions.mjs';
import { WEEKLY_ONCHAIN_BOSS_W0_ENABLED } from '../data/weeklyOnchainBoss.mjs';
import {
  advancePracticeRound,
  answerPracticeRound,
  createPracticeMissionSession,
  summarizePracticeSession,
} from '../utils/dailyRunPracticeEngine.mjs';

const BRAND = Object.freeze({
  background: '#FFF8F0',
  black: '#17120F',
  cream: '#FFF0DF',
  green: '#1F9D62',
  orange: '#FF6813',
  orangeDark: '#D94D00',
  pink: '#FFB0BE',
  red: '#D92D20',
  white: '#FFFEFC',
});

const TAKEAWAYS = Object.freeze({
  'receipt-detective': 'Status → Network → To를 차례로 확인하면 영수증의 핵심을 놓치지 않아요.',
  'scam-shield-duel': '비밀정보 요청과 긴급 링크는 막고, 공개 정보도 공식 화면에서 확인해요.',
  'live-quote-boss': '큰 예상값보다 만료·가격 영향·최소 수령액을 먼저 읽어요.',
});

function Header({ onClose, title }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityLabel="연습 미션 닫기"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onClose}
        style={styles.iconButton}
      >
        <Ionicons color={BRAND.black} name="close" size={25} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.headerKicker}>EASYGO PRACTICE ARCADE</Text>
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.headerOrange}>
        <Text style={styles.headerOrangeText}>🍊</Text>
      </View>
    </View>
  );
}

function SafetyBanner({ compact = false }) {
  return (
    <View accessibilityRole="summary" style={[styles.safetyBanner, compact && styles.safetyBannerCompact]}>
      <Ionicons color="#8A3417" name="shield-checkmark" size={18} />
      <Text style={styles.safetyText}>
        고정 연습 데이터 · 실제 가격/견적 아님 · 서명·전송·자산 이동 없음
      </Text>
    </View>
  );
}

function MissionCard({ best, mission, onPress }) {
  return (
    <TouchableOpacity
      accessibilityHint="세 라운드 연습 게임을 시작합니다"
      accessibilityLabel={`${mission.title}, ${mission.subtitle}`}
      accessibilityRole="button"
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.missionCard, { borderColor: mission.accent }]}
    >
      <View style={[styles.missionIcon, { backgroundColor: `${mission.accent}18` }]}>
        <Text style={styles.missionEmoji}>{mission.emoji}</Text>
      </View>
      <View style={styles.missionCopy}>
        <Text style={[styles.missionEyebrow, { color: mission.accent }]}>{mission.eyebrow}</Text>
        <Text style={styles.missionTitle}>{mission.title}</Text>
        <Text style={styles.missionSubtitle}>{mission.subtitle}</Text>
        <View style={styles.missionMetaRow}>
          <Text style={styles.missionMeta}>{mission.time}</Text>
          <Text style={styles.missionMeta}>3 rounds</Text>
          {best ? <Text style={[styles.bestScore, { color: mission.accent }]}>BEST {best.score}</Text> : null}
        </View>
      </View>
      <Ionicons color={mission.accent} name="play-circle" size={34} />
    </TouchableOpacity>
  );
}

function MissionHub({ bestResults, onOpenWeeklyBoss, onSelect }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>PHASE 2 · FUN TEST</Text>
        <Text style={styles.heroTitle}>실전 전에,{`\n`}게임으로 감 잡기</Text>
        <Text style={styles.heroBody}>
          서로 다른 세 가지 조작을 직접 해보고 어떤 미션이 가장 다시 하고 싶은지 골라 주세요.
        </Text>
      </View>
      <SafetyBanner />
      <Text style={styles.sectionTitle}>오늘 열려 있는 미션</Text>
      {PRACTICE_MISSIONS.map((mission) => (
        <MissionCard
          best={bestResults[mission.id]}
          key={mission.id}
          mission={mission}
          onPress={() => onSelect(mission.id)}
        />
      ))}
      {WEEKLY_ONCHAIN_BOSS_W0_ENABLED ? (
        <TouchableOpacity
          accessibilityHint="네 개의 고정 훈련 ACT로 구성된 오프라인 레이드를 시작합니다"
          accessibilityLabel="Weekly Onchain Boss W0"
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={onOpenWeeklyBoss}
          style={styles.weeklyBossCard}
        >
          <View style={styles.weeklyBossIcon}>
            <Text style={styles.weeklyBossEmoji}>🐲</Text>
          </View>
          <View style={styles.weeklyBossCopy}>
            <Text style={styles.weeklyBossEyebrow}>WEEKLY RAID · W0 OFFLINE</Text>
            <Text style={styles.weeklyBossTitle}>Weekly Onchain Boss</Text>
            <Text style={styles.weeklyBossSubtitle}>계정·영수증·사기·견적을 잇는 4 ACT 안전 레이드</Text>
          </View>
          <Ionicons color="#6E4AFF" name="flash" size={30} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.feedbackPrompt}>
        <Text style={styles.feedbackPromptTitle}>재미 확인 기준</Text>
        <Text style={styles.feedbackPromptText}>
          설명 없이 다시 할 수 있나요? · 바로 재도전하고 싶나요? · 실제 행동이 아니라는 점이 명확한가요?
        </Text>
      </View>
    </ScrollView>
  );
}

function StatusStrip({ mission, session }) {
  const progress = ((session.roundIndex + 1) / mission.rounds.length) * 100;
  const hearts = Array.from({ length: 3 }, (_, index) => index < session.hearts ? '♥' : '♡').join(' ');
  return (
    <View style={styles.statusWrap}>
      <View style={styles.statusRow}>
        <Text style={[styles.statusMission, { color: mission.accent }]}>{mission.eyebrow}</Text>
        <Text accessibilityLabel={`${session.hearts} shield hearts`} style={styles.hearts}>{hearts}</Text>
        <Text style={styles.score}>{session.score} PTS</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: mission.accent, width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function EvidenceFields({ accent, answer, fields, onChoose }) {
  return (
    <View style={styles.fieldsGrid}>
      {fields.map((field) => {
        const selected = answer?.choiceId === field.id;
        const correct = selected && answer.correct;
        const wrong = selected && !answer.correct;
        return (
          <TouchableOpacity
            accessibilityLabel={`${field.label}, ${field.value}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(answer), selected }}
            activeOpacity={0.78}
            disabled={Boolean(answer)}
            key={field.id}
            onPress={() => onChoose(field.id)}
            style={[
              styles.field,
              selected && { borderColor: accent },
              correct && styles.fieldCorrect,
              wrong && styles.fieldWrong,
            ]}
          >
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <View style={styles.fieldValueRow}>
              <Text style={styles.fieldValue}>{field.value}</Text>
              {correct ? <Ionicons color={BRAND.green} name="checkmark-circle" size={20} /> : null}
              {wrong ? <Ionicons color={BRAND.red} name="close-circle" size={20} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ReceiptRound({ answer, mission, onChoose, round }) {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.cardTopRow}>
        <Text style={[styles.cardTag, { color: mission.accent }]}>TRAINING RECEIPT</Text>
        <Text style={styles.cardHash}>0x7A…19F</Text>
      </View>
      {round.reference ? (
        <View style={styles.referenceCard}>
          <Ionicons color={mission.accent} name="flag" size={17} />
          <Text style={styles.referenceText}>{round.reference}</Text>
        </View>
      ) : null}
      <EvidenceFields
        accent={mission.accent}
        answer={answer}
        fields={round.receipt}
        onChoose={onChoose}
      />
    </View>
  );
}

function ScamRound({ answer, mission, onChoose, round }) {
  return (
    <>
      <View style={[styles.scamBot, { borderColor: mission.accent }]}>
        <View style={styles.scamSenderRow}>
          <View style={[styles.botAvatar, { backgroundColor: `${mission.accent}18` }]}>
            <Text style={styles.botAvatarText}>🤖</Text>
          </View>
          <View style={styles.scamSenderCopy}>
            <Text style={styles.scamSender}>{round.sender}</Text>
            <Text style={styles.scamTimestamp}>방금 전 · 연습 메시지</Text>
          </View>
        </View>
        <Text style={styles.scamMessage}>{round.message}</Text>
      </View>
      <View style={styles.duelActions}>
        {round.choices.map((choice) => {
          const selected = answer?.choiceId === choice.id;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(answer), selected }}
              activeOpacity={0.8}
              disabled={Boolean(answer)}
              key={choice.id}
              onPress={() => onChoose(choice.id)}
              style={[
                styles.duelButton,
                selected && (answer.correct ? styles.fieldCorrect : styles.fieldWrong),
              ]}
            >
              <Ionicons
                color={choice.id === 'verify' ? '#5271FF' : mission.accent}
                name={choice.id === 'verify' ? 'search' : 'shield'}
                size={21}
              />
              <Text style={styles.duelButtonText}>{choice.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

function QuoteRound({ answer, correctHits, countdown, mission, onChoose, round }) {
  const timerText = `00:${String(countdown).padStart(2, '0')}`;
  const bossHealth = Math.max(0, 100 - (correctHits * 34));
  return (
    <View style={[styles.challengeCard, styles.quoteCard]}>
      <View style={styles.cardTopRow}>
        <View>
          <Text style={[styles.cardTag, { color: mission.accent }]}>PRACTICE SNAPSHOT</Text>
          <Text style={styles.notLive}>NOT LIVE MARKET DATA</Text>
        </View>
        <View style={[styles.timerPill, countdown === 0 && styles.timerExpired]}>
          <Ionicons color={countdown === 0 ? '#FFF' : mission.accent} name="timer-outline" size={17} />
          <Text style={[styles.timerText, countdown === 0 && styles.timerTextExpired]}>
            {timerText}
          </Text>
        </View>
      </View>
      <Text style={styles.bonusTimerNote}>BONUS TIMER · 견적 만료와 무관 · 점수 영향 없음</Text>
      <View style={styles.bossRow}>
        <Text style={styles.bossEmoji}>👾</Text>
        <View style={styles.bossHealthTrack}>
          <View
            style={[
              styles.bossHealthFill,
              { backgroundColor: mission.accent, width: `${bossHealth}%` },
            ]}
          />
        </View>
      </View>
      <EvidenceFields
        accent={mission.accent}
        answer={answer}
        fields={round.quote}
        onChoose={onChoose}
      />
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

function ContinueButton({ answer, finalRound, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !answer }}
      activeOpacity={0.84}
      disabled={!answer}
      onPress={onPress}
      style={[styles.primaryButton, !answer && styles.buttonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{finalRound ? '결과 보기' : '다음 라운드'}</Text>
      <Ionicons color="#FFF" name="arrow-forward" size={20} />
    </TouchableOpacity>
  );
}

function MissionPlay({ mission, onSessionChange, session }) {
  const round = mission.rounds[session.roundIndex];
  const answer = session.answers.find((candidate) => candidate.roundId === round.id) || null;
  const [countdown, setCountdown] = useState(round.timerSeconds || 0);
  const correctHits = session.answers.filter((candidate) => candidate.correct).length;

  useEffect(() => {
    setCountdown(round.timerSeconds || 0);
    if (!round.timerSeconds) return undefined;
    const timer = setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [round.id, round.timerSeconds]);

  const choose = useCallback((choiceId) => {
    const result = answerPracticeRound(session, choiceId);
    if (!result.accepted) return;
    onSessionChange(result.session);
    Haptics.notificationAsync(
      result.answer.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, [onSessionChange, session]);

  const next = useCallback(() => {
    const result = advancePracticeRound(session);
    if (!result.advanced) return;
    Haptics.selectionAsync();
    onSessionChange(result.session);
  }, [onSessionChange, session]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusStrip mission={mission} session={session} />
      <Text style={[styles.roundKicker, { color: mission.accent }]}>
        ROUND {session.roundIndex + 1}/{mission.rounds.length}
      </Text>
      <Text style={styles.roundTitle}>{round.prompt}</Text>
      {mission.id === 'receipt-detective' ? (
        <ReceiptRound answer={answer} mission={mission} onChoose={choose} round={round} />
      ) : null}
      {mission.id === 'scam-shield-duel' ? (
        <ScamRound answer={answer} mission={mission} onChoose={choose} round={round} />
      ) : null}
      {mission.id === 'live-quote-boss' ? (
        <QuoteRound
          answer={answer}
          correctHits={correctHits}
          countdown={countdown}
          mission={mission}
          onChoose={choose}
          round={round}
        />
      ) : null}
      <Feedback answer={answer} />
      <ContinueButton
        answer={answer}
        finalRound={session.roundIndex === mission.rounds.length - 1}
        onPress={next}
      />
      <Text style={styles.trainingNote}>오답이어도 탈락하지 않아요. 이유를 읽고 다음 단서를 찾아보세요.</Text>
    </ScrollView>
  );
}

function MissionResult({ mission, onHome, onReplay, result }) {
  const stars = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`;
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.resultContent]} showsVerticalScrollIndicator={false}>
      <Text style={styles.resultEmoji}>{mission.emoji}</Text>
      <Text style={[styles.resultBadge, { color: mission.accent }]}>{mission.badge}</Text>
      <Text style={styles.resultTitle}>MISSION CLEAR!</Text>
      <Text accessibilityLabel={`${result.stars} stars`} style={[styles.resultStars, { color: mission.accent }]}>
        {stars}
      </Text>
      <View style={styles.resultGrid}>
        <View style={styles.resultStat}>
          <Text style={styles.resultValue}>{result.score}</Text>
          <Text style={styles.resultLabel}>Session score</Text>
        </View>
        <View style={styles.resultStat}>
          <Text style={styles.resultValue}>{result.correctCount}/{result.roundCount}</Text>
          <Text style={styles.resultLabel}>First-try hits</Text>
        </View>
      </View>
      <View style={styles.takeawayCard}>
        <Text style={styles.takeawayLabel}>한 줄만 기억하기</Text>
        <Text style={styles.takeawayText}>{TAKEAWAYS[mission.id]}</Text>
      </View>
      <Text style={styles.localReward}>Stars와 점수는 이 화면의 재미 테스트용이며 저장·지급되지 않습니다.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onReplay} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>다시 도전</Text>
        <Ionicons color="#FFF" name="refresh" size={20} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onHome} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>다른 미션 고르기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function DailyRunPracticeMissions({ navigation }) {
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [bestResults, setBestResults] = useState({});
  const [session, setSession] = useState(null);
  const mission = useMemo(() => getPracticeMission(activeMissionId), [activeMissionId]);
  const result = useMemo(
    () => session?.status === 'complete' ? summarizePracticeSession(session) : null,
    [session],
  );

  useEffect(() => {
    if (!mission || !result) return;
    setBestResults((current) => {
      const previous = current[mission.id];
      if (previous && previous.score >= result.score) return current;
      return { ...current, [mission.id]: result };
    });
  }, [mission, result]);

  const startMission = useCallback((missionId) => {
    const nextSession = createPracticeMissionSession(missionId);
    if (!nextSession) return;
    Haptics.selectionAsync();
    setActiveMissionId(missionId);
    setSession(nextSession);
  }, []);

  const returnToHub = useCallback(() => {
    Haptics.selectionAsync();
    setActiveMissionId(null);
    setSession(null);
  }, []);

  const close = useCallback(() => {
    Haptics.selectionAsync();
    navigation?.goBack();
  }, [navigation]);

  const openWeeklyBoss = useCallback(() => {
    Haptics.selectionAsync();
    navigation?.navigate('WeeklyOnchainBoss');
  }, [navigation]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <Header onClose={close} title={mission?.title || 'Practice Arcade'} />
      {mission && session ? (
        <SafetyBanner compact />
      ) : null}
      {!mission || !session ? (
        <MissionHub
          bestResults={bestResults}
          onOpenWeeklyBoss={openWeeklyBoss}
          onSelect={startMission}
        />
      ) : result ? (
        <MissionResult
          mission={mission}
          onHome={returnToHub}
          onReplay={() => startMission(mission.id)}
          result={result}
        />
      ) : (
        <MissionPlay mission={mission} onSessionChange={setSession} session={session} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bestScore: { fontFamily: 'GmarketBold', fontSize: 9 },
  bossEmoji: { fontSize: 37 },
  bossHealthFill: { borderRadius: 6, height: 10 },
  bossHealthTrack: { backgroundColor: '#F0D7C8', borderRadius: 6, flex: 1, height: 10, overflow: 'hidden' },
  bossRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 15, marginTop: 10 },
  bonusTimerNote: { color: '#8A3417', fontFamily: 'GmarketBold', fontSize: 8, marginTop: -6, textAlign: 'right' },
  botAvatar: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  botAvatarText: { fontSize: 24 },
  buttonDisabled: { opacity: 0.36 },
  cardHash: { color: '#8B7D73', fontFamily: 'GmarketMedium', fontSize: 10 },
  cardTag: { fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1.1 },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  challengeCard: { backgroundColor: '#FFF', borderColor: '#DFC9BB', borderRadius: 20, borderWidth: 2, marginBottom: 14, padding: 15 },
  content: { paddingBottom: 28, paddingHorizontal: 18, paddingTop: 17 },
  duelActions: { gap: 10, marginBottom: 14 },
  duelButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#DCC7BA', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 10, minHeight: 58, paddingHorizontal: 15, paddingVertical: 11 },
  duelButtonText: { color: BRAND.black, flex: 1, fontFamily: 'GmarketBold', fontSize: 13, lineHeight: 19 },
  feedback: { alignItems: 'center', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 9, marginBottom: 14, padding: 13 },
  feedbackCorrect: { backgroundColor: '#ECFDF3', borderColor: '#9CE0BA' },
  feedbackPrompt: { backgroundColor: BRAND.cream, borderRadius: 18, marginTop: 3, padding: 16 },
  feedbackPromptText: { color: '#654F42', fontFamily: 'GmarketMedium', fontSize: 11, lineHeight: 18 },
  feedbackPromptTitle: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 12, marginBottom: 6 },
  feedbackText: { color: '#403832', flex: 1, fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 18 },
  feedbackWrong: { backgroundColor: '#FFF0EE', borderColor: '#F5B7B1' },
  field: { backgroundColor: '#FFFDFC', borderColor: '#E5D6CD', borderRadius: 13, borderWidth: 2, minHeight: 68, padding: 11, width: '48.5%' },
  fieldCorrect: { backgroundColor: '#ECFDF3', borderColor: BRAND.green },
  fieldLabel: { color: '#88766B', fontFamily: 'GmarketBold', fontSize: 9, marginBottom: 6, textTransform: 'uppercase' },
  fieldValue: { color: BRAND.black, flex: 1, fontFamily: 'GmarketBold', fontSize: 12 },
  fieldValueRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  fieldWrong: { backgroundColor: '#FFF0EE', borderColor: BRAND.red },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  header: { alignItems: 'center', borderBottomColor: '#EBDDD4', borderBottomWidth: 1, flexDirection: 'row', minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 },
  headerCopy: { flex: 1, paddingHorizontal: 11 },
  headerKicker: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 8, letterSpacing: 1.1 },
  headerOrange: { alignItems: 'center', backgroundColor: BRAND.cream, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  headerOrangeText: { fontSize: 21 },
  headerTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 17, marginTop: 3 },
  hearts: { color: '#E43D63', fontFamily: 'GmarketBold', fontSize: 14 },
  hero: { backgroundColor: BRAND.cream, borderColor: BRAND.black, borderRadius: 22, borderWidth: 2, marginBottom: 13, overflow: 'hidden', padding: 18 },
  heroBody: { color: '#66544A', fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 19, marginTop: 10 },
  heroKicker: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 27, letterSpacing: -0.7, lineHeight: 34, marginTop: 8 },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  localReward: { color: '#78685E', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 16, marginBottom: 17, textAlign: 'center' },
  missionCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 19, borderWidth: 2, flexDirection: 'row', gap: 11, marginBottom: 11, minHeight: 128, padding: 13 },
  missionCopy: { flex: 1 },
  missionEmoji: { fontSize: 31 },
  missionEyebrow: { fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1 },
  missionIcon: { alignItems: 'center', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  missionMeta: { color: '#8B7D73', fontFamily: 'GmarketMedium', fontSize: 9 },
  missionMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 8 },
  missionSubtitle: { color: '#6F6057', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 15, marginTop: 4 },
  missionTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 16, marginTop: 3 },
  notLive: { color: '#8B7D73', fontFamily: 'GmarketMedium', fontSize: 8, marginTop: 3 },
  points: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: BRAND.orange, borderColor: BRAND.black, borderRadius: 17, borderWidth: 2, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 18, width: '100%' },
  primaryButtonText: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 14 },
  progressFill: { borderRadius: 4, height: 7 },
  progressTrack: { backgroundColor: '#EADDD5', borderRadius: 4, height: 7, overflow: 'hidden' },
  quoteCard: { borderColor: '#F0B084' },
  referenceCard: { alignItems: 'center', backgroundColor: '#EEF1FF', borderRadius: 12, flexDirection: 'row', gap: 7, marginBottom: 10, padding: 10 },
  referenceText: { color: '#3347A8', flex: 1, fontFamily: 'GmarketBold', fontSize: 10 },
  resultBadge: { fontFamily: 'GmarketBold', fontSize: 11, letterSpacing: 1.2, marginTop: 6 },
  resultContent: { alignItems: 'center', justifyContent: 'center', minHeight: 650 },
  resultEmoji: { fontSize: 72 },
  resultGrid: { flexDirection: 'row', gap: 10, marginBottom: 15, width: '100%' },
  resultLabel: { color: '#786B62', fontFamily: 'GmarketMedium', fontSize: 10, marginTop: 4 },
  resultStars: { fontFamily: 'GmarketBold', fontSize: 29, letterSpacing: 5, marginBottom: 18, marginTop: 9 },
  resultStat: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#E4D3C9', borderRadius: 17, borderWidth: 2, flex: 1, padding: 14 },
  resultTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 27, marginTop: 6 },
  resultValue: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 22 },
  roundKicker: { fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1.2, marginTop: 18 },
  roundTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 24, letterSpacing: -0.6, lineHeight: 32, marginBottom: 16, marginTop: 7 },
  safetyBanner: { alignItems: 'center', backgroundColor: '#FFF1E8', borderColor: '#F3BE9E', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 18, padding: 12 },
  safetyBannerCompact: { borderRadius: 0, borderWidth: 0, marginBottom: 0, paddingHorizontal: 18, paddingVertical: 9 },
  safetyText: { color: '#7A351A', flex: 1, fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 15 },
  scamBot: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 2, marginBottom: 12, padding: 16 },
  scamMessage: { color: BRAND.black, fontFamily: 'GmarketMedium', fontSize: 14, lineHeight: 22, marginTop: 14 },
  scamSender: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 12 },
  scamSenderCopy: { flex: 1 },
  scamSenderRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  scamTimestamp: { color: '#908178', fontFamily: 'GmarketMedium', fontSize: 9, marginTop: 3 },
  score: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 11 },
  screen: { backgroundColor: BRAND.background, flex: 1 },
  secondaryButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: BRAND.orange, borderRadius: 17, borderWidth: 2, justifyContent: 'center', marginTop: 10, minHeight: 54, width: '100%' },
  secondaryButtonText: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 14 },
  sectionTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 15, marginBottom: 10 },
  statusMission: { flex: 1, fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 11, marginBottom: 9 },
  statusWrap: { backgroundColor: '#FFF', borderColor: '#E7D8CF', borderRadius: 15, borderWidth: 1, padding: 12 },
  takeawayCard: { backgroundColor: BRAND.cream, borderRadius: 18, marginBottom: 13, padding: 16, width: '100%' },
  takeawayLabel: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 10, marginBottom: 6 },
  takeawayText: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 14, lineHeight: 21 },
  timerExpired: { backgroundColor: BRAND.red },
  timerPill: { alignItems: 'center', backgroundColor: '#FFF1E8', borderRadius: 14, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 7 },
  timerText: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 11 },
  timerTextExpired: { color: '#FFF' },
  trainingNote: { color: '#88786E', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 16, marginTop: 11, textAlign: 'center' },
  weeklyBossCard: { alignItems: 'center', backgroundColor: '#1D1628', borderColor: '#6E4AFF', borderRadius: 19, borderWidth: 2, flexDirection: 'row', gap: 11, marginBottom: 11, minHeight: 128, padding: 13 },
  weeklyBossCopy: { flex: 1 },
  weeklyBossEmoji: { fontSize: 31 },
  weeklyBossEyebrow: { color: '#B6A2FF', fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1 },
  weeklyBossIcon: { alignItems: 'center', backgroundColor: '#302247', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  weeklyBossSubtitle: { color: '#D5CDE0', fontFamily: 'GmarketMedium', fontSize: 10, lineHeight: 15, marginTop: 4 },
  weeklyBossTitle: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 16, marginTop: 3 },
});
