import React, { useState, useRef, useEffect, useContext } from "react";
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, Image, SafeAreaView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import Modal from "../Modal";
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';

/** Replaces localStorage in React Native */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Import Context */
import { GlobalContext } from "../../contexts/GlobalContext";

/** Modal explaining what connecting is on mobile */
export default function ConnectModal({hide}) {
  const { user, setUser, orbis, callbackConnect } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const [loading, setLoading] = useState(false);
  const url = Linking.useURL();

  /** Will be triggered when a new deeplink is received */
  useEffect(() => {
    if (url) {
      handleURL(url);
    }
  }, [url]);

  async function handleURL(url) {
    const { hostname, path, queryParams } = Linking.parse(url);
    if(path === 'google-auth') {
      let token = queryParams.token;
      WebBrowser.dismissBrowser();
      setLoading(true);
      console.log("Connecting with Google with token:" + token);
      if(token) {
        try {
          let resUser = await orbis.connect_v2({
             provider: "oauth",
             oauth: {
               type: "google",
               token: token
             }
           });
           console.log("resUser:", resUser);

           if(resUser.status == 200) {
             alert("Success connecting to account.");
             setUser(resUser.details);
             callbackConnect();
           } else {
             setLoading(false);
           }
        } catch(e) {
          console.log("Error authenticating with Pkp:", e);
          alert("There was an error logging you in, please retry.");
          setLoading(false);
        }
      }
    }
  }

  /** Will trigget the auth flow for Apple */
  async function connectWithApple(identityToken, userId, email) {
    setLoading(true);
    Haptics.selectionAsync();
    try {
      let resUser = await orbis.connect_v2({
         provider: "oauth",
         oauth: {
           type: "apple",
           token: identityToken
         }
       });
       if(resUser.status == 200) {
         setUser(resUser.details);
         callbackConnect()
       } else {
         alert("There was an error logging you in, please retry. Error: " + resUser.status);
         setLoading(false);
       }
    } catch(e) {
      console.log("Error authenticating with Pkp:", e);
      alert("There was an error logging you in, please retry.");
      setLoading(false);
    }
  }

  /** Will open WebBrowser to connect with Google using our Oauth API */
  async function connectWithGoogle() {
    Haptics.selectionAsync();
    let result = await WebBrowser.openBrowserAsync('https://lit.orbis.club/oauth-google/' + encodeURIComponent("coineasy://"));
  }

  /** Will hide modal only if user isn't currently logging in */
  function hideModal() {
    if(loading) {
      alert("Can't close now.");
      return;
    } else {
      hide();
    }
  }

  return(
    <Modal hide={hideModal}>
      <View style={[tailwind('flex flex-col w-full p-4 pb-12')]}>
        {loading ?
          <>
            <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Connecting to your account:</Text>
            <View style={[tailwind('flex w-full justify-center')]}>
              <ActivityIndicator style={{marginTop: 15}} size="small" color="#020617" />
            </View>
          </>
        :
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={100}
              style={{
                width: "100%",
                height: 47
              }}
              onPress={async () => {
                try {
                  /** Login with Apple */
                  const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                      AppleAuthentication.AppleAuthenticationScope.EMAIL
                    ]
                  });

                  /** Authenticate with PKP */
                  connectWithApple(credential.identityToken, credential.user, credential.email);
                } catch (e) {
                  console.log("Error connecting with Apple:", e);
                }
              }} />

            {/** Connect with Apple
            <Button color="rounded-gray" title="Continue with Apple" icon={<AppleIcon />} onPress={() => connectWithGoogle()} />*/}

            {/** Connect with Google
            <Button color="rounded-gray" title="Continue with Google" icon={<GoogleIcon />} onPress={connectWithGoogle} />*/}
          </>
        }
      </View>
    </Modal>
  )
}

const AppleIcon = () => {
  return(
    <Svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M15.0494 11.6258C15.0399 9.82322 15.8337 8.4627 17.4405 7.46073C16.5414 6.13951 15.1833 5.41259 13.39 5.27015C11.6923 5.13263 9.83688 6.28686 9.15781 6.28686C8.44049 6.28686 6.79543 5.31927 5.50425 5.31927C2.83581 5.36348 0 7.50494 0 11.8615C0 13.1484 0.229543 14.4778 0.688629 15.8498C1.30074 17.6523 3.5101 22.0728 5.81509 21.9991C7.02019 21.9696 7.87141 21.1199 9.43996 21.1199C10.9607 21.1199 11.7497 21.9991 13.0935 21.9991C15.4176 21.9647 17.4166 17.947 18 16.1395C14.882 14.6317 15.0494 11.7191 15.0494 11.6258ZM12.3427 3.56092C13.6482 1.96955 13.5287 0.52063 13.4904 0C12.3379 0.0687625 11.0037 0.805504 10.2434 1.71415C9.40648 2.68665 8.91392 3.88999 9.01913 5.2456C10.2673 5.34383 11.4054 4.68567 12.3427 3.56092Z" fill="black"/>
    </Svg>
  )
}

const GoogleIcon = () => {
  return(
    <Svg width="21" height="22" viewBox="0 0 21 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M21 11.2573C21 17.5335 16.8301 22 10.6721 22C4.76803 22 0 17.0855 0 11C0 4.91452 4.76803 0 10.6721 0C13.5467 0 15.9652 1.08669 17.8285 2.87863L14.9238 5.75726C11.124 1.97823 4.05799 4.81694 4.05799 11C4.05799 14.8367 7.03156 17.946 10.6721 17.946C14.898 17.946 16.4816 14.8234 16.7311 13.2044H10.6721V9.42097H20.8322C20.9311 9.98427 21 10.5254 21 11.2573Z" fill="black"/>
    </Svg>
  )
}
