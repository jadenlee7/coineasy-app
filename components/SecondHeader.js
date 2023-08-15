import React, { useState, useContext, useEffect, useCallback } from "react";
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import { BackIcon, NotificationsIcon, SettingsIcon } from "./Icons";

export default function SecondHeader({label, showBack = true, cta = "notifications", back}) {
  const { setUser, orbis, postDetailsVis, setPostDetailsVis, setSettingsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();

  function hidePostPane() {
    Haptics.selectionAsync();
    setPostDetailsVis(null);
  }

  async function logout() {
    let res = await orbis.logout();
    setUser(null);
  }

  return(
    <View style={[tailwind('flex flex-row items-center p-3 pt-2 pb-0')]}>
      {/** Back button */}
      <View style={[tailwind('flex flex-1 items-start pt-1')]}>
        <HeaderLabel label={label} showBack={showBack} back={back} />
      </View>

      {/** Notifications button */}
      {cta == "notifications" &&
        <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} underlayColor="#f1f5f9">
          <NotificationsIcon />
        </TouchableHighlight>
      }

      {/** Settings button */}
      {cta == "settings" &&
        <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} underlayColor="#f1f5f9" onPress={() => setSettingsVis(true)}>
          <SettingsIcon />
        </TouchableHighlight>
      }
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
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => back()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableHighlight>
    )
  } else if(postDetailsVis && showBack) {
    return(
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => hidePostPane()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableHighlight>
    )
  } else if(profileSelected && showBack) {
    return(
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => hideProfilePane()}>
        <>
          <BackIcon />
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableHighlight>
    )
  } else {
    return(
      <Text style={[tailwind('text-slate-900'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20 }]}>{label}</Text>
    )
  }

}
