import React, { useState, useContext, useRef, useEffect } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, StyleSheet, TouchableWithoutFeedback, Platform, TextInput } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as ImagePicker from 'expo-image-picker';

import Modal from "../Modal";
import Button from "../Button";
import { CloseIcon, PenIcon, SuccessIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";
import { FloatingLabelInput } from "react-native-floating-label-input";

// import TextInput from "react-native-text-input-interactive";


export default function PostSettingsModal() {    
    const { user, orbis, setNicknameVis, setUser, setPushNotifsVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const inputRef = useRef()
    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loadingLater, setLoadingLater] = useState(false)
    const [isFocused, setIsFocused] = useState(true)
    const [nickname, setNickname] = useState('');

    const [pfpLoading, setPfpLoading] = useState(false);
    const [pfp, setPfp] = useState("")

    const windowSize = Dimensions.get('window')

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;

    const moveAnimationPen = useRef(new Animated.Value(windowSize.width *0.5)).current;

    // useEffect(() => {
    //     inputRef.current.focus()
    // }, [])
    

    useEffect(() => {
        if(isFocused){
            Animated.timing(moveAnimationPen, {
                toValue: windowSize.width *0.8,
                duration: 300,
                useNativeDriver: true
            })
        }else{
            Animated.timing(moveAnimationPen, {
                toValue: windowSize.width *0.5,
                duration: 300,
                useNativeDriver: true
            })
        }
    }, [isFocused])
    

    function hide() {
        Haptics.selectionAsync();
        setNicknameVis(false);
        Keyboard.dismiss()
    }

    const showProfileImage = () => {
        Haptics.selectionAsync();
        Keyboard.dismiss()

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

    async function onChooseProfilePicture() {
        try {
            // No permissions request is necessary for launching the image library
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Images",
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.25,
            });

            if (!result.canceled) {
                /** Handle Image picked */
                let imagePath = result.assets[0].uri;
                setPfpLoading(true);
                setPfp(imagePath);

                const imageType = mime.getType(imagePath)

                /** Create file object */
                let file = {
                    name: "test",
                    type: imageType,
                    uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                }

                /** Upload PFP to IPFS */
                const resUpload = await orbis.uploadMedia(file);

                /** Handle result returned by Orbis SDK */
                if(resUpload.status == 200) {
                    let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                    console.log("finalUrl:", finalUrl);
                    setPfp(finalUrl);
                    setPfpLoading(false);
                } else {
                    alert("Error uploading profile picture.");
                    setPfpLoading(false);
                }

            }
        } catch(e) {
            console.log("Error selecting photo:", e);
            setPfpLoading(false);
        }
    }

    function getProfilePicture() {
        if(pfp.includes("ipfs://")) {
          return pfp.replace("ipfs://", "https://ipfs.io/ipfs")
        } else {
          return pfp
        }
    }

    async function doConfirm(when) {
        if(pfpLoading) {
            alert("Your profile picture is currently being uploaded.");
            return;
        }
        Haptics.selectionAsync();
        when == 'now' ? setLoading(true) : setLoadingLater(true);

        let content = {
            username: nickname,
            description: '',
            pfp: pfp,
        };
        const res = await orbis.updateProfile(content);
        
        let _user = {...user};
        _user.profile = content;
        setUser(_user);

        when == 'now' ? setLoading(false) : setLoadingLater(false);

        setNicknameVis(false);
        setPushNotifsVis(true);
    }

    const [isTextFocused, setIsTextFocused] = useState(false)

    return(
        <Modal hide={() => hide()} animateModal={true} bottomDuration={200} bottomStart={-100} type='post'>
            <TouchableOpacity 
                activeOpacity={1}
                style={[
                    tailwind('flex flex-col w-full'), 
                    { height: windowSize.height - 250 }
                ]}
                onPress={() => setIsFocused(false)}
            >
                {/* First part -  ask for a nickname */}
                <Animated.View style={[tailwind('flex flex-col'), {transform: [{ translateX: moveAnimation1 }],marginTop: 30,marginBottom: 50,}]}>
                    <TouchableOpacity onPress={() => hide()} style={{position: 'absolute',left: 15, top: -15}}>
                        <CloseIcon />
                    </TouchableOpacity>

                    <Text style={{fontWeight: 'bold',textAlign:'center',fontSize: Platform.OS == 'ios' ? 24 : 20,marginTop: Platform.OS == 'ios' ? 10 : 0,}}>Give Us Your Nickname</Text>
                    <Text style={{textAlign:'center',fontSize: Platform.OS == 'ios' ? 16 : 14,marginTop: 5,}}>Let's Play with CoinEasyners!</Text>

                    <View style={{alignSelf:'center',margin: Platform.OS == 'ios' ? 80 : 60}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 10, position: 'absolute',alignSelf:'center',width: 200,height: 40}}>
                            {nickname == "" ? (
                                <>
                                    <Text style={{color: '#959595',fontSize: Platform.OS == 'ios' ? 28 : 25,fontWeight: 'bold',}}>Nickname</Text>
                                    <PenIcon style={{marginTop: 5,}} />
                                </>
                            ) : (
                                <PenIcon style={{position: 'absolute',right: Platform.OS == 'ios' ? 25.5 : 21,top: Platform.OS == 'ios' ? 11.5 : 12}} />
                            )}
                        </View>
                        <TextInput
                            value={nickname}
                            onChangeText={(text) => setNickname(text)}
                            autoFocus
                            style={{alignSelf:'center',width:170,height: 40,fontSize: 20,}}
                            onFocus={() => setIsTextFocused(true)}
                            onBlur={() => setIsTextFocused(false)}
                        />
                    </View>


                    {/* <View style={{width: '60%',alignSelf: 'center',margin: 40,}}>
                        <FloatingLabelInput
                            ref={inputRef}
                            label={'Nickname'}
                            value={nickname}
                            onChangeText={value => setNickname(value)}
                            containerStyles={{border: 0, height: 60}}
                            rightComponent={
                                <Animated.View style={{position:'absolute',top: 5,transform: [{ translateX: moveAnimationPen }]}}>
                                    <PenIcon  />
                                </Animated.View>
                            }
                            isFocused={isFocused}
                            labelStyles={{fontSize: 25,textAlign:'center',alignSelf: 'center',fontWeight: 'bold',}}
                            customLabelStyles={{
                                colorBlurred:'#959595',
                                colorFocused:'#959595',
                                topBlurred: 0,
                                topFocused: -25,
                                fontSizeFocused: 16,
                                fontSizeBlurred: 25,
                                leftBlurred: Platform.OS == 'ios' ? windowSize.width * 0.14 : windowSize.width * 0.11,
                                leftFocused: 0
                            }}
                            animationDuration={0}
                        />
                    </View> */}


                    {user?.metadata?.address && (
                        <Text style={{textAlign:'center',color:'rgba(85,85,85,0.33)'}}>Your Wallet Address : {user.metadata.address.slice(0, 4)}...{user.metadata.address.slice(user.metadata.address.length - 4, user.metadata.address.length)}</Text>
                    )}

                    <TouchableOpacity 
                        activeOpacity={0.6} 
                        style={[
                            tailwind(`px-5 rounded-full border flex-row items-center`), 
                            {borderColor: 'black',height: Platform.OS == 'ios' ? 60 : 50, justifyContent: 'center',alignItems: 'center',width: windowSize.width - 40,alignSelf: 'center',marginTop: 20,}
                        ]} 
                        onPress={() => {Haptics.selectionAsync();showProfileImage()}}
                    >
                        <Text style={[tailwind('text-main font-semibold items-center'), {fontSize: Platform.OS == 'ios' ? 16 : 13, lineHeight: 16,}]}>Next</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Second Part - ask for a profile image */}
                {showBack && (
                    <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop: 50,alignSelf: 'center',}}>
                        <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackPress()}} style={{position: 'absolute',left: 0, top: -30}}>
                            <Image
                                style={{width: 25,height: 25}}
                                resizeMode='contain'
                                source={require('../../assets/back_button.png')}
                                defaultSource={require('../../assets/back_button.png')}
                            />
                        </TouchableOpacity>

                        <Text style={{fontWeight: 'bold',textAlign:'center',fontSize: Platform.OS == 'ios' ? 22 : 20,}}>Choose Your Profile Image</Text>
                        <Text style={{textAlign:'center',fontSize: Platform.OS == 'ios' ? 16 : 14,marginTop: 5,}}>Let's Play with CoinEasyners!</Text>

                        {nickname && (
                            <Text style={{textAlign:'center',fontWeight: 'bold',fontSize: 18,marginTop: 10,marginBottom: -20,}}>{nickname}</Text>
                        )}

                        <TouchableOpacity onPress={() => {Haptics.selectionAsync();onChooseProfilePicture()}} style={{margin: 60,}}>

                            {pfpLoading ? (
                                <View style={{width: 90,height: 90, borderWidth: 1}}>
                                    <ActivityIndicator size="small" color="#000" style={[tailwind('absolute'), {bottom: 0, right: -5}]} />
                                </View>
                            ) : pfp ? (
                                <Image
                                    style={{alignSelf: 'center',width: 90,height: 90, borderRadius: 45}}
                                    resizeMode='contain'
                                    source={{
                                        uri: getProfilePicture(),
                                        cache: 'force-cache'
                                    }}
                                />
                            ) : (
                                <Image
                                    style={{alignSelf: 'center',width: 90,height: 90}}
                                    resizeMode='contain'
                                    source={require('../../assets/addProfilePicture.png')}
                                    defaultSource={require('../../assets/addProfilePicture.png')}
                                />
                            )}

                        </TouchableOpacity>



                        {user?.metadata?.address && (
                            <Text style={{textAlign:'center',color:'rgba(85,85,85,0.33)'}}>Your Wallet Address : {user.metadata.address.slice(0, 4)}...{user.metadata.address.slice(user.metadata.address.length - 4, user.metadata.address.length)}</Text>
                        )}

                        {loading ? (
                            <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%',backgroundColor: '#FF6E31',marginTop: 30,}]}>
                                <ActivityIndicator size="small" color="#020617" />
                            </View>
                        ) : (

                            <TouchableOpacity 
                                activeOpacity={0.9}
                                style={[tailwind('px-7 py-4 rounded-full items-center'), {backgroundColor: "#FF6B17", height: Platform.OS == 'ios' ? 60 : 50,justifyContent:'center', marginBottom: 0, marginTop: 20,}]} 
                                onPress={() => doConfirm('now')}
                            >
                                <Text style={[tailwind('text-white font-semibold'), {fontSize: Platform.OS == 'ios' ? 16 : 13, lineHeight: 16,}]}>Confirm</Text>
                            </TouchableOpacity>
                        )}
                        
                        {loadingLater ? (
                            <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {borderColor: 'black',borderWidth:1,height: 50, justifyContent: 'center',alignItems: 'center',width: windowSize.width - 40,alignSelf: 'center',marginTop: 20,backgroundColor: 'white',}]}>
                                <ActivityIndicator size="small" color="#020617" />
                            </View>
                        ) : (

                            <TouchableOpacity activeOpacity={0.6} style={[tailwind(`px-5 rounded-full border flex-row items-center`), {borderColor: 'black',height: Platform.OS == 'ios' ? 60 : 50, justifyContent: 'center',alignItems: 'center',width: windowSize.width - 40,alignSelf: 'center',marginTop: 20,}]} onPress={() => doConfirm('later')}>
                                <Text style={[tailwind('text-main font-semibold items-center'), {fontSize: Platform.OS == 'ios' ? 16 : 13, lineHeight: 16,}]}>Later</Text>
                            </TouchableOpacity>
                        )}

                    </Animated.View>
                )}
            </TouchableOpacity>
        </Modal>
    )
}
