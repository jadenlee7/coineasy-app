import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { Platform, Keyboard, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Dimensions, ImageBackground } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

export default function Modal({hide, children, animateModal = true, bottomDuration = 150, bottomStart = -100, paddingBottom = 24, type = null}) {
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
      bottom: (type == 'notifications' || type == 'deleteAccount') ? '25%' : animateModal ? bottom.value : 0,
    };
  });

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  return(
    <KeyboardAvoidingView style={[tailwind('absolute h-full w-full'), { elevation: 50 }]} behavior={Platform.OS === 'ios' ? 'height' : 'padding'}>
      {/** Background */}
      <TouchableOpacity 
        activeOpacity={0.63} 
        onPress={() => hide()} 
        style={[
            tailwind('h-full w-full bg-slate-950'), 
            {
                opacity: 0.63,
                height: type == 'notifications' ? '100%' : Dimensions.get('window').height
            }
        ]} 
      />

      {/** Modal content */}
      <Animated.View 
        style={[
            tailwind('absolute bg-white '+ ((type == 'notifications' || type == 'deleteAccount') ? 'rounded-xl' : 'rounded-t-xl')),
            animatedModalStyle ,
            {
                paddingBottom: paddingBottom,
                width: (type == 'notifications' || type == 'deleteAccount')  ? '90%' : '100%',
                height: 
                    type == 'notifications' ? 400 
                    : type == 'deleteAccount' && Platform.OS == 'ios' ? 470 
                    : type == 'deleteAccount' ? 500 
                    : type == "post" ? '79.5%'
                    : 'auto',
                alignSelf: 'center',
            }, 
        ]} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {type && type == 'notifications' ? (
            <ImageBackground source={require('../assets/notification_background.png')} resizeMode="stretch" style={{height: '103%',}} >
                {children}
            </ImageBackground>
        ) : type && type == 'deleteAccount' ? (
            <ImageBackground source={require('../assets/deleteAccount_background.png')} resizeMode="stretch" style={{height: '103%',}} >
                {children}
            </ImageBackground>
        ) : (
            <>
                {children}
            </>
        )}

      </Animated.View>
    </KeyboardAvoidingView>
  )
}
