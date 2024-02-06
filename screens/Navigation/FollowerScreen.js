import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableOpacity, RefreshControl } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { UserPfp, Username } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import Button from "../../components/Button";
import { useNavigation } from "@react-navigation/core";

const FollowerScreen = (props) => {
    const { orbis, user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const navigation = useNavigation()

    const { profile, type, followers, following, own_followers, own_following } = props

    const [refreshing, setRefreshing] = useState(false)
    
    const [list_followers, setList_followers ] = useState(followers);
    const [list_following, setList_following ] = useState(following);
    const [list_own_followers, setList_own_followers] = useState(own_followers);
    const [list_own_following, setList_own_following] = useState(own_following);

    const [listFollowLoader, setListFollowLoader] = useState([])


    const Follow = ({follow, index}) => {    

        /** Will follow the user */
        async function doFollow (follow, index_follow, active) {
            listFollowLoader[index_follow] = true
            setListFollowLoader([...listFollowLoader])

            if(active){
                if(type == 'selected'){
                    list_own_following.push(follow)
                    setList_own_following([...list_own_following])
                }else{
                    list_following.push(follow)
                    setList_following([...list_following])
                }
            }else{
                if(type == 'selected'){
                    const temp_list = list_own_following.filter(e => e.details.did != follow.details.did)
                    setList_own_following([...temp_list])
                }else{
                    const temp_list = list_following.filter(e => e.details.did != follow.details.did)
                    setList_following([...temp_list])
                }
            }

            const res = await orbis.setFollow(follow.details.did, active);

            listFollowLoader[index_follow] = false
            setListFollowLoader([...listFollowLoader])
        }

        const is_follower = type == 'selected' ? list_own_followers?.findIndex(e => e.details.did == follow.details?.did) : list_followers?.findIndex(e => e.details.did == follow.details?.did)
        const is_following = type == 'selected' ? list_own_following?.findIndex(e => e.details.did == follow.details?.did) : list_following?.findIndex(e => e.details.did == follow.details?.did)

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

                {is_following == -1 && follow.details.did != user.did ? (
                    <Button 
                        loading={listFollowLoader[index]} 
                        title={is_follower == -1 ? 'Follow' : 'Follow back'} 
                        color="orange" 
                        size="sm" 
                        onPress={() => doFollow(follow, index, true)} 
                        style={{height: 40, justifyContent: 'center',alignItems: 'center',minWidth: 120}}
                    />
                ) : follow.details.did != user.did ? (
                    <Button 
                        loading={listFollowLoader[index]} 
                        title="Following" 
                        color="white" 
                        size="sm" 
                        onPress={() => doFollow(follow, index, false)} 
                        style={{borderColor: 'black',height: 40, justifyContent: 'center',alignItems: 'center',width: 120}}
                    />
                ) : null}

            </View>
        )
    }
    

    async function updateFollow() {
        setRefreshing(true)

        const result_followers = await orbis.getProfileFollowers(profile.did)
        const result_following = await orbis.getProfileFollowing(profile.did)
        
        // If user visits another profile, We'll fetch his own followers/following to compare the two lists
        if(type == 'selected'){
            const result_own_followers = await orbis.getProfileFollowers(user.did)
            const result_own_following = await orbis.getProfileFollowing(user.did)

            setList_own_followers(result_own_followers.data)
            setList_own_following(result_own_following.data)                
            
            // Switch own followers to first place
            // for the followers and following tabs
            let list_common_for_followers = []
            for (let i = 0; i < result_own_following.data.length; i++) {
                for (let j = 0; j < result_followers.data.length; j++) {
                    if (result_own_following.data[i].details.did === result_followers.data[j].details.did) {
                        list_common_for_followers.push(result_followers.data[j].details.did)
                    }
                }
            }

            let list_common_for_following = []
            for (let i = 0; i < result_own_following.data.length; i++) {
                for (let j = 0; j < result_following.data.length; j++) {
                    if (result_own_following.data[i].details.did === result_following.data[j].details.did) {
                        list_common_for_following.push(result_following.data[j].details.did)
                    }
                }
            }

            list_common_for_followers.map(elt => {
                const indexItem = result_followers.data.findIndex(e => e.details.did == elt)
                const switch_element = result_followers.data.splice(indexItem, 1)[0];
                result_followers.data.splice(0, 0, switch_element);
            })
            list_common_for_following.map(elt => {
                const indexItem = result_following.data.findIndex(e => e.details.did == elt)
                const switch_element = result_following.data.splice(indexItem, 1)[0];
                result_following.data.splice(0, 0, switch_element);
            })

            setList_followers(result_followers.data);
            setList_following(result_following.data);
            setRefreshing(false)
        }else{

            // Switch own followers to first place
            // for the followers tab
            let list_common = []
            for (let i = 0; i < result_following.data.length; i++) {
                for (let j = 0; j < result_followers.data.length; j++) {
                    if (result_following.data[i].details.did === result_followers.data[j].details.did) {
                        list_common.push(result_followers.data[j].details.did)
                    }
                }
            }

            list_common.map(elt => {
                const indexItem = result_followers.data.findIndex(e => e.details.did == elt)
                const switch_element = result_followers.data.splice(indexItem, 1)[0];
                result_followers.data.splice(0, 0, switch_element);
            })

            setList_followers(result_followers.data);
            setList_following(result_following.data);
            setRefreshing(false)
        }
    }


    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <ScrollView
                refreshControl={ 
                    <RefreshControl refreshing={refreshing} onRefresh={updateFollow} /> 
                }
            >
                { list_followers.length != 0 ? list_followers.map((follow, index) => {
                    return (
                        <Follow follow={follow} index={index} key={Math.random()}/>
                    );
                }) : (
                    <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                        <Text style={tailwind('text-secondary items-center ml-1')}>
                            {type == 'selected' && profile.profile ? profile.profile.username+' doesn\'t' : type == 'selected' ? 'This user doesn\'t' : 'You don\'t'} have any followers.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

export default FollowerScreen
