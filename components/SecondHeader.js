import React, { useContext } from "react";
import { Text, View, TouchableOpacity } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon, SettingsIcon } from "./Icons";
import { useNavigation } from "@react-navigation/core";

const SecondHeader = (props) => {

    const { setSettingsVis, screen, profileSelected, category } = useContext(GlobalContext);
    const {label, showBack = true, cta = "notifications", back} = props
    const tailwind = useTailwind();

    const navigation = useNavigation();

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
                <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();back()}}>
                    <>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </>
                </TouchableOpacity>
            )
        } else if(postDetailsVis && showBack) {
            return(
                <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hidePostPane()}>
                    <>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </>
                </TouchableOpacity>
            )
        } else if(profileSelected && showBack) {
            return(
                <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hideProfilePane()}>
                    <>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </>
                </TouchableOpacity>
            )
        } else {
            return(
                <Text style={[tailwind('text-slate-900 px-2'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20 }]}>{label}</Text>
            )
        }
    }

  return(
    <View style={{marginTop: screen == 'home' ? 0 : 40 + useStatusBarHeight(),}}>
        <View style={[tailwind('flex flex-row items-center px-3 pt-3'), {minHeight: 50, backgroundColor: 'white', paddingBottom: screen == 'home' && !profileSelected ? 30 : 0 }]}>

        {/** Back button */}
        <View style={[tailwind('flex flex-1 items-start pt-1'),]}>
            <HeaderLabel label={label} showBack={label == 'GM! CoinEasy Frens!' ? false : showBack} back={back} />
        </View>

        {/** Notifications button */}
        {cta == "notifications" &&
            <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-2'),{marginTop: category ? -4 : -1,}]} activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                <NotificationsIcon />
            </TouchableOpacity>
        }

        {/** Settings button */}
        {cta == "settings" &&
            <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-2')]} activeOpacity={0.7} onPress={() => setSettingsVis(true)}>
                <SettingsIcon />
            </TouchableOpacity>
        }
        </View>
    </View>
  )
}

export default SecondHeader
