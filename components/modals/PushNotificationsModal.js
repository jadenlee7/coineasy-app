import React, { useState, useRef, useEffect, useContext } from "react";
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, Image, SafeAreaView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { context } from "../../utils/config"
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import Modal from "../Modal";
import { registerForPushNotificationsAsync } from "../../utils/push";

/** Replaces localStorage in React Native */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Import Context */
import { GlobalContext } from "../../contexts/GlobalContext";

export default function PushNotificationsModal() {
  const { user, setUser, orbis, setPushNotifsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();

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
      console.log("Retrieved push token:", res);
      setPushNotifsVis(false);
      let result = await orbis.addNotificationsSubscription({
        type: "push",
        value: res.data,
        scopes: ["follow", "replies", "messages", "reposts", "reactions"],
        context: context
      });
      console.log("result:", result);
    } else {
      alert("Error retrieving push notifications token.");
    }
  }

  /** Won't ask for the push notifications token and will close modal */
  async function skipNotifications() {
    Haptics.selectionAsync();

    setPushNotifsVis(false);
  }

    return(
        <Modal hide={() => {Haptics.selectionAsync();setPushNotifsVis(false)}} type='notifications'>
            <View style={[tailwind('flex flex-col items-center justify-center px-3'), {paddingTop: 30,}]}>
                <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>Push Notifications</Text>

                <Image source={require('../../assets/notification_icon.png')} style={{height: 115,marginTop: 15,marginBottom: 25,alignSelf: 'center',}} resizeMode="contain"/>

                <Text style={[tailwind(`text-secondary text-center text-slate-900`), {lineHeight: 20}]}>Stay in the loop with the latest news, content, videos, and rewards.</Text>

                <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                    <Button size="md" color="black" title="Notify me" onPress={enablePushNotifications} style={{width: '90%',alignItems: 'center',height:50,justifyContent: 'center',}}/>
                    <Button size="md" color="white" title="Not now" onPress={skipNotifications} style={{width: '90%',alignItems: 'center',marginTop: 10,height: 50,justifyContent: 'center',}}/>
                </View>
            </View>
        </Modal>
    )
}
