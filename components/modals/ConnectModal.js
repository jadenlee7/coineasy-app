import React, { useState, useRef, useEffect, useContext } from "react";
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, Image, SafeAreaView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { isValidEmail } from "../../utils"
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';

/** Replaces localStorage in React Native */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Import Context */
import { GlobalContext } from "../../contexts/GlobalContext";

/** Modal explaining what connecting is on mobile */
export default function ConnectModal({connect, visible, checkIsConnected}) {
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');

  return(
    <View style={tailwind('absolute h-full w-full z-50')}>
      {/**<ConnectWithQR />*/}
      <ConnectFlow />
    </View>
  )
}

/** Will render two CTAs (one to connect with Apple, the other on to connect with email) */
function ConnectFlow() {
  const { user, setUser, orbis, setShowConnectModal } = useContext(GlobalContext);
  const tailwind = useTailwind();


  /** Hide connect modal */
  function back() {
    setShowConnectModal(false);
  }

  async function connectWithApple() {

  }



  return(
    <View style={tailwind('h-full w-full z-50 absolute')}>
      {/** BG to hide modal */}
      <TouchableOpacity onPress={() => back()} activeOpacity={0.9} style={[tailwind('h-full w-full absolute'), { backgroundColor: 'rgba(0,0,0,0.7)' }]}></TouchableOpacity>

      {/** Content of the connect flow */}
      <View style={[tailwind('bg-white m-6 p-6 mt-24 rounded-md flex-col')]}>
        <Text style={tailwind('text-lg font-medium text-gray-900 text-center')}>Connect to your account</Text>
        <View style={{flexDirection: "row", alignItems: "flex-start", justifyContent:"center", marginBottom: 20}}>
          <Text style={tailwind('text-sm text-gray-600 text-center mt-1')}>Connecting will automatically create a wallet for you which can be used to receive rewards.</Text>
        </View>

        <View style={[tailwind('items-center flex-col'), {justifyContent: "center"}]}>
          {/**<Button onPress={() => connectWithApple()} color="black" title="Connect with Apple" style={{marginBottom: 5}} />*/}
          <EmailFlow />
        </View>
      </View>

    </View>
  )
}

/** Will mange the different steps required to connect to Orbis using an email account */
const EmailFlow = () => {
  const { user, setUser, orbis, setShowConnectModal, confetti } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [emailStep, setEmailStep] = useState(0);
  const [loading, setLoading] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");


  async function connectWithEmail() {
    console.log("Enter connectWithEmail");
    Haptics.selectionAsync();

    /** Make sure we don't submit the request twice */
    if(loading) {
      console.log("Connect is already loading.");
      return;
    }

    /** Follow login steps */
    switch (emailStep) {
      /** Trigger verification email flow */
      case 0:
        if(isValidEmail(email)) {
          /** Start loading state */
          setLoading(true);

          /** Will trigger the connection flow by sending an OTP code to this email address */
          try {
            let resUser = await orbis.connect_v2({
              provider: "oauth",
              oauth: {
                type: "email",
                userId: email
              }
            });
            console.log("resUser:", resUser);

            /** Show success state and open step 2 */
            setEmailStep(1);
            setLoading(false);

          } catch(e) {
            console.log("Error logging in:", e);
            alert("There was an error logging in.");
          }

        } else {
          alert("You must use a valid email address.");
        }
        break;

      /** Submit email address with OTP */
      case 1:
        if(isValidEmail(email)) {
          setLoading(true);

          /* Submit OTP and Email to receive session string if valid */
          res = await orbis.connect_v2({
            provider: "oauth",
            oauth: {
              type: "email",
              userId: email,
              code: otp
            }
          })
          console.log("res connect:", res);
          if(res.status == 200) {
            console.log("Successfully connect user.");
            setUser(res.details);
            setShowConnectModal(false);
            confetti.current.start();
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } else {
            console.log("res:", res);
            alert('Error logging in, please retry.');
          }
          setLoading(false);
        } else {
          alert('Invalid email:' + email);
        }
        break;

    }
  }

  switch (emailStep) {
    case 0:
      return(
        <>
          <TextInput value={email} onChangeText={setEmail} style={[tailwind('bg-white px-5 py-3 rounded-full border-slate-300 border w-full mb-1')]} placeholder="Your email address" placeholderTextColor="#94a3b8" />
          <Button onPress={() => connectWithEmail()} color="black" title={loading ? <ActivityIndicator size="small" color="#fff" /> : "Verify email" } />
        </>
      );
    case 1:
      return(
        <>
          <TextInput inputMode="email" value={email} disabled style={[tailwind('bg-slate-50 text-slate-500 px-5 py-3 rounded-full border-slate-300 border w-full mb-1')]} placeholder="Your email address" placeholderTextColor="#94a3b8" />
          <Text style={tailwind('text-sm text-gray-600 text-center mt-2 mb-1')}>Enter your login code here:</Text>
          <TextInput autoFocus={true} value={otp} onChangeText={setOtp} style={[tailwind('bg-white px-5 py-3 rounded-full border-slate-300 border w-full mb-1')]} placeholder="Enter your code here" placeholderTextColor="#94a3b8" />
          <Button onPress={() => connectWithEmail()} color="black" title={loading ? <ActivityIndicator size="small" color="#fff" /> : "Connect" } />
        </>
      );
    default:
      return null
  }
}

/** Connect using QR code scanning with camera */
function ConnectWithQR() {
  const { user, setUser, orbis, setShowConnectModal } = useContext(GlobalContext);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');

  /** Will trigger a native modal to ask for camera's permission */
  async function askCameraPermission() {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }

  /** Triggered when qr code is scanned with success, we use the data to connect the user */
  async function handleBarCodeScanned({ type, data }) {
    let { path, queryParams } = Linking.parse(data);
    setScanned(true);

    /** Save did and encrypted seed in localStorage */
    await AsyncStorage.setItem('ceramic-session', queryParams.sessionString);

    /** Connect to account */
    let res = await orbis.isConnected();
    if(res.status == 200) {
      setUser(res.details);
    }

    /** Hide connect modal */
    setShowConnectModal(false);
  };

  /** Hide connect modal */
  function back() {
    setShowConnectModal(false);
  }

  /** BarCode Scanner container */
  if(hasPermission) {
    return(
      <View style={[tailwind('absolute w-full h-full flex'), { backgroundColor: "rgba(0,0,0,0.7)" }]}>
        <SafeAreaView style={[tailwind('w-full flex flex-col justify-center'), { top: 100, borderRadius: 26, height: width }]} >
          <View style={tailwind("w-full flex items-end pr-6")}>
            <Button color="gray-100" title="Close" onPress={() => back()} />
          </View>
          <View style={[tailwind('bg-white w-full rounded-md m-4'), {overflow: "hidden", marginLeft: width * 0.05, width: width * 0.9, height: width * 0.9}]}>
            {scanned ?
              <Text style={tailwind("text-gray-900 text-sm text-center pt-3")}>Connecting...</Text>
            :
              <BarCodeScanner onBarCodeScanned={scanned ? undefined : handleBarCodeScanned} style={[tailwind('w-full h-full'), {  }]} />
            }
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return(
    <View style={tailwind('h-full w-full p-6 bg-white z-50')}>
      <View style={{flexDirection: "column", paddingHorizontal: 35, marginTop: 25}}>
        <Text style={tailwind('text-lg font-medium text-gray-900 text-center mt-4')}>Connect to your account</Text>
        <View style={{flexDirection: "row", alignItems: "flex-start", justifyContent:"center", marginBottom: 20}}>
          <Text style={tailwind('text-sm text-gray-600 text-center mt-1')}><Text style={tailwind('text-gray-900 font-medium')}>#1.</Text> Open app.orbis.club on your desktop.</Text>
        </View>

        <View style={{flexDirection: "row", alignItems: "flex-start", justifyContent:"center", marginBottom: 20}}>
          <Text style={tailwind('text-sm text-gray-600 text-center mt-1')}><Text style={tailwind('text-gray-900 font-medium')}>#2.</Text> Connect and click on the three dots icon on the top-right.</Text>
        </View>

        <View style={{flexDirection: "row", alignItems: "flex-start", justifyContent:"center", marginBottom: 20}}>
          <Text style={tailwind('text-sm text-gray-600 text-center mt-1')}><Text style={tailwind('text-gray-900 font-medium')}>#3.</Text> Click on "Connect with mobile" and scan the QR code.</Text>
        </View>
      </View>

      {hasPermission === null &&
        <View style={{alignItems: "center", justifyContent: "center", marginTop: 10, flexDirection: "row"}}>
          <View style={tailwind('mr-2')}>
            <Button color="gray-100" title="Back" onPress={() => back()} />
          </View>
          <Button onPress={() => askCameraPermission()} color="blue" title="Open camera" />
        </View>
      }

      {hasPermission === false &&
        <Text style={tailwind('text-sm text-red-600 text-center mt-1')}>We don't have access to the camera. Please enable it.</Text>
      }
    </View>
  );
}
