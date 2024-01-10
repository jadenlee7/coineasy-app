import React, { useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from "../../contexts/GlobalContext";
import { BackIcon } from "../../components/Icons";
import HeaderImage from "../../components/HeaderImage";

import FollowerScreen from "./FollowerScreen";
import FollowingScreen from "./FollowingScreen";
import CommonFollowerScreen from "./CommonFollowerScreen";

import { TabBar, TabView } from 'react-native-tab-view';

const TabBarHeight = 44;
const IndicatorWidth = 80

const FollowNavigation = ({navigation, route}) => {
    const { orbis, user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { origin, profile, type, listCommonFollowers } = route.params

    const [list_followers, setList_followers ] = useState([]);
    const [list_following, setList_following ] = useState([]);
    const [followLoading, setFollowLoading ] = useState(false);
    const [refreshing, setRefreshing] = useState(false)
    const [doFollowLoading, setDoFollowLoading] = useState(false);
    
    const [list_own_followers, setList_own_followers ] = useState([]);
    const [list_own_following, setList_own_following ] = useState([]);

    /** Fetch follows */
    useEffect(() => {
        getListFollow();

        /** Will load main post details */
        async function getListFollow() {
            setFollowLoading(true);

            const result_followers = await orbis.getProfileFollowers(profile.did)
            const result_following = await orbis.getProfileFollowing(profile.did)
            
            // If user visits another profile, We'll fetch his own followers/following to compare the two lists
            if(type == 'selected'){
                const result_own_followers = await orbis.getProfileFollowers(user.did)
                const result_own_following = await orbis.getProfileFollowing(user.did)

                setList_own_followers(result_own_followers.data)
                setList_own_following(result_own_following.data)
            }

            setList_followers(result_followers.data);
            setList_following(result_following.data);
            setFollowLoading(false);
        }
    }, []);

    const [tabIndex, setIndex] = useState(origin == 'Followers' ? 0 : 1);
    const routes = [
        {key:0, title: 'Followers'},
        {key:1, title: 'Following'},
        {key:2, title: 'Mutual'},
    ];
    
    const renderLabel = ({route, focused}) => { 
        return ( 
            <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>{route.title}</Text>
        );
    };

    const renderScene = ({route}) => {
        if(followLoading){
            return <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
        }else{
            if(route.key == 0 ) return <FollowerScreen profile={profile} type={type} followers={list_followers} following={list_following} own_followers={list_own_followers} own_following={list_own_following} listCommonFollowers={listCommonFollowers}/>
            if(route.key == 1 ) return <FollowingScreen profile={profile} type={type} followers={list_followers} following={list_following} own_followers={list_own_followers} own_following={list_own_following} listCommonFollowers={listCommonFollowers}/>
            if(route.key == 2 ) return <CommonFollowerScreen profile={profile} own_followers={list_own_followers} listCommonFollowers={listCommonFollowers}/>
        }
    };
 
    const renderTabBar = (props) => {
        return (
            <TabBar
                {...props}
                style={styles.tab}
                renderLabel={renderLabel}
                indicatorStyle={[styles.indicator, { width: IndicatorWidth, left: (Dimensions.get('window').width / 3 - IndicatorWidth) / 2 }]}
            />
        );
    };

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
            </View>

            <TabView
                navigationState={{index: tabIndex, routes}}
                onIndexChange={(id) => { setIndex(id);}}
                renderScene={renderScene}
                renderTabBar={renderTabBar}
            />

        </View>
    )
}

export default FollowNavigation

const styles = StyleSheet.create({
    label: {
        fontSize: 18,
        fontWeight: 'bold',
        // color: 'white'
    },
    tab: {
        elevation: 0,
        shadowOpacity: 0,
        backgroundColor: 'white',
        height: TabBarHeight,
        marginTop: -10,
    },
    indicator: {
        height: 4, 
        borderRadius: 10,
        width: '20%',
        backgroundColor: '#FF6B17'
    },
})