import React, { useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { Platform, TouchableOpacity, Dimensions, ImageBackground, KeyboardAvoidingView } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import * as Haptics from 'expo-haptics';


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

    const animatedModalStyle = useAnimatedStyle(() => {
        return {
            bottom: (type == 'notifications' || type == 'oranges' || type == 'deleteAccount') ? '25%' : animateModal ? bottom.value : 0,
        };
    });

    const statusBarHeight = useStatusBarHeight();
    
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
                        height: (type == 'notifications' || type == 'oranges') ? '100%' : Dimensions.get('window').height,
                    }
                ]} 
            />

            {/** Modal content */}
            <Animated.View 
                style={[
                    tailwind('absolute bg-white '+ ((type == 'notifications' || type == 'oranges' || type == 'deleteAccount') ? 'rounded-xl' : 'rounded-t-xl')),
                    animatedModalStyle ,
                    {
                        paddingBottom: paddingBottom,
                        top: 
                            statusBarHeight > 25 && type != 'notifications' && type != 'trophy' && type != 'oranges' && type != 'small' && type != 'deleteAccount' ? 65 + statusBarHeight
                            : type != 'notifications' && type != 'oranges' && type != 'trophy' && type != 'small' && type != 'deleteAccount' ? 80 + statusBarHeight
                            : type == 'oranges' ? 150 + statusBarHeight 
                            : type == 'trophy' ? 220 
                            : 'auto',
                        width: (type == 'notifications' || type == 'oranges' || type == 'deleteAccount' || type == 'trophy')  ? '90%' : '100%',
                        height: 
                            type == 'notifications' ? 400 
                            : type == 'oranges' && Platform.OS == 'ios' ? 450 
                            : type == 'oranges' && Platform.OS !== 'ios' ? 400 
                            : type == 'deleteAccount' && Platform.OS == 'ios' ? 470 
                            : type == 'deleteAccount' ? 500 
                            : type == 'trophy' ? 350 
                            : 'auto',
                        alignSelf: 'center',
                        borderRadius: 10
                    }, 
                ]} 
            >
                {type && type == 'notifications' ? (
                    <ImageBackground source={require('../assets/notification_background.png')} resizeMode="stretch" style={{height: '103%',}} >
                        {children}
                    </ImageBackground>
                ) : type && type == 'deleteAccount' ? (
                    <ImageBackground source={require('../assets/delete_account_background.png')} resizeMode="stretch" style={{height: '103%',}} >
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
