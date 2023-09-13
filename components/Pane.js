import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { Platform, Keyboard, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, Dimensions, KeyboardAvoidingView } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import Header from "../components/Header";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function Pane({children}) {
  const tailwind = useTailwind();
  const statusBarHeight = useStatusBarHeight();
  const { height } = Dimensions.get('window');


  return(
    <Animated.View style={[tailwind('absolute flex w-full bg-white'), { elevation: 30, top: 40 + statusBarHeight, height: height - (40 + statusBarHeight) }]} behavior={Platform.OS === 'ios' ? 'height' : 'height'}>
      {children}
    </Animated.View>
  )
}
