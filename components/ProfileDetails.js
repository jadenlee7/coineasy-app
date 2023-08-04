import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, ActivityIndicator, RefreshControl, TouchableHighlight } from 'react-native';
import Header from "./Header";
import Post from "./Post";
import Button from "./Button";
import Modal from "./Modal";
import { UserPfp, Username } from "./User";
import SecondHeader from "./SecondHeader";
import { context } from '../utils/config.js';

export default function ProfileDetails({profile}) {
  const { user, setUser, orbis, updateProfileVis, setUpdateProfileVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [nav, setNav] = useState("feed");

  useEffect(() => {
    console.log("profile:", profile);
  }, [profile])

  if(!profile) {
    return null;
  }

  return(
    <>
      {/** Display profile details */}
      <View style={tailwind('flex flex-col items-center')}>
        <UserPfp details={profile} height={50} />
        <View style={tailwind('mt-2')}>
          <Username details={profile} fontSize={15} />
        </View>
        {profile?.profile?.description &&
          <Text style={[tailwind(`text-main mt-2 w-2/3 text-center`), { fontSize: 11.5, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{profile.profile.description}</Text>
        }
      </View>

      {/** Edit CTA (only if user is connected) */}
      {user.did == profile.did &&
        <View style={tailwind('flex flex-row px-4 mt-3 items-center w-full justify-center')}>
            <Button title="Edit Profile" color="orange" size="sm" onPress={() => setUpdateProfileVis(true)} />
            <View style={{width: 10}} />
            <Button title="Share Profile" color="sm-white" />
        </View>
      }

      {/** KPI counts */}
      <View style={tailwind('flex flex-row px-4 mt-2')}>
        <ProfileItem count="50" title="Posts" />
        <ProfileItem count={profile.count_followers} title="Followers" />
        <ProfileItem count={profile.count_following} title="Following" />
        <ProfileItem count="156" title="Orange" />
      </View>

      {/** Profile navigation */}
      <View style={tailwind('flex flex-row px-4 mt-4 border-b border-slate-100 mt-6')}>
        <NavItem slug="feed" title="Feed" setNav={setNav} nav={nav} />
        <NavItem slug="replies" selected={true} title="Replies" nav={nav} setNav={setNav} />
        <NavItem slug="reposts" title="Reposts" nav={nav} setNav={setNav} />
      </View>

      <ScrollView style={tailwind('flex flex-col flex-1')}>
        <Posts type={nav} profile={profile} />
      </ScrollView>
    </>
  )
}


const Posts = ({type, profile}) => {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, orbis } = useContext(GlobalContext);
  const tailwind = useTailwind();

  useEffect(() => {
    loadPosts();
  }, [type])

  /** Will retrieve all posts shared in the global context */
  async function loadPosts() {
    setRefreshing(true);
    let query;

    switch (data) {
      /** Render posts shared by user */
      case "feed":
        query = orbis.getPosts({
          did: profile.did,
          context
        });
        break;

      /** Render replies from user */
      case "replies":
        query = orbis.getPosts({
          did: profile.did,
          context
        });
        break;

      /** Render replies from user */
      case "reposts":
        query = orbis.getPosts({
          did: profile.did,
          context
        });
        break;
      default:
        query = orbis.getPosts({
          did: profile.did,
          context
        });
        break;
    }

    let { data } = await query;
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }

  return(
    <ScrollView
      contentContainerStyle={tailwind('items-center w-full')}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={loadPosts} />
      }>
      {refreshing ?
        <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
      :
        <>
          {(posts && posts.length > 0) ?
            <>
              {posts.map((post) => {
                return (
                  <Post post={post} key={post.stream_id} />
                );
              })}
            </>
          :
            <Text style={tailwind('text-gray-900 font-semibold mt-6')}></Text>
          }
        </>
      }
    </ScrollView>
  )
}

const NavItem = ({title, selected, nav, setNav, slug}) => {
  const tailwind = useTailwind();

  return(
    <TouchableHighlight style={tailwind('flex flex-1 items-center rounded-md pt-2')} onPress={() => setNav(slug)} underlayColor="#f8fafc">
        <View style={tailwind('flex flex-col')}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{title}</Text>
          <View style={[tailwind(`rounded-full h-1 mt-2`), { backgroundColor: nav == slug ? "#FF6B17" : "transparent" }]}></View>
        </View>
    </TouchableHighlight>
  )
}

const ProfileItem = ({title, count}) => {
  const tailwind = useTailwind();

  return(
    <View style={tailwind('flex flex-col flex-1 items-center')}>
      <Text style={[tailwind(`text-slate-900 mt-5`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 15 }]}>{count}</Text>
      <Text style={[tailwind(`text-slate-400 mt-2 text-center`), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketMedium", lineHeight: 15 }]}>{title}</Text>
    </View>
  )
}
