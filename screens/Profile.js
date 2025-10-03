import React, { useState, useContext, useEffect } from "react";
import { View, Image, ActivityIndicator, Dimensions } from 'react-native';

import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from "../contexts/GlobalContext";
import ProfileDetails from "../components/ProfileDetails";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import HeaderImage from "../components/HeaderImage";
import Header from "../components/Header";

const Profile = ({ navigation, route }) => {
    const { user, setUser, orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();

    const [profile, setProfile] = useState();

    useEffect(() => {
        getProfile();
    }, [user]);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function getProfile() {
        const { data, error } = await orbis.getProfile(user.did);

        if(error?.message == 'FetchError: Network request failed'){
            await delay(2000);
            const resultRetry = await orbis.getProfile(user.did);
            if(resultRetry.error?.message == 'FetchError: Network request failed'){
                alert('FetchError: Network request failed')
            }else{
                setProfile(resultRetry.data)
            }
        }else{
            setProfile(data);
        }
    }


    return(
        <>
            {profile ?
                <ProfileDetails profile={profile.details} />
            :
                <View style={tailwind('flex-1 bg-white')}>
                    <Header />
                    
                    <ActivityIndicator style={{marginTop: 60}} size="small" color="#020617" />
                </View>
            }

        </>
  )
}

export default Profile
