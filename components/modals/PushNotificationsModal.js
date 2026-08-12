import React, { useContext, useState } from "react";
import { Alert, Text, View, Image, Platform } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import { GlobalContext } from "../../contexts/GlobalContext";
import {
    useDeviceAccountData,
    useDeviceAccountOperationLease,
} from '../../contexts/DeviceAccountDataContext';
import { registerForPushNotificationsAsync } from "../../utils/push";
import { api } from '../../utils/api';
import { pushTokenRegistrationEnabled } from '../../utils/pushTokenRegistration.mjs';

import moment from "moment";
import Checkbox from 'expo-checkbox';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';

// These cooldown dates are intentionally device-wide UI preferences. They do
// not contain an account identifier, notification token, or profile data.


export default function PushNotificationsModal() {
    const { setPushNotifsVis, setNewFeatureVis } = useContext(GlobalContext);
    const { saveExpoPushToken } = useDeviceAccountData();
    const { lease: renderLease, isCurrentLease } = useDeviceAccountOperationLease();
    const tailwind = useTailwind();

    const [toggleCheckBox, setToggleCheckBox] = useState(false)
    /** Request permission, bind the token to this account, then retain it locally. */
    async function enablePushNotifications() {
        const expectedLease = renderLease;
        if (!isCurrentLease(expectedLease)) return;
        Haptics.selectionAsync();

        let res;
        try {
            res = await registerForPushNotificationsAsync();
        } catch {
            if (isCurrentLease(expectedLease)) {
                Alert.alert('Notifications unavailable', 'EasyGo could not request device notification permission. Please try again.');
            }
            return;
        }

        if (!isCurrentLease(expectedLease)) return;
        if(res?.data) {
            const token = res.data;
            const remoteRegistrationEnabled = pushTokenRegistrationEnabled();
            let registration;
            if (remoteRegistrationEnabled) {
                try {
                    registration = await api.registerPushToken({
                        token,
                        platform: Platform.OS,
                        expectedAuthUserId: expectedLease.ownerUserId,
                    });
                } catch {
                    if (isCurrentLease(expectedLease)) {
                        Alert.alert('Notifications unavailable', 'EasyGo could not securely register this device. Please try again.');
                    }
                    return;
                }
            }
            if (!isCurrentLease(expectedLease)) {
                if (remoteRegistrationEnabled) {
                    try {
                        await api.unregisterPushToken({
                            token,
                            expectedAuthUserId: expectedLease.ownerUserId,
                        });
                    } catch {}
                }
                return;
            }
            if (remoteRegistrationEnabled && registration?.registration?.registered !== true) {
                Alert.alert('Notifications unavailable', 'EasyGo could not securely register this device. Please try again.');
                return;
            }

            const tokenSaved = await saveExpoPushToken(token);
            if (!isCurrentLease(expectedLease)) {
                if (remoteRegistrationEnabled) {
                    try {
                        await api.unregisterPushToken({
                            token,
                            expectedAuthUserId: expectedLease.ownerUserId,
                        });
                    } catch {}
                }
                return;
            }
            if (!tokenSaved) {
                if (remoteRegistrationEnabled) {
                    try {
                        await api.unregisterPushToken({
                            token,
                            expectedAuthUserId: expectedLease.ownerUserId,
                        });
                    } catch {}
                }
                Alert.alert('Notifications unavailable', 'EasyGo could not protect this account’s notification registration. Please try again.');
                return;
            }

            if(toggleCheckBox){
                await AsyncStorage.setItem("showNotificationDate", moment().add(7, 'days').format('YYYY-MM-DD'))
            }
            if (!isCurrentLease(expectedLease)) return;
            const showNewFeatureDate = await AsyncStorage.getItem('showNewFeatureDate')
            if (!isCurrentLease(expectedLease)) return;
            if(moment().format('YYYY-MM-DD') >= showNewFeatureDate || !showNewFeatureDate){
                setNewFeatureVis(true);
            }
            
            setPushNotifsVis(false);
            Alert.alert(
                'Notifications enabled',
                remoteRegistrationEnabled
                    ? 'Device permission and secure EasyGo registration are ready. Notification delivery will activate in a later release.'
                    : 'Device permission is ready. Remote EasyGo registration remains off until the next privacy document is approved.'
            );
        } else {
            Alert.alert('Notifications unavailable', 'EasyGo could not retrieve a notification token. Please try again.');
        }
    }

    /** Won't ask for the push notifications token and will close modal */
    async function skipNotifications() {
        const expectedLease = renderLease;
        if (!isCurrentLease(expectedLease)) return;
        Haptics.selectionAsync();
        const showNewFeatureDate = await AsyncStorage.getItem('showNewFeatureDate')
        if (!isCurrentLease(expectedLease)) return;
        
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
