import React, { useState, useContext, useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, Image } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import User, { UserPfp, Username } from "./User";
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import moment from 'moment';

moment.updateLocale('en', {
  relativeTime: {
    s: 'sec.',
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
  const { setPostDetailsVis, setProfileSelected } = useContext(GlobalContext);
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

  if(!post?.content) {
    return null;
  }

  return(
    <>
      <View style={[tailwind(`flex w-full flex-col mb-2 ${!verticalDivider ? "border-b border-slate-200" : "" } ${isReply ? "" : "px-5 py-4"}`), style]}>
        {/** Will show the parent post if any */}
        {(showParent && post.content.reply_to && post.reply_to_details) &&
          <Post post={{stream_id: post.reply_to, content: post.reply_to_details, creator_details: post.reply_to_creator_details}} isReply={true} verticalDivider={true} />
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
              <TouchableHighlight onPress={() => showProfileDetails(post.creator)} underlayColor="transparent">
                <Username details={post.creator_details} />
              </TouchableHighlight>
              <View style={[tailwind('ml-2 mr-2')]}>
                <Svg width="4" height="4" viewBox="0 0 4 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <Circle cx="2" cy="2" r="2" fill="#959595"/>
                </Svg>
              </View>
              <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, color: "#959595"}]}><TimeAgo timestamp={post.timestamp} /></Text>
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
              <CommentIcon post={post} />
              <LikeIcon post={post} />
              <RepostIcon post={post} />
            </View>
          </View>
        </View>
      </View>
    </>
  )
}

export const CommentIcon = ({post}) => {
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
        <Svg width="18" height="16" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <Path d="M5.31095 15.8137C5.86525 15.4098 6.58283 15.3066 7.22736 15.5387C8.36603 15.9512 9.6422 16.1875 11 16.1875C16.3582 16.1875 19.9375 12.7285 19.9375 9.3125C19.9375 5.89648 16.3582 2.4375 11 2.4375C5.64181 2.4375 2.06252 5.89648 2.06252 9.3125C2.06252 10.6875 2.59533 12.0109 3.5965 13.1453C3.96603 13.5621 4.1465 14.1121 4.10353 14.6707C4.04338 15.4484 3.85861 16.1617 3.61799 16.7934C4.34845 16.4539 4.95431 16.0758 5.31095 15.818V15.8137ZM0.910954 17.5582C0.988298 17.4422 1.06134 17.3262 1.13009 17.2102C1.55978 16.4969 1.96799 15.5602 2.04963 14.5074C0.760564 13.0422 1.69175e-05 11.2504 1.69175e-05 9.3125C1.69175e-05 4.37539 4.92424 0.375 11 0.375C17.0758 0.375 22 4.37539 22 9.3125C22 14.2496 17.0758 18.25 11 18.25C9.40588 18.25 7.89338 17.975 6.52697 17.4809C6.01564 17.8547 5.18205 18.366 4.19377 18.7957C3.54494 19.0793 2.80588 19.3371 2.04103 19.4875C2.00666 19.4961 1.97228 19.5004 1.93791 19.509C1.74884 19.5434 1.56408 19.5734 1.37072 19.5906C1.36213 19.5906 1.34924 19.5949 1.34064 19.5949C1.1215 19.6164 0.902361 19.6293 0.68322 19.6293C0.403923 19.6293 0.154704 19.4617 0.0472825 19.2039C-0.0601393 18.9461 1.69086e-05 18.6539 0.193376 18.4563C0.369548 18.2758 0.528533 18.0824 0.678923 17.8762C0.75197 17.7773 0.82072 17.6785 0.885173 17.5797C0.88947 17.5711 0.893767 17.5668 0.898064 17.5582H0.910954Z" fill="black"/>
        </Svg>
        <Text style={[tailwind('text-slate-900 text-sm font-normal ml-1'), { fontFamily: "GmarketMedium" }]}>
          {post.count_replies}
        </Text>
      </>
    </TouchableHighlight>
  )
}


export const LikeIcon = ({post}) => {
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

export const RepostIcon = ({post}) => {
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
