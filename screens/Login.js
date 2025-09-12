import React, { useState, useContext, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, Image, Animated, Easing, Dimensions, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';

import ConnectModal from "../components/modals/ConnectModal";
import { GlobalContext } from "../contexts/GlobalContext";

export default function Login() {
    const { connectType, setConnectType, connectModalVis, setConnectModalVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    async function openTerms() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing");
    }

    async function openPrivacy() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing");
    }

    return(
        <View style={tailwind('w-full h-full')}>
            <Image
                resizeMode="stretch"
                style={[tailwind('w-full h-full')]}
                source={require('../assets/login_background.png')} 
            />


            <View style={[tailwind('w-full h-full absolute px-7 items-center')]}>
                <View style={[tailwind('absolute w-full'), {top: '55%'}]}>

                    <Image
                        resizeMode="cover"
                        style={{position: 'absolute',width: 128, height: 128, top: -95}}
                        source={require('../assets/login_icon_background.png')} 
                    />
                    <TouchableOpacity 
                        activeOpacity={0.8} 
                        style={[
                            tailwind('rounded-full text-center bg-slate-900 border-2 border-slate-900 mt-4'), 
                            {
                                paddingTop: Platform.OS == 'ios' ? 12 : 10,
                                paddingBottom: Platform.OS == 'ios' ? 12 : 10
                            }
                        ]}
                        onPress={() => {Haptics.selectionAsync();setConnectModalVis(true);setConnectType('signup')}}
                    >
                        <Text style={[tailwind(`text-white px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Sign up</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            tailwind('rounded-full text-center bg-white mt-2 border-2 border-slate-900'),
                            {
                                paddingTop: Platform.OS == 'ios' ? 12 : 10,
                                paddingBottom: Platform.OS == 'ios' ? 12 : 10
                            }
                        ]} 
                        onPress={() => {Haptics.selectionAsync();setConnectModalVis(true);setConnectType('signin')}} 
                        activeOpacity={0.8}
                    >
                        <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Sign in</Text>
                    </TouchableOpacity>

                    <View style={[tailwind(`w-full items-center`), {marginTop: 25}]}>
                        <Image
                            resizeMode="cover"
                            style={{width: 159 * 0.9, height: 22.7 * 0.9}}
                            source={require('../assets/powered_by_orbis.png')} 
                        />
                    </View>

                </View>
            </View>

            <View style={{position: 'absolute',bottom: 100,width: '100%',alignItems: 'center',}}>
                <Text style={{color:'black'}}>By signing up an account, I agree to the</Text>
                <View style={{flexDirection: 'row'}}>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();openTerms()}}>
                        <Text style={{textDecorationLine: 'underline', fontWeight: 'bold',color:'black'}}>Terms & Conditions</Text>
                    </TouchableOpacity>
                    <Text style={{color:'black'}}> and </Text>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();openPrivacy()}}>
                        <Text style={{textDecorationLine: 'underline', fontWeight: 'bold',color:'black'}}>Privacy policy</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {connectModalVis &&
                <ConnectModal hide={() => setConnectModalVis(false)} type={connectType}/>
            }

        </View>
    )
}
