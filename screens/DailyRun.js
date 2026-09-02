import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlobalContext } from '../contexts/GlobalContext';
import {
  useDeviceAccountData,
  useDeviceAccountOperationLease,
} from '../contexts/DeviceAccountDataContext';
import { DAILY_RUN_CURRICULUM } from '../data/dailyRunCurriculum.mjs';
import useEasyGoWalletRuntime from '../hooks/useEasyGoWalletRuntime';
import { createBaseScanAddressUrl } from '../utils/baseWalletRuntime.mjs';
import {
  completeDailyRun,
  dailyRunDateKey,
  getDailyRunState,
  hasDailyRunDateChanged,
} from '../utils/dailyRunProgress.mjs';

const BRAND = Object.freeze({
  background: '#FFF8F0',
  black: '#17120F',
  cream: '#FFF0DF',
  green: '#1F9D62',
  orange: '#FF6813',
  orangeDark: '#D94D00',
  pink: '#FFB0BE',
  white: '#FFFEFC',
});

const STAGES = Object.freeze(['Meme', 'Learn', 'Quiz', 'Do', 'Reward']);

function shortAddress(address) {
  if (typeof address !== 'string' || address.length < 12) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ProgressHeader({ lesson, stageIndex, onClose, guestMode }) {
  const stages = guestMode ? ['Meme', 'Learn', 'Quiz', 'Start'] : STAGES;
  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityLabel={guestMode ? '맛보기 닫기' : 'Daily Run 닫기'}
        accessibilityRole="button"
        hitSlop={12}
        onPress={onClose}
        style={styles.closeButton}
      >
        <Ionicons color={BRAND.black} name="close" size={26} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.eyebrow}>{guestMode ? '30초 맛보기' : `DAY ${lesson.day} · DAILY RUN`}</Text>
        <View style={styles.progressTrack}>
          {stages.map((label, index) => (
            <View
              accessibilityLabel={`${label} ${index <= stageIndex ? '완료 또는 진행 중' : '대기'}`}
              key={label}
              style={[
                styles.progressSegment,
                index <= stageIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.dayPill}>
        <Text style={styles.dayPillText}>{lesson.emoji}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({ disabled, label, loading, onPress, secondary = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.primaryButton,
        secondary && styles.secondaryButton,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? BRAND.black : '#FFF'} />
      ) : (
        <Text style={[styles.primaryButtonText, secondary && styles.secondaryButtonText]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function MemeStage({ lesson, onNext }) {
  const bounce = useRef(new Animated.Value(0)).current;

  const react = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(bounce, { toValue: -14, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [bounce]);

  return (
    <View style={styles.stage}>
      <Text style={styles.stageKicker}>3초 MEME HOOK</Text>
      <Text style={styles.stageTitle}>{lesson.title}</Text>
      <TouchableOpacity
        accessibilityHint="오렌지 캐릭터가 움직입니다"
        accessibilityLabel="밈에 반응하기"
        activeOpacity={0.9}
        onPress={react}
        style={styles.memeCard}
      >
        <Text style={styles.memeCopy}>{lesson.meme}</Text>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require('../assets/nice_orange.png')}
            style={styles.memeOrange}
          />
        </Animated.View>
        <Text style={styles.memePunchline}>{lesson.memePunchline}</Text>
        <Text style={styles.tapHint}>오렌지를 눌러 보세요</Text>
      </TouchableOpacity>
      <PrimaryButton label="15초 만에 이해하기" onPress={onNext} />
    </View>
  );
}

function LearnStage({ lesson, onNext }) {
  return (
    <View style={styles.stage}>
      <Text style={styles.stageKicker}>20초 LEARN</Text>
      <Text style={styles.stageTitle}>{lesson.title}</Text>
      <View style={styles.learnCard}>
        <View style={styles.learnIcon}>
          <Text style={styles.learnIconText}>{lesson.emoji}</Text>
        </View>
        <Text style={styles.learnBody}>{lesson.learn}</Text>
      </View>
      <View style={styles.takeawayCard}>
        <Text style={styles.takeawayLabel}>한 줄만 기억하기</Text>
        <Text style={styles.takeawayText}>{lesson.takeaway}</Text>
      </View>
      <PrimaryButton label="이해했어요 · 퀴즈 시작" onPress={onNext} />
    </View>
  );
}

function ChoiceList({ options, selectedId, successId, onSelect }) {
  return (
    <View style={styles.choiceList}>
      {options.map((option, index) => {
        const selected = selectedId === option.id;
        const correct = selected && option.correct;
        const wrong = selected && !option.correct;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected }}
            activeOpacity={0.78}
            key={option.id}
            onPress={() => onSelect(option)}
            style={[
              styles.choice,
              selected && styles.choiceSelected,
              correct && styles.choiceCorrect,
              wrong && styles.choiceWrong,
            ]}
          >
            <View style={styles.choiceIndex}>
              <Text style={styles.choiceIndexText}>{index + 1}</Text>
            </View>
            <Text style={styles.choiceText}>{option.label}</Text>
            {correct && <Ionicons color={BRAND.green} name="checkmark-circle" size={24} />}
            {wrong && <Ionicons color="#D92D20" name="close-circle" size={24} />}
          </TouchableOpacity>
        );
      })}
      {!!successId && <Text style={styles.choiceSuccess}>정답을 찾았어요! 다음으로 이동하세요.</Text>}
    </View>
  );
}

function QuizStage({ lesson, onNext }) {
  const [selectedId, setSelectedId] = useState(null);
  const [passed, setPassed] = useState(false);

  const select = useCallback((option) => {
    setSelectedId(option.id);
    if (option.correct) {
      setPassed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPassed(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  return (
    <View style={styles.stage}>
      <Text style={styles.stageKicker}>TAP QUIZ</Text>
      <Text style={styles.stageTitle}>{lesson.quiz.question}</Text>
      <ChoiceList
        onSelect={select}
        options={lesson.quiz.options}
        selectedId={selectedId}
        successId={passed ? selectedId : null}
      />
      {selectedId && (
        <View style={[styles.feedback, passed ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <Text style={styles.feedbackText}>
            {passed ? lesson.quiz.explanation : '괜찮아요. 힌트를 다시 읽고 바로 재도전해 보세요.'}
          </Text>
        </View>
      )}
      <PrimaryButton disabled={!passed} label="직접 해보기" onPress={onNext} />
    </View>
  );
}

function RuntimeStatus({ runtime }) {
  const presentation = {
    checking: ['확인 중', '#9A3412', '#FFF1E8'],
    ready: ['Base · 준비 완료', BRAND.green, '#EAFBF2'],
    'wallet-missing': ['지갑을 찾을 수 없음', '#B42318', '#FFF0EE'],
    'wrong-chain': ['Base 연결 필요', '#B42318', '#FFF0EE'],
    'account-mismatch': ['계정 확인 필요', '#B42318', '#FFF0EE'],
    error: ['다시 확인 필요', '#B42318', '#FFF0EE'],
    idle: ['로그인 필요', '#667085', '#F2F4F7'],
  }[runtime.status] || ['확인 필요', '#667085', '#F2F4F7'];

  return (
    <View style={[styles.runtimePill, { backgroundColor: presentation[2] }]}>
      <View style={[styles.runtimeDot, { backgroundColor: presentation[1] }]} />
      <Text style={[styles.runtimeText, { color: presentation[1] }]}>{presentation[0]}</Text>
    </View>
  );
}

function DoStage({ lesson, onReady, walletRuntime }) {
  const [selectedId, setSelectedId] = useState(null);
  const [actionReady, setActionReady] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const action = lesson.action;
  const baseScanUrl = createBaseScanAddressUrl(walletRuntime.walletAddress);

  const choose = useCallback((option) => {
    setSelectedId(option.id);
    setActionReady(Boolean(option.correct));
    Haptics.notificationAsync(
      option.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, []);

  const runAction = useCallback(async () => {
    setActionLoading(true);
    try {
      if (action.kind === 'wallet-ready') {
        if (walletRuntime.status !== 'ready') {
          walletRuntime.refresh?.();
          Alert.alert('Base 지갑 확인 필요', '잠시 후 다시 눌러 주세요. 거래나 서명은 발생하지 않습니다.');
          return;
        }
        setActionReady(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (action.kind === 'basescan') {
        if (!baseScanUrl || !(await Linking.canOpenURL(baseScanUrl))) {
          Alert.alert('BaseScan을 열 수 없어요', '내 지갑 주소가 준비된 뒤 다시 시도해 주세요.');
          return;
        }
        await Linking.openURL(baseScanUrl);
        setActionReady(true);
        return;
      }

    } catch {
      Alert.alert('실전 화면을 열 수 없어요', '네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setActionLoading(false);
    }
  }, [action.kind, baseScanUrl, walletRuntime]);

  return (
    <View style={styles.stage}>
      <Text style={styles.stageKicker}>SAFE PRACTICE</Text>
      <Text style={styles.stageTitle}>{action.title}</Text>
      <Text style={styles.actionDescription}>{action.description}</Text>

      {action.kind === 'choice' ? (
        <>
          <ChoiceList
            onSelect={choose}
            options={action.options}
            selectedId={selectedId}
            successId={actionReady ? selectedId : null}
          />
          {actionReady && (
            <View style={styles.feedbackCorrect}>
              <Text style={styles.feedbackText}>{action.success}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.practiceCard}>
          <View style={styles.practiceTopRow}>
            <Text style={styles.practiceEmoji}>{lesson.emoji}</Text>
            <RuntimeStatus runtime={walletRuntime} />
          </View>
          <Text style={styles.practiceLabel}>내 EasyGo Base 지갑</Text>
          <Text style={styles.practiceValue}>
            {shortAddress(walletRuntime.walletAddress) || '지갑 주소 확인 중'}
          </Text>
          <Text style={styles.safetyCopy}>
            읽기 전용 학습입니다. 서명, 전송, 자산 이동은 발생하지 않습니다.
          </Text>
          <PrimaryButton
            label={action.button}
            loading={actionLoading}
            onPress={runAction}
            secondary
          />
          {actionReady && (
            <Text style={styles.actionReadyText}>
              ✓ 실전 화면을 확인했어요. 이제 오늘의 Run을 완료할 수 있어요.
            </Text>
          )}
        </View>
      )}

      <PrimaryButton disabled={!actionReady} label="오늘의 Run 완료" onPress={onReady} />
    </View>
  );
}

function RewardCelebration() {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    const animation = Animated.spring(entrance, {
      damping: 9,
      mass: 0.7,
      stiffness: 160,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance]);

  const scale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const opacity = entrance.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.rewardCelebration,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={styles.rewardSparkles}>✦  ✦  ✦</Text>
      <Text style={styles.rewardEmoji}>🍊</Text>
      <Text style={styles.rewardCelebrationLabel}>RUN COMPLETE!</Text>
    </Animated.View>
  );
}

function RewardStage({ guestMode, lesson, onClose, progress, onShare }) {
  return (
    <View style={[styles.stage, styles.rewardStage]}>
      <RewardCelebration />
      <Text style={styles.rewardTitle}>{guestMode ? '첫 개념 완료!' : '오늘도 EasyGo!'}</Text>
      <Text style={styles.rewardSubtitle}>
        {guestMode
          ? '로그인하면 실제 Base 지갑과 7일 학습 여정을 이어갈 수 있어요.'
          : `${lesson.badge} 배지를 열고 학습 트리를 키웠어요.`}
      </Text>
      <View style={styles.rewardGrid}>
        <View style={styles.rewardStat}>
          <Text style={styles.rewardStatValue}>{guestMode ? '완료' : `+${lesson.xp}`}</Text>
          <Text style={styles.rewardStatLabel}>{guestMode ? '30초 맛보기' : 'Knowledge XP'}</Text>
        </View>
        <View style={styles.rewardStat}>
          <Text style={styles.rewardStatValue}>{guestMode ? '1' : progress.streak}</Text>
          <Text style={styles.rewardStatLabel}>Day streak</Text>
        </View>
      </View>
      <Text style={styles.localRewardNote}>
        {guestMode
          ? '맛보기는 XP나 Orange를 지급하거나 저장하지 않습니다.'
          : 'Knowledge XP는 구매·전송·현금화되지 않는 학습 진행 기록입니다.'}
      </Text>
      <PrimaryButton
        label={guestMode ? '로그인하고 7일 여정 시작' : '홈으로 돌아가기'}
        onPress={onClose}
      />
      {!guestMode && lesson.day === 7 && (
        <PrimaryButton
          label="학습 카드 공유 · 선택"
          onPress={onShare}
          secondary
        />
      )}
    </View>
  );
}

function JourneyComplete({ onClose, progress }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.stage, styles.rewardStage]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require('../assets/celebration_orange_streak.png')}
          style={styles.journeyImage}
        />
        <Text style={styles.rewardTitle}>7일 Web3 Starter 완료!</Text>
        <Text style={styles.rewardSubtitle}>
          이제 지갑, Base, 보안, 가스비, USDC와 견적을 한 문장씩 설명할 수 있어요.
        </Text>
        <View style={styles.rewardGrid}>
          <View style={styles.rewardStat}>
            <Text style={styles.rewardStatValue}>{progress.totalXp}</Text>
            <Text style={styles.rewardStatLabel}>Total XP</Text>
          </View>
          <View style={styles.rewardStat}>
            <Text style={styles.rewardStatValue}>7/7</Text>
            <Text style={styles.rewardStatLabel}>Runs</Text>
          </View>
        </View>
        <PrimaryButton label="홈으로 돌아가기" onPress={onClose} />
      </View>
    </SafeAreaView>
  );
}

function DailyRunExperience({ guestMode = false, navigation, onGuestClose }) {
  const { user } = useContext(GlobalContext);
  const {
    dailyRunProgress,
    saveDailyRunProgress,
    status: storageStatus,
  } = useDeviceAccountData();
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [dateKey, setDateKey] = useState(() => dailyRunDateKey());
  const summary = useMemo(
    () => getDailyRunState(guestMode ? null : dailyRunProgress, dateKey),
    [dailyRunProgress, dateKey, guestMode],
  );
  const lesson = guestMode ? DAILY_RUN_CURRICULUM[0] : summary.lesson;
  const [stageIndex, setStageIndex] = useState(
    !guestMode && summary.status === 'complete-today' ? 4 : 0,
  );
  const [saving, setSaving] = useState(false);
  const expectedWalletAddress = user?.profile?.data?.walletAddress || null;
  const walletRuntime = useEasyGoWalletRuntime({
    enabled: !guestMode,
    expectedAddress: expectedWalletAddress,
  });

  const refreshCalendarDate = useCallback(() => {
    const currentDateKey = dailyRunDateKey();
    if (!hasDailyRunDateChanged(dateKey, currentDateKey)) return false;

    const currentSummary = getDailyRunState(dailyRunProgress, currentDateKey);
    setDateKey(currentDateKey);
    setStageIndex(currentSummary.status === 'complete-today' ? 4 : 0);
    return true;
  }, [dailyRunProgress, dateKey]);

  useEffect(() => {
    if (guestMode) return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshCalendarDate();
    });
    return () => subscription.remove();
  }, [guestMode, refreshCalendarDate]);

  const close = useCallback(() => {
    Haptics.selectionAsync();
    if (guestMode) onGuestClose?.();
    else navigation?.goBack();
  }, [guestMode, navigation, onGuestClose]);

  const nextStage = useCallback(() => {
    Haptics.selectionAsync();
    setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
  }, []);

  const finishGuestQuiz = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStageIndex(STAGES.length - 1);
  }, []);

  const finish = useCallback(async () => {
    if (guestMode) {
      finishGuestQuiz();
      return;
    }
    if (refreshCalendarDate()) {
      Alert.alert('새 Daily Run이 열렸어요', '날짜가 바뀌어 오늘의 학습을 처음부터 다시 시작합니다.');
      return;
    }
    const expectedLease = lease;
    if (saving || !isCurrentLease(expectedLease)) return;

    const result = completeDailyRun({
      value: dailyRunProgress,
      dayId: lesson.id,
      dateKey,
    });
    if (!result.recorded) {
      if (['already_completed', 'daily_limit'].includes(result.reason)) {
        setStageIndex(STAGES.length - 1);
      } else if (result.reason === 'clock_before_history') {
        Alert.alert('기기 날짜를 확인해 주세요', '마지막 학습 기록보다 이전 날짜에는 새 Run을 완료할 수 없어요.');
      } else {
        Alert.alert('진행을 저장할 수 없어요', '홈으로 돌아간 뒤 다시 시작해 주세요.');
      }
      return;
    }

    setSaving(true);
    try {
      const saved = await saveDailyRunProgress(result.progress);
      if (!saved || !isCurrentLease(expectedLease)) {
        Alert.alert('진행을 저장하지 못했어요', '계정이나 저장소 상태를 확인한 뒤 다시 시도해 주세요.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStageIndex(STAGES.length - 1);
    } finally {
      if (isCurrentLease(expectedLease)) setSaving(false);
    }
  }, [
    dailyRunProgress,
    dateKey,
    finishGuestQuiz,
    guestMode,
    isCurrentLease,
    lease,
    lesson?.id,
    refreshCalendarDate,
    saveDailyRunProgress,
    saving,
  ]);

  const shareCompletion = useCallback(async () => {
    try {
      await Share.share({
        message: 'EasyGo Web3 Starter 7일 완료 🍊\n지갑은 코인 주머니가 아니라 블록체인 자산을 관리하는 열쇠예요.\n#EasyGo #Web3MadeSimple',
      });
    } catch {
      Alert.alert('공유 카드를 열 수 없어요', '잠시 후 다시 시도해 주세요.');
    }
  }, []);

  if (!guestMode && summary.status === 'journey-complete') {
    return <JourneyComplete onClose={close} progress={summary.progress} />;
  }

  if (!lesson || (!guestMode && storageStatus !== 'ready')) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={BRAND.orange} size="large" />
          <Text style={styles.loadingText}>오늘의 Run을 준비하고 있어요…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ProgressHeader
        guestMode={guestMode}
        lesson={lesson}
        onClose={close}
        stageIndex={stageIndex}
      />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {stageIndex === 0 && <MemeStage lesson={lesson} onNext={nextStage} />}
        {stageIndex === 1 && <LearnStage lesson={lesson} onNext={nextStage} />}
        {stageIndex === 2 && (
          <QuizStage
            lesson={lesson}
            onNext={guestMode ? finishGuestQuiz : nextStage}
          />
        )}
        {stageIndex === 3 && (
          <DoStage
            lesson={lesson}
            onReady={finish}
            walletRuntime={walletRuntime}
          />
        )}
        {stageIndex === 4 && (
          <RewardStage
            guestMode={guestMode}
            lesson={lesson}
            onClose={close}
            onShare={shareCompletion}
            progress={summary.progress}
          />
        )}
        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator color={BRAND.orange} size="large" />
            <Text style={styles.loadingText}>오늘의 성장을 저장하고 있어요…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function DailyRunGuestSample({ onClose }) {
  return <DailyRunExperience guestMode onGuestClose={onClose} />;
}

export default function DailyRun({ navigation }) {
  return <DailyRunExperience navigation={navigation} />;
}

const styles = StyleSheet.create({
  actionDescription: {
    color: '#5F514A',
    fontFamily: 'GmarketMedium',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  actionReadyText: {
    color: BRAND.green,
    fontFamily: 'GmarketBold',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  buttonDisabled: { opacity: 0.42 },
  choice: {
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderColor: '#E4D8CF',
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceCorrect: { backgroundColor: '#ECFDF3', borderColor: BRAND.green },
  choiceIndex: {
    alignItems: 'center',
    backgroundColor: BRAND.cream,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    marginRight: 10,
    width: 30,
  },
  choiceIndexText: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 13 },
  choiceList: { gap: 10, marginBottom: 14 },
  choiceSelected: { borderColor: BRAND.orange },
  choiceSuccess: { color: BRAND.green, fontFamily: 'GmarketBold', fontSize: 12, textAlign: 'center' },
  choiceText: { color: BRAND.black, flex: 1, fontFamily: 'GmarketBold', fontSize: 14, lineHeight: 19 },
  choiceWrong: { backgroundColor: '#FFF1F0', borderColor: '#D92D20' },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#E9DBD0',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayPill: {
    alignItems: 'center',
    backgroundColor: BRAND.cream,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayPillText: { fontSize: 20 },
  eyebrow: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 10, letterSpacing: 1 },
  feedback: { borderRadius: 14, marginBottom: 14, padding: 13 },
  feedbackCorrect: { backgroundColor: '#ECFDF3', borderRadius: 14, marginBottom: 14, padding: 13 },
  feedbackText: { color: '#34302D', fontFamily: 'GmarketMedium', fontSize: 13, lineHeight: 19 },
  feedbackWrong: { backgroundColor: '#FFF1F0' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerCenter: { flex: 1, gap: 7 },
  journeyImage: { height: 170, marginBottom: 12, width: 220 },
  learnBody: { color: BRAND.black, fontFamily: 'GmarketMedium', fontSize: 16, lineHeight: 26 },
  learnCard: {
    backgroundColor: '#FFF',
    borderColor: '#F1D4BE',
    borderRadius: 22,
    borderWidth: 2,
    marginBottom: 14,
    padding: 20,
  },
  learnIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BRAND.cream,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 14,
    width: 48,
  },
  learnIconText: { fontSize: 25 },
  loadingState: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 30 },
  loadingText: { color: '#6B625C', fontFamily: 'GmarketMedium', fontSize: 13, textAlign: 'center' },
  localRewardNote: {
    color: '#70645D',
    fontFamily: 'GmarketMedium',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 20,
    maxWidth: 300,
    textAlign: 'center',
  },
  memeCard: {
    alignItems: 'center',
    backgroundColor: BRAND.pink,
    borderColor: BRAND.black,
    borderRadius: 24,
    borderWidth: 3,
    marginBottom: 20,
    minHeight: 340,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  memeCopy: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 21, lineHeight: 29, textAlign: 'center' },
  memeOrange: { height: 130, marginVertical: 9, width: 145 },
  memePunchline: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  practiceCard: {
    backgroundColor: '#FFF',
    borderColor: BRAND.black,
    borderRadius: 22,
    borderWidth: 2,
    marginBottom: 18,
    padding: 18,
  },
  practiceEmoji: { fontSize: 34 },
  practiceLabel: { color: '#756A62', fontFamily: 'GmarketMedium', fontSize: 11, marginTop: 16 },
  practiceTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  practiceValue: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 20, marginTop: 5 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND.orange,
    borderColor: BRAND.black,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
    width: '100%',
  },
  primaryButtonText: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 15 },
  progressSegment: { backgroundColor: '#E8D9CF', borderRadius: 3, flex: 1, height: 6 },
  progressSegmentActive: { backgroundColor: BRAND.orange },
  progressTrack: { flexDirection: 'row', gap: 4 },
  rewardCelebration: { alignItems: 'center', marginBottom: 8 },
  rewardCelebrationLabel: {
    color: BRAND.orangeDark,
    fontFamily: 'GmarketBold',
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 2,
  },
  rewardEmoji: { fontSize: 76, marginTop: -10 },
  rewardGrid: { flexDirection: 'row', gap: 10, marginBottom: 16, width: '100%' },
  rewardSparkles: { color: BRAND.orange, fontSize: 28, letterSpacing: 10 },
  rewardStage: { alignItems: 'center', justifyContent: 'center', minHeight: 600 },
  rewardStat: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#F0D0B9',
    borderRadius: 18,
    borderWidth: 2,
    flex: 1,
    padding: 16,
  },
  rewardStatLabel: { color: '#756A62', fontFamily: 'GmarketMedium', fontSize: 11, marginTop: 4 },
  rewardStatValue: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 25 },
  rewardSubtitle: {
    color: '#5D534C',
    fontFamily: 'GmarketMedium',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  rewardTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 27, marginBottom: 8, textAlign: 'center' },
  runtimeDot: { borderRadius: 5, height: 10, marginRight: 6, width: 10 },
  runtimePill: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7 },
  runtimeText: { fontFamily: 'GmarketBold', fontSize: 10 },
  safetyCopy: { color: '#746960', fontFamily: 'GmarketMedium', fontSize: 11, lineHeight: 17, marginBottom: 14, marginTop: 14 },
  savingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.94)',
    bottom: 0,
    gap: 14,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  screen: { backgroundColor: BRAND.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 20 },
  secondaryButton: { backgroundColor: '#FFF', borderColor: BRAND.orange, marginTop: 10 },
  secondaryButtonText: { color: BRAND.orangeDark },
  stage: { flex: 1, paddingTop: 16 },
  stageKicker: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 11, letterSpacing: 1.4, marginBottom: 7 },
  stageTitle: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 27, letterSpacing: -0.8, lineHeight: 35, marginBottom: 18 },
  takeawayCard: { backgroundColor: BRAND.cream, borderRadius: 18, marginBottom: 20, padding: 16 },
  takeawayLabel: { color: BRAND.orangeDark, fontFamily: 'GmarketBold', fontSize: 10, marginBottom: 6 },
  takeawayText: { color: BRAND.black, fontFamily: 'GmarketBold', fontSize: 15, lineHeight: 22 },
  tapHint: { color: '#684835', fontFamily: 'GmarketMedium', fontSize: 10, marginBottom: 10, marginTop: 8 },
});
