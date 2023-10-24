import React, { useContext, useState, useEffect } from "react";
import { ActivityIndicator, Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from "tailwind-rn";

import { GlobalContext } from "../../contexts/GlobalContext";
import ProfileDetails from "../../components/ProfileDetails";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon } from "../../components/Icons";
import HeaderImage from "../../components/HeaderImage";

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

            {profile ? (
                <ProfileDetails profile={profile?.details} pfpMarginTop={0} type='selected'/>
            ) : (
                <View style={tailwind('w-full flex-1 bg-white')}>
                    <HeaderImage />

                    
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

                    <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
                </View>
            )}
        </View>
    )
}

export default ProfileSelected
