import React, { useState, useContext } from "react";
import { Text, View, TouchableOpacity, Image } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';

import ConnectModal from "../components/modals/ConnectModal";

export default function Login() {
    const tailwind = useTailwind();
    const [connectModalVis, setConnectModalVis] = useState(false);

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
                resizeMode="cover"
                style={[tailwind('w-full h-full')]}
                source={require('../assets/LoginBG.png')} 
            />

            <View style={[tailwind('w-full h-full absolute px-8 items-center'), {paddingTop: 350}]}>
                <View style={[tailwind('absolute w-full'), {bottom: 115}]}>

                    <TouchableOpacity activeOpacity={0.8} style={[tailwind('rounded-full py-2.5 text-center bg-slate-900 border-2 border-slate-900 mt-4')]} onPress={() => setConnectModalVis(true)}>
                        <Text style={[tailwind(`text-white px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Register</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[tailwind('rounded-full py-2.5 text-center bg-white mt-2 border-2 border-slate-900')]} onPress={() => setConnectModalVis(true)} activeOpacity={0.8}>
                        <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Login</Text>
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

            <View style={{position: 'absolute',bottom: 50,width: '100%',alignItems: 'center',}}>
                <Text>By signing up an account, I agree to the</Text>
                <View style={{flexDirection: 'row'}}>
                    <TouchableOpacity onPress={() => openTerms()}>
                        <Text style={{textDecorationLine: 'underline', fontWeight: 'bold',}}>Terms & Conditions</Text>
                    </TouchableOpacity>
                    <Text> and </Text>
                    <TouchableOpacity onPress={() => openPrivacy()}>
                        <Text style={{textDecorationLine: 'underline', fontWeight: 'bold',}}>Privacy policy</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {connectModalVis &&
                <ConnectModal hide={() => setConnectModalVis(false)} />
            }

        </View>
    )
}
