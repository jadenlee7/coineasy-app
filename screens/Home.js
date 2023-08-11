import React, { useState, useContext, useEffect, useCallback } from "react";
import Postbox from "../components/Postbox";
import Feed from "../components/Feed";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import SecondHeader from "../components/SecondHeader";
import PostPane from "../components/panes/PostPane";
import ProfilePane from "../components/panes/ProfilePane";

import * as Haptics from 'expo-haptics';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import Profile from "./Profile";

export default function Home() {
  const { user, orbis, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis, posts, setPosts, refreshing, refreshingBottom, onRefresh, loadPosts, profileSelected, showPostbox, hidePostbox, loadMorePosts } = useContext(GlobalContext);
  const tailwind = useTailwind();

  return(
    <>
      <SecondHeader label="GM! CoinEasy Frens!" />

      <View style={tailwind('flex flex-col flex-1')}>
        {/**<Postbox callback={() => loadPosts()} />*/}
        <View style={tailwind('flex flex-1 bg-white')}>
          <Feed posts={posts} refreshing={refreshing} refreshingBottom={refreshingBottom} onRefresh={onRefresh} loadMore={loadMorePosts} />

          {/** Share button */}
          <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 0, right: 15} ]} onPress={() => showPostbox()}>
            <Image
              style={{ height: 70, width: 70 }}
              source={require('../assets/share_btn.png')} />
          </TouchableOpacity>
        </View>
      </View>


    </>
  )
}
