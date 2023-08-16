import React, { useState, useContext, useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, Image } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import User, { UserPfp, Username } from "./User";
import Button from "./Button";
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import moment from 'moment';
import { context } from '../utils/config.js';
import { CommentIcon, InterpunctIcon, LikeIcon, RepostIcon } from "./Icons";

moment.updateLocale('en', {
  relativeTime: {
    s: 'secs.',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    w: '1w',
    ww: '%dw',
    M: '1m',
    MM: '%dm',
  },
});

export default function Post({post, isReply = false, showParent = true, verticalDivider = false, style, showRepostDetails = true, fontSize = 13.5}) {
  const { setPostDetailsVis, setProfileSelected, setCategory } = useContext(GlobalContext);
  const tailwind = useTailwind();

  /** Will open pane with post details */
  function showPostDetails() {
    Haptics.selectionAsync();
    setPostDetailsVis(post.content.master ? post.content.master : post.stream_id)
  }

  /** Will open pane with post details */
  function showProfileDetails(did) {
    Haptics.selectionAsync();
    setProfileSelected(did)
  }

  if(!post || !post.content) {
    return null;
  }

  return(
    <>
      <View style={[tailwind(`flex w-full flex-col mb-2 ${!verticalDivider ? "border-b border-slate-200" : "" } ${isReply ? "" : "px-5 py-4"}`), style]}>
        {/** Will show the parent post if any */}
        {(showParent && post.content.reply_to && post.reply_to_details) &&
          <>
            <TouchableOpacity activeOpacity={0.6} style={[tailwind('flex flex-row items-center mb-3')]} onPress={() => showPostDetails()}>
              <>
                <CommentIcon color="#959595" />
                <Text style={tailwind('text-secondary items-center ml-1')}>Replied to <Username details={post.reply_to_creator_details} style={tailwind('text-secondary font-normal')} /></Text>
              </>
            </TouchableOpacity>
            {/**<Post post={{stream_id: post.reply_to, content: post.reply_to_details, creator_details: post.reply_to_creator_details, context_details: post.context_details, context: post.context}} isReply={true} verticalDivider={true} />*/}
          </>
        }

        <View style={[tailwind('flex flex-row items-start')]}>
          <View style={[tailwind('justify-center flex flex-col items-center')]}>
            <TouchableHighlight onPress={() => showProfileDetails(post.creator)} underlayColor="transparent">
              <UserPfp height={37} details={post.creator_details} />
            </TouchableHighlight>
            {verticalDivider &&
              <View style={[tailwind('bg-slate-200 flex-1 mt-2 mb-1'), {width: 1}]} />
            }
          </View>
          <View style={[tailwind('flex flex-col')]}>

            {/** Username and post metadata */}
            <View style={tailwind('ml-2 flex flex-row items-center')}>
              <TouchableHighlight onPress={() => showProfileDetails(post.creator)} underlayColor="transparent" >
                <Username details={post.creator_details} />
              </TouchableHighlight>
              <View style={[tailwind('ml-2 mr-2')]}>
                <InterpunctIcon />
              </View>
              <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, color: "#959595", marginRight: 6}]}><TimeAgo timestamp={post.timestamp} /></Text>

              {/** Display category name */}
              {(post.context != context && post.context != undefined) &&
                <Button title={post.context_details?.context_details?.displayName} color="orange" size="xs" onPress={() => setCategory({stream_id: post.context, content: post.context_details?.context_details})} />
              }

            </View>

            {/** Post content */}
            <TouchableHighlight style={[tailwind('ml-1 px-1 flex flex-1 rounded-md mr-8')]} onPress={() => showPostDetails()} underlayColor="#f8fafc">
              <>
                <Text style={[tailwind('text-slate-900 font-normal'), { fontFamily: "GmarketMedium", marginTop: 5, paddingBottom: 5, fontSize: fontSize, lineHeight: 19 }]}>
                  {post.content.body}
                </Text>

                {/** Display media attached if any */}
                <Media media={post.content.media} />
              </>
            </TouchableHighlight>

            {/** Quoted post details if any */}
            {(showRepostDetails && post.content.repost != null) &&
              <View >
                <Post post={post.repost_details} style={[tailwind('rounded-md border border-secondary p-3'), {width: "95%"}]} />
              </View>
            }

            {/** Post CTAs */}
            <View style={[tailwind('flex flex-row mt-0')]}>
              <CommentCTA post={post} />
              <LikeCTA post={post} />
              <RepostCTA post={post} />
            </View>
          </View>
        </View>
      </View>
    </>
  )
}

export const CommentCTA = ({post}) => {
  const { setPostDetailsVis, showPostbox, setReplyTo } = useContext(GlobalContext);
  const tailwind = useTailwind();

  /** Open postbox and save reply to */
  function openReplyBox() {
    showPostbox();
    setReplyTo(post);
  }

  return(
    <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} onPress={() => openReplyBox()} underlayColor="#f1f5f9">
      <>
        <CommentIcon />
        <Text style={[tailwind('text-slate-900 text-sm font-normal ml-1'), { fontFamily: "GmarketMedium" }]}>
          {post.count_replies}
        </Text>
      </>
    </TouchableHighlight>
  )
}


export const LikeCTA = ({post}) => {
  const [hasLiked, setHasLiked] = useState(false);
  const [countLikes, setCountLikes] = useState(post.count_likes);
  const { user, orbis, showConnectModal, setShowConnectModal } = useContext(GlobalContext);
  const tailwind = useTailwind();

  /** Check if user liked this post */
  useEffect(() => {
    if(user) {
      getReaction();
    }

    async function getReaction() {
      let { data, error } = await orbis.getReaction(post.stream_id, user.did);
      if(data && data.type && data.type == "like") {
        setHasLiked(true);
      }
    }
  }, [user]);

  /** Will like the post */
  async function like() {
    if(hasLiked == true) {
      console.log("User already liked post.");
      return;
    }
    if(user) {
      setHasLiked(true);
      Haptics.selectionAsync();
      setCountLikes(post.count_likes + 1);
      let res = await orbis.react(
        post.stream_id,
        "like"
      );
      console.log("res:", res);
    } else {
      alert("You must be connected to react to posts.");
    }
  }

  return(
    <TouchableHighlight style={[tailwind('flex flex-row items-center ml-1 rounded-md py-1 px-2')]} onPress={() => like()} underlayColor="#f1f5f9">
      <>
        {hasLiked ?
          <LikeIcon active={true} />
        :
          <LikeIcon active={false} />
        }

        <Text style={[tailwind('text-sm font-normal ml-1'), { fontFamily: "GmarketMedium", color: hasLiked ? "#FF6B17" : "#0F172A" }]}>
          {countLikes}
        </Text>
      </>
    </TouchableHighlight>
  )
}

export const RepostCTA = ({post}) => {
  const { user, orbis, showConnectModal, setShowConnectModal, setRepost } = useContext(GlobalContext);
  const [hasLiked, setHasLiked] = useState(false);
  const [countReposts, setCountReposts] = useState(post.count_repost);
  const tailwind = useTailwind();

  /** Check if user liked this post */
  useEffect(() => {
    if(user) {
      getReaction();
    }

    async function getReaction() {
      let { data, error } = await orbis.getReaction(post.stream_id, user.did);
      if(data && data.type && data.type == "like") {
        //setHasLiked(true);
      }
    }
  }, [user]);

  /** Will render the repost pane */
  function showRepostPane() {
    setRepost(post);
    Haptics.selectionAsync();
  }

  return(
    <TouchableHighlight style={[tailwind('flex flex-row items-center ml-1 rounded-md py-1 px-2')]} onPress={() => showRepostPane()} underlayColor="#f1f5f9">
      <>
        {hasLiked ?
          <RepostIcon color="#FF6B17" />
        :
          <RepostIcon />
        }

        <Text style={[tailwind('text-sm font-normal ml-1'), { fontFamily: "GmarketMedium", color: hasLiked ? "#FF6B17" : "#0F172A" }]}>
          {countReposts}
        </Text>
      </>
    </TouchableHighlight>
  )
}

const Media = ({media}) => {
  const tailwind = useTailwind();
  if(media && media.length > 0) {
    return(
      <View style={[tailwind('rounded-md border border-secondary'), { marginBottom: 6, marginTop: 2 }]}>
        <Image
          style={[tailwind('rounded-md'), { height: 200, width: 200 }]}
          source={{
            uri: media[0].url,
          }} />
      </View>
    )
  } else {
    return null
  }
}


const TimeAgo = ({ timestamp }) => {
  const tailwind = useTailwind();
  if(timestamp) {
    const timeAgo = moment(timestamp * 1000).fromNow();
    return <Text style={tailwind("text-xs ml-1 text-slate-600")}>{timeAgo}</Text>
  } else {
    return null;
  }
}
