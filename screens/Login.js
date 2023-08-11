import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight, ActivityIndicator } from 'react-native';
import Header from "../components/Header";
import SecondHeader from "../components/SecondHeader";
import Button from "../components/Button";
import ConnectModal from "../components/modals/ConnectModal";

export default function Login() {
  const { user, setUser, orbis, callbackConnect } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [connectModalVis, setConnectModalVis] = useState(false);

  return(
    <View style={tailwind('w-full h-full')}>
      <Image
        resizeMode="cover"
        style={[tailwind('w-full h-full')]}
        source={require('../assets/LoginBG.png')} />
      <View style={[tailwind('w-full h-full absolute px-8 items-center'), {paddingTop: 350}]}>
        <Text style={[tailwind(`text-white`), { fontSize: 25, fontFamily: "GmarketBold", lineHeight: 35 }]}>WELCOME TO EASY WORLD!</Text>
        <View style={[tailwind('absolute w-full'), {bottom: 115}]}>
          <TouchableHighlight style={[tailwind('rounded-full py-3 text-center bg-slate-900 border-2 border-slate-900 mt-4')]} onPress={() => setConnectModalVis(true)}>
            <Text style={[tailwind(`text-white px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Register</Text>
          </TouchableHighlight>

          <TouchableHighlight style={[tailwind('rounded-full py-3 text-center bg-white mt-2 border-2 border-slate-900')]} onPress={() => setConnectModalVis(true)} underlayColor="#f8fafc">
            <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Login</Text>
          </TouchableHighlight>

          <View style={[tailwind(`w-full items-center`), {marginTop: 25}]}>
            <Image
              resizeMode="cover"
              style={{width: 159 * 0.95, height: 22.7 * 0.95}}
              source={require('../assets/powered_by_orbis.png')} />
          </View>
        </View>
      </View>

      {connectModalVis &&
        <ConnectModal hide={() => setConnectModalVis(false)} />
      }

    </View>
  )
}
