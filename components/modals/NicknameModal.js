import React, { useState, useContext, useRef, useEffect, useMemo } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, StyleSheet, TouchableWithoutFeedback, Platform, TextInput, Easing } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as ImagePicker from 'expo-image-picker';

import Modal from "../Modal";
import Button from "../Button";
import { ArrowAccordionIcon, CloseIcon, PenIcon, SuccessIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";
import { FloatingLabelInput } from "react-native-floating-label-input";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import moment from "moment";


export default function PostSettingsModal() {    
    const { user, orbis, setUser, setUserData, setPushNotifsVis, modalNicknameRef } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loadingLater, setLoadingLater] = useState(false)
    const [nickname, setNickname] = useState('');

    const [pfpLoading, setPfpLoading] = useState(false);
    const [pfp, setPfp] = useState("")

    const [inviteCode, setInviteCode] = useState('')

    const windowSize = Dimensions.get('window')

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;

    const snapPoints = useMemo(() => ['100%', '100%'], []);
    const statusBarHeight = useStatusBarHeight();

    
    function hide() {
        Haptics.selectionAsync();
        modalNicknameRef.current?.close()
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

        const tempData = user.profile?.data ?? {}

        if(inviteCode == 'ORANGE50' && !tempData.claimedOrangeFifty){
            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: 50,
                        type: 'Account Creation Reward'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: 50,
                                type: 'Account Creation Reward'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                        {
                            numberOranges: 50,
                            type: 'Account Creation Reward'
                        },
                    ]
                }]
            }

            tempData.numberOranges ? tempData.numberOranges += 50 : tempData.numberOranges = 50
            tempData.claimedOrangeFifty = true
            tempData.rewardFirstPost = 'reward pending'

            setUserData({...tempData})
        }

        let content = {
            username: nickname,
            description: '',
            pfp: pfp,
            data: tempData
        };
        const res = await orbis.updateProfile(content);
        
        let _user = {...user};
        _user.profile = content;
        setUser(_user);

        when == 'now' ? setLoading(false) : setLoadingLater(false);

        modalNicknameRef.current?.close()
        setPushNotifsVis(true);
    }


      
    const [collapsed, setCollapsed] = useState(true);
    const [animationCollapse] = useState(new Animated.Value(0));

    const heightInterpolate = animationCollapse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 100]
    });

    const spinValue = new Animated.Value(0);
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["180deg", "0deg"]
    })

    const toggleCollapse = () => {
        if (collapsed) {
            Animated.parallel([
                Animated.timing(spinValue,{
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false 
                }),
                Animated.timing(animationCollapse, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false
                }),
            ]).start(() => setCollapsed(!collapsed))
        } else {
            Animated.parallel([
                Animated.timing(spinValue,{
                    toValue: 0,
                    duration: 300,
                    easing: Easing.linear,
                    useNativeDriver: false 
                }),
                Animated.timing(animationCollapse, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false
                }),
            ]).start(() => setCollapsed(!collapsed))
        }
    };

    return(
        <BottomSheetModalProvider>
            <BottomSheetModal
                ref={modalNicknameRef}
                index={1}
                snapPoints={snapPoints}
                enableContentPanningGesture={false}
                handleIndicatorStyle={{backgroundColor: 'black',}}
                handleStyle={{height: 2,justifyContent: 'center',marginTop: 10,}}
                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                topInset={65 + statusBarHeight}
            >
                <TouchableOpacity 
                    activeOpacity={1}
                    style={[
                        tailwind('flex flex-col w-full'), 
                        { height: windowSize.height - 250 }
                    ]}
                >
                    {/* First part -  ask for a nickname */}
                    <Animated.View style={[tailwind('flex flex-col'), {transform: [{ translateX: moveAnimation1 }],marginTop: 30,marginBottom: 50,}]}>
                        <TouchableOpacity onPress={() => hide()} style={{position: 'absolute',left: 15, top: -15}}>
                            <CloseIcon />
                        </TouchableOpacity>

                        <Text style={{fontWeight: 'bold',textAlign:'center',fontSize: Platform.OS == 'ios' ? 24 : 20,marginTop: Platform.OS == 'ios' ? 10 : 0,}}>Give Us Your Nickname</Text>
                        <Text style={{textAlign:'center',fontSize: Platform.OS == 'ios' ? 16 : 14,marginTop: 5,}}>Let's Play with CoinEasyners!</Text>

                        <View style={{alignSelf:'center',marginTop: Platform.OS == 'ios' ? 80 : 60, marginBottom: Platform.OS == 'ios' ? 40 : 30}}>
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
                            />
                        </View>

                        <View style={{marginVertical: 30,}}>
                            <TouchableWithoutFeedback onPress={toggleCollapse}>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                                    <Text style={{}}>Do you have an invitation code ?</Text>
                                    <Animated.View style={{height: 40, justifyContent:'center',alignItems:'center', transform: [{ rotate: spin}]}}>
                                        <ArrowAccordionIcon />
                                    </Animated.View>
                                </View>
                            </TouchableWithoutFeedback>
                            <Animated.View style={{ height: heightInterpolate, overflow: 'hidden', paddingHorizontal: 10}}>
                                <View style={{height: 100}}>
                                    <Text style={{width:'90%',alignSelf:'center',marginTop: 10,}}>Invite code</Text>
                                    <TextInput
                                        value={inviteCode}
                                        onChangeText={(text) => setInviteCode(text)}
                                        style={{alignSelf:'center',width:170,height: 40,fontSize: 15,borderRadius: 10,borderWidth: 1, borderColor: '#000',width:'90%',textAlign: 'center',}}
                                    />
                                </View>
                            </Animated.View>
                        </View>
                        





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
                                        source={require('../../assets/add_profile_picture.png')}
                                        defaultSource={require('../../assets/add_profile_picture.png')}
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
            </BottomSheetModal>
        </BottomSheetModalProvider>
    )
}
