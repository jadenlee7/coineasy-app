import React, { useContext, useState } from "react";
import { Text, View, Image, TouchableOpacity, Animated, Easing } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import { context } from "../../utils/config"
import { GlobalContext } from "../../contexts/GlobalContext";
import { registerForPushNotificationsAsync } from "../../utils/push";

import moment from "moment";
import Checkbox from 'expo-checkbox';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/core";


export default function NewFeatureModal() {
    const { user, userData, setUserData, orbis, setNewFeatureVis, newFeatureAlertVis, setNewFeatureAlertVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const navigation = useNavigation()

    const [toggleCheckBox, setToggleCheckBox] = useState(false)
    const [isClaimed, setIsClaimed] = useState(false)
    const [fadeAnim] = useState(new Animated.Value(0));

    async function goToRewardPage(isNavigating) {
        Haptics.selectionAsync();
        if(toggleCheckBox){
            await AsyncStorage.setItem("showNewFeatureDate", moment().add(7, 'days').format('YYYY-MM-DD'))
        }
        setNewFeatureVis(false);

        isNavigating && navigation.navigate('OrangeReward')
    }

    async function claimFirstReward(){
        Haptics.selectionAsync()

        if(isClaimed){
            setNewFeatureVis(false)
            setNewFeatureAlertVis(false)
        }else{
            const tempData = userData
    
            if(tempData){
                tempData.numberOranges ? tempData.numberOranges += 50 : tempData.numberOranges = 50
    
                if(tempData.listClaimedOranges){
                    const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                    if(index != -1){
                        tempData.listClaimedOranges[index].listOranges.push({
                            numberOranges: 50,
                            type: 'First Orange Rewards'
                        })
                    }else{
                        tempData.listClaimedOranges.push({
                            date: moment().format('YYYY-MM-DD'),
                            listOranges: [
                                {
                                    numberOranges: 50,
                                    type: 'First Orange Rewards'
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
                                    type: 'First Orange Rewards'
                                },
                        ]
                    }]
                }
    
                userData.firstTime = 'done'
                setUserData({...tempData})
                
                var tempProfile = user.profile
                tempProfile.data = tempData

                const res = await orbis.updateProfile(tempProfile);
                await AsyncStorage.setItem('FirstTimeReward', 'false')

                setIsClaimed(true)
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver:false
                }).start();
            }


        }
    }

    return(
        <Modal 
            hide={() => goToRewardPage(false)} 
            type='oranges'
        >
            <TouchableOpacity
                style={{position: 'absolute',top: 15, right: 15}}
                onPress={() => goToRewardPage(false)}
            >
                <AntDesign name="closecircle" size={24} color="black" />
            </TouchableOpacity>

            {newFeatureAlertVis ? (
                <View style={[tailwind('flex flex-col items-center justify-center px-3'), {paddingTop: 30,}]}>
                    <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>New Feature Alert!</Text>
                    <Text style={[tailwind(`text-secondary text-center text-slate-900`), {lineHeight: 20,marginTop: 10,}]}>Enjoy Your First Orange Rewards!</Text>

                    {isClaimed ? (
                        <Animated.View style={{opacity: fadeAnim,marginVertical: 20,}}>
                            <Text style={{fontSize: 28,fontWeight: 'bold',color:'#FF6B17',textAlign: 'center',}}>+50</Text>
                            <Image 
                                style={{height: 100,width: 100,alignSelf: 'center',}} 
                                resizeMode="contain"
                                source={require('../../assets/orangeDay.png')} 
                            />
                            <Animated.Text style={{opacity: fadeAnim, textAlign: 'center',marginTop: 10,fontWeight: 'bold',}}>You've earned 50 Oranges !</Animated.Text>
                        </Animated.View>
                    ) : (
                        <Image 
                            style={{height: 180,marginTop: 15,alignSelf: 'center',}} 
                            resizeMode="contain"
                            source={require('../../assets/new_feature_orange.png')} 
                        />

                    )}

                    <Button 
                        size="md" 
                        color="white" 
                        title={isClaimed ? "Continue" : "Claim"}
                        onPress={() => claimFirstReward()} 
                        style={{width: '90%',alignItems: 'center',height: 50,justifyContent: 'center',marginTop: 20,}}
                    />
                </View>
            ) : (
                <View style={[tailwind('flex flex-col items-center justify-center px-3'), {paddingTop: 30,}]}>
                    <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>New Feature Alert!</Text>
                    <Text style={[tailwind(`text-secondary text-center text-slate-900`), {lineHeight: 20,marginTop: 10,}]}>Discover New Rewards!</Text>

                    <Image 
                        style={{height: 180,marginTop: 15,alignSelf: 'center',}} 
                        resizeMode="contain"
                        source={require('../../assets/new_feature_orange.png')} 
                    />

                    <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5,marginVertical: 10,}}>
                        <Checkbox 
                            style={{width: 17,height: 17}}
                            value={toggleCheckBox} 
                            onValueChange={setToggleCheckBox} 
                            color={'#000'}
                        />
                        <Text style={{fontFamily: 'GmarketMedium',fontSize: 12,}}>Don't show me for 7 days</Text>
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to Reward Page"
                        onPress={() => goToRewardPage(true)} 
                        style={{width: '100%',alignItems: 'center',height: 50,justifyContent: 'center',marginTop: 10,}}
                    />
                </View>

            )}

        </Modal>
    )
}
