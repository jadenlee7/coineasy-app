import React, { useState, useContext, useEffect, useCallback } from "react";
import Postbox from "../components/Postbox";
import Feed from "../components/Feed";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import Button from "../components/Button";
import SecondHeader from "../components/SecondHeader";
import PostPane from "../components/panes/PostPane";
import ProfilePane from "../components/panes/ProfilePane";

import * as Haptics from 'expo-haptics';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import Profile from "./Profile";

export default function Home() {
  const { user, orbis, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis, posts, setPosts, refreshing, refreshingBottom, onRefresh, loadPosts, profileSelected, showPostbox, hidePostbox, loadMorePosts, category, setCategory } = useContext(GlobalContext);
  const tailwind = useTailwind();

  return(
    <>
      <SecondHeader label={"GM! CoinEasy Frens!"} back={category ? () => setCategory(null) : null} />

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

const CloseIcon = () => {
  return(
    <Svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginLeft: 5}}>
      <Path d="M1.28033 0.21967C0.987437 -0.0732233 0.512563 -0.0732233 0.21967 0.21967C-0.0732233 0.512563 -0.0732233 0.987437 0.21967 1.28033L3.93934 5L0.21967 8.71967C-0.0732233 9.01256 -0.0732233 9.48744 0.21967 9.78033C0.512563 10.0732 0.987437 10.0732 1.28033 9.78033L5 6.06066L8.71967 9.78033C9.01256 10.0732 9.48744 10.0732 9.78033 9.78033C10.0732 9.48744 10.0732 9.01256 9.78033 8.71967L6.06066 5L9.78033 1.28033C10.0732 0.987437 10.0732 0.512563 9.78033 0.21967C9.48744 -0.0732233 9.01256 -0.0732233 8.71967 0.21967L5 3.93934L1.28033 0.21967Z" fill="#fff"/>
    </Svg>
  )
}
