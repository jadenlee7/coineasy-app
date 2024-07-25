import React, { useContext, useEffect, useState } from 'react'
import { Alert, Animated, Dimensions, Easing, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import moment from 'moment';
import Modal from '../Modal';
import Button from '../Button';
import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { AntDesign } from '@expo/vector-icons';
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer';
import { useNavigation } from '@react-navigation/core';

const {width, height} = Dimensions.get('window')

const ClaimOrangesModal = () => {

    const { user, setUser,userData, setUserData, orbis, setShowClaimOranges, todayOranges, adAlreadyClaimed } = useContext(GlobalContext);
    const tailwind = useTailwind();
    let navigation;
    try {
        navigation = useNavigation()
    } catch (error) {
        console.log('ici');
        console.log(error);
    }

    const [showAds, setShowAds] = useState(!adAlreadyClaimed)
    const [pendingAds, setPendingAds] = useState(false)
    const [completeAds, setCompleteAds] = useState(false)
    const [claimedAds, setClaimedAds] = useState(false)
    const [showClose, setShowClose] = useState(false)

    const openUrl = async () => {
        let url = 'https://youtu.be/EPLZlxe07Eg'
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(`Don't know how to open this URL: ${url}`);
        }
    }

    const onHideModal = async () => {
        Haptics.selectionAsync()

        setShowAds(false)
        setCompleteAds(false)
        setShowClose(false)
        setShowClaimOranges(false)
    }

    const claimAds = async () => {
        const tempData = userData

        if(tempData){
            tempData.numberOranges += 200
            if(tempData.adReward){
                tempData.adReward.lastClaim = moment().format('YYYY-MM-DD HH:mm:ss')
            }else{
                tempData.adReward = {
                    lastClaim: moment().format('YYYY-MM-DD HH:mm:ss')
                }
            }

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: 200,
                        type: 'Ad Rewards'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: 200,
                                type: 'Ad Rewards'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: 200,
                                type: 'Ad Rewards'
                            },
                    ]
                }]
            }

            setUserData({...tempData})

            var tempProfile = user.profile
            tempProfile.data = tempData
            console.log('ICIIII');
            console.log(JSON.stringify(tempProfile));
            console.log(' ');
            const res = await orbis.updateProfile(tempProfile);
            console.log(res);
        }

    }

    let opacity = new Animated.Value(0);
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

    useEffect(() => {
        if(pendingAds){
            handleAds()
        }
    }, [pendingAds])
    

    const handleAds = async () => {
        Animated.sequence([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 500,
                easing: Easing.ease,
                useNativeDriver: false,
            }),

            Animated.delay(1000),

            Animated.timing(opacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: false,
            }),
        ]).start(() => {
            setPendingAds(false)
            setClaimedAds(true)
            claimAds()
        })
    }

    return (
        <Modal 
            hide={onHideModal} 
            type='oranges' 
            isAds={showAds}
            pendingAds={pendingAds}
        >
            { adAlreadyClaimed ? (
                <>
                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();setShowClaimOranges(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 16,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            Oops, this basket is empty!
                        </Text>

                        <Text style={{textAlign: 'center',}}>You've already claimed :)</Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '60%',alignSelf: 'center',marginTop: 20,}} 
                            resizeMode="contain"
                        />
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to Reward Page" 
                        onPress={() => {Haptics.selectionAsync();setShowClaimOranges(false);navigation.navigate('RewardHistory')}} 
                        style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                    />
                </>
            ) : !pendingAds && showAds ? (
                <TouchableOpacity 
                    style={[tailwind('flex flex-col items-center justify-center px-3')]}
                    onPress={openUrl}
                >
                    <Text style={{position: 'absolute',top: 25, left: 20, color: 'white', fontSize: 15,fontFamily: 'GmarketMedium'}}>Click!</Text>
                    <View style={{position: 'absolute',top: 10, right: 10}}>

                        {showClose ? (
                            <TouchableOpacity
                                style={{position: 'absolute',top: 10, right: 5}}
                                onPress={() => {Haptics.selectionAsync();setShowAds(false);setCompleteAds(true)}}
                            >
                                <AntDesign name="closecircle" size={24} color="white" />
                            </TouchableOpacity>
                        ) : (
                            <CountdownCircleTimer
                                isPlaying
                                duration={10}
                                colors={['#fff',]}
                                onComplete={() => setShowClose(true)}
                                size={35}
                                strokeWidth={3}
                                trailColor="rgba(0,0,0,0)"
                            >
                                {({ remainingTime }) => <Text style={{color:'#fff'}}>{remainingTime}</Text>}
                            </CountdownCircleTimer>
                        )}
                    </View>
                </TouchableOpacity>
            ) : !showAds && !pendingAds && completeAds && !claimedAds? (
                <>
                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();onHideModal()}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            You've got 200 Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '60%',alignSelf: 'center',marginTop: 40,}} 
                            resizeMode="contain"
                        />

                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Claim" 
                        onPress={() => {Haptics.selectionAsync();setPendingAds(true)}} 
                        style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                    />
                </>
            ) : claimedAds && !pendingAds && (
                <>

                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();onHideModal()}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 16,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            Now you have Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '60%',alignSelf: 'center',marginTop: 20,}} 
                            resizeMode="contain"
                        />
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to Reward Page" 
                        onPress={() => {Haptics.selectionAsync();setShowAds(false);setCompleteAds(false);setShowClose(false);setShowClaimOranges(false);navigation.navigate('RewardHistory')}} 
                        style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                    />
                </>
            )}

            {/* Pop up celebration daily reward */}
            {pendingAds && (
                <View style={[styles.boxContainer, {width: width, height: 500, justifyContent:'center',alignItems:'center',}]}>
                    <Animated.View style={animatedStyles}>
                        <Text style={{textAlign: 'center',color:'white', fontSize: 18,fontWeight: 'bold',minWidth: width-100}}>
                            +200 Oranges !
                        </Text>

                        <Image
                            style={{width: width-100, height: 100, alignSelf:'center',marginTop: 10,}}
                            resizeMode='contain'
                            source={require('../../assets/celebration_orange_claim.png')}
                        />
                    </Animated.View>
                </View>
            )}
        </Modal>
    )
}

export default ClaimOrangesModal

const styles = StyleSheet.create({
    boxContainer: {
        zIndex: 2,
        alignSelf:'center',
        // top: 20, 
        // left: 20,
    },
    box: {
        marginTop: 0,
        backgroundColor: 'rgba(0,0,0,0)',
    },
})