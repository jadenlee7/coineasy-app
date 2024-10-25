import React, { useContext, useState } from "react";
import { Text, View, Image, Platform } from 'react-native';

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


export default function PushNotificationsModal() {
    const { user, setUser, orbis, setPushNotifsVis, setNewFeatureVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [toggleCheckBox, setToggleCheckBox] = useState(false)

    /** Will enable push notifications and save the token with Orbis */
    async function enablePushNotifications() {
        Haptics.selectionAsync();

        let res;
        try {
            res = await registerForPushNotificationsAsync();
        } catch (error) {
            console.log(error);
        }

        if(res) {
            try {
                let result = await orbis.addNotificationsSubscription({
                    type: "push",
                    value: res.data,
                    scopes: ["follow", "replies", "messages", "reposts", "reactions"],
                    context: context
                });
            } catch (error) {
                console.log(error);
            }

            if(toggleCheckBox){
                await AsyncStorage.setItem("showNotificationDate", moment().add(7, 'days').format('YYYY-MM-DD'))
            }
            const showNewFeatureDate = await AsyncStorage.getItem('showNewFeatureDate')
            if(moment().format('YYYY-MM-DD') >= showNewFeatureDate || !showNewFeatureDate){
                setNewFeatureVis(true);
            }
            
            setPushNotifsVis(false);
        } else {
            alert("Error retrieving push notifications token.");
        }
    }

    /** Won't ask for the push notifications token and will close modal */
    async function skipNotifications() {
        Haptics.selectionAsync();
        const showNewFeatureDate = await AsyncStorage.getItem('showNewFeatureDate')
        console.log('ICIII : '+showNewFeatureDate);
        
        if(moment().format('YYYY-MM-DD') >= showNewFeatureDate || !showNewFeatureDate){
            setNewFeatureVis(true);
        }

        setPushNotifsVis(false);
        if(toggleCheckBox){
            await AsyncStorage.setItem("showNotificationDate", moment().add(7, 'days').format('YYYY-MM-DD'))
        }
    }

    return(
        <Modal hide={() => {Haptics.selectionAsync();setPushNotifsVis(false)}} type='notifications'>
            <View style={[tailwind('flex flex-col items-center justify-center px-3'), {paddingTop: 30,}]}>
                <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 20,fontFamily: "GmarketBold",lineHeight: 24,}]}>Push Notifications</Text>

                <Image source={require('../../assets/notification_icon.png')} style={{height: 115,marginTop: 15,marginBottom: 25,alignSelf: 'center',}} resizeMode="contain"/>

                <Text style={[tailwind(`text-secondary text-center text-slate-900`), {lineHeight: 20, fontFamily: "GmarketMedium",fontSize: 14,}]}>
                    Stay in the loop with the latest news, content, videos, and rewards.
                </Text>

                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5,marginTop: 25,}}>
                    <Checkbox 
                        style={{width: 17,height: 17}}
                        value={toggleCheckBox} 
                        onValueChange={setToggleCheckBox} 
                        color={'#000'}
                    />
                    <Text style={{fontFamily: 'GmarketMedium',fontSize: 12,}}>Don't show me for 7 days</Text>
                </View>

                <View style={[tailwind('flex flex-row justify-between w-full'), {marginTop: Platform.OS == 'ios' ? 32 : 20}]}>
                    <Button size="md" color="black" title="Notify me" onPress={enablePushNotifications} style={{width: '47%',alignItems: 'center',height: 50,justifyContent: 'center',}}/>
                    <Button size="md" color="white" title="Not now" onPress={skipNotifications} style={{width: '47%',alignItems: 'center',height: 50,justifyContent: 'center',}}/>
                </View>
            </View>
        </Modal>
    )
}
