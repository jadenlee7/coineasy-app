import React, { useState, useEffect, useRef, useContext } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, Image, NativeEventEmitter, NativeModules, Platform, StatusBar } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue,
  Easing
} from 'react-native-reanimated';

export default function Header() {
  const { screen, scrolled, setScrolled, postDetailsVis, profileSelected, translateY } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();
  const mTop = useSharedValue(0);
  const [hidden, setHidden] = useState(false);

  const actionBarStyle = useAnimatedStyle(() => {
    return {
      marginTop: withTiming(translateY.value, {
        duration: translateY.value == 0 ? 250 : 200,
        easing: Easing.inOut(Easing.ease),
      })
    };
  });


  if(screen == "qr") {
    return;
  }

  return(
    <Animated.View style={[tailwind('w-full'), { height: 40 + statusBarHeight }, actionBarStyle]}>
      <Image
        style={[{ width: width, height: 40 + statusBarHeight, paddingTop: statusBarHeight }]}
        source={require('../assets/HeaderBg.png')} />
    </Animated.View>
  )
}
