import React, { useState, useContext, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Linking, Alert, Image, Dimensions } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as Clipboard from 'expo-clipboard';
import Animated from 'react-native-reanimated';

import Post from "./Post";
import Button from "./Button";
import { shortAddress } from "../utils";
import { UserPfp, Username } from "./User";
import { context } from '../utils/config.js';
import { BackIcon, CheckIcon, CopyIconBadge, LinkIcon, NotificationsIcon, SettingsIcon, TelegramIcon, TwitterIcon } from "./Icons";
import useDidToAddress from "../hooks/useDidToAddress";
import { GlobalContext } from "../contexts/GlobalContext";
import { useNavigation } from "@react-navigation/core";
import { useScrollToTop } from "@react-navigation/native";
import HeaderImage from "./HeaderImage";


export default function ProfileDetails({profile, pfpMarginTop = 20, type}) {
    const { user, orbis, setUpdateProfileVis, setShareProfileVis, screen, setSettingsVis, setUser, setPushNotifsVis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [nav, setNav] = useState("feed");
    const [isFollowing, setIsFollowing] = useState(false);
    const [countPosts, setCountPosts] = useState("-");
    const [followLoading, setFollowLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [listCommonFollowers, setListCommonFollowers ] = useState([]);
    const [commonFollowLoading, setCommonFollowLoading] = useState(true)
    const [userInfo, setUserInfo] = useState(profile)

    const { address } = useDidToAddress(profile?.did);

    const scrollRef = useRef()
    const navigation = useNavigation()


    let countLink = 0
    if(userInfo.profile && userInfo.profile.data){
        typeof userInfo.profile.data.external !== 'undefined' && userInfo.profile.data.external != '' ? countLink += 1 : null
        typeof userInfo.profile.data.twitter !== 'undefined' && userInfo.profile.data.twitter != '' ? countLink += 1 : null
        typeof userInfo.profile.data.telegram !== 'undefined' && userInfo.profile.data.telegram != '' ? countLink += 1 : null
    }

    const [numberLink, setNumberLink] = useState(countLink)

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

        loadiIsFollowing();
        getCountPosts();
        setFollowLoading(true);

        /** Will check if the connected user is following this user */
        async function loadiIsFollowing() {
            const res = await orbis.getIsFollowing(user.did, profile.did);
            console.log("res isFollowing():", res);
            setIsFollowing(res.data);
            setFollowLoading(false);
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
        console.log("res:", res);
        setFollowLoading(false);
        setIsFollowing(active);
    }

    const ProfileItem = ({title, count}) => {
        const tailwind = useTailwind();
      
        { return title != 'Posts' ? (
            <TouchableOpacity style={tailwind('flex flex-col flex-1 items-center')} onPress={() => {Haptics.selectionAsync();navigation.navigate('FollowNavigation', {origin: title, profile, type, listCommonFollowers})}}>
                <Text style={[tailwind(`text-slate-900`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
                <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
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

        let countLink = 0
        if(data.details.profile && data.details.profile.data){
            typeof data.details.profile.data.external !== 'undefined' && data.details.profile.data.external != '' ? countLink += 1 : null
            typeof data.details.profile.data.twitter !== 'undefined' && data.details.profile.data.twitter != '' ? countLink += 1 : null
            typeof data.details.profile.data.telegram !== 'undefined' && data.details.profile.data.telegram != '' ? countLink += 1 : null
        }
        setNumberLink(countLink)

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

    return(
        <View style={{flex: screen === 'home' ? 1 : 0,backgroundColor: 'white',}}>
            { type == 'selected' ? (
                <>
                    <HeaderImage />

                    <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 5}}>
                        <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}} hitSlop={{top: 50, bottom: 150, left: 50, right: 50}}>
                            <View style={{justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                                <BackIcon />
                                <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                            </View>
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
                style={{backgroundColor: 'white',marginTop: type == 'selected' ? -10 : 0,}}
                ref={scrollRef}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={updateProfile} />
                }
            >

                {/** Display profile details */}
                <View style={[tailwind('flex flex-col items-center'), {marginTop: type == 'selected' ? pfpMarginTop : 0,}]}>
                    <View style={[tailwind("rounded-full"), {marginTop: type == 'selected' ? 0 : 42,}]}>
                        <UserPfp details={profile} height={60} />
                    </View>
                    <View style={tailwind('mt-2 flex flex-row items-center')}>
                        <Username details={userInfo} fontSize={15} />
                        <Button color="badge-gray" icon={<CopyIconBadge style={{marginLeft: 4}} />} title={userInfo?.metadata?.ensName ? userInfo.metadata.ensName : shortAddress(address, 4)} style={{marginLeft: 8}} onPress={() => copy(address)} />
                    </View>
                    {userInfo?.profile?.description &&
                        <Text style={[tailwind(`text-main mt-2 w-2/3 text-center`), { fontSize: 11.5, lineHeight: 19, fontFamily: "GmarketMedium" }]}>{userInfo.profile.description}</Text>
                    }

                    {userInfo?.profile?.data &&
                        <View style={{marginBottom: 10,marginTop: 5,flexDirection:'row',}}>
                            {userInfo.profile.data.external && (
                                <TouchableOpacity 
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 
                                            !userInfo.profile.data.external_title && countLink == 3 ? '30%' 
                                            : countLink == 3 ? '30%' 
                                            : countLink == 2 && !userInfo.profile.data.external_title ? '50%' 
                                            : countLink == 2 && userInfo.profile.data.external_title ? '30%' 
                                            : 'auto',
                                        marginLeft: countLink == 3 && userInfo.profile.data.twitter_title && userInfo.profile.data.telegram_title ? 30 : 0,
                                    }} 
                                    onPress={() => openLink(userInfo.profile.data.external)}
                                >
                                    <Image
                                        style={{width: 25,height: 25,}}
                                        resizeMode='contain'
                                        source={require('../assets/link_icon.png')}
                                        defaultSource={require('../assets/link_icon.png')}
                                    />
                                    <Text style={[{marginLeft: 3,fontWeight: 'bold',width: '70%'}]} numberOfLines={1}>
                                        {userInfo.profile.data.external_title ? 
                                            userInfo.profile.data.external_title 
                                            : userInfo.profile.data.external.replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '').replace('Http://www.', '').replace('Https://www.', '').replace('Http://', '').replace('Https://', '')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {userInfo.profile.data.twitter && (
                                <TouchableOpacity 
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width:
                                            !userInfo.profile.data.twitter_title && countLink == 3 ? '27%' 
                                            : countLink == 2 && !userInfo.profile.data.twitter_title ? '50%' 
                                            : countLink == 2 && userInfo.profile.data.twitter_title ? '30%' 
                                            : 'auto',
                                        marginLeft: userInfo.profile.data.external && Platform.OS == 'ios' ? 20 : userInfo.profile.data.external ? 10 : 0,
                                    }} 
                                    onPress={() => openLink(userInfo.profile.data.twitter)}
                                >
                                    <TwitterIcon />
                                    <Text style={[{marginLeft: 3, fontWeight: 'bold',}]} numberOfLines={1}>
                                        {userInfo.profile.data.twitter_title ? 
                                            userInfo.profile.data.twitter_title 
                                            : userInfo.profile.data.twitter.toLowerCase().replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '')}
                                        </Text>
                                </TouchableOpacity>
                            )}
                            {userInfo.profile.data.telegram && (
                                <TouchableOpacity 
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        width: 
                                            !userInfo.profile.data.telegram_title && countLink == 3 && Platform.OS == 'ios' ? '27%' 
                                            : '27%',
                                        marginLeft: userInfo.profile.data.twitter && Platform.OS == 'ios' ? 20 : userInfo.profile.data.twitter ? 15 : 0,
                                    }} 
                                    onPress={() => openLink(userInfo.profile.data.telegram)}
                                >
                                    <TelegramIcon />
                                    <Text style={[{marginLeft: 7,fontWeight: 'bold',width:'70%'}]} numberOfLines={1}>
                                        {userInfo.profile.data.telegram_title ? 
                                            userInfo.profile.data.telegram_title 
                                            : userInfo.profile.data.telegram.toLowerCase().replace('http://www.', '').replace('https://www.', '').replace('http://', '').replace('https://', '')}
                                    </Text>
                                </TouchableOpacity>
                            )}


                        </View>
                    }
                    
                    { type !== 'selected' && (

                        <TouchableOpacity 
                            activeOpacity={0.7}
                            onPress={() => {Haptics.selectionAsync();setSettingsVis(true)}} 
                            style={{width: 60,height: 50,alignItems: 'center',justifyContent: 'center',position: 'absolute',top: 0,right:0}}
                            hitSlop={{top: 20, bottom: 20, left: 50, right: 50}}
                        >
                            <SettingsIcon />
                        </TouchableOpacity>
                    )}
                </View>
        
                {/** KPI counts */}
                <View style={[tailwind('flex flex-row px-4'), {paddingTop: 10}]}>
                    <ProfileItem count={countPosts} title="Posts" />
                    <ProfileItem count={userInfo ? userInfo.count_followers : "-"} title="Followers" />
                    <ProfileItem count={userInfo ? userInfo.count_following : "-"} title="Following" />
                    {/*<ProfileItem count="156" title="Oranges" />*/}
                </View>
        
                {!commonFollowLoading && type == "selected" && listCommonFollowers.length > 0 ? (
                    <TouchableOpacity 
                        style={{width: '100%', justifyContent: 'center', marginTop: 15,}}
                        onPress={() => {Haptics.selectionAsync();navigation.navigate('FollowNavigation', {origin: "Followers", profile, type, listCommonFollowers})}}
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
                    <View style={tailwind('flex flex-row px-4 pt-4 items-center w-full justify-center')}>
                        {/**<View style={{backgroundColor: "red", width: 200, height: 20, position: "absolute", top: 0, left:0}}></View>*/}
                        <Button title="Edit Profile" color="orange" size="sm" onPress={() => {Haptics.selectionAsync();setUpdateProfileVis(true)}} />
                        <View style={{width: 10}} />
                        <Button title="Share Profile" color="white" size="sm" onPress={() => {Haptics.selectionAsync();setShareProfileVis(true)}} />
                    </View>
                :
                    <View style={tailwind('flex flex-row px-4 pt-4 items-center w-full justify-center')}>
                        {isFollowing ?
                            <Button title="Following" icon={<CheckIcon color="#fff" style={{marginRight: 5}} />} color="green" size="sm" onPress={() => follow(false)} />
                        :
                            <Button loading={followLoading} title="Follow" color="orange" size="sm" onPress={() => follow(true)} />
                        }
                    </View>
                }
        
        
                {/** Profile navigation */}
                <View style={tailwind('flex flex-row px-4 border-b border-slate-100 mt-30px')}>
                    <NavItem slug="feed" title="Feed" setNav={setNav} nav={nav} />
                    <NavItem slug="replies" selected={true} title="Replies" nav={nav} setNav={setNav} />
                    <NavItem slug="reposts" title="Reposts" nav={nav} setNav={setNav} />
                </View>
        
                <View style={tailwind('flex flex-col')}>
                    <Posts type={nav} profile={userInfo} />
                </View>
            </Animated.ScrollView>
        </View>
    )
}


const Posts = ({type, profile}) => {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(true);
  const { user, orbis } = useContext(GlobalContext);
  const tailwind = useTailwind();

  useEffect(() => {
    loadPosts();
  }, [type, profile])

  /** Will retrieve all posts shared in the global context */
  async function loadPosts() {
    setRefreshing(true);
    console.log("Enter loadPosts for:", type);
    setPosts([]);

    let options;

    switch (type) {
      /** Render posts shared by user */
      case "feed":
        options = {
          did: profile.did,
          context,
          include_child_contexts: true
        };
        break;

      /** Render replies from user */
      case "replies":
        options = {
          did: profile.did,
          context,
          is_reply: true,
          include_child_contexts: true
        };
        break;

      /** Render replies from user */
      case "reposts":
        options = {
          did: profile.did,
          context,
          is_repost: true,
          include_child_contexts: true
        };
        break;
      default:
        options = {
          did: profile.did,
          context,
          include_child_contexts: true
        };
        break;
    }

    let { data } = await orbis.getPosts(options);
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }

  if(refreshing) {
    return(
      <View style={{backgroundColor: 'white',height: 900}}>
        <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
      </View>
    )
  }

  if(posts.length == 0) {
    return(
      <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
        <Text style={tailwind('text-secondary items-center ml-1')}>There isn't any post shared here.</Text>
      </View>
    )
  }

  return posts.map((post, key) => {
    return (
      <Post key={key} post={post} />
    );
  });

  /*return(
    <Feed posts={posts} refreshing={refreshing} onRefresh={loadPosts} />
  )*/
}

const NavItem = ({title, selected, nav, setNav, slug}) => {
  const tailwind = useTailwind();

  return(
    <TouchableOpacity style={tailwind('flex flex-1 items-center rounded-md')} onPress={() => setNav(slug)} activeOpacity={0.65}>
        <View style={tailwind('flex flex-col')}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{title}</Text>
          <View style={[tailwind(`rounded-full h-1 mt-1`), { backgroundColor: nav == slug ? "#FF6B17" : "transparent" }]}></View>
        </View>
    </TouchableOpacity>
  )
}
