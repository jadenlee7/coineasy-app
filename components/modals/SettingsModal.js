import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableHighlight, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { context } from '../../utils/config.js';
import { sleep } from '../../utils';

export default function SettingsModal() {
  const { user, setUser, orbis, setSettingsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function hideSettings() {
    setSettingsVis(false);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  async function logout() {
    Haptics.selectionAsync();
    setSettingsVis(false);
    let res = await orbis.logout();
    setUser(null);
  }

  function openHelp() {
    Haptics.selectionAsync();
    alert("Coming soon");
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
      <View style={[tailwind('flex flex-col w-full p-4')]}>
        <Button color="rounded-gray" title="Help" style={{marginBottom: 10}} onPress={() => openHelp()} />
        <Button color="rounded-gray" title="Privacy Policy" style={{marginBottom: 10}} onPress={() => openPrivacyPolicy()} />
        <Button color="rounded-gray" title="Terms and Conditions" style={{marginBottom: 10}} onPress={() => openTerms()} />
        <Button color="rounded-red" title="Logout" onPress={() => logout()} />
      </View>
    </Modal>
  )
}
