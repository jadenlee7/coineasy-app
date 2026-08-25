import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useDeviceAccountData } from '../contexts/DeviceAccountDataContext';
import { dailyRunDateKey, getDailyRunState } from '../utils/dailyRunProgress.mjs';

export default function DailyRunHomeCard({ onPress }) {
  const { dailyRunProgress } = useDeviceAccountData();
  const [dateKey, setDateKey] = useState(() => dailyRunDateKey());
  useFocusEffect(useCallback(() => {
    setDateKey(dailyRunDateKey());
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') setDateKey(dailyRunDateKey());
    });
    return () => subscription.remove();
  }, []);
  const state = useMemo(
    () => getDailyRunState(dailyRunProgress, dateKey),
    [dailyRunProgress, dateKey],
  );
  const lesson = state.lesson;
  const completed = state.completedCount;
  const ratio = Math.max(0, Math.min(1, completed / state.totalCount));
  const title = state.status === 'journey-complete'
    ? '7일 Web3 Starter 완료!'
    : state.status === 'complete-today'
      ? '오늘의 Run 완료 🍊'
      : `Day ${lesson.day} · ${lesson.title}`;
  const subtitle = state.status === 'journey-complete'
    ? `${state.progress.totalXp} XP · 배운 내용을 다시 확인해 보세요.`
    : state.status === 'complete-today'
      ? `${state.progress.streak}일 스트릭 · 내일 새 Run이 열려요.`
      : '밈 → 20초 학습 → 퀴즈 → 안전한 실전';

  return (
    <TouchableOpacity
      accessibilityHint="오늘의 게임형 Web3 학습을 엽니다"
      accessibilityLabel={title}
      accessibilityRole="button"
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.touchable}
    >
      <LinearGradient
        colors={['#FF6813', '#FF9254']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.card}
      >
        <View style={styles.pixelRow}>
          <View style={styles.pixel} />
          <View style={[styles.pixel, styles.pixelSmall]} />
          <View style={styles.pixel} />
        </View>
        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Text style={styles.kicker}>TODAY'S EASYGO RUN · 약 3분</Text>
            <Text numberOfLines={2} style={styles.title}>{title}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.playButton}>
            <Ionicons color="#FF6813" name="play" size={25} style={styles.playIcon} />
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{completed}/{state.totalCount}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: '#17120F',
    borderRadius: 20,
    borderWidth: 2,
    minHeight: 144,
    overflow: 'hidden',
    padding: 16,
  },
  copy: { flex: 1, paddingRight: 10 },
  kicker: { color: '#FFF4EA', fontFamily: 'GmarketBold', fontSize: 9, letterSpacing: 1 },
  pixel: { backgroundColor: '#FFD5AC', height: 8, marginRight: 5, width: 8 },
  pixelRow: { flexDirection: 'row', position: 'absolute', right: 14, top: 10 },
  pixelSmall: { height: 5, marginTop: 3, width: 5 },
  playButton: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#17120F',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  playIcon: { marginLeft: 3 },
  progressFill: { backgroundColor: '#17120F', borderRadius: 4, height: 7 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 13 },
  progressText: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 10 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.48)', borderRadius: 4, flex: 1, height: 7, overflow: 'hidden' },
  subtitle: { color: '#FFF7F0', fontFamily: 'GmarketMedium', fontSize: 11, marginTop: 6 },
  title: { color: '#FFF', fontFamily: 'GmarketBold', fontSize: 18, lineHeight: 24, marginTop: 5 },
  topRow: { alignItems: 'center', flexDirection: 'row' },
  touchable: { backgroundColor: '#FFF', paddingBottom: 9, paddingHorizontal: 12, paddingTop: 10 },
});
