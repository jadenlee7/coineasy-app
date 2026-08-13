import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import WebView from 'react-native-webview';
import { PrivyProvider, usePrivy } from '@privy-io/expo';
import {
  createEasyGoPrivyClient,
  EASYGO_BASE_CHAIN,
  EASYGO_PRIVY_CONFIG,
  getEasyGoPrivyClient,
  getEasyGoPrivyWebViewUrl,
  initializeEasyGoPrivyClient,
} from './utils/privyClient';
import { easyGoPrivyStorage } from './utils/privyStorage';

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
const PRIVY_STORAGE_PROBE_KEY = 'startup-probe-v97';
const JS_ENGINE = global.HermesInternal ? 'HERMES' : 'JSC';
const RUNTIME_LABEL = `${JS_ENGINE} · ${Platform.OS.toUpperCase()} ${Platform.Version}`;
const RAW_WEBVIEW_INJECTED_OBJECT = Object.freeze({
  shouldUseAppBackedStorage: true,
});
const RAW_WEBVIEW_SECURE_STORE_OPTIONS = Object.freeze({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

const STAGE_COPY = {
  storage: {
    title: '1/5 · Privy 보안 저장소',
    body: '실제 EasyGo Privy 저장소 어댑터로 쓰기, 읽기, 삭제를 각각 확인합니다.',
    action: '1단계 · 저장소 왕복 확인',
  },
  'client-create': {
    title: '2/5 · Privy client 생성',
    body: '네트워크 초기화나 Provider 없이 singleton client 객체만 생성합니다.',
    action: '2단계 · client만 생성',
  },
  'client-initialize': {
    title: '3/5 · Privy client 초기화',
    body: 'Provider와 WebView를 마운트하지 않은 상태에서 앱 설정과 세션 초기화만 실행합니다.',
    action: '3단계 · initialize만 실행',
  },
  'raw-webview': {
    title: '4/5 · standalone Privy WebView',
    body: 'SDK가 실제 사용하는 주소와 설정으로 숨은 WebView만 별도로 마운트합니다.',
    action: '4단계 · WebView만 마운트',
  },
  'raw-webview-loading': {
    title: '4/5 · standalone Privy WebView',
    body: 'Privy SDK와 같은 기준으로 숨은 WebView의 네이티브 로드 완료를 확인하고 있습니다.',
    action: 'WebView 확인 중',
  },
  'provider-mount': {
    title: '5/5 · Privy Provider',
    body: 'standalone WebView가 통과했습니다. 이제 동일 client로 Provider만 마운트합니다.',
    action: '5단계 · Provider 마운트',
  },
  provider: {
    title: '5/5 · Privy Provider',
    body: 'Provider 내부 화면과 Privy 준비 신호를 확인하고 있습니다.',
    action: 'Provider 확인 중',
  },
};

function safeErrorDetail(error) {
  let detail = error?.message || String(error);
  for (const identifier of [PRIVY_APP_ID, PRIVY_CLIENT_ID]) {
    if (identifier) detail = detail.split(identifier).join('[redacted]');
  }
  return detail;
}

function isSecureStorageMessage(message) {
  return Boolean(
    message
    && typeof message === 'object'
    && typeof message.event === 'string'
    && message.event.startsWith('app:secure-storage:')
    && typeof message.id === 'string'
    && message.data
    && typeof message.data === 'object',
  );
}

function secureWebViewKey(key) {
  if (typeof key !== 'string' || !key) {
    throw new Error('Privy WebView sent an invalid secure-storage key');
  }
  return key.replaceAll(':', '-');
}

async function answerSecureStorageMessage(message) {
  const key = secureWebViewKey(message.data.key);

  switch (message.event) {
    case 'app:secure-storage:get': {
      const value = await SecureStore
        .getItemAsync(key, RAW_WEBVIEW_SECURE_STORE_OPTIONS)
        .catch(() => null);
      return { event: message.event, id: message.id, data: { value } };
    }
    case 'app:secure-storage:remove': {
      const success = await SecureStore
        .deleteItemAsync(key, RAW_WEBVIEW_SECURE_STORE_OPTIONS)
        .then(() => true)
        .catch(() => false);
      return { event: message.event, id: message.id, data: { success } };
    }
    case 'app:secure-storage:set': {
      if (typeof message.data.value !== 'string') {
        throw new Error('Privy WebView sent an invalid secure-storage value');
      }
      const success = await SecureStore
        .setItemAsync(key, message.data.value, RAW_WEBVIEW_SECURE_STORE_OPTIONS)
        .then(() => true)
        .catch(() => false);
      return { event: message.event, id: message.id, data: { success } };
    }
    default:
      throw new Error('Privy WebView sent an unknown secure-storage event');
  }
}

class ProbeErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(
      '[privy-probe] protected render failure',
      safeErrorDetail(error),
      info?.componentStack,
    );
    void this.props.onStatus({
      step: 'privy-provider-mount',
      status: 'failed',
      detail: safeErrorDetail(error),
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <DiagnosticScreen
        buildNumber={this.props.buildNumber}
        currentTitle="5/5 · Privy Provider 렌더 오류"
        description="Provider 렌더 단계의 JavaScript 오류를 앱 종료 대신 표시했습니다."
        error={this.state.error}
        lastMarker={this.props.lastMarker}
        markerLabel={this.props.markerLabel}
      />
    );
  }
}

function DiagnosticScreen({
  actionLabel,
  buildNumber,
  busy = false,
  currentTitle,
  description,
  error = null,
  lastMarker = null,
  markerLabel,
  onAction,
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.eyebrow}>
          PRIVY ISOLATION · BUILD {buildNumber} · {RUNTIME_LABEL}
        </Text>
        <Text style={styles.title}>{currentTitle}</Text>
        <Text style={styles.body}>{description}</Text>

        <View style={styles.currentBox}>
          <Text style={styles.currentCaption}>현재 상태</Text>
          <Text selectable style={styles.currentText}>
            {busy ? `${currentTitle} · 실행 중` : currentTitle}
          </Text>
        </View>

        <View style={styles.markerBox}>
          <Text style={styles.markerCaption}>마지막 기록</Text>
          <Text selectable style={styles.markerText}>
            {markerLabel?.(lastMarker) || '이전 진단 기록 없음'}
          </Text>
          {!!lastMarker?.at && (
            <Text selectable style={styles.markerTime}>{lastMarker.at}</Text>
          )}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text selectable style={styles.errorCode}>
              STARTUP-PRIVY-05 · build {buildNumber}
            </Text>
            <Text selectable style={styles.errorMessage}>
              {safeErrorDetail(error)}
            </Text>
          </View>
        )}

        {!!onAction && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onAction}
            style={[styles.button, busy && styles.buttonDisabled]}
          >
            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.loadingText}>단계 확인 중</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{actionLabel}</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrivyProbeContent({
  appLoadError,
  buildNumber,
  busy,
  lastMarker,
  markerLabel,
  onContinue,
  onStatus,
}) {
  const privy = usePrivy();
  const readyRef = useRef(Boolean(privy?.isReady));
  const errorRef = useRef(privy?.error || null);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  readyRef.current = Boolean(privy?.isReady);
  errorRef.current = privy?.error || null;

  useEffect(() => {
    let active = true;
    void (async () => {
      await onStatus({ step: 'privy-provider-mount', status: 'passed' });
      await onStatus({ step: 'privy-provider-child', status: 'passed' });
      if (active) {
        await onStatus({
          step: 'privy-provider-ready',
          status: errorRef.current ? 'failed' : readyRef.current ? 'passed' : 'pending',
          detail: errorRef.current ? safeErrorDetail(errorRef.current) : null,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [onStatus]);

  useEffect(() => {
    if (privy?.isReady) {
      void onStatus({ step: 'privy-provider-ready', status: 'passed' });
    }
  }, [onStatus, privy?.isReady]);

  useEffect(() => {
    if (privy?.error) {
      void onStatus({
        step: 'privy-provider-ready',
        status: 'failed',
        detail: safeErrorDetail(privy.error),
      });
    }
  }, [onStatus, privy?.error]);

  useEffect(() => {
    if (privy?.isReady) return undefined;
    const timer = setTimeout(() => setWaitedTooLong(true), 15000);
    return () => clearTimeout(timer);
  }, [privy?.isReady]);

  const error = appLoadError || privy?.error || null;
  const currentTitle = error
    ? '5/5 · Provider 오류'
    : privy?.isReady
      ? '5/5 · Provider 준비 완료'
      : '5/5 · Provider 초기화 중';
  const description = error
    ? 'Provider 오류를 화면에 표시했습니다. 마지막 기록과 오류 문구를 캡처해 주세요.'
    : privy?.isReady
      ? '다섯 단계가 모두 통과했습니다. 이제 같은 Provider 안에서 EasyGo 본체를 열 수 있습니다.'
      : waitedTooLong
        ? 'Provider 내부 화면은 열렸지만 준비 신호를 15초 넘게 기다리고 있습니다.'
        : 'Provider 내부 화면까지 열렸습니다. Privy 준비 신호를 기다리고 있습니다.';

  return (
    <DiagnosticScreen
      actionLabel={privy?.isReady ? 'EasyGo 본체 열기' : undefined}
      buildNumber={buildNumber}
      busy={busy}
      currentTitle={currentTitle}
      description={description}
      error={error}
      lastMarker={lastMarker}
      markerLabel={markerLabel}
      onAction={!error && privy?.isReady ? onContinue : undefined}
    />
  );
}

export default function PrivyStartupProbe(props) {
  const [stage, setStage] = useState('storage');
  const [localBusy, setLocalBusy] = useState(false);
  const [stageError, setStageError] = useState(null);
  const [rawWebViewMounted, setRawWebViewMounted] = useState(false);
  const [rawWebViewUrl, setRawWebViewUrl] = useState(null);
  const [rawWebViewAttempt, setRawWebViewAttempt] = useState(0);
  const [providerMounted, setProviderMounted] = useState(false);
  const rawWebViewRef = useRef(null);
  const rawAttemptRef = useRef(0);
  const rawStageRef = useRef('idle');
  const rawTimeoutRef = useRef(null);

  const clearRawWebViewTimeout = useCallback(() => {
    if (rawTimeoutRef.current) {
      clearTimeout(rawTimeoutRef.current);
      rawTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearRawWebViewTimeout, [clearRawWebViewTimeout]);

  const runUserStep = useCallback(async (step, action, nextStage) => {
    if (localBusy) return;
    setLocalBusy(true);
    setStageError(null);
    await props.onStatus({ step, status: 'pending' });

    try {
      await action();
      await props.onStatus({ step, status: 'passed' });
      setStage(nextStage);
    } catch (error) {
      const detail = safeErrorDetail(error);
      await props.onStatus({ step, status: 'failed', detail });
      setStageError(new Error(detail));
    } finally {
      setLocalBusy(false);
    }
  }, [localBusy, props.onStatus]);

  const handleStorageRoundtrip = useCallback(() => runUserStep(
    'privy-storage-roundtrip',
    async () => {
      const value = `build-${props.buildNumber}`;
      await easyGoPrivyStorage.put(PRIVY_STORAGE_PROBE_KEY, value);
      const restored = await easyGoPrivyStorage.get(PRIVY_STORAGE_PROBE_KEY);
      await easyGoPrivyStorage.del(PRIVY_STORAGE_PROBE_KEY);
      if (restored !== value) {
        throw new Error('Privy storage round-trip returned an unexpected value');
      }
      const deleted = await easyGoPrivyStorage.get(PRIVY_STORAGE_PROBE_KEY);
      if (deleted !== null && deleted !== undefined) {
        throw new Error('Privy storage probe value remained after deletion');
      }
    },
    'client-create',
  ), [props.buildNumber, runUserStep]);

  const handleClientCreate = useCallback(() => runUserStep(
    'privy-client-create',
    async () => {
      const client = createEasyGoPrivyClient();
      if (
        !client
        || typeof client.initialize !== 'function'
        || typeof client.embeddedWallet?.getURL !== 'function'
      ) {
        throw new Error('Privy client was created without the expected interfaces');
      }
    },
    'client-initialize',
  ), [runUserStep]);

  const handleClientInitialize = useCallback(() => runUserStep(
    'privy-client-initialize',
    () => initializeEasyGoPrivyClient(),
    'raw-webview',
  ), [runUserStep]);

  const failRawWebView = useCallback(async (
    reason,
    attempt = rawAttemptRef.current,
  ) => {
    if (attempt !== rawAttemptRef.current) return;
    if (rawStageRef.current === 'failed') return;
    rawStageRef.current = 'failed';
    clearRawWebViewTimeout();
    const detail = safeErrorDetail(reason);
    await props.onStatus({
      step: 'privy-raw-webview',
      status: 'failed',
      detail,
    });
    if (attempt !== rawAttemptRef.current) return;
    setRawWebViewMounted(false);
    rawWebViewRef.current = null;
    setStageError(new Error(detail));
    setStage('raw-webview');
    setLocalBusy(false);
  }, [clearRawWebViewTimeout, props.onStatus]);

  const handleRawWebViewMessage = useCallback((event, attempt) => {
    void (async () => {
      if (attempt !== rawAttemptRef.current) return;
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (isSecureStorageMessage(message)) {
          const response = await answerSecureStorageMessage(message);
          if (attempt !== rawAttemptRef.current) return;
          rawWebViewRef.current?.postMessage(JSON.stringify(response));
          return;
        }
        getEasyGoPrivyClient().embeddedWallet.onMessage(message);
      } catch {
        await failRawWebView(
          new Error('Standalone Privy WebView message bridge failed'),
          attempt,
        );
      }
    })();
  }, [failRawWebView]);

  const handleRawWebViewLoad = useCallback((attempt) => {
    void (async () => {
      if (attempt !== rawAttemptRef.current) return;
      if (rawStageRef.current !== 'pending') return;
      rawStageRef.current = 'loaded';
      clearRawWebViewTimeout();
      try {
        await props.onStatus({
          step: 'privy-raw-webview',
          status: 'passed',
        });
        if (attempt !== rawAttemptRef.current) return;
        if (rawStageRef.current !== 'loaded') return;
        rawStageRef.current = 'passed';
        setStage('provider-mount');
        setLocalBusy(false);
      } catch (error) {
        await failRawWebView(error, attempt);
      }
    })();
  }, [clearRawWebViewTimeout, failRawWebView, props.onStatus]);

  const handleRawWebViewMount = useCallback(() => {
    void (async () => {
      if (localBusy) return;
      setLocalBusy(true);
      setStageError(null);
      const attempt = rawAttemptRef.current + 1;
      rawAttemptRef.current = attempt;
      rawStageRef.current = 'pending';
      clearRawWebViewTimeout();
      await props.onStatus({
        step: 'privy-raw-webview',
        status: 'pending',
      });
      if (attempt !== rawAttemptRef.current) return;

      try {
        const url = getEasyGoPrivyWebViewUrl();
        setRawWebViewUrl(url);
        setRawWebViewAttempt(attempt);
        setRawWebViewMounted(true);
        setStage('raw-webview-loading');
        rawTimeoutRef.current = setTimeout(() => {
          void failRawWebView(
            new Error('Standalone Privy WebView did not load within 15 seconds'),
            attempt,
          );
        }, 15000);
      } catch (error) {
        await failRawWebView(error, attempt);
      }
    })();
  }, [
    clearRawWebViewTimeout,
    failRawWebView,
    localBusy,
    props.onStatus,
  ]);

  const handleProviderMount = useCallback(() => {
    void (async () => {
      if (localBusy || rawStageRef.current !== 'passed') return;
      setLocalBusy(true);
      setStageError(null);
      clearRawWebViewTimeout();
      rawAttemptRef.current += 1;
      setRawWebViewMounted(false);
      rawWebViewRef.current = null;
      await props.onStatus({
        step: 'privy-provider-mount',
        status: 'pending',
      });
      setProviderMounted(true);
      setStage('provider');
      setLocalBusy(false);
    })();
  }, [clearRawWebViewTimeout, localBusy, props.onStatus]);

  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) {
    return (
      <DiagnosticScreen
        buildNumber={props.buildNumber}
        currentTitle="Privy 공개 식별자 확인 필요"
        description="빌드 번들에 필요한 Privy 공개 식별자가 없습니다."
        error={new Error('Privy public identifiers are missing from the release bundle')}
        lastMarker={props.lastMarker}
        markerLabel={props.markerLabel}
      />
    );
  }

  if (providerMounted) {
    const AppRoot = props.AppRoot;
    return (
      <ProbeErrorBoundary
        buildNumber={props.buildNumber}
        lastMarker={props.lastMarker}
        markerLabel={props.markerLabel}
        onStatus={props.onStatus}
      >
        <PrivyProvider
          appId={PRIVY_APP_ID}
          client={getEasyGoPrivyClient()}
          clientId={PRIVY_CLIENT_ID}
          config={EASYGO_PRIVY_CONFIG}
          storage={easyGoPrivyStorage}
          supportedChains={[EASYGO_BASE_CHAIN]}
        >
          {AppRoot ? (
            <AppRoot
              linkingManagedExternally
              navigationUrlEvent={props.navigationUrlEvent}
              onStartupStatus={props.onStatus}
              privyAlreadyMounted
            />
          ) : (
            <PrivyProbeContent {...props} />
          )}
        </PrivyProvider>
      </ProbeErrorBoundary>
    );
  }

  const copy = STAGE_COPY[stage] || STAGE_COPY.storage;
  let onAction;
  if (stage === 'storage') onAction = handleStorageRoundtrip;
  if (stage === 'client-create') onAction = handleClientCreate;
  if (stage === 'client-initialize') onAction = handleClientInitialize;
  if (stage === 'raw-webview') onAction = handleRawWebViewMount;
  if (stage === 'provider-mount') onAction = handleProviderMount;

  return (
    <>
      <DiagnosticScreen
        actionLabel={copy.action}
        buildNumber={props.buildNumber}
        busy={localBusy}
        currentTitle={copy.title}
        description={copy.body}
        error={stageError}
        lastMarker={props.lastMarker}
        markerLabel={props.markerLabel}
        onAction={onAction}
      />
      {rawWebViewMounted && rawWebViewUrl && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.hiddenWebView}
        >
          <WebView
            key={rawWebViewAttempt}
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            injectedJavaScriptObject={RAW_WEBVIEW_INJECTED_OBJECT}
            onContentProcessDidTerminate={() => {
              void failRawWebView(
                new Error('Standalone Privy WebView content process terminated'),
                rawWebViewAttempt,
              );
            }}
            onError={() => {
              void failRawWebView(
                new Error('Standalone Privy WebView native load failed'),
                rawWebViewAttempt,
              );
            }}
            onLoad={() => handleRawWebViewLoad(rawWebViewAttempt)}
            onMessage={(event) => handleRawWebViewMessage(event, rawWebViewAttempt)}
            ref={(instance) => {
              if (!instance) return;
              if (rawWebViewAttempt !== rawAttemptRef.current) return;
              try {
                rawWebViewRef.current = instance;
                getEasyGoPrivyClient().setMessagePoster(instance);
              } catch (error) {
                void failRawWebView(error, rawWebViewAttempt);
              }
            }}
            source={{ uri: rawWebViewUrl }}
            style={styles.hiddenWebViewContent}
            webviewDebuggingEnabled={false}
          />
        </View>
      )}
    </>
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
  currentBox: {
    backgroundColor: '#FFEDD5',
    borderRadius: 14,
    marginTop: 22,
    padding: 16,
  },
  currentCaption: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  currentText: { color: '#7C2D12', fontSize: 14, fontWeight: '700', marginTop: 7 },
  markerBox: {
    backgroundColor: '#FFF',
    borderColor: '#FED7AA',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  markerCaption: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  markerText: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 7 },
  markerTime: { color: '#64748B', fontSize: 11, marginTop: 6 },
  errorBox: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 16, padding: 16 },
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
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  loadingRow: { alignItems: 'center', flexDirection: 'row' },
  loadingText: { color: '#FFF', fontSize: 14, fontWeight: '700', marginLeft: 10 },
  hiddenWebView: {
    height: 0,
    overflow: 'hidden',
    width: 0,
  },
  hiddenWebViewContent: { flex: 1 },
});
