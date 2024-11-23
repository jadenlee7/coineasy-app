import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Image, ImageBackground, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ScrollView } from 'react-native-gesture-handler';


import Modal from '../../components/Modal';
import Button from '../../components/Button';
import HeaderImage from '../../components/HeaderImage';
import { listConstants } from '../../components/Constants';
import { GlobalContext } from '../../contexts/GlobalContext';

import moment from 'moment-timezone';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { AntDesign } from '@expo/vector-icons';
import CountDownTimer from "react-native-countdown-timer-hooks";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewFeatureModal from '../../components/modals/NewFeatureModal';
import { CopyIcon, CopyIcon2, CopyIconBadge } from '../../components/Icons';

const {width, height} = Dimensions.get('window')


const OrangeReward = ({navigation, route}) => {
    const { 
        orbis,
        user,
        userData,
        setUserData,
        activityClaim,
        setShowClaimOranges,
        setTodayOranges,
        setNewFeatureVis,
        setNewFeatureAlertVis,
        newFeatureVis,
        newFeatureAlertVis,
        setAddressCopied
    } = useContext(GlobalContext);
    const tailwind = useTailwind();  
    
    const [openHelp, setOpenHelp] = useState(false)
    const [openInviteHelp, setOpenInviteHelp] = useState(false)
    const [bottomOpen, setBottomOpen] = useState(false)
    const [launchAnimation, setLaunchAnimation] = useState(false)
    const [firstTimeReward, setFirstTimeReward] = useState(false)

    const [firstCelebrationTitle, setFirstCelebrationTitle] = useState('+5 Oranges!')
    const [secondCelebrationTitle, setSecondCelebrationTitle] = useState(listConstants[0].title)
    const [thirdCelebrationTitle, setThirdCelebrationTitle] = useState(null)

    const modalRef = useRef(null); 
    const snapPoints = useMemo(() => ['40%','40%'], []);
    const handleModalPress = useCallback(() => modalRef.current?.present(), []);
    
    const modalInviteRef = useRef(null); 
    const snapInvitePoints = useMemo(() => ['50%','50%'], []);
    const snapInvitePointsIOS = useMemo(() => ['43%','43%'], []);
    const handleModalInvitePress = useCallback(() => modalInviteRef.current?.present(), []);

    useEffect(() => {
        checkFirstTimeReward()
        
        async function checkFirstTimeReward(){
            // await AsyncStorage.removeItem('FirstTimeReward')
            // userData.firstTime = false       
            // setUserData({...userData})

            const isFirstTime = await AsyncStorage.getItem('FirstTimeReward')
            setFirstTimeReward(isFirstTime ?? 'true')
        }
    }, [])    

    useEffect(() => {
        if(launchAnimation){
            startAnimation()
        }
    }, [launchAnimation])
    

    const onResetData = async () => {
        user.profile.data = {alreadyLogin: true}

        // tempData = {
        //     "alreadyLogin":true,
        //     "post":{
        //         "number":1,
        //         "gained":15,
        //         "lastPost":"2024-07-16 16:13",
        //     },
        //     "activityUnclaimed":{"number":29},
        //     "reaction":{"number":4,"gained":8,"lastReaction":"2024-07-16 16:13"},
        //     "comment":{"number":2,"gained":6,"lastComment":"2024-07-16 16:16"},
        //     "numberOranges":0,
        // }


        // setUserData({...tempData})

        var tempProfile = user.profile
        // tempProfile.data = tempData
        const res = await orbis.updateProfile(tempProfile);
    }

    const onDailyClaim = async () => {
        Haptics.selectionAsync()
        const tempData = userData

        if(tempData){
            let addNumber = 5
            if(tempData.claimStreak){
                if(tempData.claimStreak.lastClaim && tempData.claimStreak.lastClaim.slice(0,10) == moment().format('YYYY-MM-DD')){

                    if(tempData.claimStreak.number == 6 || tempData.claimStreak.number == 13 || tempData.claimStreak.number == 29){
                        if(tempData.listClaimedOranges){
                            const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                            if(index != -1){
                                tempData.listClaimedOranges[index].listOranges.push({
                                    numberOranges: tempData.claimStreak.number == 6 ? 20 : tempData.claimStreak.number == 13 ? 40 : 100,
                                    type: tempData.claimStreak.number+1+'-Day Streak Bonus'
                                })
                            }else{
                                tempData.listClaimedOranges.push({
                                    date: moment().format('YYYY-MM-DD'),
                                    listOranges: [
                                        {
                                            numberOranges: tempData.claimStreak.number == 6 ? 20 : tempData.claimStreak.number == 13 ? 40 : 100,
                                            type: tempData.claimStreak.number+1+'-Day Streak Bonus'
                                        },
                                    ]
                                })
                            }
                        }else{
                            tempData.listClaimedOranges = [{
                                date: moment().format('YYYY-MM-DD'),
                                listOranges: [
                                    {
                                        numberOranges: tempData.claimStreak.number == 6 ? 20 : tempData.claimStreak.number == 13 ? 40 : 100,
                                        type: tempData.claimStreak.number+1+'-Day Streak Bonus'
                                    },
                                ]
                            }]
                        }
                    }

                    addNumber = (tempData.claimStreak.number+1)*5
                    tempData.claimStreak.number += 1
                }else{
                    tempData.claimStreak.number = 1
                }

                tempData.numberOranges += addNumber
                tempData.claimStreak.lastClaim = moment().format('YYYY-MM-DD HH:mm:ss')
            }else{
                tempData.numberOranges ? tempData.numberOranges += 5 : tempData.numberOranges = 5
                tempData.claimStreak = {
                    number: 1,
                    lastClaim: moment().format('YYYY-MM-DD HH:mm:ss')
                }
            }

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: addNumber,
                        type: 'Daily Check-in'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Daily Check-in'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Daily Check-in'
                            },
                    ]
                }]
            }

            setFirstCelebrationTitle('+'+addNumber+' Oranges!')

            const indexCelebration = listConstants.findIndex(e => e.day == 1)
            if(indexCelebration != -1){
                setSecondCelebrationTitle(listConstants[indexCelebration].title)
            }

            if(tempData.claimStreak.number == 7 || tempData.claimStreak.number == 14 || tempData.claimStreak.number == 30){
                setThirdCelebrationTitle(
                    tempData.claimStreak.number == 6 ? '+20 Bounces Oranges!' 
                    : tempData.claimStreak.number == 13 ? '+40 Bounces Oranges!' 
                    : '+100 Bounces Oranges!')
            }

            setLaunchAnimation(true)
            
            setUserData({...tempData})

            var tempProfile = user.profile
            tempProfile.data = tempData
            const res = await orbis.updateProfile(tempProfile);
        }


        // numberOranges: 1000
        // listClaimedOranges: [
        //     {
        //         date: moment().format('YYYY-MM-DD'),
        //         listOranges: [
                        // {
                        //     numberOranges: 10,
                        //     type: 'Comment'
                        // },
                        // {
                        //     numberOranges: 5,
                        //     type: 'Daily Check-in'
                        // },
                        // {
                        //     numberOranges: 5,
                        //     type: 'Ad Rewards'
                        // },
                        // {
                        //     numberOranges: 5,
                        //     type: '7-Day Streak Bonus'
                        // },
        //         ]
        //     }
        // ]
        // claimStreak: {
        //     number: 0,
        //     lastClaim: moment().format('YYYY-MM-DD HH:mm:ss')
        // }
        // adReward: {
        //     lastClaim: moment().format('YYYY-MM-DD HH:mm:ss')
        // }
        // post: {
        //     number: 0,
        //     gained: 0,
        //     lastPost: moment().format('YYYY-MM-DD HH:mm')
            // listPostLiked: [
            //     {
            //         stream_id: "liujblmiuhboimiohnomihn",
            //         milestone: 50
            //     }
            // ]
        // }
        // comment: {
        //     number: 0,
        //     gained: 0        
        // }
        // reaction: {
        //     number: 0,
        //     gained: 0,
        //     lastReaction: moment().format('YYYY-MM-DD HH:mm')    
        // }
        // activityUnclaimed: {
        //     number: 0,
        // }
        // activityClaimed: {
        //     number: 0,
        // }
        // friendsInvited: 0
    }

    // Timer References
    const refTimer = useRef();

    const OrangeDayCards =  () => {
        const dayStreak = userData?.claimStreak?.lastClaim ? userData?.claimStreak?.lastClaim.slice(0,10) : ''
        const claimStreak = userData?.claimStreak?.number && dayStreak == moment().format('YYYY-MM-DD') ? userData?.claimStreak?.number : 0        

        return [...Array(30).keys()].map(e => {
            return(
                <View 
                    style={[
                        styles.orangeDayCard, 
                        {
                            marginLeft: e == 0 ? 20 : 10, 
                            backgroundColor: e != claimStreak ? '#949494' : '#FFF2E2', 
                            borderColor: e != claimStreak ? 'black' : "#FF6E31"
                        }
                    ]} 
                    key={Math.random()}
                >
                    <View style={[
                        styles.claimCard,
                        {
                            backgroundColor: e != claimStreak ? '#CECECE' : '#FF6E31'
                        }
                    ]}>
                        <Text style={{fontWeight: 'bold',color: 'white',fontSize: 9,textAlign: 'center',marginTop: Platform.OS == 'ios' ? 1.5 : 0,}}>Day {e+1}</Text>
                    </View>
                    
                    <Image
                        style={{width: 35, height: 35, alignSelf:'center',marginTop: -10}}
                        resizeMode='contain'
                        source={e != claimStreak ? require('../../assets/orange_day_past.png') : require('../../assets/orange_day.png')}
                    />

                    <Text style={{textAlign: 'center',fontSize: 13,fontWeight: 'bold',color: e < claimStreak ? '#4A4A4A' : 'black'}}>
                        {(e < claimStreak && dayStreak == moment().format('YYYY-MM-DD')) ? 'Claimed' : '+'+(e+1)*5}
                    </Text>
                </View>
            )
        })
    }

    const renderButton = () => {

        let isAlreadyClaimed = false
    
        let momentOne = moment().tz('Asia/Seoul');
        momentOne.set('year', moment().tz('Asia/Seoul').year()); 
        momentOne.set('month', moment().tz('Asia/Seoul').month()); 
        momentOne.set('day', moment().tz('Asia/Seoul').day()); 
        momentOne.set('hour', 9); 
        momentOne.set('minute', 0);
        momentOne.set('second', 0); 
        momentOne.set('millisecond', 0); 

        if(userData?.claimStreak?.lastClaim){            
            checkDiff = momentOne.diff(moment(userData.claimStreak.lastClaim), 'seconds')
            checkDiff2 = momentOne.add(1, 'days').diff(moment(userData.claimStreak.lastClaim), 'seconds')

            if(checkDiff < 0 && checkDiff2 >= 0){
                isAlreadyClaimed = true
            }
        }

        return isAlreadyClaimed && checkDiff ? (
            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',alignSelf:'center',width: width - 30, borderRadius: 30,backgroundColor: '#FF6E31',gap: 5,height: 50,marginTop: Platform.OS == 'ios' ? 40 : 30,}}>
                <Text style={{color:'white',fontSize: 18,fontWeight: 'bold',}}>Next Reward in</Text>
                <CountDownTimer
                    ref={refTimer}
                    timestamp={checkDiff2}
                    textStyle={{color: "#FFFFFF",fontSize: 18,fontWeight: 'bold',}}
                />
            </View>
        ) : (
            <Button 
                title='Claim'
                color='orange'
                size="md"
                onPress={() => onDailyClaim()} 
                style={{height: 50,width: width-30, alignSelf:'center', justifyContent: 'center',alignItems: 'center', marginTop: Platform.OS == 'ios' ? 40 : 30,}}
            />
        )
    }

    let opacity = new Animated.Value(0);


    let opacityText = new Animated.Value(0);
    let opacitySecondText = new Animated.Value(0);
    let opacityThirdText = new Animated.Value(0);

    const size = opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, width-100],
    });
    const animatedStyles = [
        styles.box,
        {
            opacity,
            width: size,
            height: size,
        },
    ];

    
    const startAnimation = () => {
        opacity.setValue(0)
        opacityText.setValue(0)
        opacitySecondText.setValue(0)
        opacityThirdText.setValue(0)

        if(thirdCelebrationTitle){
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.ease,
                    useNativeDriver: false,
                }),
                Animated.timing(opacityText, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.linear,
                    useNativeDriver: false,
                }),
                Animated.delay(3000),
                Animated.parallel([
                    Animated.timing(opacityText, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(opacitySecondText, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.delay(3000),
                Animated.parallel([
                    Animated.timing(opacitySecondText, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(opacityThirdText, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.delay(3000),
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(opacityThirdText, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                ]),
            ]).start()
        }else{
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.ease,
                    useNativeDriver: false,
                }),
                Animated.timing(opacityText, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.linear,
                    useNativeDriver: false,
                }),
                Animated.delay(2000),
                Animated.parallel([
                    Animated.timing(opacityText, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(opacitySecondText, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.delay(2000),
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(opacitySecondText, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                ]),
            ]).start()
        }
    }

    const onAdClaim = async () => {
        Haptics.selectionAsync();
        setTodayOranges(200);
        setShowClaimOranges(true)
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const onCopyPress = async () => {
        setAddressCopied(true)
        await delay(1000);
        setAddressCopied(false)
    }

    const navigateNext = () => {
        Haptics.selectionAsync();
        if(navigation){
            navigation.navigate('ActivityReward')
        }else{
            setNewFeatureVis(false)
        }
    }

    const onInvitePress = () => {
        Share.share({
            message: "Join CoinEasy and empower your Web3 journey ! \n\nUse code ORANGE50 to receive your first reward ! \n\nhttps://www.coineasy.xyz",
            url: "https://www.coineasy.xyz",
            title: "Download CoinEasy"
        }).then(({ action, activityType }) => {
            if (action === Share.sharedAction) {
                const tempData = userData ?? {}

                if(tempData.listClaimedOranges){
                    const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                    if(index != -1){
                        tempData.listClaimedOranges[index].listOranges.push({
                            numberOranges: 30,
                            type: 'Invite Sent'
                        })
                    }else{
                        tempData.listClaimedOranges.push({
                            date: moment().format('YYYY-MM-DD'),
                            listOranges: [
                                {
                                    numberOranges: 30,
                                    type: 'Invite Sent'
                                },
                            ]
                        })
                    }
                }else{
                    tempData.listClaimedOranges = [{
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: 30,
                                type: 'Invite Sent'
                            },
                        ]
                    }]
                }

                tempData.numberOranges ? tempData.numberOranges += 30 : tempData.numberOranges = 30
                tempData.friendsInvited ? tempData.friendsInvited += 1 : tempData.friendsInvited = 1

                setUserData({...tempData})

                var tempProfile = user.profile
                tempProfile.data = tempData
                orbis.updateProfile(tempProfile);
            }
        }).catch((e) => console.warn('error', e));
    };

    return (
        <View style={[tailwind('flex-1 flex-col')]}>
            <HeaderImage />

            <ImageBackground source={require('../../assets/bg_orange_reward.png')} resizeMode="stretch" style={{flex: 1,}}>

                    <TouchableOpacity style={{position: 'absolute',left: 10, top: 10}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                        <Image
                            style={{width: 24,height: 24}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>



                <View style={{borderRadius: 30,borderWidth:1,borderColor:'black', backgroundColor: '#FFF2E2',flexDirection:'row',gap: 6,alignSelf:'flex-end',marginRight: 5,paddingVertical: 5, paddingHorizontal:10,marginTop: 15,marginRight: 20, justifyContent:'center',alignItems:'center',}}>
                    <Image
                        style={{width: 20, height: 20}}
                        resizeMode='contain'
                        source={require('../../assets/orange_icon.png')}
                    />
                    <Text style={{fontWeight: 'bold',}}>{userData?.numberOranges ?? 0}</Text>
                </View>


                <View style={{flexDirection:'row',alignItems:'center',gap: 10,marginLeft: 20}}>
                    <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 21 : 18}}>Orange Rewards</Text>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelp(true)}}>
                        <Image
                            style={{width: 20, height: 20}}
                            resizeMode='contain'
                            source={require('../../assets/question_icon.png')}
                        />
                    </TouchableOpacity>
                </View>


                {/* <Button 
                    title='Reset Data'
                    color='orange'
                    size="md"
                    onPress={() => onResetData()} 
                    style={{height: 50,width: width-30, alignSelf:'center', justifyContent: 'center',alignItems: 'center', marginTop: 30,}}
                /> */}

                {firstTimeReward == 'true' && userData?.firstTime != 'done' && (
                    <TouchableOpacity 
                        style={{height: 60,width:'100%', marginVertical: 10,}}
                        onPress={() => {Haptics.selectionAsync();setNewFeatureAlertVis(true);setNewFeatureVis(true)}}
                    >
                        <Image
                            style={{width: width-20,height: 65,alignSelf:'center',}}
                            resizeMode='stretch'
                            source={require('../../assets/new_feature_alert.png')}
                        />
                    </TouchableOpacity>
                )}


                {/* DAILY CHECK-IN */}
                <View style={[
                    styles.elevate, 
                    {
                        width: width-20,
                        height: 100,
                        alignSelf:'center',
                        borderRadius: 10,
                        marginTop: firstTimeReward == 'true' && userData?.firstTime != 'done' ? 0 : 20,
                        overflow:'hidden',
                    }]}
                >
                    <ImageBackground 
                        source={require('../../assets/bg_card_reward.png')} 
                        resizeMode="stretch" 
                        style={{flex: 1,justifyContent:'center',padding: 20}}
                    >
                        <View style={{position: 'absolute',top: -5,left: 2}}>
                            <Image
                                style={{width: 80, height: 80, }}
                                resizeMode='contain'
                                source={require('../../assets/banner_day.png')}
                            />
                        </View>

                        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginLeft: 10}}>
                            <View style={{flexDirection:'row',alignItems:'center',gap: 10}}>
                                <Image
                                    style={{width: 35, height: 35}}
                                    resizeMode='contain'
                                    source={require('../../assets/daily_icon.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 20 : 18,}}>Daily Check-in</Text>
                            </View>

                            <Button 
                                title='Claim'
                                color='orange'
                                size="sm"
                                onPress={() => {Haptics.selectionAsync();setBottomOpen(true);handleModalPress()}} 
                                style={{height: 40, justifyContent: 'center',alignItems: 'center', width: '30%'}}
                            />
                        </View>
                    </ImageBackground>
                </View>




                {/* AD REWARD */}
                <View style={[styles.elevate, {width: width-20, height: 100, alignSelf:'center',borderRadius: 10,marginTop: 10,  overflow:'hidden'}]}>
                    <ImageBackground source={require('../../assets/bg_card_reward.png')} resizeMode="stretch" style={{flex: 1,justifyContent:'center',padding: 20}}>
                        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginLeft: 10}}>
                            <View style={{flexDirection:'row',alignItems:'center',gap: 10}}>
                                <Image
                                    style={{width: 35, height: 35}}
                                    resizeMode='contain'
                                    source={require('../../assets/fire_icon.png')}
                                />
                                <View style={{}}>
                                    <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 20 : 18,}}>Ad Rewards</Text>
                                    <Text style={{fontSize: Platform.OS == 'ios' ? 16 : 14,}}>+200</Text>
                                </View>
                            </View>

                            {userData?.adReward?.lastClaim ? (
                                <View style={{backgroundColor: '#D0D0D0',paddingHorizontal: 10, borderRadius: 20,height: 40,width: 100,justifyContent:'center',alignItems:'center',width: '30%'}}>
                                    <Text style={{color: 'white',fontSize: 16,fontWeight: 'bold',}}>Claimed</Text>
                                </View>
                            ) : (
                                <Button 
                                    title='Claim'
                                    color='orange'
                                    size="sm"
                                    onPress={() => onAdClaim()} 
                                    style={{height: 40, justifyContent: 'center',alignItems: 'center',width:'30%'}}
                                />
                            )}
                        </View>
                    </ImageBackground>
                </View>

                {/* ACTIVITY REWARD */}
                <View style={[styles.elevate, {width: width-20, height: 100, alignSelf:'center',borderRadius: 10,marginTop: 10,  overflow:'hidden'}]}>
                    <ImageBackground source={require('../../assets/bg_card_reward.png')} resizeMode="stretch" style={{flex: 1,justifyContent:'center',padding: 20}}>
                        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginLeft: 10}}>
                            <View style={{flexDirection:'row',alignItems:'center',gap: 10}}>
                                <Image
                                    style={{width: 35, height: 35}}
                                    resizeMode='contain'
                                    source={require('../../assets/pen_icon.png')}
                                />
                                <View style={{}}>
                                    <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 20 : 18,}}>Activity Rewards</Text>
                                    <Text style={{fontSize: Platform.OS == 'ios' ? 16 : 14,}}>+1000</Text>
                                </View>
                            </View>

                            <Button 
                                // loading={listFollowLoader[index]} 
                                title={activityClaim ? 'Claimed' : 'Claim'} 
                                color={activityClaim ? 'gray-100' : 'orange'}
                                disabled={activityClaim}
                                size="sm"
                                onPress={navigateNext}
                                style={{height: 40, justifyContent: 'center',alignItems: 'center',width:'30%'}}
                            />
                        </View>
                    </ImageBackground>
                </View>

                {/* INVITE FRIENDS */}
                <View style={[styles.elevate, {width: width-20, height: 100, alignSelf:'center',borderRadius: 10,marginTop: 10,  overflow:'hidden'}]}>
                    <ImageBackground source={require('../../assets/bg_card_reward.png')} resizeMode="stretch" style={{flex: 1,justifyContent:'center',padding: 20}}>
                        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginLeft: 10}}>
                            <View style={{flexDirection:'row',alignItems:'center',gap: 10}}>
                                <Image
                                    style={{width: 35, height: 35}}
                                    resizeMode='contain'
                                    source={require('../../assets/invite_icon.png')}
                                />
                                <View style={{}}>
                                    <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 20 : 18,}}>Invite Friends</Text>
                                    <Text style={{fontSize: Platform.OS == 'ios' ? 16 : 14,}}>{userData?.friendsInvited ?? 0}</Text>
                                </View>
                            </View>

                            <Button 
                                // loading={listFollowLoader[index]} 
                                title="Invite"
                                color='orange'
                                size="sm"
                                onPress={handleModalInvitePress} 
                                style={{height: 40, justifyContent: 'center',alignItems: 'center',width:'30%'}}
                            />
                        </View>
                    </ImageBackground>
                </View>

                <TouchableOpacity
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('RewardHistory')}} 
                    style={[styles.elevate, {position: 'absolute', bottom: 20, backgroundColor: '#FFFAFA',width: width-20,alignSelf:'center',height: 60,borderRadius: 30,justifyContent:'center',}]}
                >
                    <Text style={{fontSize: 18,fontWeight: 'bold',textAlign: 'center',}}>Track Your Rewards</Text>
                </TouchableOpacity>

            </ImageBackground>



            {/* Pop up celebration daily reward */}
            {bottomOpen && (
                <View style={styles.boxContainer}>
                    <Animated.View style={animatedStyles}>
                        <Animated.View style={{position: 'absolute',top: -30, opacity: opacityText, overflow: 'hidden'}}>
                            <Text style={{textAlign: 'center',color:'white', fontSize: 18,fontWeight: 'bold',minWidth: width-100}}>
                                {firstCelebrationTitle}
                            </Text>
                        </Animated.View>

                        <Animated.View style={{position: 'absolute',top: -40, opacity: opacitySecondText, overflow: 'hidden'}}>
                            <Text style={{textAlign: 'center',color:'white', fontSize: 18,fontWeight: 'bold',minWidth: width-100}}>
                                {secondCelebrationTitle}
                            </Text>
                        </Animated.View>

                        <Animated.View style={{position: 'absolute',top: -30, opacity: opacityThirdText, overflow: 'hidden'}}>
                            <Text style={{textAlign: 'center',color:'white', fontSize: 18,fontWeight: 'bold',minWidth: width-100}}>
                                {thirdCelebrationTitle}
                            </Text>
                        </Animated.View>

                        <Image
                            style={{width: width-100, height: 100, alignSelf:'center',marginTop: 10,}}
                            resizeMode='contain'
                            source={thirdCelebrationTitle ? require('../../assets/celebration_orange_streak.png') : require('../../assets/celebration_orange_claim.png')}
                        />
                    </Animated.View>
                </View>
            )}

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalRef}
                    index={1}
                    snapPoints={snapPoints}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 40,justifyContent: 'center',}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                    onDismiss={() => {setBottomOpen(false)}}
                >
                    <View style={{}}>
                        <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',}}>Daily Check-in</Text>
                        <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 17 : 14,marginTop: Platform.OS == 'ios' ? 10 : 0,}}>Start Your Day with Orange Rewards!</Text>
                    </View>

                    <View style={{height: 75, marginTop: Platform.OS == 'ios' ? 30 : 20,}}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <OrangeDayCards />

                            <View style={{width:20}}/>
                        </ScrollView>
                    </View>

                    {renderButton()}
                </BottomSheetModal>
            </BottomSheetModalProvider>

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalInviteRef}
                    index={1}
                    snapPoints={Platform.OS == 'ios' ? snapInvitePointsIOS : snapInvitePoints}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 40,justifyContent: 'center',}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                    onDismiss={() => {setBottomOpen(false)}}
                >
                    <View style={{}}>
                        <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',}}>Invite Friends</Text>
                        <Text style={{textAlign: 'center',paddingHorizontal: 10,marginTop: Platform.OS == 'ios' ? 10 : 0,fontSize: Platform.OS == 'ios' ? 16 : 14,}}>
                            Invite friends with code <Text style={{color: '#FF6E31',fontWeight: 'bold',}}>ORANGE50</Text> and earn together!
                        </Text>
                    </View>

                    <View style={{marginTop: 20,}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:20}}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                <Image
                                    style={{width: 35, height: 35}}
                                    resizeMode='contain'
                                    source={require('../../assets/orange_icon.png')}
                                />
                                <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',}}>+50</Text>                                
                            </View>

                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                <Image
                                    style={{width: 45, height: 45, alignSelf:'center',}}
                                    resizeMode='contain'
                                    source={require('../../assets/orange_gray.png')}
                                />
                                <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',marginLeft: -5}}>+30</Text>                                
                                <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenInviteHelp(true)}} style={{marginLeft: 5}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/question_icon.png')}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={{height: 50,width: width-30, alignSelf:'center', justifyContent: 'center',alignItems: 'center', marginTop: 30,borderWidth: 1,borderRadius: 25,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}
                        onPress={onCopyPress}
                    >
                        <Text style={{fontWeight: 'bold',fontSize: 16,paddingLeft: 20}}>https://coineasy.xyz</Text>
                        <CopyIcon2 style={{marginRight: 15}}/>
                    </TouchableOpacity>

                    <Button 
                        title='Invite'
                        color='orange'
                        size="md"
                        onPress={() => onInvitePress()} 
                        style={{height: 50,width: width-30, alignSelf:'center', justifyContent: 'center',alignItems: 'center',marginTop: 20,}}
                    />
                </BottomSheetModal>
            </BottomSheetModalProvider>

            {openHelp && (
                <Modal 
                    hide={() => {Haptics.selectionAsync();setOpenHelp(false)}} 
                    type='oranges-help' 
                >

                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15,zIndex: 2}}
                        onPress={() => {Haptics.selectionAsync();setOpenHelp(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{alignSelf:'center',height:'100%'}}>
                        <View style={[tailwind('flex flex-col items-center px-1'), {marginTop: 50,}]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 23 : 18,}}>What is Orange Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',marginTop: 10,fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Earn oranges for being active and engaged.</Text>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Redeem them for exciting rewards!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 23 : 18,}}>What is Daily Check-in?</Text>
                            </View>
                            <Text style={{textAlign: 'center',marginTop: 10,fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Log in daily to earn increasing rewards.</Text>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Check in every day for the best rewards!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 23 : 18,}}>What is Ad Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',marginTop: 10,fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Watch short ads to earn extra oranges.</Text>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 14,}}>Quick and easy bonus!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 23 : 18,}}>What is Posting Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',marginTop: 10,fontSize: Platform.OS == 'ios' ? 17 : 14}}>Earn rewards by creating posts.</Text>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 14,}}>The more you post, the more you earn!</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {openInviteHelp && (
                <Modal 
                    hide={() => {Haptics.selectionAsync();setOpenInviteHelp(false)}} 
                    type='oranges-help-invite' 
                >

                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();setOpenInviteHelp(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{alignSelf:'center',marginTop: 40,}}>
                        <Image
                            style={{width: 50, height: 50, alignSelf:'center',}}
                            resizeMode='contain'
                            source={require('../../assets/orange2_icon.png')}
                        />

                        <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 22 : 18,textAlign: 'center',marginVertical: 20,}}>Friend Post Bonus</Text>

                        <Text style={{textAlign: 'center',fontSize: Platform.OS == 'ios' ? 16 : 14}}>Tell your friends to start posting to earn</Text>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 16 : 14}}>bonus Oranges! </Text>
                            <Image
                                style={{width: 25, height: 25}}
                                resizeMode='contain'
                                source={require('../../assets/nice_orange.png')}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {newFeatureVis && newFeatureAlertVis && (
                <View style={{
                    zIndex: 9999,
                    position: 'absolute',
                    flex: 1,
                    width: '100%',
                    height:'100%',
                }}>
                    <NewFeatureModal />
                </View>
            )}

        </View>
    )
}

export default OrangeReward

const styles = StyleSheet.create({
    elevate: {
        elevation: 4,
        shadowRadius: 4,
        shadowOpacity: 0.1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
    },
    orangeDayCard: {
        width: 75,
        height: 75,
        overflow:'hidden',
        borderRadius: 10,
        borderWidth: 1,
    },
    claimCard: {
        height: 15,
        width: 70,
        overflow: 'hidden',
        marginTop: 10,
        marginLeft: -17,
        transform: [{ rotate: '320deg'}]
    },
    boxContainer: {
        position: 'absolute',
        zIndex: 2,
        alignSelf:'center',
        // top: 20, 
        // left: 20,
    },
    box: {
        marginTop: 250,
        backgroundColor: 'rgba(0,0,0,0)',
    },
})