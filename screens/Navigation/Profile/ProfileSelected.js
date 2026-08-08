import React, { useEffect } from "react";
import { ActivityIndicator, BackHandler, Image, Text, TouchableOpacity, View } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from "tailwind-rn";

import HeaderImage from "../../../components/HeaderImage";
import ProfileDetails from "../../../components/ProfileDetails";
import { NotificationsIcon } from "../../../components/Icons";
import useSocialProfile from "../../../hooks/useSocialProfile";
import { adaptSocialProfile, getEasyGoUserId } from "../../../utils/socialPostAdapter";
import { normalizeEasyGoRouteId } from '../../../utils/navigationIntent.mjs';

const ProfileSelected = ({navigation, route}) => {

    const { did, back, userId: routeUserId } = route.params || {}
    const tailwind = useTailwind();
    const userId = normalizeEasyGoRouteId(routeUserId || getEasyGoUserId(did));
    const { profile: backendProfile, loading, error, refresh } = useSocialProfile(userId);
    const profile = adaptSocialProfile(backendProfile);

    useEffect(() => {
        const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
            if(back == 'search'){
                Haptics.selectionAsync()
                navigation.navigate('Search')
                return true;
            }
            return false;
        })
        return () => backhandler.remove();
    }, [back, navigation])

    return(
        <View style={{flex: 1}}>

            {!loading && profile ? (
                <ProfileDetails profile={profile} refreshProfile={refresh} pfpMarginTop={0} type='selected'/>
            ) : (
                <View style={tailwind('w-full flex-1 bg-white')}>
                    <HeaderImage />

                    
                    <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4,}}>
                        <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                            <Image
                                style={{width: 24,height: 24}}
                                resizeMode='contain'
                                source={require('../../../assets/back_button.png')}
                                defaultSource={require('../../../assets/back_button.png')}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                            <NotificationsIcon />
                        </TouchableOpacity>
                    </View>

                    {loading ?
                        <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
                    :
                        <View style={tailwind('mx-6 mt-8 rounded-md bg-slate-50 px-5 py-5 items-center')}>
                            <Text style={{fontFamily: 'GmarketBold', color: '#0F172A'}}>Profile unavailable</Text>
                            <Text style={[tailwind('text-secondary text-center'), {marginTop: 8}]}>
                                {!userId ? 'This legacy profile has not migrated to EasyGo yet.' : "We couldn't load this EasyGo profile."}
                            </Text>
                            {error &&
                                <TouchableOpacity onPress={refresh} style={{marginTop: 14, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9}}>
                                    <Text style={{color: 'white', fontFamily: 'GmarketBold'}}>Try again</Text>
                                </TouchableOpacity>
                            }
                        </View>
                    }
                </View>
            )}
        </View>
    )
}

export default ProfileSelected
