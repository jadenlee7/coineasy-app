import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { Platform, Keyboard, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, TextInput, KeyboardAvoidingView } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import Svg, { Circle, Rect, Path } from 'react-native-svg';

export default function Pane({children}) {
  const tailwind = useTailwind();
  return(
    <KeyboardAvoidingView style={[tailwind('absolute h-full w-full bg-white flex flex-col'), { elevation: 10 }]} behavior={Platform.OS === 'ios' ? 'height' : 'height'}>
      {children}
    </KeyboardAvoidingView>
  )
}
