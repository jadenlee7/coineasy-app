import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight } from 'react-native';
import Pane from "../Pane";
import Post from "../Post";
import Postbox from "../Postbox";
import SecondHeader from "../SecondHeader";

import { UserPfp } from "../User";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';

export default function PostPane() {
  const { user, orbis, showConnectModal, setShowConnectModal, postDetailsVis, showPostbox, hidePostbox, setReplyTo } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [ post, setPost ] = useState();
  const [ replies, setReplies ] = useState([]);
  const [ repliesLoading, setRepliesLoading ] = useState(false);

  /** Check if user liked this post */
  useEffect(() => {
    getPost();
    getReplies();

    /** Will load main post details */
    async function getPost() {
      let { data, error } = await orbis.getPost(postDetailsVis);
      if(data) {
        setPost(data);
      }
    }

    /** Will load replies */
    async function getReplies() {
      setRepliesLoading(true);
      const { data, error } = await orbis.getPosts(
        {
          master: postDetailsVis
        },
        0,
        50,
        true
      );

      if(data) {
        setReplies(data);
        setRepliesLoading(false);
      }
    }
  }, []);

  /** Open postbox and save reply to */
  function openReplyBox() {
    showPostbox(callback);
    setReplyTo(post);
  }

  function callback(newPost) {
    hidePostbox();
    console.log("Adding new post as a reply:", newPost);
    let _replies = [...replies, newPost];
    setReplies(_replies);
  }

  return(
    <Pane>
      <SecondHeader label="" showBack={true} />
      <ScrollView style={tailwind('pt-4')}>
        {post ?
          <View style={{marginTop: -10}}>
            {/** Show master post */}
            <Post post={post} verticalDivider={true} fontSize={15} />

            {/** Show replies */}
            <View style={[tailwind('flex flex-col')]}>
              {repliesLoading ?
                <View style={{marginBottom: 30, marginTop: -10}}>
                  <ActivityIndicator size="small" color="#020617" />
                </View>
              :
                <>
                  {replies.map((reply) => {
                    return (
                      <Post post={reply} key={reply.stream_id} showParent={false} verticalDivider={true} style={{marginTop: -20}} />
                    );
                  })}
                </>
              }

            </View>

            {/** Reply postbox CTA */}
            <TouchableHighlight style={[tailwind('flex flex-row rounded-full mx-4 items-center'), { marginTop: -10, backgroundColor: "#F6F6F6", marginBottom: 25, padding: 5 }]} underlayColor="#EFEFEF" onPress={() => openReplyBox()}>
              <>
                <UserPfp details={user} height={35} />
                <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, lineHeight: 18, color: "#959595", marginLeft: 6}]}>Reply</Text>
              </>
            </TouchableHighlight>
          </View>
        :
          <ActivityIndicator size="small" color="#020617" />
        }
      </ScrollView>
    </Pane>
  )
}
