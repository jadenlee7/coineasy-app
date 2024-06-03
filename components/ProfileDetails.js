import React, { useState, useContext, useEffect, useRef, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Linking, Alert, Image, Dimensions, StyleSheet } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as Clipboard from 'expo-clipboard';
import Animated from 'react-native-reanimated';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/core";
import { TabBar, TabView } from "react-native-tab-view";
import ImageViewer from "react-native-image-zoom-viewer";
import { useScrollToTop } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer'
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";


import Post from "./Post";
import Button from "./Button";
import Modal from "./Modal.js";
import HeaderImage from "./HeaderImage";
import { shortAddress } from "../utils";
import { UserPfp, Username } from "./User";
import { context } from '../utils/config.js';
import SettingsModal from "./modals/SettingsModal";
import useDidToAddress from "../hooks/useDidToAddress";
import { GlobalContext } from "../contexts/GlobalContext";
import SwitchAccountModal from "./modals/SwitchAccountModal";
import useStatusBarHeight from "../hooks/useStatusBarHeight.js";
import ProfileFeed from '../screens/Navigation/Profile/ProfileFeed'
import ProfileReplies from '../screens/Navigation/Profile/ProfileReplies'
import ProfileReposts from '../screens/Navigation/Profile/ProfileReposts'
import { CheckIcon,CloseIcon,CopyIconBadge,FacebookIcon,InstagramIcon,LinkIcon,NotificationsIcon,SettingsIcon,TelegramIcon,TwitterIcon } from "./Icons";
import moment from "moment";

const TabBarHeight = 50;
const IndicatorWidth = 50

const windowSize = Dimensions.get('window')

export default function ProfileDetails({profile, pfpMarginTop = 20, type}) {
    const { 
        user, 
        setUser, 
        orbis, 
        setUpdateProfileVis, 
        setShareProfileVis, 
        screen, 
        modalSwitchRef, 
        tabViewHeight, 
        modalSettingsRef, 
        modalProfileRef,
        showClaimOranges, 
        setShowClaimOranges,
        todayOranges,
        setTodayOranges
    } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const snapPoints = useMemo(() => ['75%','75%'], []);
    const snapPointsSmall = useMemo(() => ['60%','60%'], []);
    const snapPointsTop = useMemo(() => [Platform.OS == 'ios' ? '86.1%' : '90%',Platform.OS == 'ios' ? '86.1%' : '90%'], []);

    const modalLinkRef = useRef(null); 

    const handleModalLinkPress = useCallback(() => modalLinkRef.current?.present(), []);
    const handleModalSettingsPress = useCallback(() => modalSettingsRef.current?.present(), []);
    const handleModalSwitchPress = useCallback(() => modalSwitchRef.current?.present(), []);
    const handleUpdateProfilePress = useCallback(() => modalProfileRef.current?.present(), []);


    const [isFollowing, setIsFollowing] = useState(false);
    const [countPosts, setCountPosts] = useState("-");
    const [followLoading, setFollowLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [listCommonFollowers, setListCommonFollowers ] = useState([]);
    const [commonFollowLoading, setCommonFollowLoading] = useState(true)
    const [userInfo, setUserInfo] = useState(profile)

    const [showLinkModal, setShowLinkModal] = useState(false)
    const [showProfileImage, setShowProfileImage] = useState(false)

    const { address } = useDidToAddress(profile?.did);

    const statusBarHeight = useStatusBarHeight();

    const scrollRef = useRef()
    const navigation = useNavigation()

    useScrollToTop(scrollRef);

    /** fetch common followers */
    useEffect(() => {
        type == 'selected' && getListCommonFollow();

        /** Will fetch common followers between you and the profile you are visiting */
        async function getListCommonFollow() {
            setCommonFollowLoading(true)
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

            setListCommonFollowers(common_followers);
            setCommonFollowLoading(false)
        }
    }, []);

    useEffect(() => {
        getProfile()
        loadiIsFollowing();
        getCountPosts();
        setFollowLoading(true);

        /** Will check if the connected user is following this user */
        async function loadiIsFollowing() {
            const res = await orbis.getIsFollowing(user.did, profile.did);
            setIsFollowing(res.data);
            setFollowLoading(false);
        }
    
        async function getProfile() {
            const { data, error } = await orbis.getProfile(type == 'selected' ? profile.did : user.did);
            setUserInfo(data.details);
        }

    }, [profile]);
    
    /** Will retrieve the count of posts shared by this profile in the context */
    async function getCountPosts() {
        const { count } = await orbis.api.from('orbis_posts').select('*', { count: 'exact', head: true }).eq('context', context).eq('creator', profile.did);
        if(count) {
            setCountPosts(count);
        }
    }

    /** Will copy link in Clipboard */
    async function copy(val) {
        await Clipboard.setStringAsync(val);
        alert("Address copied!");
    }

    if(!profile) {
        return null;
    }

    /** Will follow the user */
    async function follow(active) {
        setFollowLoading(true);

        const res = await orbis.setFollow(profile.did, active);
        setFollowLoading(false);
        setIsFollowing(active);
    }

    const ProfileItem = ({title, count}) => {
        const tailwind = useTailwind();

        { return title != 'Posts' && title != 'Orange' ? (
            <TouchableOpacity style={tailwind('flex flex-col flex-1 items-center')} onPress={() => {Haptics.selectionAsync();navigation.navigate('FollowNavigation', {origin: title, profile, type, listCommonFollowers})}}>
                <Text style={[tailwind(`text-slate-900`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
                <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
            </TouchableOpacity>
        ) : title == 'Orange' ? (
            <TouchableOpacity 
                style={tailwind('flex flex-col flex-1 items-center')}
                onPress={() => {Haptics.selectionAsync();setTodayOranges(Math.floor(Math.random() * (20 - 5) + 5)); setShowClaimOranges(true)}}
                disabled={type == 'selected'}
            >
                <Text style={[tailwind(`text-slate-900`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                    <Image
                        style={{width: 20,height: 20,marginTop: 5}}
                        resizeMode="contain"
                        source={require('../assets/orange.png')}
                    />
                    <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
                </View>
            </TouchableOpacity>
        ) : (
            <View style={tailwind('flex flex-col flex-1 items-center')}>
                <Text style={[tailwind(`text-slate-900`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
                <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
            </View>
        )}
    }

    async function updateProfile() {
        setRefreshing(true)
        
        const { data, error } = await orbis.getProfile(profile.did);
        setUserInfo(data.details)
        setUser(data)
        
        getCountPosts()

        setRefreshing(false)
    }

    const openLink = async (url) => {
        Haptics.selectionAsync()

        if(!url.toLowerCase().includes('http')){
            url = 'http://'+url
        }

        try {
            Linking.openURL(url)
        } catch (error) {
            Alert.alert('Could not open URL '+url)
        }
    }

    const [tabIndex, setIndex] = useState(0);
    const routes = [
        {key:0, title: 'Feed'},
        {key:1, title: 'Replies'},
        {key:2, title: 'Reposts'},
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
            if(route.key == 0 ) return <ProfileFeed profile={userInfo} type={type} />
            if(route.key == 1 ) return <ProfileReplies profile={userInfo} type={type} />
            if(route.key == 2 ) return <ProfileReposts profile={userInfo} type={type} />
        }
    };
 
    const renderTabBar = (props) => {
        return (
            <TabBar
                {...props}
                style={styles.tab}
                renderLabel={renderLabel}
                indicatorStyle={[styles.indicator, { width: IndicatorWidth, left: (windowSize.width / 3 - IndicatorWidth) / 2 }]}
            />
        );
    };

    function getProfilePicture(details) {
        if(details.profile.pfp.includes("ipfs://")) {
          return details.profile.pfp.replace("ipfs://", "https://ipfs.io/ipfs")
        } else {
          return details.profile.pfp
        }
    }

    return(
        <View style={{flex: screen === 'home' ? 1 : 0,backgroundColor: 'white',}}>
            { type == 'selected' ? (
                <>
                    <HeaderImage />

                    <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4}}>
                        <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                            <Image
                                style={{width: 24,height: 24}}
                                resizeMode='contain'
                                source={require('../assets/back_button.png')}
                                defaultSource={require('../assets/back_button.png')}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                            <NotificationsIcon />
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <HeaderImage/>
            )}

            <Animated.ScrollView 
                scrollEventThrottle={16}
                style={{backgroundColor: 'white',marginTop: type == 'selected' ? -10 : 0}}
                // contentContainerStyle={{flex:1}}
                ref={scrollRef}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={updateProfile} />
                }
            >

                {/** Display profile details */}
                <View style={[tailwind('flex flex-col items-center'), {marginTop: type == 'selected' ? pfpMarginTop : 0,}]}>
                    <TouchableOpacity 
                        style={[tailwind("rounded-full"), {marginTop: type == 'selected' ? 0 : 42,}]}
                        onPress={() => {Haptics.selectionAsync();setShowProfileImage(true)}}
                    >
                        <UserPfp details={profile} height={60} />
                    </TouchableOpacity>
                    
                    <View style={tailwind('mt-2 flex flex-row items-center')}>
                        <Username details={userInfo} fontSize={15} />
                        <Button color="badge-gray" icon={<CopyIconBadge style={{marginLeft: 4}} />} title={userInfo?.metadata?.ensName ? userInfo.metadata.ensName : shortAddress(address, 4)} style={{marginLeft: 8}} onPress={() => copy(address)} />
                    </View>
                    {userInfo?.profile?.description &&
                        <Text style={[tailwind(`text-main mt-2 w-2/3 text-center`), { fontSize: 11.5, lineHeight: 19, fontFamily: "GmarketMedium" }]}>
                            {userInfo.profile.description}
                        </Text>
                    }

                    {userInfo?.profile?.data?.list_link && userInfo.profile.data?.list_link.length > 1 && userInfo.profile.data?.list_link.length < 4 ? (
                        <View 
                            horizontal={true} 
                            style={{
                                height: 40,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                            }}
                        >
                            {userInfo.profile.data?.list_link.map((e, index) => {
                                return (
                                    <TouchableOpacity 
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginLeft: index == 2 && e.title == '' && Platform.OS == 'ios' ? 20 : 0,
                                            marginRight: index == 2 && e.title == '' && Platform.OS == 'ios' ? 10 : 0,
                                        }} 
                                        onPress={() => openLink(e.link)}
                                        key={Math.random()}
                                    >
                                        {e.link.toLowerCase().includes('twitter.com') ? (
                                            <TwitterIcon />
                                        ) : e.link.toLowerCase().includes('t.me') ? (
                                            <TelegramIcon />
                                        ) : e.link.toLowerCase().includes('facebook.com') ? (
                                            <FacebookIcon />
                                        ) : e.link.toLowerCase().includes('instagram.com') ? (
                                            <InstagramIcon />
                                        ) : (
                                            <LinkIcon />
                                        )}

                                        <Text 
                                            style={[{marginLeft: 3,fontWeight: 'bold',fontSize: 12,}]} 
                                            numberOfLines={1}
                                        >
                                            {e.title ? e.title : e.link.replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '').replace('Http://www.', '').replace('Https://www.', '').replace('Http://', '').replace('Https://', '')}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    ) : userInfo?.profile?.data?.list_link && userInfo.profile.data?.list_link.length >= 4 ? (
                        <TouchableOpacity
                            onPress={() => {Haptics.selectionAsync();handleModalLinkPress();}} 
                            style={{flexDirection:'row',alignItems: 'center',justifyContent: 'center',height: 35}}
                        >
                            <LinkIcon />
                            <View style={[{marginLeft: 5}]}>
                                <Text style={[tailwind("text-slate-900"), { fontSize: 13,fontWeight: 'bold',}]}>My Social links</Text>
                            </View>
                        </TouchableOpacity>
                    ) : userInfo?.profile?.data?.list_link && userInfo.profile.data?.list_link.length == 1 && (
                        <TouchableOpacity 
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: 50
                            }} 
                            onPress={() => openLink(userInfo.profile.data?.list_link[0].link)}
                            key={Math.random()}
                        >
                            {userInfo.profile.data?.list_link[0].link.toLowerCase().includes('twitter.com') ? (
                                <TwitterIcon />
                            ) : userInfo.profile.data?.list_link[0].link.toLowerCase().includes('t.me') ? (
                                <TelegramIcon />
                            ) : userInfo.profile.data?.list_link[0].link.toLowerCase().includes('facebook.com') ? (
                                <FacebookIcon />
                            ) : userInfo.profile.data?.list_link[0].link.toLowerCase().includes('instagram.com') ? (
                                <InstagramIcon />
                            ) : (
                                <LinkIcon />
                            )}

                            <Text 
                                style={[{marginLeft: 3,fontWeight: 'bold',fontSize: 13,}]} 
                                numberOfLines={1}
                            >
                                {userInfo.profile.data?.list_link[0].title ? userInfo.profile.data?.list_link[0].title : userInfo.profile.data?.list_link[0].link.replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '').replace('Http://www.', '').replace('Https://www.', '').replace('Http://', '').replace('Https://', '')}
                            </Text>
                        </TouchableOpacity>
                    )}
                    
                    { type !== 'selected' && (
                        <>
                            <TouchableOpacity 
                                activeOpacity={0.7}
                                onPress={() => {Haptics.selectionAsync();handleModalSwitchPress()}} 
                                style={{width: 60,height: 50,alignItems: 'center',justifyContent: 'center',position: 'absolute',top: 0,left:0}}
                                hitSlop={{top: 20, bottom: 20, left: 50, right: 50}}
                            >
                                <MaterialIcons name="switch-account" size={24} color="black" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                activeOpacity={0.7}
                                onPress={() => {Haptics.selectionAsync();handleModalSettingsPress()}} 
                                style={{width: 60,height: 50,alignItems: 'center',justifyContent: 'center',position: 'absolute',top: 0,right:0}}
                                hitSlop={{top: 20, bottom: 20, left: 50, right: 50}}
                            >
                                <SettingsIcon />
                            </TouchableOpacity>
                        </>

                    )}
                </View>
        
                {/** KPI counts */}
                <View style={[tailwind('flex flex-row px-4'), {paddingTop: 10}]}>
                    <ProfileItem count={countPosts} title="Posts" />
                    <ProfileItem count={userInfo ? userInfo.count_followers : "-"} title="Followers" />
                    <ProfileItem count={userInfo ? userInfo.count_following : "-"} title="Following" />
                    <ProfileItem count={userInfo?.profile.data?.oranges?.count ?? 0} title="Orange" />
                </View>
        
                {!commonFollowLoading && type == "selected" && listCommonFollowers.length > 0 ? (
                    <TouchableOpacity 
                        style={{width: '100%', justifyContent: 'center', marginTop: 15,}}
                        onPress={() => {Haptics.selectionAsync();navigation.navigate('FollowNavigation', {origin: "Mutual", profile, type, listCommonFollowers})}}
                    >
                        {listCommonFollowers.length < 3 ? (
                            <View style={{flexDirection: 'row',alignItems: 'center',justifyContent: 'center',}}>
                                {listCommonFollowers?.map(e => {
                                    return (
                                        <UserPfp details={e.details} height={27} key={Math.random()} style={{marginLeft: -13,}}/>
                                    )
                                })}

                                <Text style={[tailwind('text-secondary'), {marginLeft: 10,fontSize: 11,}]}>Followed by </Text>

                                {listCommonFollowers?.map((e, index) => {
                                    if(index != listCommonFollowers.length-1){
                                        return (
                                            <View style={{flexDirection: 'row',alignItems: 'flex-start',height: 20}} key={Math.random()}>
                                                <Text style={{fontWeight: 'bold',fontSize: 12,marginTop: Platform.OS == 'ios' ? 2 : 0,}}>{e.details.profile.username}</Text>
                                                <Text style={[tailwind('text-secondary'),{fontSize: 11,}]}> and </Text>
                                            </View>
                                        )
                                    }else{
                                        return(
                                            <Text style={{fontWeight: 'bold',fontSize: 13,height: 20,marginTop: Platform.OS == 'ios' ? 2 : -2,}} key={Math.random()}>{e.details.profile.username}</Text>
                                        )
                                    }
                                })}
                            </View>
                        ) : (
                            <View style={{flexDirection: 'row',alignItems: 'center',justifyContent: 'center',}}>
                                {listCommonFollowers.map((e, index) => {
                                    if(index < 2){
                                        return (
                                            <UserPfp details={e.details} height={27} key={Math.random()} style={{marginLeft: -13,}}/>
                                        )
                                    }else if(index == 2){
                                        return(
                                            <View style={{backgroundColor: '#d9d9d9', width: 27, height: 27, borderRadius: 15,alignItems: 'center',justifyContent: 'center',marginLeft: -13,}} key={Math.random()}>
                                                <Text style={[tailwind('text-secondary'),{fontSize: 10,}]}>+{listCommonFollowers.length - 2}</Text>
                                            </View>
                                        )
                                    }
                                })}

                                <View style={{flexDirection: 'row',}}>
                                    <Text style={[tailwind('text-secondary'), {marginLeft: 5,fontSize: 10,}]}>
                                        Followed by
                                        {listCommonFollowers.map((e, index) => {
                                            if(index == 0){
                                                return(
                                                    <Text key={Math.random()}>
                                                        <Text style={{fontWeight: 'bold',fontSize: 11,marginBottom: -8,marginLeft: 3,color: 'black'}}> {e.details.profile?.username}</Text>
                                                        <Text> and </Text>
                                                    </Text>
                                                )
                                            }else if(index == 1){
                                                return (
                                                    <Text style={{fontWeight: 'bold',fontSize: 11,marginBottom: -5,marginLeft: 3,color: 'black'}} key={Math.random()}>{e.details.profile?.username}</Text>
                                                )
                                            }else if(index == 2){
                                                return(
                                                    <Text style={[tailwind('text-secondary'),{fontSize: 10,marginLeft: 3,}]} key={Math.random()}>{"\n"}and {listCommonFollowers.length - 2} other{listCommonFollowers.length - 2 > 1 ? 's' : ''}</Text>
                                                )
                                            }
                                        })}
                                    </Text>

                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                ) : !commonFollowLoading && type == "selected" && !isFollowing && (
                    <View style={[tailwind('flex px-4'), {paddingTop: 15,}]}>
                        <Text style={[tailwind('text-secondary'), {fontSize: 11,textAlign:'center'}]}>You don't have any common followers.</Text>
                    </View>
                )}
        
                {/** Edit CTA (only if user is connected) */}
                {user.did == profile.did ?
                    <View style={[tailwind('flex flex-row px-4 pt-4 items-center justify-evenly'), {width: '95%',alignSelf: 'center',}]}>
                        <Button title="Edit Profile" color="orange" size="sm" onPress={() => {Haptics.selectionAsync();handleUpdateProfilePress()}} style={{height: 40,justifyContent: 'center',alignItems: 'center',flex: 1}}/>
                        <View style={{width: 10}} />
                        <Button title="Share Profile" color="white" size="sm" onPress={() => {Haptics.selectionAsync();setShareProfileVis(true)}} style={{height: 40, justifyContent: 'center',flex: 1}}/>
                    </View>
                :
                    <View style={tailwind('flex flex-row px-4 pt-4 items-center w-full justify-center')}>
                        {isFollowing ?
                            <Button title="Following" icon={<CheckIcon color="#fff" style={{marginRight: 5}} />} color="green" size="sm" onPress={() => follow(false)} style={{height: 40, width:'90%',alignItems: 'center',justifyContent: 'center', }}/>
                        :
                            <Button loading={followLoading} title="Follow" color="orange" size="sm" onPress={() => follow(true)} style={{height: 40, width:'90%',alignItems: 'center',justifyContent: 'center', }}/>
                        }
                    </View>
                }
        
                {/** Profile navigation */}
                {/* {Platform.OS == 'ios' ? (
                    <>
                        <View style={tailwind('flex flex-row px-4 border-b border-slate-100 mt-30px')}>
                            <NavItem slug="feed" title="Feed" setNav={setNav} nav={nav} />
                            <NavItem slug="replies" selected={true} title="Replies" nav={nav} setNav={setNav} />
                            <NavItem slug="reposts" title="Reposts" nav={nav} setNav={setNav} />
                        </View>
                        <View style={tailwind('flex flex-col')}>
                            <Posts type={nav} profile={userInfo} />
                        </View>
                    </>
                ) : ( */}
                    <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
                        <TabView
                            navigationState={{index: tabIndex, routes}}
                            renderScene={renderScene}
                            renderTabBar={renderTabBar}
                            onIndexChange={setIndex}
                            initialLayout={{width: windowSize.width}}
                            style={{height: tabViewHeight,}}
                        />
                    </View>
                {/* )} */}


            </Animated.ScrollView>

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalLinkRef}
                    index={1}
                    snapPoints={snapPoints}
                    // backgroundStyle={{backgroundColor: colors.modal,}}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 40,justifyContent: 'center',}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                >
                    <View style={{zIndex: 2}}>
                        <View style={{justifyContent: 'center',alignItems: 'center',marginTop: 20,}}>
                            {userInfo.profile.data?.list_link?.map((e, index) => {
                                return (
                                    <TouchableOpacity 
                                        style={{backgroundColor: '#F6F6F6',borderRadius: 25,height: 50,marginTop: 10,flexDirection:'row', justifyContent: 'space-between',alignItems: 'center',width:'90%'}}
                                        key={Math.random()}
                                        onPress={() => openLink(e.link)}
                                    >
                                        <Text style={{fontWeight: 'bold',fontSize: 17,paddingLeft: 20}}>
                                            {e.title ? e.title : e.link.replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '').replace('Http://www.', '').replace('Https://www.', '').replace('Http://', '').replace('Https://', '')}
                                        </Text>

                                        {e.link.toLowerCase().includes('twitter.com') ? (
                                            <TwitterIcon style={{marginRight: 20}}/>
                                        ) : e.link.toLowerCase().includes('t.me') ? (
                                            <TelegramIcon style={{marginRight: 20}}/>
                                        ) : e.link.toLowerCase().includes('facebook.com') ? (
                                            <Image
                                                style={{width: 25,height: 25,marginLeft: 3,marginRight: 20}}
                                                resizeMode='contain'
                                                source={require('../assets/facebook_icon.png')}
                                                defaultSource={require('../assets/facebook_icon.png')}
                                            />
                                        ) : e.link.toLowerCase().includes('instagram.com') ? (
                                            <Image
                                                style={{width: 25,height: 25,marginLeft: 3,marginRight: 20}}
                                                resizeMode='contain'
                                                source={require('../assets/instagram_icon.png')}
                                                defaultSource={require('../assets/instagram_icon.png')}
                                            />
                                        ) : (
                                            <LinkIcon style={{marginRight: 20}}/>
                                        )}
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>
                </BottomSheetModal>
            </BottomSheetModalProvider>

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalSwitchRef}
                    index={1}
                    snapPoints={snapPointsSmall}
                    // backgroundStyle={{backgroundColor: colors.modal,}}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 40,justifyContent: 'center',}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                >
                    <SwitchAccountModal />
                </BottomSheetModal>
            </BottomSheetModalProvider>

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalSettingsRef}
                    index={1}
                    snapPoints={snapPointsTop}
                    // backgroundStyle={{backgroundColor: colors.modal,}}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 10,marginTop: 5, justifyContent: 'center',}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                >
                    <SettingsModal />
                </BottomSheetModal>
            </BottomSheetModalProvider>


            {showProfileImage &&
                <Modal 
                    visible={true}
                    transparent={true}
                    statusBarTranslucent
                    style={{backgroundColor: "#000"}}
                    onRequestClose={() => setShowProfileImage(false)}
                >
                    <View 
                        style={[
                            tailwind("h-full w-full"), 
                            {
                                height:'120%',
                                marginTop: -120,
                                backgroundColor: "#000",
                                paddingTop: statusBarHeight + 10,
                            }
                        ]}
                    >
                        <View style={[tailwind('flex justify-end w-full'), {height: 40}]}>
                            <TouchableOpacity onPress={() => setShowProfileImage(!showProfileImage)} style={{left: 20}} activeOpacity={0.6}>
                                <CloseIcon />
                            </TouchableOpacity>
                        </View>
                        <ImageViewer 
                            imageUrls={[{url: getProfilePicture(profile)}]}
                            onSwipeDown={() => setShowProfileImage(!showProfileImage)} 
                            enableSwipeDown={true} 
                            loadingRender={() => { return (
                                <ActivityIndicator style={{marginTop: 10}} 
                                    size="small" 
                                    color="#fff" 
                                /> 
                            )}}
                        />
                    </View>
                </Modal>
            }
        </View>
    )
}

const styles = StyleSheet.create({
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
    },
    tab: {
        elevation: 0,
        shadowOpacity: 0,
        backgroundColor: 'white',
        height: TabBarHeight,
        borderBottomWidth: 1,
        borderBottomColor: '#ebebeb'
    },
    indicator: {
        height: 4, 
        borderRadius: 10,
        width: '20%',
        backgroundColor: '#FF6B17',
    },
})