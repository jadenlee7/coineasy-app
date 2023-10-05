import React, { useState, useContext, useEffect } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';

import { useTailwind } from 'tailwind-rn';
import * as Clipboard from 'expo-clipboard';
import Animated from 'react-native-reanimated';

import Post from "./Post";
import Button from "./Button";
import { shortAddress } from "../utils";
import { UserPfp, Username } from "./User";
import { context } from '../utils/config.js';
import { CheckIcon, CopyIconBadge } from "./Icons";
import useDidToAddress from "../hooks/useDidToAddress";
import { GlobalContext } from "../contexts/GlobalContext";

export default function ProfileDetails({profile, pfpMarginTop = -10}) {
    const { user, orbis, setUpdateProfileVis, setShareProfileVis, screen } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const [nav, setNav] = useState("feed");
    const [isFollowing, setIsFollowing] = useState(false);
    const [countPosts, setCountPosts] = useState("-");
    const [followLoading, setFollowLoading] = useState(false);
    const { address } = useDidToAddress(profile?.did);


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

        /** Will retrieve the count of posts shared by this profile in the context */
        async function getCountPosts() {
            const { count } = await orbis.api.from('orbis_posts').select('*', { count: 'exact', head: true }).eq('context', context).eq('creator', profile.did);
            if(count) {
                setCountPosts(count);
            }
        }
    }, [profile]);

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

    return(
        <View style={{flex: screen === 'home' ? 1 : 0}}>
            <Animated.ScrollView scrollEventThrottle={16} style={{backgroundColor: 'white',}}>
                {/** Display profile details */}
                <View style={[tailwind('flex flex-col items-center')]}>
                    <View style={[tailwind("rounded-full"),{marginTop: 20,}]}>
                        <UserPfp details={profile} height={60} />
                    </View>
                    <View style={tailwind('mt-2 flex flex-row items-center')}>
                        <Username details={profile} fontSize={15} />
                        <Button color="badge-gray" icon={<CopyIconBadge style={{marginLeft: 4}} />} title={profile?.metadata?.ensName ? profile.metadata.ensName : shortAddress(address, 4)} style={{marginLeft: 8}} onPress={() => copy(address)} />
                    </View>
                    {profile?.profile?.description &&
                        <Text style={[tailwind(`text-main mt-2 w-2/3 text-center`), { fontSize: 11.5, lineHeight: 19, fontFamily: "GmarketMedium" }]}>{profile.profile.description}</Text>
                    }
                </View>
        
                {/** KPI counts */}
                <View style={[tailwind('flex flex-row px-4'), {paddingTop: 10}]}>
                    <ProfileItem count={countPosts} title="Posts" />
                    <ProfileItem count={profile ? profile.count_followers : "-"} title="Followers" />
                    <ProfileItem count={profile ? profile.count_following : "-"} title="Following" />
                    {/*<ProfileItem count="156" title="Oranges" />*/}
                </View>
        
        
                {/** Edit CTA (only if user is connected) */}
                {user.did == profile.did ?
                    <View style={tailwind('flex flex-row px-4 pt-4 items-center w-full justify-center')}>
                        {/**<View style={{backgroundColor: "red", width: 200, height: 20, position: "absolute", top: 0, left:0}}></View>*/}
                        <Button title="Edit Profile" color="orange" size="sm" onPress={() => setUpdateProfileVis(true)} />
                        <View style={{width: 10}} />
                        <Button title="Share Profile" color="white" size="sm" onPress={() => setShareProfileVis(true)} />
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
                    <Posts type={nav} profile={profile} />
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
          <View style={[tailwind(`rounded-full h-1 mt-2`), { backgroundColor: nav == slug ? "#FF6B17" : "transparent" }]}></View>
        </View>
    </TouchableOpacity>
  )
}

const ProfileItem = ({title, count}) => {
  const tailwind = useTailwind();

  return(
    <View style={tailwind('flex flex-col flex-1 items-center')}>
      <Text style={[tailwind(`text-slate-900`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
      <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
    </View>
  )
}
