import React, { useContext, useEffect, useRef, useState } from "react";
import { Alert, Text, View, Image, TouchableOpacity, Animated, Easing, Platform, Dimensions, StyleSheet } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useDeviceAccountOperationLease } from '../../contexts/DeviceAccountDataContext';
import { api } from "../../utils/api";

import moment from "moment";
import Checkbox from 'expo-checkbox';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The seven-day dismissal is intentionally device-wide and contains only a
// date. Reward ownership and claim state remain server/account-bound.
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/core";

const {width, height} = Dimensions.get('window')

export default function NewFeatureModal() {
    const { setUserData, setNewFeatureVis, newFeatureAlertVis, setNewFeatureAlertVis } = useContext(GlobalContext);
    const { lease, isCurrentLease } = useDeviceAccountOperationLease();
    const tailwind = useTailwind();

    const navigation = useNavigation()

    const [toggleCheckBox, setToggleCheckBox] = useState(false)
    const [isClaimed, setIsClaimed] = useState(false)
    const [showOrangesAdded, setShowOrangesAdded] = useState(false)
    const rewardLeaseRef = useRef(null)

    const [fadeAnim] = useState(new Animated.Value(0));

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
        if(showOrangesAdded){
            animateProgressAdded(rewardLeaseRef.current)
        }
    }, [lease, showOrangesAdded])

    useEffect(() => {
        rewardLeaseRef.current = null
        setIsClaimed(false)
        setShowOrangesAdded(false)
    }, [lease])


    const animateProgressAdded = (expectedLease) => {
        if (!expectedLease || !isCurrentLease(expectedLease)) return;
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
            if (!isCurrentLease(expectedLease)) return;
            setShowOrangesAdded(false)
            setIsClaimed(true)
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver:false
            }).start(() => {
                if (!isCurrentLease(expectedLease)) return;
            });
        })
    }

    async function goToRewardPage(isNavigating) {
        const expectedLease = lease;
        if (!expectedLease || !isCurrentLease(expectedLease)) return;
        Haptics.selectionAsync();
        if(toggleCheckBox){
            await AsyncStorage.setItem("showNewFeatureDate", moment().add(7, 'days').format('YYYY-MM-DD'))
            if (!isCurrentLease(expectedLease)) return;
        }
        if (!isCurrentLease(expectedLease)) return;
        setNewFeatureVis(false);

        isNavigating && navigation.navigate('OrangeNavigation')
    }

    async function claimFirstReward(){
        const expectedLease = lease;
        if (!expectedLease || !isCurrentLease(expectedLease)) return;
        Haptics.selectionAsync()

        if(isClaimed){
            setNewFeatureVis(false)
            setNewFeatureAlertVis(false)
        }else{
            try {
                const result = await api.orangeClaimFirstReward({
                    expectedAuthUserId: expectedLease.ownerUserId,
                });
                if (!isCurrentLease(expectedLease)) return;
                if (!result) throw new Error('backend_not_configured');
                setUserData((current) => (
                    isCurrentLease(expectedLease)
                        ? {
                            ...(current || {}),
                            numberOranges: result.balance,
                            firstTime: 'done',
                        }
                        : current
                ));
                if (!result.claimed) {
                    setNewFeatureVis(false)
                    setNewFeatureAlertVis(false)
                    Alert.alert('Progress already added', `Your EasyGo balance is ${result.balance} Orange points.`);
                    return;
                }
                rewardLeaseRef.current = expectedLease
                setShowOrangesAdded(true)
            } catch {
                if (!isCurrentLease(expectedLease)) return;
                Alert.alert('Could not add progress', 'Connect the EasyGo backend and try again.');
            }
        }
    }

    return(
        <Modal 
            hide={() => goToRewardPage(false)} 
            type='oranges'
        >
            {!showOrangesAdded && (
                <TouchableOpacity
                    style={{position: 'absolute',top: 15, right: 15,zIndex: 2}}
                    onPress={() => goToRewardPage(false)}
                >
                    <AntDesign name="closecircle" size={24} color="black" />
                </TouchableOpacity>
            )}

            {newFeatureAlertVis && !showOrangesAdded ? (
                <View style={[tailwind('flex flex-col items-center px-3'), {paddingTop: 30,height:'100%'}]}>
                    <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>New Feature Alert!</Text>
                    <Text style={[tailwind(`text-center`), {lineHeight: 20,marginTop: 10,fontFamily: "GmarketMedium",fontSize: Platform.OS == 'ios' ? 16 : 14,}]}>
                        Start Your Orange Progress!
                    </Text>

                    {isClaimed ? (
                        <Animated.View style={{opacity: fadeAnim,marginVertical: 20,marginTop: Platform.OS == 'ios' ? 40 : 20,}}>
                            <Text style={{fontSize: 28,fontWeight: 'bold',color:'#FF6B17',textAlign: 'center',}}>+50</Text>
                            <Image 
                                style={{height: 100,width: 100,alignSelf: 'center',}} 
                                resizeMode="contain"
                                source={require('../../assets/orange_day.png')} 
                            />
                            <Animated.Text style={{opacity: fadeAnim, textAlign: 'center',marginTop: 10,fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 18 : 14,}}>
                                50 Orange progress points added.
                            </Animated.Text>
                        </Animated.View>
                    ) : (
                        <Image 
                            style={{height: Platform.OS == 'ios' ? 220 : 180,marginTop: Platform.OS == 'ios' ? 50 : 30,alignSelf: 'center',}} 
                            resizeMode="contain"
                            source={require('../../assets/new_feature_orange.png')} 
                        />
                    )}

                    <Button 
                        size="md" 
                        color="white" 
                        title={isClaimed ? "Continue" : "Add progress"}
                        onPress={() => claimFirstReward()} 
                        style={{width: '90%',alignItems: 'center',height: 50,justifyContent: 'center',position: 'absolute',bottom: 30,zIndex: 2}}
                    />
                </View>
            ) : !showOrangesAdded && (
                <View style={[tailwind('flex flex-col items-center px-3'), {paddingTop: 30, height:'100%'}]}>
                    <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>New Feature Alert!</Text>
                    <Text style={[tailwind(`text-center`), {lineHeight: 20,marginTop: 10,fontFamily: "GmarketMedium",fontSize: Platform.OS == 'ios' ? 16 : 14,}]}>View your Orange Progress</Text>

                    <Image 
                        style={{height: Platform.OS == 'ios' ? 200 : 180,marginTop: Platform.OS == 'ios' ? 40 : 20,alignSelf: 'center',}} 
                        resizeMode="contain"
                        source={require('../../assets/new_feature_orange.png')} 
                    />

                    <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5,position: 'absolute',bottom: 100}}>
                        <Checkbox 
                            style={{width: 17,height: 17}}
                            value={toggleCheckBox} 
                            onValueChange={setToggleCheckBox} 
                            color={'#000'}
                        />
                        <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 15 : 12,}}>Don't show me for 7 days</Text>
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to Progress Page"
                        onPress={() => goToRewardPage(true)} 
                        style={{width: '100%',alignItems: 'center',height: 50,justifyContent: 'center',position: 'absolute',bottom: 30,zIndex: 2}}
                    />
                </View>
            )}

            {/* Progress-added celebration */}
            {showOrangesAdded && (
                <View style={[styles.boxContainer, {width: width, height: 500, justifyContent:'center',alignItems:'center',}]}>
                    <Animated.View style={animatedStyles}>
                        <Text style={{textAlign: 'center',color:'white', fontSize: 18,fontWeight: 'bold',minWidth: width-100}}>
                            +50 progress points
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
