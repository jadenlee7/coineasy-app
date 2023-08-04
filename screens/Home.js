import React, { useState, useContext, useEffect, useCallback } from "react";
import Postbox from "../components/Postbox";
import Feed from "../components/Feed";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import SecondHeader from "../components/SecondHeader";
import Modal from "../components/Modal";
import Pane from "../components/Pane";
import PostPane from "../components/panes/PostPane";
import ProfilePane from "../components/panes/ProfilePane";

import * as Haptics from 'expo-haptics';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import Profile from "./Profile";

export default function Home() {
  const { user, orbis, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis, posts, setPosts, refreshing, onRefresh, loadPosts, profileSelected } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [postboxVis, setPostboxVis] = useState(false);

  function showPostbox() {
    setPostboxVis(true);
    Haptics.selectionAsync();
  }

  function hidePostbox() {
    setPostboxVis(false);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  function hideRepost() {
    setRepostVis(false);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  /** Will be called when a new post is being shared */
  function callbackPostShared(_post) {
    console.log("callbackPostShared:", _post);
    //loadPosts();

    let _posts = [_post, ...posts];
    setPosts(_posts);
    setPostboxVis(false);
    Keyboard.dismiss();
    Haptics.selectionAsync();
  }

  return(
    <>
      <SecondHeader label="GM! CoinEasy Frens!" />

      <View style={tailwind('flex flex-col flex-1')}>
        {/**<Postbox callback={() => loadPosts()} />*/}
        <View style={tailwind('flex flex-1 bg-white')}>
          <Feed posts={posts} />

          {/** Show selected post details in a pane */}
          {postDetailsVis != null &&
            <PostPane />
          }

          {/** Show user profile selected */}
          {profileSelected &&
            <ProfilePane did={profileSelected} />
          }
        </View>
      </View>

      {/** Share button */}
      <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 100, right: 20} ]} onPress={() => showPostbox()}>
        <Image
          style={{ height: 70, width: 70 }}
          source={require('../assets/share_btn.png')} />
      </TouchableOpacity>

      {/** Share modal container */}
      {postboxVis &&
        <Modal hide={() => hidePostbox()} animateModal={false}>
          <Postbox callback={callbackPostShared} />
        </Modal>
      }

      {/** Render repost modal */}
      {repostVis &&
        <Modal hide={() => hideRepost()} animateModal={true} bottomDuration={200} bottomStart={-100}>
          <View style={[tailwind('flex flex-col w-full p-4')]}>
            {/** Repost CTA */}
            <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-4 ')]}>
              <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold" }]}>Repost</Text>
            </TouchableHighlight>

            {/** Quote CTA */}
            <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-4 mt-2')]}>
              <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold" }]}>Quote</Text>
            </TouchableHighlight>
          </View>
        </Modal>
      }
    </>
  )
}
