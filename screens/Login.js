// screens/Login.js
//
// EasyGo-branded Privy entry screen, implemented from Figma node 20164:3802.
// OAuth and passkey actions use Privy's headless Expo hooks so the UI remains
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
import { useLoginWithPasskey } from '@privy-io/expo/passkey';

import AppleIcon from '../assets/easygo/apple.svg';
import GoogleIcon from '../assets/easygo/google.svg';
import LogoArrow from '../assets/easygo/logo-arrow.svg';
import PasskeyIcon from '../assets/easygo/passkey.svg';
import WalletIcon from '../assets/easygo/wallet.svg';

const BRAND = {
  background: '#FFF8F0',
  orange: '#FF6813',
  sheet: '#FFFEFC',
};

const PASSKEY_RELYING_PARTY = process.env.EXPO_PUBLIC_PRIVY_RELYING_PARTY;
const TERMS_URL = 'https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing';
const PRIVACY_URL = 'https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing';

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
  const { loginWithPasskey, state: passkeyState } = useLoginWithPasskey();
  const [pendingProvider, setPendingProvider] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const compact = height < 780;
  const oauthLoading = oauthState.status === 'loading';
  const passkeyLoading = !['initial', 'done', 'error'].includes(passkeyState.status);
  const disabled = !isReady || oauthLoading || passkeyLoading;

  async function runAuth(provider, action) {
    if (!isReady) return;

    Haptics.selectionAsync();
    setErrorMessage('');
    setPendingProvider(provider);

    try {
      await action();
    } catch (error) {
      console.warn(`[auth] ${provider} login failed`, error);
      setErrorMessage('로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPendingProvider(null);
    }
  }

  function handleOAuth(provider) {
    return runAuth(provider, () => loginWithOAuth({ provider }));
  }

  function handlePasskey() {
    if (!PASSKEY_RELYING_PARTY) {
      Haptics.selectionAsync();
      Alert.alert(
        'Passkey 설정 필요',
        'EXPO_PUBLIC_PRIVY_RELYING_PARTY를 설정하면 Passkey 로그인을 사용할 수 있어요.'
      );
      return;
    }

    return runAuth('passkey', () =>
      loginWithPasskey({ relyingParty: PASSKEY_RELYING_PARTY })
    );
  }

  function handleWallet() {
    Haptics.selectionAsync();
    Alert.alert(
      'Wallet 로그인 준비 중',
      'Privy SIWE와 WalletConnect 연결은 다음 구현 단위에서 활성화됩니다.'
    );
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
        <LoginOption
          Icon={PasskeyIcon}
          disabled={!isReady || oauthLoading}
          label="Sign up with Passkey"
          loading={pendingProvider === 'passkey'}
          onPress={handlePasskey}
        />
        <LoginOption
          Icon={WalletIcon}
          disabled={!isReady || oauthLoading || passkeyLoading}
          label="Sign up with Wallet"
          onPress={handleWallet}
        />

        {!isReady && <Text style={styles.statusText}>EasyGo를 준비하고 있어요…</Text>}
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Text style={styles.termsText}>
          계속하면 EasyGo의{' '}
          <Text onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} style={styles.termsLink}>
            이용약관
          </Text>
          {' '}및{' '}
          <Text onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} style={styles.termsLink}>
            개인정보 처리방침
          </Text>
          에 동의하게 됩니다.
        </Text>
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
});
