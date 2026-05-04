// screens/Login.js
//
// Privy-driven sign in/sign up. The previous Orbis-based ConnectModal flow
// is removed; Privy handles email/Google/Telegram/etc. through its native
// modal. After login, App.js's AuthBridge calls /auth/sync via useAuthSync,
// which writes the resulting profile back into GlobalContext.
//
// See docs/MIGRATION_NOTES.md.

import React from "react";
import { Text, View, TouchableOpacity, Image, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import { usePrivy } from '@privy-io/expo';

export default function Login() {
  const tailwind = useTailwind();
  const { login, ready } = usePrivy();

  async function openTerms() {
    Haptics.selectionAsync();
    await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing");
  }

  async function openPrivacy() {
    Haptics.selectionAsync();
    await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing");
  }

  // Privy auto-detects new vs returning users — same handler for both buttons.
  async function handleConnect() {
    Haptics.selectionAsync();
    if (!ready) return;
    try {
      await login();
    } catch (err) {
      console.log("Login error:", err);
    }
  }

  return (
    <View style={tailwind('w-full h-full')}>
      <Image
        resizeMode="stretch"
        style={[tailwind('w-full h-full')]}
        source={require('../assets/login_background.png')}
      />
      <View style={[tailwind('w-full h-full absolute px-7 items-center')]}>
        <View style={[tailwind('absolute w-full'), { top: '55%' }]}>
          <Image
            resizeMode="cover"
            style={{ position: 'absolute', width: 128, height: 128, top: -95 }}
            source={require('../assets/login_icon_background.png')}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={!ready}
            style={[
              tailwind('rounded-full text-center bg-slate-900 border-2 border-slate-900 mt-4'),
              { paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: Platform.OS === 'ios' ? 12 : 10 },
            ]}
            onPress={handleConnect}
          >
            <Text style={[tailwind(`text-white px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>
              Sign up
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={!ready}
            style={[
              tailwind('rounded-full text-center bg-white mt-2 border-2 border-slate-900'),
              { paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: Platform.OS === 'ios' ? 12 : 10 },
            ]}
            onPress={handleConnect}
          >
            <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ position: 'absolute', bottom: 100, width: '100%', alignItems: 'center' }}>
        <Text style={{ color: 'black' }}>By signing up an account, I agree to the</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); openTerms(); }}>
            <Text style={{ textDecorationLine: 'underline', fontWeight: 'bold', color: 'black' }}>Terms & Conditions</Text>
          </TouchableOpacity>
          <Text style={{ color: 'black' }}> and </Text>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); openPrivacy(); }}>
            <Text style={{ textDecorationLine: 'underline', fontWeight: 'bold', color: 'black' }}>Privacy policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
