import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const BUILD_NUMBER = '90';

export default function BootstrapApp() {
  const [AppRoot, setAppRoot] = useState(null);
  const [phase, setPhase] = useState('ready');
  const [error, setError] = useState(null);

  const loadEasyGo = useCallback(async () => {
    if (phase === 'loading') return;
    setError(null);
    setPhase('loading');

    try {
      // Evaluate Privy's required globals one at a time before any app module.
      await import('fast-text-encoding');
      await import('react-native-get-random-values');
      await import('@ethersproject/shims');
      await import('react-native-gesture-handler');
      await import('react-native-reanimated');
      const appModule = await import('./App');
      setAppRoot(() => appModule.default);
      setPhase('loaded');
    } catch (startupError) {
      console.error('[bootstrap] module load failure', startupError);
      setError(startupError);
      setPhase('error');
    }
  }, [phase]);

  if (AppRoot) return <AppRoot />;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.eyebrow}>STARTUP DIAGNOSTIC · BUILD {BUILD_NUMBER}</Text>
        <Text style={styles.title}>안전 부팅 화면이 열렸어요</Text>
        <Text style={styles.body}>
          이 화면이 보이면 iOS 기본 실행은 정상입니다. 아래 버튼을 눌러 EasyGo 본체를 시작해 주세요.
        </Text>

        {phase === 'error' && (
          <View style={styles.errorBox}>
            <Text selectable style={styles.errorCode}>STARTUP-MODULE-02 · build {BUILD_NUMBER}</Text>
            <Text selectable style={styles.errorMessage}>
              {error?.stack || error?.message || String(error)}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={phase === 'loading'}
          onPress={loadEasyGo}
          style={[styles.button, phase === 'loading' && styles.buttonDisabled]}
        >
          {phase === 'loading' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>{phase === 'error' ? '다시 시도' : 'EasyGo 시작'}</Text>
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
  eyebrow: { color: '#C2410C', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 10 },
  title: { color: '#0F172A', fontSize: 22, fontWeight: '700', marginTop: 24 },
  body: { color: '#475569', fontSize: 15, lineHeight: 23, marginTop: 12 },
  errorBox: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 22, maxHeight: 260, padding: 16 },
  errorCode: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  errorMessage: { color: '#334155', fontSize: 12, lineHeight: 18, marginTop: 10 },
  button: { alignItems: 'center', backgroundColor: '#FF6813', borderRadius: 26, marginTop: 28, minHeight: 52, justifyContent: 'center', padding: 15 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
