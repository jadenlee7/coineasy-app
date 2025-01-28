import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { Platform, Keyboard, View, TouchableOpacity, Dimensions, ImageBackground, KeyboardAvoidingView, Linking, TouchableWithoutFeedback } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from "expo-linear-gradient";


export default function ModalSmall({hide, children}) {
    const tailwind = useTailwind();
    const opacity = useSharedValue(0.25);
    const bottom = useSharedValue(-100);

    useEffect(() => {
        handleOpen();
    }, [])

    // Function to trigger the fadeout animation
    const handleOpen = () => {
        opacity.value = withTiming(0.75, { duration: 150 });
        bottom.value = withTiming(0, {
            duration: 150
        });
    };

    return(
        <KeyboardAvoidingView style={[tailwind('absolute h-full w-full'), { elevation: 50 }]} behavior={'height'}>
            {/** Background */}
            <TouchableOpacity 
                activeOpacity={0.63} 
                onPress={() => {Haptics.selectionAsync();hide()}} 
                style={[
                    tailwind('h-full w-full bg-slate-950'), 
                    {
                        opacity: 0.63,
                        height: '100%',
                    }
                ]} 
            />

            {/** Modal content */}
            <Animated.View 
                style={[
                    tailwind('absolute rounded-xl'),
                    {
                        paddingVertical: 30,
                        top: Dimensions.get('window').height/2-100,
                        width: '95%',
                        alignSelf: 'center',
                    }, 
                ]} 
            >
                <LinearGradient
                    colors={['#FFF7E8', '#FFD4D1']}
                    style={[{justifyContent:'center',borderRadius: 10,}]} 
                >
                    <View>
                        {children}
                    </View>
                </LinearGradient>
            </Animated.View>
        </KeyboardAvoidingView>
    )
}
