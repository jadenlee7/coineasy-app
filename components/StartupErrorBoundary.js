import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default class StartupErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[startup] protected render failure', error, info?.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>EasyGo</Text>
          <Text style={styles.title}>앱을 안전 모드로 열었어요</Text>
          <Text style={styles.body}>
            시작 중 오류를 감지해 앱 종료를 막았습니다. 아래 오류 문구를 캡처해 주세요.
          </Text>
          <View style={styles.errorBox}>
            <Text selectable style={styles.errorCode}>STARTUP-JS-01 · build 90</Text>
            <Text selectable style={styles.errorMessage}>
              {error?.message || String(error)}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#FF6813', fontSize: 42, fontWeight: '800' },
  title: { color: '#0F172A', fontSize: 22, fontWeight: '700', marginTop: 22 },
  body: { color: '#475569', fontSize: 15, lineHeight: 23, marginTop: 12 },
  errorBox: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 22, padding: 16 },
  errorCode: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  errorMessage: { color: '#334155', fontSize: 13, lineHeight: 20, marginTop: 10 },
  button: { alignItems: 'center', backgroundColor: '#FF6813', borderRadius: 26, marginTop: 24, padding: 15 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
