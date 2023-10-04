import React, { useState, useContext, useEffect, useCallback } from "react";
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { BackIcon, NotificationsIcon, SettingsIcon } from "./Icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function SecondHeader({label, showBack = true, cta = "notifications", back}) {
  const { setUser, orbis, postDetailsVis, setPostDetailsVis, setSettingsVis, setNotificationsVis, screen } = useContext(GlobalContext);
  const tailwind = useTailwind();

  function hidePostPane() {
    Haptics.selectionAsync();
    setPostDetailsVis(null);
  }

  async function logout() {
    let res = await orbis.logout();
    await AsyncStorage.removeItem("user-connected");
    setUser(null);
  }

  return(
    <View style={{marginTop: screen == 'home' ? 0 : 40 + useStatusBarHeight(),}}>
        <View style={[tailwind('flex flex-row items-center px-3 pt-3'), {minHeight: 50, backgroundColor: screen == 'home' ? '#f7f7f7' : 'white', paddingBottom: screen == 'home' ? 30 : 0 }]}>

        {/** Back button */}
        <View style={[tailwind('flex flex-1 items-start pt-1'),]}>
            <HeaderLabel label={label} showBack={showBack} back={back} />
        </View>

        {/** Notifications button */}
        {cta == "notifications" &&
            <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} activeOpacity={0.7} onPress={() => setNotificationsVis(true)}>
            <NotificationsIcon />
            </TouchableOpacity>
        }

        {/** Settings button */}
        {cta == "settings" &&
            <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} activeOpacity={0.7} onPress={() => setSettingsVis(true)}>
            <SettingsIcon />
            </TouchableOpacity>
        }
        </View>
    </View>
  )
}

const HeaderLabel = ({label, showBack, back}) => {
  const { orbis, postDetailsVis, setPostDetailsVis, profileSelected, setProfileSelected } = useContext(GlobalContext);
  const tailwind = useTailwind();


  function hidePostPane() {
    Haptics.selectionAsync();
    setPostDetailsVis(null);
  }

  function hideProfilePane() {
    Haptics.selectionAsync();
    setProfileSelected(null);
  }

  if(back) {
    return(
      <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => back()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableOpacity>
    )
  } else if(postDetailsVis && showBack) {
    return(
      <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hidePostPane()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableOpacity>
    )
  } else if(profileSelected && showBack) {
    return(
      <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hideProfilePane()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableOpacity>
    )
  } else {
    return(
      <Text style={[tailwind('text-slate-900 px-2'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20 }]}>{label}</Text>
    )
  }

}
