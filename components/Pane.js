import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { Platform, Keyboard, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, TextInput, KeyboardAvoidingView } from 'react-native';
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

  return(
    <KeyboardAvoidingView style={[tailwind('absolute flex flex-1 h-full w-full bg-white'), { elevation: 30, top: 40 + statusBarHeight }]} behavior={Platform.OS === 'ios' ? 'height' : 'height'}>
      {children}
    </KeyboardAvoidingView>
  )
}
