import React, { useState, useContext, useEffect, useCallback } from "react";
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";

export default function SecondHeader({label, showBack = true, cta = "notifications"}) {
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
        <HeaderLabel label={label} showBack={showBack} />
      </View>

      {/** Notifications button */}
      {cta == "notifications" &&
        <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} underlayColor="#f1f5f9">
          <Svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{color: "#000"}}>
            <Path d="M9 20C9.6193 20.0008 10.2235 19.8086 10.7285 19.4502C11.2335 19.0917 11.6143 18.5849 11.818 18H6.182C6.38566 18.5849 6.76648 19.0917 7.27151 19.4502C7.77654 19.8086 8.3807 20.0008 9 20ZM16 12.586V8C16 4.783 13.815 2.073 10.855 1.258C10.562 0.52 9.846 0 9 0C8.154 0 7.438 0.52 7.145 1.258C4.185 2.074 2 4.783 2 8V12.586L0.293001 14.293C0.199958 14.3857 0.126171 14.4959 0.0758854 14.6172C0.0256001 14.7386 -0.000189449 14.8687 1.04767e-06 15V16C1.04767e-06 16.2652 0.105358 16.5196 0.292894 16.7071C0.480431 16.8946 0.734784 17 1 17H17C17.2652 17 17.5196 16.8946 17.7071 16.7071C17.8946 16.5196 18 16.2652 18 16V15C18.0002 14.8687 17.9744 14.7386 17.9241 14.6172C17.8738 14.4959 17.8 14.3857 17.707 14.293L16 12.586Z" fill="currentColor"/>
          </Svg>
        </TouchableHighlight>
      }

      {/** Settings button */}
      {cta == "settings" &&
        <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} underlayColor="#f1f5f9" onPress={() => setSettingsVis(true)}>
          <Svg width="18" height="18" viewBox="0 0 22 21" fill="none" xmlns="http://www.w3.org/2000/svg" style={{color: "#000"}}>
            <Path d="M19.9 7.40748C17.91 7.40748 17.0965 5.98358 18.086 4.23709C18.6577 3.22479 18.3168 1.93438 17.3163 1.35593L15.4143 0.254634C14.5457 -0.268202 13.4243 0.0432746 12.9075 0.922085L12.7866 1.13344C11.7971 2.87994 10.1699 2.87994 9.16942 1.13344L9.04848 0.922085C8.92996 0.711817 8.77129 0.527497 8.58171 0.379853C8.39213 0.232209 8.17542 0.124188 7.94419 0.0620759C7.71296 -3.59623e-05 7.47183 -0.0149983 7.23484 0.0180596C6.99784 0.0511175 6.76971 0.131535 6.56372 0.254634L4.66167 1.35593C3.66117 1.93438 3.32034 3.23591 3.89205 4.24821C4.89255 5.98358 4.07896 7.40748 2.08896 7.40748C0.945527 7.40748 0 8.35303 0 9.52107V11.4789C0 12.6358 0.934533 13.5925 2.08896 13.5925C4.07896 13.5925 4.89255 15.0164 3.89205 16.7629C3.32034 17.7752 3.66117 19.0656 4.66167 19.6441L6.56372 20.7454C7.43228 21.2682 8.55372 20.9567 9.07046 20.0779L9.1914 19.8666C10.1809 18.1201 11.8081 18.1201 12.8086 19.8666L12.9295 20.0779C13.4463 20.9567 14.5677 21.2682 15.4363 20.7454L17.3383 19.6441C18.3388 19.0656 18.6797 17.7641 18.1079 16.7629C17.1074 15.0164 17.921 13.5925 19.911 13.5925C21.0545 13.5925 22 12.647 22 11.4789V9.52107C21.9942 8.9604 21.7708 8.4245 21.3779 8.02907C20.985 7.63363 20.4542 7.41037 19.9 7.40748ZM10.9945 14.1154C9.02649 14.1154 7.42129 12.4912 7.42129 10.5C7.42129 8.50877 9.02649 6.88464 10.9945 6.88464C12.9625 6.88464 14.5677 8.50877 14.5677 10.5C14.5677 12.4912 12.9625 14.1154 10.9945 14.1154Z" fill="currentColor"/>
          </Svg>
        </TouchableHighlight>
      }
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
