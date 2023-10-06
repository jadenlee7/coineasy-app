import React, { useContext, useState, useEffect } from "react";
import { Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from "tailwind-rn";

import { GlobalContext } from "../../contexts/GlobalContext";
import ProfileDetails from "../../components/ProfileDetails";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon } from "../../components/Icons";

const ProfileSelected = ({navigation, route}) => {

    const { did } = route.params
    const { orbis } = useContext(GlobalContext);
    const statusBarHeight = useStatusBarHeight();
    const tailwind = useTailwind();

    const [ profile, setProfile ] = useState();

    useEffect(() => {
        getProfile();
    }, [did]);

    async function getProfile() {
        const { data, error } = await orbis.getProfile(did);
        setProfile(data);
    }



    return(
        <View style={{flex: 1}}>
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../../assets/HeaderBg.png')} 
            />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 10,paddingRight: 20,paddingTop: 5,}}>
                <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <View style={{zIndex:100000, justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>

            {profile ? (
                <ProfileDetails profile={profile?.details} />
            ) : (
                <View style={{backgroundColor: 'white',height: 800, width:'100%'}} />
            )}
        </View>
    )
}

export default ProfileSelected
