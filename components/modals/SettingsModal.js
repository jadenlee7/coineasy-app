import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableHighlight, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { context } from '../../utils/config.js';
import { sleep } from '../../utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnectModal, WalletConnectModal } from '@walletconnect/modal-react-native'
import * as WebBrowser from 'expo-web-browser';

export default function SettingsModal() {
  const { user, setUser, orbis, setSettingsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { isOpen, open, close, provider, isConnected, address } = useWalletConnectModal();

  function hideSettings() {
    setSettingsVis(false);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  async function logout() {
    Haptics.selectionAsync();
    setSettingsVis(false);
    AsyncStorage.removeItem("user-connected");
    let res = await orbis.logout();
    console.log("res:", res);

    let providerType = await AsyncStorage.getItem("provider-type");
    console.log("providerType:", providerType);
    if(providerType == "wallet-connect") {
      provider?.disconnect();
    }

    setUser(null);
  }

  async function openHelp() {
    Haptics.selectionAsync();
    let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1x8ZvprutJSuv96KVz3vLyXHWXwi8AaVS/view?usp=sharing");
  }

  function openPrivacyPolicy() {
    Haptics.selectionAsync();
    alert("Coming soon");
  }

  function openTerms() {
    Haptics.selectionAsync();
    alert("Coming soon");
  }

  return(
    <Modal hide={() => hideSettings()} animateModal={true} bottomDuration={200} bottomStart={-100}>
      <View style={[tailwind('flex flex-col w-full p-5')]}>
        <Text style={[tailwind('text-primary mb-5')]}>Settings & Privacy</Text>
        <Button color="rounded-gray" title="Help" style={{marginBottom: 10}} onPress={() => openHelp()} />
        <Button color="rounded-gray" title="Privacy Policy" style={{marginBottom: 10}} onPress={() => openPrivacyPolicy()} />
        <Button color="rounded-gray" title="Terms and Conditions" style={{marginBottom: 10}} onPress={() => openTerms()} />
        <Button color="rounded-red" title="Logout" onPress={() => logout()} style={{marginBottom: 30}}  />
      </View>
    </Modal>
  )
}
