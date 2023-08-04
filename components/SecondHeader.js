import React, { useState, useContext, useEffect, useCallback } from "react";
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";

export default function SecondHeader({label, showBack = true}) {
  const { setUser, orbis, postDetailsVis, setPostDetailsVis } = useContext(GlobalContext);
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
    <View style={[tailwind('flex flex-row items-center p-4 pb-0')]}>
      {/** Back button */}
      <View style={[tailwind('flex flex-1 items-start')]}>
        <HeaderLabel label={label} showBack={showBack} />
      </View>

      {/** Notifications button */}
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9">
        <Svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <Path d="M9 20C9.6193 20.0008 10.2235 19.8086 10.7285 19.4502C11.2335 19.0917 11.6143 18.5849 11.818 18H6.182C6.38566 18.5849 6.76648 19.0917 7.27151 19.4502C7.77654 19.8086 8.3807 20.0008 9 20ZM16 12.586V8C16 4.783 13.815 2.073 10.855 1.258C10.562 0.52 9.846 0 9 0C8.154 0 7.438 0.52 7.145 1.258C4.185 2.074 2 4.783 2 8V12.586L0.293001 14.293C0.199958 14.3857 0.126171 14.4959 0.0758854 14.6172C0.0256001 14.7386 -0.000189449 14.8687 1.04767e-06 15V16C1.04767e-06 16.2652 0.105358 16.5196 0.292894 16.7071C0.480431 16.8946 0.734784 17 1 17H17C17.2652 17 17.5196 16.8946 17.7071 16.7071C17.8946 16.5196 18 16.2652 18 16V15C18.0002 14.8687 17.9744 14.7386 17.9241 14.6172C17.8738 14.4959 17.8 14.3857 17.707 14.293L16 12.586Z" fill="black"/>
        </Svg>
      </TouchableHighlight>

      {/** Temporary logout button */}
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => logout()}>
        <Svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <Path fill-rule="evenodd" clip-rule="evenodd" d="M9 1C9.41421 1 9.75 1.33579 9.75 1.75V9.25C9.75 9.66421 9.41421 10 9 10C8.58579 10 8.25 9.66421 8.25 9.25V1.75C8.25 1.33579 8.58579 1 9 1ZM4.40381 3.34315C4.6967 3.63604 4.6967 4.11091 4.40381 4.40381C1.8654 6.94221 1.8654 11.0578 4.40381 13.5962C6.94221 16.1346 11.0578 16.1346 13.5962 13.5962C16.1346 11.0578 16.1346 6.94221 13.5962 4.40381C13.3033 4.11091 13.3033 3.63604 13.5962 3.34315C13.8891 3.05025 14.364 3.05025 14.6569 3.34315C17.781 6.46734 17.781 11.5327 14.6569 14.6569C11.5327 17.781 6.46734 17.781 3.34315 14.6569C0.218951 11.5327 0.218951 6.46734 3.34315 3.34315C3.63604 3.05025 4.11091 3.05025 4.40381 3.34315Z" fill="#0F172A" stroke="black" stroke-width="0.5" stroke-linecap="round"/>
        </Svg>
      </TouchableHighlight>
    </View>
  )
}

const HeaderLabel = ({label, showBack}) => {
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

  if(postDetailsVis && showBack) {
    return(
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => hidePostPane()}>
        <>
          <Svg width="11" height="18" viewBox="0 0 11 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M0.402753 9.90773C-0.134252 9.40567 -0.134252 8.59032 0.402753 8.08825L8.65114 0.376546C9.18815 -0.125517 10.0602 -0.125517 10.5972 0.376546C11.1343 0.87861 11.1343 1.69396 10.5972 2.19603L3.31976 9L10.593 15.804C11.13 16.306 11.13 17.1214 10.593 17.6235C10.0559 18.1255 9.18385 18.1255 8.64685 17.6235L0.398457 9.91175L0.402753 9.90773Z" fill="black"/>
          </Svg>
          <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
        </>
      </TouchableHighlight>
    )
  } else if(profileSelected && showBack) {
    return(
      <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => hideProfilePane()}>
        <>
          <Svg width="11" height="18" viewBox="0 0 11 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M0.402753 9.90773C-0.134252 9.40567 -0.134252 8.59032 0.402753 8.08825L8.65114 0.376546C9.18815 -0.125517 10.0602 -0.125517 10.5972 0.376546C11.1343 0.87861 11.1343 1.69396 10.5972 2.19603L3.31976 9L10.593 15.804C11.13 16.306 11.13 17.1214 10.593 17.6235C10.0559 18.1255 9.18385 18.1255 8.64685 17.6235L0.398457 9.91175L0.402753 9.90773Z" fill="black"/>
          </Svg>
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
