import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrivyProvider, usePrivy } from '@privy-io/expo';
import {
  EASYGO_BASE_CHAIN,
  getEasyGoPrivyClient,
  initializeEasyGoPrivyClient,
} from './utils/privyClient';
import { easyGoPrivyStorage } from './utils/privyStorage';

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

export { initializeEasyGoPrivyClient };

class ProbeErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[privy-probe] protected render failure', error, info?.componentStack);
    void this.props.onStatus({
      step: 'privy-provider-ready',
      status: 'failed',
      detail: error?.message || String(error),
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ProbeScreen
        buildNumber={this.props.buildNumber}
        error={this.state.error}
        markerLabel={this.props.markerLabel}
      />
    );
  }
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
      await onStatus({ step: 'privy-provider-child', status: 'passed' });
      if (active) {
        await onStatus({
          step: 'privy-provider-ready',
          status: errorRef.current ? 'failed' : readyRef.current ? 'passed' : 'pending',
          detail: errorRef.current?.message || null,
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
        detail: privy.error?.message || String(privy.error),
      });
    }
  }, [onStatus, privy?.error]);

  useEffect(() => {
    if (privy?.isReady) return undefined;
    const timer = setTimeout(() => setWaitedTooLong(true), 15000);
    return () => clearTimeout(timer);
  }, [privy?.isReady]);

  return (
    <ProbeScreen
      buildNumber={buildNumber}
      busy={busy}
      error={appLoadError || privy?.error || null}
      isReady={Boolean(privy?.isReady)}
      lastMarker={lastMarker}
      markerLabel={markerLabel}
      onContinue={onContinue}
      waitedTooLong={waitedTooLong}
    />
  );
}

function ProbeScreen({
  buildNumber,
  busy = false,
  error = null,
  isReady = false,
  lastMarker = null,
  markerLabel,
  onContinue,
  waitedTooLong = false,
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.eyebrow}>PRIVY PROBE · BUILD {buildNumber}</Text>
        <Text style={styles.title}>
          {error ? 'Privy 렌더 오류를 잡았어요' : isReady ? 'Privy 준비 완료' : 'Privy 초기화 중'}
        </Text>
        <Text style={styles.body}>
          {error
            ? '앱 종료 대신 오류를 표시했습니다. 아래 내용을 캡처해 주세요.'
            : isReady
              ? '보안 저장소와 Privy 세션 초기화가 정상입니다. 이제 EasyGo 본체를 열 수 있어요.'
              : 'Provider 내부 화면까지 열렸습니다. 세션 준비 신호를 기다리고 있어요.'}
        </Text>

        {!error && !isReady && (
          <View style={styles.progressBox}>
            <ActivityIndicator color="#FF6813" />
            <Text style={styles.progressText}>
              {waitedTooLong
                ? '15초 넘게 준비 신호를 기다리는 중입니다.'
                : 'Privy 준비 신호 확인 중…'}
            </Text>
          </View>
        )}

        {!!lastMarker && (
          <View style={styles.markerBox}>
            <Text style={styles.markerCaption}>마지막 기록</Text>
            <Text selectable style={styles.markerText}>{markerLabel(lastMarker)}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text selectable style={styles.errorCode}>
              STARTUP-PRIVY-04 · build {buildNumber}
            </Text>
            <Text selectable style={styles.errorMessage}>
              {error?.stack || error?.message || String(error)}
            </Text>
          </View>
        )}

        {!error && (
          <Pressable
            accessibilityRole="button"
            disabled={!isReady || busy}
            onPress={onContinue}
            style={[styles.button, (!isReady || busy) && styles.buttonDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isReady ? 'EasyGo 본체 열기' : 'Privy 준비 중'}
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PrivyStartupProbe(props) {
  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) {
    const error = new Error('Privy public identifiers are missing from the release bundle');
    return (
      <ProbeScreen
        buildNumber={props.buildNumber}
        error={error}
        markerLabel={props.markerLabel}
      />
    );
  }

  const AppRoot = props.AppRoot;

  return (
    <ProbeErrorBoundary
      buildNumber={props.buildNumber}
      markerLabel={props.markerLabel}
      onStatus={props.onStatus}
    >
      <PrivyProvider
        appId={PRIVY_APP_ID}
        client={getEasyGoPrivyClient()}
        clientId={PRIVY_CLIENT_ID}
        config={{ embedded: { disableAutomaticMigration: true } }}
        storage={easyGoPrivyStorage}
        supportedChains={[EASYGO_BASE_CHAIN]}
      >
        {AppRoot ? (
          <AppRoot
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
  progressBox: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 22,
    padding: 16,
  },
  progressText: { color: '#475569', flex: 1, fontSize: 13, marginLeft: 12 },
  markerBox: {
    backgroundColor: '#FFF',
    borderColor: '#FED7AA',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  markerCaption: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  markerText: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 7 },
  errorBox: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 22, padding: 16 },
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
});
