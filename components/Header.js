import React, { useState, useEffect, useRef, useContext } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, Image, NativeEventEmitter, NativeModules, Platform, StatusBar, Animated } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import {
  withTiming,
  useAnimatedStyle,
  useSharedValue,
  Easing
} from 'react-native-reanimated';
import SecondHeader from "./SecondHeader";

export default function Header() {
  const { screen, scrolled, setScrolled, postDetailsVis, profileSelected, translateY, setCategory, setScreen, previousScreen, category, scrollAnim,offsetAnim, setClampedScroll, navbarTranslate } = useContext(GlobalContext);
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
  
  function resetCategory() {
    setCategory(null);
    setScreen(previousScreen);
  }

  return(
    <Animated.View 
        style={[
            tailwind('w-full'), 
            { 
                height: screen == 'home' ? 100 + statusBarHeight : 40 + statusBarHeight,
                transform: [{ translateY: navbarTranslate }],
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 1000,
                overflow: 'hidden'
            },
        ]}
        onLayout={(event) => {
            let {height} = event.nativeEvent.layout;
            setClampedScroll(Animated.diffClamp(
              Animated.add(
                scrollAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                  extrapolateLeft: 'clamp'
                }),
                offsetAnim
              ), 0, height)
            );
        }}
    >
      <Image
        style={[{ width: width, height: 40 + statusBarHeight, paddingTop: statusBarHeight }]}
        source={require('../assets/HeaderBg.png')} 
      />
      
      {screen == 'home' && <SecondHeader label={"GM! CoinEasy Frens!"} back={category ? () => resetCategory() : null} />}
    </Animated.View>
  )
}
