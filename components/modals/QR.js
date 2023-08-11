import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight, ActivityIndicator, Dimensions } from 'react-native';
import Button from "../Button";
import Svg, { Circle, Rect, Path } from 'react-native-svg';

export default function QR({hide}) {
  const { user, setUser, orbis, callbackConnect } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [connectModalVis, setConnectModalVis] = useState(false);
  const { width } = Dimensions.get('window');

  function shareProfile() {

  }

  function copyLink() {

  }

  return(
    <View style={[tailwind('absolute w-full h-full'), {elevation: 50}]}>
      <Image
        resizeMode="cover"
        style={[tailwind('w-full h-full')]}
        source={require('../../assets/qr_code_bg.png')} />
      <SafeAreaView style={[tailwind('absolute w-full flex flex-col')]}>
        <View style={[tailwind('flex items-start')]}>
          <TouchableHighlight onPress={hide} style={{left: 20, top: 10}} underlayColor="transparent">
            <Svg width="27" height="27" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <Circle cx="12" cy="12.001" r="10" fill="white"/>
              <Path d="M12 1C5.939 1 1 5.939 1 12C1 18.061 5.939 23 12 23C18.061 23 23 18.061 23 12C23 5.939 18.061 1 12 1ZM15.696 14.53C16.015 14.849 16.015 15.377 15.696 15.696C15.531 15.861 15.322 15.938 15.113 15.938C14.904 15.938 14.695 15.861 14.53 15.696L12 13.166L9.47 15.696C9.305 15.861 9.096 15.938 8.887 15.938C8.678 15.938 8.469 15.861 8.304 15.696C8.15057 15.5407 8.06453 15.3313 8.06453 15.113C8.06453 14.8947 8.15057 14.6853 8.304 14.53L10.834 12L8.304 9.47C8.15057 9.31475 8.06453 9.10527 8.06453 8.887C8.06453 8.66873 8.15057 8.45925 8.304 8.304C8.623 7.985 9.151 7.985 9.47 8.304L12 10.834L14.53 8.304C14.849 7.985 15.377 7.985 15.696 8.304C16.015 8.623 16.015 9.151 15.696 9.47L13.166 12L15.696 14.53Z" fill="black"/>
            </Svg>
          </TouchableHighlight>
        </View>

        <View style={[tailwind('items-center justify-center'), {marginTop: 100}]}>
          <View style={[tailwind('bg-white rounded-lg shadow-md'), {width: width / 1.5, height: width / 1.5}]}></View>
          <View style={[tailwind('flex flex-row'), {width: width / 1.5, marginTop: 15}]}>
            <WhiteAction style={{marginRight: 15}} label="Share" icon={<ShareIcon />} onPress={() => shareProfile()} />
            <WhiteAction label="Copy link" icon={<CopyIcon />} onPress={() => copyLink()} />
          </View>
        </View>
      </SafeAreaView>

    </View>
  )
}

const WhiteAction = ({style, label, icon, onPress}) => {
  const tailwind = useTailwind();
  return(
    <TouchableHighlight style={[tailwind('bg-white rounded-lg shadow-md flex-1 flex p-4'), style]} underlayColor="#f1f5f9" onPress={onPress}>
      <>
        <View style={tailwind("w-full items-center")}>
          {icon}
        </View>
        <Text style={tailwind("text-primary font-normal text-center")}>{label}</Text>
      </>
    </TouchableHighlight>
  )
}

const ShareIcon = () => {
  return(
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M12.908 2.36623C12.4058 1.87792 11.5902 1.87792 11.0879 2.36623L5.94509 7.36647C5.44286 7.85478 5.44286 8.64779 5.94509 9.13609C6.44732 9.6244 7.26295 9.6244 7.76518 9.13609L10.7143 6.26876V14.4996C10.7143 15.1911 11.2888 15.7497 12 15.7497C12.7112 15.7497 13.2857 15.1911 13.2857 14.4996V6.26876L16.2348 9.13609C16.7371 9.6244 17.5527 9.6244 18.0549 9.13609C18.5571 8.64779 18.5571 7.85478 18.0549 7.36647L12.9121 2.36623H12.908ZM5.57143 15.7497C5.57143 15.0583 4.99688 14.4996 4.28571 14.4996C3.57455 14.4996 3 15.0583 3 15.7497V18.2498C3 20.3202 4.72768 22 6.85714 22H17.1429C19.2723 22 21 20.3202 21 18.2498V15.7497C21 15.0583 20.4254 14.4996 19.7143 14.4996C19.0031 14.4996 18.4286 15.0583 18.4286 15.7497V18.2498C18.4286 18.9413 17.854 19.4999 17.1429 19.4999H6.85714C6.14598 19.4999 5.57143 18.9413 5.57143 18.2498V15.7497Z" fill="black"/>
    </Svg>
  )
}

const CopyIcon = () => {
  return(
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M18.5035 13.7745L19.5713 12.7068C21.7067 10.5713 21.7138 7.07112 19.5713 4.92859C17.4358 2.79313 13.9356 2.78606 11.7931 4.92859L10.7254 5.99632M6.48979 10.2319L5.42913 11.2926C4.40012 12.3253 3.82234 13.7238 3.82234 15.1816C3.82234 16.6395 4.40012 18.038 5.42913 19.0707C7.56459 21.2062 11.0648 21.2133 13.2073 19.0707L14.268 18.0101M9.67177 14.8281L15.3286 9.17123" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}
