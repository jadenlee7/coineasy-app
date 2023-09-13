import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight, ActivityIndicator, Dimensions, Share } from 'react-native';
import Button from "../Button";
import SvgQRCode from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { CloseIcon, ShareIcon, CopyIcon } from "../Icons";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";

export default function QR({hide}) {
  const { user, setUser, orbis, callbackConnect } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [connectModalVis, setConnectModalVis] = useState(false);
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();

  /** Will build follow link */
  let link = Linking.createURL('user', {
    queryParams: { did: user.did },
  });
  console.log("link:", link);

  /** Will open the native sharing modal */
  const shareProfile = async () => {
    try {
      const result = await Share.share({
        url: link,
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log("shared with activity type of:", result.activityType)
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert(error.message);
    }
  };

  /** Will copy link in Clipboard */
  async function copyLink() {
    await Clipboard.setStringAsync(link);
    alert("Profile link copied!");
  }

  let logo = require('../../assets/qr-code-logo.png');

  return(
    <View style={[tailwind('absolute w-full h-full'), {elevation: 50}]}>
      <Image
        resizeMode="cover"
        style={[tailwind('w-full h-full')]}
        source={require('../../assets/qr_code_bg.png')} />
      <View style={[tailwind('absolute w-full flex flex-col'), { paddingTop: statusBarHeight }]}>
        <View style={[tailwind('flex items-start')]}>
          <TouchableHighlight onPress={hide} style={{left: 20, top: 10}} underlayColor="transparent">
            <CloseIcon />
          </TouchableHighlight>
        </View>

        <View style={[tailwind('items-center justify-center'), {marginTop: 100}]}>
          <View style={[tailwind('bg-white rounded-lg shadow-lg overflow-hidden items-center justify-center'), {width: width / 1.4, height: width / 1.4}]}>
            <View style={tailwind("rounded-lg overflow-hidden")}>
              <SvgQRCode
                value={link}
                logoSize={65}
                size={width / 1.4 - 50}
                color="#FF6B17" logo={logo} />
            </View>
          </View>
          <View style={[tailwind('flex flex-row'), {width: width / 1.4, marginTop: 15}]}>
            <WhiteAction style={{marginRight: 15}} label="Share" icon={<ShareIcon />} onPress={() => shareProfile()} />
            <WhiteAction label="Copy link" icon={<CopyIcon />} onPress={() => copyLink()} />
          </View>
        </View>
      </View>

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
