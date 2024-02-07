import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableOpacity, RefreshControl } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { UserPfp, Username } from "../../../components/User";
import { GlobalContext } from "../../../contexts/GlobalContext";
import Button from "../../../components/Button";
import { useNavigation } from "@react-navigation/core";

const CommonFollowerScreen = (props) => {
    const { orbis, user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const navigation = useNavigation()

    const { profile, own_followers, listCommonFollowers } = props

    const [refreshing, setRefreshing] = useState(false)
    const [listMutualFollowers, setListMutualFollowers] = useState(listCommonFollowers)

    const Follow = ({follow, index}) => {

        const is_follower = own_followers?.findIndex(e => e.details.did == follow.details?.did)

        return (
            <View style={[tailwind("items-center flex flex-row border-b border-secondary"), {justifyContent: 'space-between',paddingRight: 10,}]}>
                <TouchableOpacity 
                    style={tailwind("items-center flex flex-row py-3 px-6 ")} 
                    underlayColor="#f1f5f9"
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: follow.details.did })}}
                >
                    <UserPfp details={follow.details} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex mt-1")}>
                            <Text style={[tailwind("text-secondary"), {maxWidth: 150}]} numberOfLines={1}>
                                <Username details={follow.details}/>
                            </Text>
                            {is_follower != -1 && (
                                <Text style={tailwind("text-secondary")}>Follows you</Text>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                <Button 
                    title="Following" 
                    color="white" 
                    size="sm" 
                    style={{borderColor: 'black',height: 40, justifyContent: 'center',alignItems: 'center',width: 120}}
                />
            </View>
        )
    }
    

    async function updateMutualFollow() {
        setRefreshing(true)

        const result_selected_followers = await orbis.getProfileFollowers(profile.did)
        const result_own_followers = await orbis.getProfileFollowers(user.did)

        let common_followers = []
        result_selected_followers?.data?.forEach(e => {
            result_own_followers?.data?.map(elt => {
                if(elt.details.did == e.details.did){
                    if(e.details.profile && e.details.profile.username){
                        common_followers.push(e)
                    }
                }
            })
        })

        setListMutualFollowers(common_followers);
        setRefreshing(false)
    }


    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <ScrollView
                refreshControl={ 
                    <RefreshControl refreshing={refreshing} onRefresh={updateMutualFollow} /> 
                }
            >
                { listMutualFollowers?.length != 0 ? listMutualFollowers.map((follow, index) => {
                    return (
                        <Follow follow={follow} index={index} key={Math.random()}/>
                    );
                }) : (
                    <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                        <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any mutual followers.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

export default CommonFollowerScreen
