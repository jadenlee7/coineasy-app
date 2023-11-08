import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, TouchableOpacity, RefreshControl } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { context } from "../../utils/config";
import TimeAgo from "../../components/TimeAgo";
import { UserPfp, Username } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import { BackIcon, InterpunctIcon, NotificationsIcon } from "../../components/Icons";
import HeaderImage from "../../components/HeaderImage";

const FollowDetails = ({navigation, route}) => {
    const { orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { origin, profile } = route.params

    const [ list_follow, setList_follow ] = useState([]);
    const [ followLoading, setFollowLoading ] = useState(false);
    const [refreshing, setRefreshing] = useState(false)

    /** Check if user liked this post */
    useEffect(() => {
        getListFollow();

        /** Will load main post details */
        async function getListFollow() {
            setFollowLoading(true);

            const { data, error } = origin == 'Followers' ? await orbis.getProfileFollowers(profile.did) : await orbis.getProfileFollowing(profile.did)

            if(data) {
                setList_follow(data);
                setFollowLoading(false);
            }
        }
    }, []);

    const Follow = ({follow}) => {      
        return(
            <TouchableOpacity style={tailwind("items-center flex flex-row border-b border-secondary py-3 px-6 ")} underlayColor="#f1f5f9" onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: follow.details.did })}}>
                <>
                    <UserPfp details={follow.details} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex flex-row items-center mb-1")}>
                            <Text style={tailwind("text-secondary")}>
                                <Username details={follow.details} />
                            </Text>
                        </View>
                    </View>
                </>
            </TouchableOpacity>
        )
    }
    

    async function updateFollow() {
        setRefreshing(true)

        const { data, error } = origin == 'Followers' ? await orbis.getProfileFollowers(profile.did) : await orbis.getProfileFollowing(profile.did)
        if(data) {
            setList_follow(data);
        }

        setRefreshing(false)
    }


    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 5}}>
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

            {followLoading ?
                <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
            : list_follow && list_follow.length > 0 ?
                <ScrollView
                    refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={updateFollow} /> }
                >
                    {list_follow.map((follow, key) => {
                        return (
                            <Follow follow={follow} key={key} />
                        );
                    })}
                </ScrollView>
            :
                <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any {origin}.</Text>
                </View>
            }
        </View>
    )
}

export default FollowDetails
