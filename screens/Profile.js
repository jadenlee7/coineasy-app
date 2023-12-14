import React, { useState, useContext, useEffect } from "react";
import { View, Image, ActivityIndicator, Dimensions } from 'react-native';

import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from "../contexts/GlobalContext";
import ProfileDetails from "../components/ProfileDetails";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import HeaderImage from "../components/HeaderImage";

const Profile = ({ navigation, route }) => {
    const { user, setUser, orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();

    const [profile, setProfile] = useState();

    useEffect(() => {
        getProfile();
    }, [user]);

    async function getProfile() {
        const { data, error } = await orbis.getProfile(user.did);
        setProfile(data);
    }


    return(
        <>
            {profile ?
                <ProfileDetails profile={profile.details} />
            :
                <View style={tailwind('flex-1 bg-white')}>
                    <HeaderImage />
                    
                    <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
                </View>
            }

        </>
  )
}

export default Profile
