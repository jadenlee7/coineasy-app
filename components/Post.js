import React, { useState, useContext, useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, Image } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import User, { UserPfp, Username } from "./User";
import Button from "./Button";
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import moment from 'moment';
import { context } from '../utils/config.js';
import { CommentIcon } from "./Icons";

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
                <Svg width="4" height="4" viewBox="0 0 4 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <Circle cx="2" cy="2" r="2" fill="#959595"/>
                </Svg>
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
          <Svg width="18" height="16" viewBox="0 0 22 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M2.04531 11.2064L9.80977 18.527C10.132 18.8308 10.5574 19 11 19C11.4426 19 11.868 18.8308 12.1902 18.527L19.9547 11.2064C21.2609 9.9784 22 8.25566 22 6.45481V6.20313C22 3.16989 19.8301 0.58361 16.8695 0.0845793C14.9102 -0.245215 12.9164 0.401355 11.5156 1.816L11 2.33672L10.4844 1.816C9.08359 0.401355 7.08984 -0.245215 5.13047 0.0845793C2.16992 0.58361 0 3.16989 0 6.20313V6.45481C0 8.25566 0.739062 9.9784 2.04531 11.2064Z" fill="#FF6B17"/>
          </Svg>
        :
          <Svg width="18" height="16" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M9.70234 19.1178L9.59492 19.019L2.0668 12.028C0.747656 10.8034 0 9.08462 0 7.28423V7.14243C0 4.11743 2.14844 1.52212 5.12187 0.954928C6.81484 0.628366 8.54648 1.01938 9.92578 1.99048C10.3125 2.26548 10.6734 2.58344 11 2.94868C11.1805 2.74243 11.3738 2.55337 11.5801 2.37719C11.7391 2.23969 11.9023 2.11079 12.0742 1.99048C13.4535 1.01938 15.1852 0.628366 16.8781 0.950632C19.8516 1.51782 22 4.11743 22 7.14243V7.28423C22 9.08462 21.2523 10.8034 19.9332 12.028L12.4051 19.019L12.2977 19.1178C11.9453 19.4444 11.4812 19.6291 11 19.6291C10.5188 19.6291 10.0547 19.4487 9.70234 19.1178ZM10.2738 5.23032C10.2566 5.21743 10.2438 5.20024 10.2309 5.18305L9.46602 4.32368L9.46172 4.31938C8.46914 3.20649 6.96953 2.69946 5.50859 2.97876C3.50625 3.36118 2.0625 5.10571 2.0625 7.14243V7.28423C2.0625 8.50883 2.57383 9.68188 3.47188 10.5155L11 17.5065L18.5281 10.5155C19.4262 9.68188 19.9375 8.50883 19.9375 7.28423V7.14243C19.9375 5.11001 18.4937 3.36118 16.4957 2.97876C15.0348 2.69946 13.5309 3.21079 12.5426 4.31938C12.5426 4.31938 12.5426 4.31938 12.5383 4.32368C12.534 4.32798 12.5383 4.32368 12.534 4.32798L11.7691 5.18735C11.7562 5.20454 11.7391 5.21743 11.7262 5.23462C11.5328 5.42798 11.2707 5.5354 11 5.5354C10.7293 5.5354 10.4672 5.42798 10.2738 5.23462V5.23032Z" fill="black"/>
          </Svg>
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
          <Svg width="23" height="17" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M19.5 9C19.5 7.76808 19.4536 6.54699 19.3624 5.3384C19.2128 3.35425 17.6458 1.78724 15.6616 1.63757C14.453 1.54641 13.2319 1.5 12 1.5C10.7681 1.5 9.54699 1.54641 8.3384 1.63757C6.35425 1.78724 4.78724 3.35425 4.63757 5.3384C4.62097 5.55852 4.60585 5.77906 4.59222 6M19.5 9L22.5 6M19.5 9L16.5 6M4.5 9C4.5 10.2319 4.54641 11.453 4.63757 12.6616C4.78724 14.6458 6.35425 16.2128 8.3384 16.3624C9.54699 16.4536 10.7681 16.5 12 16.5C13.2319 16.5 14.453 16.4536 15.6616 16.3624C17.6458 16.2128 19.2128 14.6458 19.3624 12.6616C19.379 12.4415 19.3941 12.2209 19.4078 12M4.5 9L7.5 12M4.5 9L1.5 12" stroke="#FF6B17" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round"/>
          </Svg>
        :
          <Svg width="23" height="17" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Path d="M19.5 9C19.5 7.76808 19.4536 6.54699 19.3624 5.3384C19.2128 3.35425 17.6458 1.78724 15.6616 1.63757C14.453 1.54641 13.2319 1.5 12 1.5C10.7681 1.5 9.54699 1.54641 8.3384 1.63757C6.35425 1.78724 4.78724 3.35425 4.63757 5.3384C4.62097 5.55852 4.60585 5.77906 4.59222 6M19.5 9L22.5 6M19.5 9L16.5 6M4.5 9C4.5 10.2319 4.54641 11.453 4.63757 12.6616C4.78724 14.6458 6.35425 16.2128 8.3384 16.3624C9.54699 16.4536 10.7681 16.5 12 16.5C13.2319 16.5 14.453 16.4536 15.6616 16.3624C17.6458 16.2128 19.2128 14.6458 19.3624 12.6616C19.379 12.4415 19.3941 12.2209 19.4078 12M4.5 9L7.5 12M4.5 9L1.5 12" stroke="#0F172A" strokeWidth="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </Svg>
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
