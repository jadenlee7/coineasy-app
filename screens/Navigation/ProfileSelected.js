import React, { useContext, useState, useEffect } from "react";
import { Dimensions, Image, TouchableOpacity, View } from 'react-native';

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

            <TouchableOpacity onPress={() => navigation.goBack()} style={{position: 'absolute', top:65, left: 0,zIndex: 2}}>
                <View style={{zIndex:100000, width:40,height: 40, borderRadius: 50,justifyContent: 'center',alignItems: 'center',margin: 15, elevation:8, backgroundColor: 'white',}}>
                    <BackIcon />
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={{position: 'absolute',top: 90,right: 30,zIndex: 2,}} activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')}>
                <NotificationsIcon />
            </TouchableOpacity>

            {profile ? (
                <ProfileDetails profile={profile?.details} />
            ) : (
                <View style={{backgroundColor: 'white',height: 800, width:'100%'}} />
            )}
        </View>
    )
}

export default ProfileSelected
