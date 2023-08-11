import React, { useState, useEffect, useRef, useContext } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Image, NativeEventEmitter, NativeModules, Platform, StatusBar } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function Header() {
  const { screen } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();

  if(screen == "qr") {
    return;
  }

  return(
    <View style={[tailwind('w-full'), { height: 40 + statusBarHeight }]}>
      <Image
        style={[{ width: width, height: 40 + statusBarHeight, paddingTop: statusBarHeight }]}
        source={require('../assets/HeaderBg.png')} />
    </View>
  )
}
