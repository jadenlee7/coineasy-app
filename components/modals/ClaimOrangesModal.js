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

const {width, height} = Dimensions.get('window')


const ClaimOrangesModal = () => {

    const { user, setUser, orbis, setShowClaimOranges, todayOranges } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [showAds, setShowAds] = useState(true)
    const [completeAds, setCompleteAds] = useState(false)
    const [pendingAds, setPendingAds] = useState(false)
    const [claimedAds, setClaimedAds] = useState(false)
    const [showClose, setShowClose] = useState(false)

    const onAdCompleted = async () => {
        Haptics.selectionAsync();
        let tempOranges = user?.profile?.data?.oranges?.count ?? 0
        tempOranges += todayOranges

        if(user.profile.data){
            user.profile.data.oranges = {
                count: tempOranges,
                updated: moment().format('YYYY-MM-DD')
            }
        }else{
            user.profile.data = {
                oranges: {
                    count: tempOranges,
                    updated: moment().format('YYYY-MM-DD')
                }
            }
        }
        setUser({...user})

        const res = await orbis.updateProfile(user.profile);

        setCompleteAds(true)
        setShowAds(false)
        setShowClose(false)
    }


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

        if(showAds && showClose){
            onAdCompleted()
        }

        setShowAds(false)
        setCompleteAds(false)
        setShowClose(false)
        setShowClaimOranges(false)
    }

    const claimAds = async () => {
        const tempData = user?.profile?.data

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

            setShowAds(false)
            setCompleteAds(false)
            setShowClose(false)
            setShowClaimOranges(false)

            user.profile.data = tempData
            setUser({...user})
    
            const res = await orbis.updateProfile(user.profile);
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
            { !pendingAds && showAds ? (
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
                                duration={1}
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
                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            You've got 200 Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '55%',alignSelf: 'center',marginTop: 40,}} 
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
                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            Now you have Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '55%',alignSelf: 'center',marginTop: 40,}} 
                            resizeMode="contain"
                        />
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to profile" 
                        onPress={() => {Haptics.selectionAsync();claimAds()}} 
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