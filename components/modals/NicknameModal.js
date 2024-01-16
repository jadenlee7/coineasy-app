import React, { useState, useContext, useRef } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, TextInput, StyleSheet, TouchableWithoutFeedback } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { showMessage } from "react-native-flash-message";

import Modal from "../Modal";
import Button from "../Button";
import { PenIcon, SuccessIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";

import { Sae } from 'react-native-textinput-effects';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';

export default function PostSettingsModal() {    
    const { user, orbis, setNicknameVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(false)

    const [isFocused, setIsFocused] = useState(false);
    const [text, setText] = useState('');
    const labelPosition = useRef(new Animated.Value(text ? 1 : 0)).current;

    const windowSize = Dimensions.get('window')

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;

    function hide() {
        setNicknameVis(false);
        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    const showProfileImage = () => {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: -windowSize.width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start();

        setShowBack(true)
    }
    
    function onBackPress() {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: windowSize.width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setShowBack(false)
        });
    }

    function doConfirm () {
        Haptics.selectionAsync();
        setLoading(true);

        setTimeout(() => {
            setLoading(false);

            hide();
            showMessage({
                message: "This post was reported !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }, 3000)

    }


    const handleFocus = () => {
        console.log('HAHAHA');
        setIsFocused(true);
        animatedLabel(1);
      };
    
      const handleBlur = () => {
        console.log('ici');
        setIsFocused(false);
        if (!text) {
          animatedLabel(0);
        }
      };
    
      const handleTextChange = (text) => {
        setText(text);
        
        if (text) {
          animatedLabel(1);
        } else {
          animatedLabel(isFocused ? 1 : 0);
        }
      };
    
      const animatedLabel = (toValue) => {
        Animated.timing(labelPosition, {
          toValue: toValue,
          duration: 200,
          useNativeDriver: false,
        }).start();
      };
    
      const labelStyle = {
        left: 10,
        top: labelPosition.interpolate({
          inputRange: [0, 1],
          outputRange: [17, 0],
        }),
        fontSize: labelPosition.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 14],
        }),
        color: labelPosition.interpolate({
          inputRange: [0, 1],
          outputRange: ['gray', '#888'],
        }),
      };

    return(
        <Modal hide={hide} animateModal={true} bottomDuration={200} bottomStart={-100} type='post'>
            <View 
                style={[
                    tailwind('flex flex-col w-full'), 
                    { height: windowSize.height - 250 }
                ]}
            >

                {/* First part -  ask for a nickname */}
                <Animated.View style={[tailwind('flex flex-col'), {transform: [{ translateX: moveAnimation1 }],marginTop: 30,marginBottom: 50,}]}>
                    <Text style={{fontWeight: 'bold',textAlign:'center',fontSize: 20,}}>Give Us Your Nickname</Text>
                    <Text style={{textAlign:'center',fontSize: 15,marginTop: 10,}}>Let's Play with CoinEasyners!</Text>


                    <Text>Your Wallet Address : </Text>

                    <Button 
                        title="Next" 
                        color="white" 
                        size="sm" 
                        onPress={() => {Haptics.selectionAsync();showProfileImage()}} 
                        style={{borderColor: 'black',height: 40, justifyContent: 'center',alignItems: 'center',width: 120}}
                    />
                </Animated.View>

                {/* Second Part - ask for a profile image */}
                {showBack && (
                    <>
                        <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackPress()}} style={{position: 'absolute',left: 15, top: 15}}>
                            <Image
                                style={{width: 25,height: 25}}
                                resizeMode='contain'
                                source={require('../../assets/back_button.png')}
                                defaultSource={require('../../assets/back_button.png')}
                            />
                        </TouchableOpacity>
                        
                        <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop: 50,alignSelf: 'center',}}>

                            <Text>Choose Your Profile Image</Text>
                            <Text>Let's Play with CoinEasyners!</Text>

                            <Text>Your Wallet Address : </Text>

                            {loading ? (
                                <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%',backgroundColor: '#FF6E31',marginTop: 30,}]}>
                                    <ActivityIndicator size="small" color="#020617" />
                                </View>
                            ) : (
                                <Button color="orange" size='centered' onPress={() => doConfirm()} title="Confirm" style={{marginBottom: 0, marginTop: 30,}} />
                            )}
                        </Animated.View>
                    </>
                )}
            </View>
        </Modal>
    )
}
