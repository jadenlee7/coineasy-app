import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const BUILD_NUMBER = Application.nativeBuildVersion || 'unknown';
const STARTUP_STATE_KEY = 'easygo.startup-probe.v94';
const SECURE_STORE_PROBE_KEY = 'easygo_startup_probe_v94';

const STEP_LABELS = {
  'polyfill-text': 'Text 인코딩 준비',
  'polyfill-random': '암호화 난수 준비',
  'polyfill-ethers': '지갑 호환 계층 준비',
  'gesture-handler': '제스처 엔진 준비',
  reanimated: '애니메이션 엔진 준비',
  'secure-store-module': 'iOS 보안 저장소 연결',
  'secure-store-roundtrip': 'iOS 보안 저장소 읽기/쓰기',
  'privy-probe-module': 'Privy 진단 모듈 로드',
  'privy-client-initialize': 'Privy 앱 설정 및 세션 확인',
  'privy-provider-mount': 'Privy Provider 마운트',
  'privy-provider-child': 'Privy Provider 내부 렌더',
  'privy-provider-ready': 'Privy 세션 초기화',
  'full-app-module': 'EasyGo 본체 모듈 로드',
  'full-app-render': 'EasyGo 본체 렌더',
  'full-provider-child': 'EasyGo Privy 내부 렌더',
  'full-provider-ready': 'EasyGo Privy 세션 준비',
};

function markerLabel(marker) {
  if (!marker) return '이전 진단 기록 없음';
  const label = STEP_LABELS[marker.step] || marker.step;
  if (marker.status === 'passed') return `${label} · 통과`;
  if (marker.status === 'failed') return `${label} · 오류`;
  return `${label} · 시작됨(완료 전)`;
}

export default function BootstrapApp() {
  const [ProbeRoot, setProbeRoot] = useState(null);
  const [AppRoot, setAppRoot] = useState(null);
  const [phase, setPhase] = useState('restoring');
  const [currentStep, setCurrentStep] = useState(null);
  const [lastMarker, setLastMarker] = useState(null);
  const [error, setError] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');
  const startupStateRef = useRef({
    build: BUILD_NUMBER,
    last: null,
    phases: {},
    updatedAt: null,
  });
  const writeChainRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STARTUP_STATE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const parsed = JSON.parse(stored);
          startupStateRef.current = parsed;
          setLastMarker(parsed.last || null);
        } catch (restoreError) {
          console.warn('[bootstrap] unable to parse startup state', restoreError);
        }
      })
      .catch((restoreError) => {
        console.warn('[bootstrap] unable to restore startup state', restoreError);
        if (active) setStorageWarning('이전 진단 기록을 읽지 못했습니다.');
      })
      .finally(() => {
        if (active) setPhase('ready');
      });

    return () => {
      active = false;
    };
  }, []);

  const recordMarker = useCallback((step, status, detail = null) => {
    const marker = {
      build: BUILD_NUMBER,
      step,
      status,
      detail,
      at: new Date().toISOString(),
    };
    const previous = startupStateRef.current || {};
    const next = {
      build: BUILD_NUMBER,
      last: marker,
      phases: {
        ...(previous.phases || {}),
        [step]: marker,
      },
      updatedAt: marker.at,
    };

    startupStateRef.current = next;
    setLastMarker(marker);
    setCurrentStep(step);

    writeChainRef.current = writeChainRef.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STARTUP_STATE_KEY, JSON.stringify(next)))
      .catch((writeError) => {
        console.warn('[bootstrap] unable to persist startup state', writeError);
        setStorageWarning('진단 기록 저장에 실패했습니다.');
      });

    return writeChainRef.current;
  }, []);

  const runStep = useCallback(async (step, action) => {
    await recordMarker(step, 'pending');
    try {
      const result = await action();
      await recordMarker(step, 'passed');
      return result;
    } catch (stepError) {
      await recordMarker(step, 'failed', stepError?.message || String(stepError));
      throw stepError;
    }
  }, [recordMarker]);

  const handleProbeStatus = useCallback(async ({ step, status, detail }) => {
    await recordMarker(step, status, detail || null);
  }, [recordMarker]);

  const loadPrivyProbe = useCallback(async () => {
    if (phase === 'loading') return;
    setError(null);
    setPhase('loading');

    try {
      await runStep('polyfill-text', () => import('fast-text-encoding'));
      await runStep('polyfill-random', () => import('react-native-get-random-values'));
      await runStep('polyfill-ethers', () => import('@ethersproject/shims'));
      await runStep('gesture-handler', () => import('react-native-gesture-handler'));
      await runStep('reanimated', () => import('react-native-reanimated'));

      const secureStore = await runStep(
        'secure-store-module',
        () => import('expo-secure-store'),
      );
      await runStep('secure-store-roundtrip', async () => {
        await secureStore.setItemAsync(SECURE_STORE_PROBE_KEY, BUILD_NUMBER);
        const storedBuild = await secureStore.getItemAsync(SECURE_STORE_PROBE_KEY);
        await secureStore.deleteItemAsync(SECURE_STORE_PROBE_KEY);
        if (storedBuild !== BUILD_NUMBER) {
          throw new Error('SecureStore round-trip returned an unexpected value');
        }
      });

      const probeModule = await runStep(
        'privy-probe-module',
        () => import('./PrivyStartupProbe'),
      );
      await runStep(
        'privy-client-initialize',
        () => probeModule.initializeEasyGoPrivyClient(),
      );
      await recordMarker('privy-provider-mount', 'pending');
      setProbeRoot(() => probeModule.default);
      setPhase('probe');
    } catch (startupError) {
      console.error('[bootstrap] staged startup failure', startupError);
      setError(startupError);
      setPhase('error');
    }
  }, [phase, recordMarker, runStep]);

  const loadFullApp = useCallback(async () => {
    if (phase === 'loading') return;
    setError(null);
    setPhase('loading');

    try {
      const appModule = await runStep('full-app-module', () => import('./App'));
      await recordMarker('full-app-render', 'pending');
      setAppRoot(() => appModule.default);
      setPhase('loaded');
    } catch (startupError) {
      console.error('[bootstrap] full app load failure', startupError);
      setError(startupError);
      setPhase('probe');
    }
  }, [phase, recordMarker, runStep]);

  if (ProbeRoot) {
    return (
      <ProbeRoot
        AppRoot={AppRoot}
        appLoadError={error}
        buildNumber={BUILD_NUMBER}
        busy={phase === 'loading'}
        lastMarker={lastMarker}
        markerLabel={markerLabel}
        onContinue={loadFullApp}
        onStatus={handleProbeStatus}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.eyebrow}>STARTUP DIAGNOSTIC · BUILD {BUILD_NUMBER}</Text>
        <Text style={styles.title}>단계별 안전 부팅</Text>
        <Text style={styles.body}>
          아래 버튼을 누르면 iOS 보안 저장소와 Privy를 먼저 점검한 뒤 EasyGo 본체를 엽니다.
          도중에 앱이 종료되어도 마지막 단계가 이 화면에 남습니다.
        </Text>

        <View style={styles.markerBox}>
          <Text style={styles.markerCaption}>마지막 기록</Text>
          <Text selectable style={styles.markerText}>{markerLabel(lastMarker)}</Text>
          {!!lastMarker?.at && (
            <Text selectable style={styles.markerTime}>{lastMarker.at}</Text>
          )}
        </View>

        {!!storageWarning && <Text style={styles.warningText}>{storageWarning}</Text>}

        {phase === 'error' && (
          <View style={styles.errorBox}>
            <Text selectable style={styles.errorCode}>
              STARTUP-STAGE-03 · build {BUILD_NUMBER}
            </Text>
            <Text selectable style={styles.errorMessage}>
              {error?.stack || error?.message || String(error)}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={phase === 'loading' || phase === 'restoring'}
          onPress={loadPrivyProbe}
          style={[
            styles.button,
            (phase === 'loading' || phase === 'restoring') && styles.buttonDisabled,
          ]}
        >
          {phase === 'loading' || phase === 'restoring' ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFF" />
              <Text style={styles.loadingText}>
                {phase === 'restoring'
                  ? '진단 기록 확인 중'
                  : STEP_LABELS[currentStep] || '점검 중'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {phase === 'error' ? '처음부터 다시 점검' : 'Privy 단계 진단 시작'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#FF6813', fontSize: 42, fontWeight: '800' },
  eyebrow: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 10,
  },
  title: { color: '#0F172A', fontSize: 22, fontWeight: '700', marginTop: 24 },
  body: { color: '#475569', fontSize: 15, lineHeight: 23, marginTop: 12 },
  markerBox: {
    backgroundColor: '#FFF',
    borderColor: '#FED7AA',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 16,
  },
  markerCaption: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  markerText: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 7 },
  markerTime: { color: '#64748B', fontSize: 11, marginTop: 6 },
  warningText: { color: '#B45309', fontSize: 12, lineHeight: 18, marginTop: 12 },
  errorBox: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginTop: 16,
    maxHeight: 260,
    padding: 16,
  },
  errorCode: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  errorMessage: { color: '#334155', fontSize: 12, lineHeight: 18, marginTop: 10 },
  button: {
    alignItems: 'center',
    backgroundColor: '#FF6813',
    borderRadius: 26,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
    padding: 15,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  loadingRow: { alignItems: 'center', flexDirection: 'row' },
  loadingText: { color: '#FFF', fontSize: 14, fontWeight: '700', marginLeft: 10 },
});
