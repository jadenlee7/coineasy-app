// screens/Login.js
//
// EasyGo-branded Privy entry screen, implemented from Figma node 20164:3802.
// Apple and Google OAuth use Privy's headless Expo hooks so the UI remains
// fully owned by EasyGo while Privy handles the authentication flow.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { usePrivy, useLoginWithOAuth } from '@privy-io/expo';

import AppleIcon from '../assets/easygo/apple.svg';
import GoogleIcon from '../assets/easygo/google.svg';
import LogoArrow from '../assets/easygo/logo-arrow.svg';
import { EASYGO_LEGAL_DOCUMENTS } from '../utils/legalDocuments.mjs';
import { getOAuthLoginErrorMessage } from '../utils/oauthLoginError.mjs';
import { DailyRunGuestSample } from './DailyRun';

const BRAND = {
  background: '#FFF8F0',
  orange: '#FF6813',
  sheet: '#FFFEFC',
};

function openLegalDocument(document, label) {
  if (!document?.url) {
    Alert.alert(
      '정책 문서 준비 중',
      `${label}의 승인된 EasyGo 문서가 아직 설정되지 않았습니다.`,
    );
    return;
  }
  WebBrowser.openBrowserAsync(document.url);
}

function LoginOption({ Icon, label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.72}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.loginOption, disabled && styles.loginOptionDisabled]}
    >
      <View style={styles.optionIcon}>
        {loading ? <ActivityIndicator color="#000" size="small" /> : <Icon width={24} height={24} />}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Login() {
  const { height } = useWindowDimensions();
  const { isReady } = usePrivy();
  const { login: loginWithOAuth, state: oauthState } = useLoginWithOAuth();
  const [pendingProvider, setPendingProvider] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDailyRunSample, setShowDailyRunSample] = useState(false);

  const compact = height < 780;
  const oauthLoading = oauthState.status === 'loading';
  const disabled = !isReady || oauthLoading;

  async function runAuth(provider, action) {
    if (!isReady) return;

    Haptics.selectionAsync();
    setErrorMessage('');
    setPendingProvider(provider);

    try {
      await action();
    } catch (error) {
      const message = getOAuthLoginErrorMessage(error);
      if (message) {
        console.warn(`[auth] ${provider} login failed`);
        setErrorMessage(message);
      }
    } finally {
      setPendingProvider(null);
    }
  }

  function handleOAuth(provider) {
    return runAuth(provider, () => loginWithOAuth({ provider }));
  }

  if (showDailyRunSample) {
    return <DailyRunGuestSample onClose={() => setShowDailyRunSample(false)} />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>EasyGo</Text>
          <LogoArrow height={30} style={styles.logoArrow} width={33} />
        </View>

        <Text style={[styles.headline, compact && styles.headlineCompact]}>
          Your Web3{`\n`}Journey{`\n`}Starts Here.
        </Text>

        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require('../assets/easygo/login-mascot.png')}
          style={[styles.mascot, compact && styles.mascotCompact]}
        />

        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={require('../assets/easygo/pixel-hills.png')}
          style={styles.hillsLeft}
        />
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={require('../assets/easygo/pixel-hills.png')}
          style={styles.hillsRight}
        />

        <TouchableOpacity
          accessibilityHint="로그인 없이 첫 Web3 밈 학습을 체험합니다"
          accessibilityLabel="30초 Daily Run 맛보기"
          accessibilityRole="button"
          activeOpacity={0.82}
          onPress={() => {
            Haptics.selectionAsync();
            setShowDailyRunSample(true);
          }}
          style={styles.sampleButton}
        >
          <Text style={styles.sampleButtonText}>30초 맛보기</Text>
          <Text style={styles.sampleButtonIcon}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.sheet, compact && styles.sheetCompact]}>
        <LoginOption
          Icon={AppleIcon}
          disabled={disabled}
          label="Sign up with Apple"
          loading={pendingProvider === 'apple'}
          onPress={() => handleOAuth('apple')}
        />
        <LoginOption
          Icon={GoogleIcon}
          disabled={disabled}
          label="Sign up with Google"
          loading={pendingProvider === 'google'}
          onPress={() => handleOAuth('google')}
        />
        {!isReady && <Text style={styles.statusText}>EasyGo를 준비하고 있어요…</Text>}
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Text style={styles.termsText}>
          계속하기 전에{' '}
          <Text onPress={() => openLegalDocument(EASYGO_LEGAL_DOCUMENTS.terms, '이용약관')} style={styles.termsLink}>
            이용약관
          </Text>
          {' '}및{' '}
          <Text onPress={() => openLegalDocument(EASYGO_LEGAL_DOCUMENTS.privacy, '개인정보 처리방침')} style={styles.termsLink}>
            개인정보 처리방침
          </Text>
          을 확인해 주세요. 동의 선택은 설정에서 별도로 관리됩니다.
        </Text>
        {!EASYGO_LEGAL_DOCUMENTS.versioned && (
          <Text style={styles.policyPendingText}>
            EasyGo 전용 정책 문서는 정식 공개 준비 중입니다.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  hero: {
    flex: 1,
    paddingHorizontal: 34,
    paddingTop: 48,
    overflow: 'hidden',
  },
  heroCompact: {
    paddingTop: 24,
  },
  brandRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  brandName: {
    color: BRAND.orange,
    fontFamily: 'GmarketBold',
    fontSize: 50,
    letterSpacing: -2.5,
    lineHeight: 60,
  },
  logoArrow: {
    marginLeft: -1,
    marginTop: 2,
    transform: [{ rotate: '-45deg' }],
  },
  headline: {
    color: '#000',
    fontFamily: 'GmarketBold',
    fontSize: 46,
    letterSpacing: -2.2,
    lineHeight: 55,
    marginTop: 11,
    width: 315,
  },
  headlineCompact: {
    fontSize: 39,
    lineHeight: 46,
  },
  mascot: {
    bottom: 4,
    height: 128,
    left: 34,
    position: 'absolute',
    width: 128,
    zIndex: 2,
  },
  mascotCompact: {
    height: 104,
    width: 104,
  },
  hillsLeft: {
    bottom: -28,
    height: 138,
    left: -85,
    opacity: 0.8,
    position: 'absolute',
    width: 288,
  },
  hillsRight: {
    bottom: -28,
    height: 138,
    position: 'absolute',
    right: -85,
    transform: [{ scaleX: -1 }],
    width: 288,
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: BRAND.sheet,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 10,
    minHeight: 340,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetCompact: {
    minHeight: 320,
    paddingBottom: 12,
    paddingTop: 16,
  },
  sampleButton: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#000',
    borderRadius: 18,
    borderWidth: 2,
    bottom: 24,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 22,
    zIndex: 5,
  },
  sampleButtonIcon: {
    color: BRAND.orange,
    fontFamily: 'GmarketBold',
    fontSize: 12,
  },
  sampleButtonText: {
    color: '#000',
    fontFamily: 'GmarketBold',
    fontSize: 12,
  },
  loginOption: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#000',
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    maxWidth: 350,
    position: 'relative',
    width: '100%',
  },
  loginOptionDisabled: {
    opacity: 0.55,
  },
  optionIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    width: 24,
  },
  optionLabel: {
    color: '#000',
    fontFamily: 'GmarketBold',
    fontSize: 14,
    lineHeight: 20,
  },
  statusText: {
    color: '#5F5A55',
    fontFamily: 'GmarketMedium',
    fontSize: 11,
    marginTop: 1,
  },
  errorText: {
    color: '#B42318',
    fontFamily: 'GmarketMedium',
    fontSize: 11,
    marginTop: 1,
    textAlign: 'center',
  },
  termsText: {
    color: '#5F5A55',
    fontFamily: 'GmarketMedium',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 'auto',
    maxWidth: 330,
    textAlign: 'center',
  },
  termsLink: {
    color: '#000',
    fontFamily: 'GmarketBold',
    textDecorationLine: 'underline',
  },
  policyPendingText: {
    color: '#B45309',
    fontFamily: 'GmarketMedium',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
});
