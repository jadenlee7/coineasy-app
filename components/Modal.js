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


export default function Modal({hide, children, animateModal = true, bottomDuration = 150, bottomStart = -100, paddingBottom = 24, type = null, isAds = null, pendingAds = null}) {
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

    const animatedModalStyle = useAnimatedStyle(() => {
        return {
            bottom: (type == 'notifications' || type == 'oranges' || type == 'deleteAccount') ? '25%' : animateModal ? bottom.value : 0,
        };
    });

    const statusBarHeight = useStatusBarHeight();
    
    const openUrl = async () => {
        let url = 'https://youtu.be/EPLZlxe07Eg'
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(`Don't know how to open this URL: ${url}`);
        }
    }

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
                        height: (type == 'notifications' || type == 'oranges' || type == 'oranges-help') ? '100%' : Dimensions.get('window').height,
                    }
                ]} 
            />

            {/** Modal content */}
            <Animated.View 
                style={[
                    tailwind('absolute '+  (!pendingAds ? ' bg-white ' : '')+ ((type == 'notifications' || type == 'oranges' || type == 'oranges-help' || type == 'deleteAccount') ? 'rounded-xl' : 'rounded-t-xl')),
                    animatedModalStyle ,
                    {
                        paddingBottom: paddingBottom,
                        top: 
                            statusBarHeight > 25 && type != 'notifications' && type != 'oranges' && type != 'oranges-help' && type != 'small' && type != 'deleteAccount' ? 65 + statusBarHeight 
                            : type != 'notifications' && type != 'oranges' && type != 'oranges-help' && type != 'small' && type != 'deleteAccount' ? 80 + statusBarHeight 
                            : type == 'oranges' ? 150 + statusBarHeight 
                            : type == 'oranges-help' ? 100 + statusBarHeight 
                            : 'auto',
                        width: (type == 'notifications' || type == 'oranges' || type == 'oranges-help' || type == 'deleteAccount')  ? '90%' : '100%',
                        height: 
                            type == 'notifications' ? 400 
                            : type == 'oranges' ? 400 
                            : type == 'oranges-help' ? 450
                            : type == 'deleteAccount' && Platform.OS == 'ios' ? 470 
                            : type == 'deleteAccount' ? 500 
                            : 'auto',
                        alignSelf: 'center',
                    }, 
                ]} 
            >
                {type && type == 'notifications' ? (
                    <ImageBackground source={require('../assets/notification_background.png')} resizeMode="stretch" style={{height: '103%',}} >
                        {children}
                    </ImageBackground>
                ) : type && type == 'deleteAccount' ? (
                    <ImageBackground source={require('../assets/deleteAccount_background.png')} resizeMode="stretch" style={{height: '103%',}} >
                        {children}
                    </ImageBackground>
                ) : type && (type == 'oranges' || type == 'oranges-help') && !pendingAds ? (
                    <TouchableWithoutFeedback onPress={openUrl} disabled={!isAds}>
                        <ImageBackground 
                            source={isAds ? require('../assets/ads/ad1_v2.png') : require('../assets/background_claim_oranges.png')} 
                            resizeMode="stretch" 
                            style={[isAds ? {height: '103.2%',width: '100%',} : {height: '103%',}, type == 'oranges-help' && {justifyContent:'center'}]} 
                        >
                            {children}
                        </ImageBackground>
                    </TouchableWithoutFeedback>
                ) : type && (type == 'oranges' || type == 'oranges-help') && pendingAds ? (
                    <>
                        {children}
                    </>

                ) : (
                    <>
                        {children}
                    </>
                )}

            </Animated.View>
        </KeyboardAvoidingView>
    )
}
