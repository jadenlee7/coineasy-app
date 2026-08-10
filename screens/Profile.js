import React, { useContext } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from "../contexts/GlobalContext";
import ProfileDetails from "../components/ProfileDetails";
import Header from "../components/Header";
import useSocialProfile from "../hooks/useSocialProfile";
import { adaptSocialProfile, getEasyGoUserId } from "../utils/socialPostAdapter";

const Profile = ({ navigation, route }) => {
    const { user } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const userId = getEasyGoUserId(user);
    const { profile: backendProfile, loading, error, refresh } = useSocialProfile(userId);
    const profile = backendProfile ? adaptSocialProfile(backendProfile) : user;


    return(
        <>
            {profile ?
                <ProfileDetails profile={profile} refreshProfile={refresh} />
            :
                <View style={tailwind('flex-1 bg-white')}>
                    <Header />
                    {loading ?
                        <ActivityIndicator style={{marginTop: 60}} size="small" color="#020617" />
                    :
                        <View style={tailwind('mx-6 mt-20 rounded-md bg-slate-50 px-5 py-5 items-center')}>
                            <Text style={[tailwind('text-slate-900 text-center'), {fontFamily: 'GmarketBold'}]}>Profile unavailable</Text>
                            <Text style={[tailwind('text-secondary text-center'), {marginTop: 8}]}>We couldn't load your EasyGo profile.</Text>
                            {error &&
                                <TouchableOpacity onPress={refresh} style={{marginTop: 14, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9}}>
                                    <Text style={{color: 'white', fontFamily: 'GmarketBold'}}>Try again</Text>
                                </TouchableOpacity>
                            }
                        </View>
                    }
                </View>
            }

        </>
  )
}

export default Profile
