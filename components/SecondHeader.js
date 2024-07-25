import React, { useContext } from "react";
import { Text, View, TouchableOpacity, Image } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon, SettingsIcon, TelegramIcon } from "./Icons";
import { useNavigation } from "@react-navigation/core";

const SecondHeader = (props) => {

    const { setSettingsVis, screen, profileSelected, category, userData } = useContext(GlobalContext);
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
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../assets/back_button.png')}
                        defaultSource={require('../assets/back_button.png')}
                    />
                </TouchableOpacity>
            )
        } else if(postDetailsVis && showBack) {
            return(
                <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hidePostPane()}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../assets/back_button.png')}
                        defaultSource={require('../assets/back_button.png')}
                    />
                </TouchableOpacity>
            )
        } else if(profileSelected && showBack) {
            return(
                <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-3')]} activeOpacity={0.7} onPress={() => hideProfilePane()}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../assets/back_button.png')}
                        defaultSource={require('../assets/back_button.png')}
                    />
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
            <View 
                style={
                    [
                        tailwind('flex flex-row items-center px-3 pt-3'), 
                        {
                            minHeight: 50,
                            backgroundColor: 'white',
                            paddingBottom: screen == 'home' && !profileSelected ? 30 : 0,
                        }
                    ]
                }
            >

                {/** Back button */}
                <View style={[tailwind('flex flex-1 items-start pt-1'),]}>
                    <HeaderLabel label={label} showBack={label == '' ? false : showBack} back={back} />
                </View>

                {/** Notifications button */}
                {cta == "notifications" &&
                    <>
                        <TouchableOpacity 
                            onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeReward')}}
                            style={{borderRadius: 30,borderWidth:1,borderColor:'black', backgroundColor: '#FFF2E2',flexDirection:'row',gap: 6,alignSelf:'flex-end',marginRight: 5,paddingVertical: 5, paddingHorizontal:10}}
                        >
                            <Image
                                style={{width: 20, height: 20}}
                                resizeMode='contain'
                                source={require('../assets/orange_icon.png')}
                            />
                            <Text style={{fontWeight: 'bold',}}>
                                {userData?.numberOranges && userData?.numberOranges.toString().length <= 3 ? userData?.numberOranges
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 4 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 5 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 6 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 7 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)+','+userData?.numberOranges.toString().slice(4,7)
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 8 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)+','+userData?.numberOranges.toString().slice(5,8)
                                    : userData?.numberOranges && userData?.numberOranges.toString().length == 9 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)+','+userData?.numberOranges.toString().slice(6,9)
                                    : 0
                                }
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[tailwind('flex flex-row items-center rounded-md py-2 px-2'),{marginTop: category ? -4 : 1,}]} activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                            <NotificationsIcon />
                        </TouchableOpacity>
                    </>
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
