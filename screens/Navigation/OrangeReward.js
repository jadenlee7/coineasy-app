import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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

const {width, height} = Dimensions.get('window')


const OrangeReward = ({navigation, route}) => {
    const { 
        orbis,
        user,
        userData,
        setUserData,
        activityClaim,
        inviteClaim,
        setShowClaimOranges,
        setTodayOranges,
        setNewFeatureVis,
        setNewFeatureAlertVis,
        newFeatureVis,
        newFeatureAlertVis,
    } = useContext(GlobalContext);
    const tailwind = useTailwind();    

    const [openHelp, setOpenHelp] = useState(false)
    const [bottomOpen, setBottomOpen] = useState(false)
    const [launchAnimation, setLaunchAnimation] = useState(false)
    const [firstTimeReward, setFirstTimeReward] = useState(false)

    const [firstCelebrationTitle, setFirstCelebrationTitle] = useState('+5 Oranges!')
    const [secondCelebrationTitle, setSecondCelebrationTitle] = useState(listConstants[0].title)
    const [thirdCelebrationTitle, setThirdCelebrationTitle] = useState(null)

    const modalRef = useRef(null); 
    const snapPoints = useMemo(() => ['40%','40%'], []);
    const handleModalPress = useCallback(() => modalRef.current?.present(), []);

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
        // user.profile.data = {alreadyLogin: true}

        tempData = {
            "alreadyLogin":true,
            "post":{
                "number":1,
                "gained":15,
                "lastPost":"2024-07-16 16:13",
            },
            "activityUnclaimed":{"number":29},
            "reaction":{"number":4,"gained":8,"lastReaction":"2024-07-16 16:13"},
            "comment":{"number":2,"gained":6,"lastComment":"2024-07-16 16:16"},
            "numberOranges":0,
        }


        setUserData({...tempData})

        var tempProfile = user.profile
        tempProfile.data = tempData
        const res = await orbis.updateProfile(tempProfile);
    }

    const onDailyClaim = async () => {
        Haptics.selectionAsync()
        const tempData = userData

        if(tempData){
            let addNumber = 5
            if(tempData.claimStreak){

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
                tempData.numberOranges += addNumber
                tempData.claimStreak.number += 1
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
    }

    // Timer References
    const refTimer = useRef();

    const OrangeDayCards =  () => {

        const claimStreak = userData?.claimStreak?.number ?? 0

        return [...Array(30).keys()].map(e => {
            return(
                <View 
                    style={[
                        styles.orangeDayCard, 
                        {
                            marginLeft: e == 0 ? 20 : 10, 
                            backgroundColor: (e > claimStreak || e < claimStreak) ? '#949494' : '#FFF2E2', 
                            borderColor: (e > claimStreak || e < claimStreak) ? 'black' : "#FF6E31"
                        }
                    ]} 
                    key={Math.random()}
                >
                    <View style={[
                        styles.claimCard,
                        {
                            backgroundColor: (e > claimStreak || e < claimStreak) ? '#CECECE' : '#FF6E31'
                        }
                    ]}>
                        <Text style={{fontWeight: 'bold',color: 'white',fontSize: 9,textAlign: 'center',}}>Day {e+1}</Text>
                    </View>
                    
                    <Image
                        style={{width: 35, height: 35, alignSelf:'center',marginTop: -10}}
                        resizeMode='contain'
                        source={(e > claimStreak || e < claimStreak) ? require('../../assets/orangeDayPast.png') : require('../../assets/orangeDay.png')}
                    />

                    <Text style={{textAlign: 'center',fontSize: 13,fontWeight: 'bold',color: e < claimStreak ? '#4A4A4A' : 'black'}}>
                        {e < claimStreak ? 'Claimed' : '+'+(e+1)*5}
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

        let diffSeconds = null

        if(userData?.claimStreak?.lastClaim){
            checkDiff = momentOne.diff(moment(userData.claimStreak.lastClaim), 'seconds')
            checkDiff2 = momentOne.add(1, 'days').diff(moment(userData.claimStreak.lastClaim), 'seconds')
            diffSeconds = momentOne.diff(moment(userData.claimStreak.lastClaim), 'seconds')

            if(checkDiff < 0 && checkDiff2 >= 0){
                isAlreadyClaimed = true
            }
        }

        return isAlreadyClaimed && diffSeconds ? (
            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',alignSelf:'center',width: width - 30, borderRadius: 30,backgroundColor: '#FF6E31',gap: 5,height: 50,marginTop: 30,}}>
                <Text style={{color:'white',fontSize: 18,fontWeight: 'bold',}}>Next Reward in</Text>
                <CountDownTimer
                    ref={refTimer}
                    timestamp={diffSeconds}
                    textStyle={{color: "#FFFFFF",fontSize: 18,fontWeight: 'bold',}}
                />
            </View>
        ) : (
            <Button 
                title='Claim'
                color='orange'
                size="md"
                onPress={() => onDailyClaim()} 
                style={{height: 50,width: width-30, alignSelf:'center', justifyContent: 'center',alignItems: 'center', marginTop: 30,}}
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
                Animated.delay(2000),
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
                Animated.delay(1000),
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
        setTodayOranges(200);
        setShowClaimOranges(true)
    }

    // const RewardCard = (props) => {

    //     let isClaimed = false

    //     let momentOne = moment().tz('Asia/Seoul');
    //     momentOne.set('year', moment().tz('Asia/Seoul').year()); 
    //     momentOne.set('month', moment().tz('Asia/Seoul').month()); 
    //     momentOne.set('day', moment().tz('Asia/Seoul').day()); 
    //     momentOne.set('hour', 9); 
    //     momentOne.set('minute', 0);
    //     momentOne.set('second', 0); 
    //     momentOne.set('millisecond', 0); 

    //     let diffSeconds = null

    //     if(user?.profile?.data?.adReward?.lastClaim){
    //         checkDiff = momentOne.diff(moment(user.profile.data.adReward.lastClaim), 'seconds')
    //         checkDiff2 = momentOne.add(1, 'days').diff(moment(user.profile.data.adReward.lastClaim), 'seconds')
    //         diffSeconds = momentOne.diff(moment(user.profile.data.adReward.lastClaim), 'seconds')

    //         if(checkDiff > 0 && checkDiff2 >= 0){
    //             isClaimed = true
    //         }
    //     }

    //     return(
    //         <View style={[styles.elevate, {width: width-20, height: 100, alignSelf:'center',borderRadius: 10,marginTop: 10,  overflow:'hidden'}]}>
    //             <ImageBackground source={require('../../assets/bg_card_reward.png')} resizeMode="stretch" style={{flex: 1,justifyContent:'center',padding: 20}}>
    //                 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginLeft: 10}}>
    //                     <View style={{flexDirection:'row',alignItems:'center',gap: 10}}>
    //                         <Image
    //                             style={{width: 35, height: 35}}
    //                             resizeMode='contain'
    //                             source={
    //                                 props.title == 'Ad Rewards' ? require('../../assets/fire_icon.png')
    //                                 : props.title == 'Daily Check-in' ? require('../../assets/daily_icon.png')
    //                                 : props.title == 'Activity Rewards' ? require('../../assets/pen_icon.png')
    //                                 : require('../../assets/invite_icon.png')
    //                             }
    //                         />
    //                         {props.title != 'Daily Check-in' && (
    //                             <View style={{}}>
    //                                 <Text style={{fontWeight: 'bold',fontSize: 18,}}>{props.title}</Text>
    //                                 <Text style={{}}>
    //                                     {
    //                                         props.title == 'Ad Rewards' ? '+200'
    //                                         : props.title == 'Activity Rewards' ? '+1000'
    //                                         : '0'
    //                                     }
    //                                 </Text>
    //                             </View>
    //                         )}
    //                     </View>

    //                     {isClaimed ? (
    //                         <View style={{backgroundColor: '#D0D0D0',paddingHorizontal: 10, borderRadius: 20,height: 40,width: 100,justifyContent:'center',alignItems:'center',}}>
    //                             <Text style={{color: 'white',fontSize: 16,fontWeight: 'bold',}}>Claimed</Text>
    //                         </View>
    //                     ) : (
    //                         <Button 
    //                             title='Claim'
    //                             color='orange'
    //                             size="sm"
    //                             onPress={() => {props.title == 'Daily Check-in' ? onAdClaim() : onRewardClaim()}} 
    //                             style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
    //                         />
    //                     )}
    //                 </View>
    //             </ImageBackground>
    //         </View>
    //     )
    // }    

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



                <View style={{borderRadius: 30,borderWidth:1,borderColor:'black', backgroundColor: '#FFF2E2',flexDirection:'row',gap: 6,alignSelf:'flex-end',marginRight: 5,paddingVertical: 5, paddingHorizontal:10,marginTop: 15,marginRight: 20}}>
                    <Image
                        style={{width: 20, height: 20}}
                        resizeMode='contain'
                        source={require('../../assets/orange_icon.png')}
                    />
                    <Text style={{fontWeight: 'bold',}}>{userData?.numberOranges ?? 0}</Text>
                </View>


                <View style={{flexDirection:'row',alignItems:'center',gap: 10,marginLeft: 20}}>
                    <Text style={{fontWeight: 'bold',fontSize: 18,fontFamily: 'GmarketMedium'}}>Orange Rewards</Text>
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

                {firstTimeReward == 'true' && userData.firstTime != 'done' && (
                    <TouchableOpacity 
                        style={{height: 60,marginVertical: 10,}}
                        onPress={() => {Haptics.selectionAsync();setNewFeatureAlertVis(true);setNewFeatureVis(true)}}
                    >
                        <Image
                            style={{width: width-20,height: 65,alignSelf:'center',}}
                            resizeMode='contain'
                            source={require('../../assets/new_feature_alert.png')}
                        />
                    </TouchableOpacity>
                )}


                {/* DAILY CHECK-IN */}
                <View style={[styles.elevate, {width: width-20, height: 100, alignSelf:'center',borderRadius: 10, marginTop: firstTimeReward == 'true' && userData.firstTime != 'done' ? 0 : 20, overflow:'hidden'}]}>
                    <ImageBackground source={require('../../assets/bg_card_reward.png')} resizeMode="contain" style={{flex: 1,justifyContent:'center',padding: 20}}>
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
                                <Text style={{fontWeight: 'bold',fontSize: 18,}}>Daily Check-in</Text>
                            </View>

                            <Button 
                                // loading={listFollowLoader[index]} 
                                title='Claim'
                                color='orange'
                                size="sm"
                                onPress={() => {Haptics.selectionAsync();setBottomOpen(true);handleModalPress()}} 
                                style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
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
                                    <Text style={{fontWeight: 'bold',fontSize: 18,}}>Ad Rewards</Text>
                                    <Text style={{}}>+200</Text>
                                </View>
                            </View>

                            {userData?.adReward?.lastClaim ? (
                                <View style={{backgroundColor: '#D0D0D0',paddingHorizontal: 10, borderRadius: 20,height: 40,width: 100,justifyContent:'center',alignItems:'center',}}>
                                    <Text style={{color: 'white',fontSize: 16,fontWeight: 'bold',}}>Claimed</Text>
                                </View>
                            ) : (
                                <Button 
                                    title='Claim'
                                    color='orange'
                                    size="sm"
                                    onPress={() => onAdClaim()} 
                                    style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
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
                                    <Text style={{fontWeight: 'bold',fontSize: 18,}}>Activity Rewards</Text>
                                    <Text style={{}}>+1000</Text>
                                </View>
                            </View>

                            <Button 
                                // loading={listFollowLoader[index]} 
                                title={activityClaim ? 'Claimed' : 'Claim'} 
                                color={activityClaim ? 'gray-100' : 'orange'}
                                disabled={activityClaim}
                                size="sm"
                                onPress={() => navigation.navigate('ActivityReward')} 
                                style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
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
                                    <Text style={{fontWeight: 'bold',fontSize: 18,}}>Invite Friends</Text>
                                    <Text style={{}}>0</Text>
                                </View>
                            </View>

                            <Button 
                                // loading={listFollowLoader[index]} 
                                title={inviteClaim ? 'Claimed' : 'Claim'} 
                                color={inviteClaim ? 'gray-100' : 'orange'}
                                disabled={inviteClaim}
                                size="sm"
                                onPress={() => onInviteClaim()} 
                                style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
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
                        <Text style={{textAlign: 'center',fontSize: 18,fontWeight: 'bold',}}>Daily Check-in</Text>
                        <Text style={{textAlign: 'center',}}>Start Your Day with Orange Rewards!</Text>
                    </View>

                    <View style={{height: 75, marginTop: 20,}}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <OrangeDayCards />

                            <View style={{width:20}}/>
                        </ScrollView>
                    </View>

                    {renderButton()}
                </BottomSheetModal>
            </BottomSheetModalProvider>

            {openHelp && (
                <Modal 
                    hide={() => {Haptics.selectionAsync();setOpenHelp(false)}} 
                    type='oranges-help' 
                >

                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();setOpenHelp(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{alignSelf:'center',}}>
                        <View style={[tailwind('flex flex-col items-center justify-center px-1')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: 18,}}>What is Orange Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',}}>Earn oranges for being active and engaged.</Text>
                            <Text style={{}}>Redeem them for exciting rewards!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: 18,}}>What is Daily Check-in?</Text>
                            </View>
                            <Text style={{textAlign: 'center',}}>Log in daily to earn increasing rewards.</Text>
                            <Text style={{}}>Check in every day for the best rewards!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: 18,}}>What is Ad Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',}}>Watch short ads to earn extra oranges.</Text>
                            <Text style={{}}>Quick and easy bonus!</Text>
                        </View>

                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontWeight: 'bold',fontSize: 18,}}>What is Posting Rewards?</Text>
                            </View>
                            <Text style={{textAlign: 'center',}}>Earn rewards by creating posts.</Text>
                            <Text style={{}}>The more you post, the more you earn!</Text>
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