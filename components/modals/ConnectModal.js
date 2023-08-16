import React, { useState, useRef, useEffect, useContext } from "react";
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, Image, SafeAreaView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import Modal from "../Modal";
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { AppleIcon, GoogleIcon } from "../Icons";

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
