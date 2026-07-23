import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';

const MinimalStartupScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EasyGo</Text>
      <Text style={styles.subtitle}>최소 부팅 화면 · BUILD 91</Text>
      <Text style={styles.message}>
        앱이 이 화면에서 멈추지 않고 열리면, 이전 크래시는 앱 진입부의 의존성 로딩이 원인입니다.
      </Text>
      <Text style={styles.message}>
        앱이 여기서도 즉시 종료되면, 네이티브/설정 레벨 이슈를 우선 점검해야 합니다.
      </Text>
    </View>
  );
};

registerRootComponent(MinimalStartupScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FF6813',
    fontSize: 44,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  message: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
