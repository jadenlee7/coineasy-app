import React, { useState, useEffect, useRef } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Image, NativeEventEmitter, NativeModules, Platform, StatusBar } from 'react-native';
const { StatusBarManager } = NativeModules;
import { useTailwind } from 'tailwind-rn';

export default function Header() {
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();

  useEffect(() => {
    console.log("statusBarHeight:", statusBarHeight);
  }, [statusBarHeight])

  return(
    <View style={[tailwind('w-full'), { height: 40 + statusBarHeight }]}>
      <Image
        style={[{ width: width, height: 40 + statusBarHeight, paddingTop: statusBarHeight }]}
        source={require('../assets/HeaderBg.png')} />
    </View>
  )
}


function useStatusBarHeight() {
  const [value, setValue] = useState(StatusBar.currentHeight || 0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const emitter = new NativeEventEmitter(StatusBarManager);

    StatusBarManager.getHeight(({ height }: { height: number }) => {
      setValue(height);
    });
    const listener = emitter.addListener("statusBarFrameWillChange", (data) =>
      setValue(data.frame.height),
    );

    return () => listener.remove();
  }, []);

  return value;
}
