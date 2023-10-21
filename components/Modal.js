import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { Platform, Keyboard, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Dimensions } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

export default function Modal({hide, children, animateModal = true, bottomDuration = 150, bottomStart = -100, paddingBottom = 24}) {
  const tailwind = useTailwind();
  const opacity = useSharedValue(0.25);
  const bottom = useSharedValue(bottomStart);

  useEffect(() => {
    handleOpen();
  }, [])

  // Function to trigger the fadeout animation
  const handleOpen = () => {
    opacity.value = withTiming(0.75, { duration: 150 });
    bottom.value = withTiming(0, {
      duration: bottomDuration
    });
  };

  // Animated style for the fading effect
  const animatedBgStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const animatedModalStyle = useAnimatedStyle(() => {
    return {
      bottom: animateModal ? bottom.value : 0,
    };
  });

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  return(
    <KeyboardAvoidingView style={[tailwind('absolute h-full w-full'), { elevation: 50 }]} behavior={Platform.OS === 'ios' ? 'height' : 'padding'}>
      {/** Background */}
      <TouchableOpacity activeOpacity={0.63} onPress={() => hide()} style={[tailwind('h-full w-full bg-slate-950'), {opacity: 0.63, height: Dimensions.get('window').height}]}></TouchableOpacity>

      {/** Modal content */}
      <Animated.View style={[tailwind('absolute w-full bg-white rounded-t-xl'), { paddingBottom: paddingBottom}, animatedModalStyle ]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  )
}
