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
    let res = await registerForPushNotificationsAsync();
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
    setPushNotifsVis(false);
  }

  return(
    <Modal hide={() => setPushNotifsVis(false)}>
      <View style={[tailwind('flex flex-col items-center justify-center p-4')]}>
        <Text style={[tailwind(`text-primary px-8 mb-1 text-center`)]}>Push Notifications</Text>
        <Text style={[tailwind(`text-secondary text-center`)]}>To stay in the loop with the latest news, content, videos, and more, allow CoinEasy to send you notifications.</Text>
        <View style={[tailwind('flex items-center mt-4 flex-col')]}>
          <Button size="md" color="orange" title="Notify me" onPress={enablePushNotifications} />
          <Button color="sm-transparent" title="Do not notifiy me" onPress={skipNotifications} style={{marginTop: 5}} />
        </View>
      </View>
    </Modal>
  )
}
