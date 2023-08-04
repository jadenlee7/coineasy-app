import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView } from 'react-native';
import Pane from "../Pane";
import Post from "../Post";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';

export default function PostPane() {
  const { user, orbis, showConnectModal, setShowConnectModal, postDetailsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [ post, setPost ] = useState();
  const [ replies, setReplies ] = useState([]);

  /** Check if user liked this post */
  useEffect(() => {
    getPost();
    getReplies();

    async function getPost() {
      let { data, error } = await orbis.getPost(postDetailsVis);
      if(data) {
        setPost(data);
      }
    }

    async function getReplies() {
      const { data, error } = await orbis.getPosts({ master: postDetailsVis });

      if(data) {
        setReplies(data);
      }
      console.log("replies:", data);
    }
  }, []);

  return(
    <Pane>
      <ScrollView style={tailwind('pt-4')}>
        {post ?
          <View style={{marginTop: -10}}>
            {/** Show master post */}
            <Post post={post} verticalDivider={true} />

            {/** Show replies */}
            <View style={tailwind('flex flex-col')}>
              {replies.map((reply) => {
                return (
                  <Post post={reply} key={reply.stream_id} showParent={false} verticalDivider={true} />
                );
              })}
            </View>
          </View>
        :
          <ActivityIndicator size="small" color="#020617" />
        }
      </ScrollView>
    </Pane>
  )
}
