import React, { useState, useContext, useEffect, memo } from "react";
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback, Pressable, Image, Modal, ActivityIndicator, Dimensions } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import User, { UserPfp, Username } from "./User";
import Button from "./Button";
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import { context } from '../utils/config.js';
import { CommentIcon, InterpunctIcon, LikeIcon, RepostIcon, PostMenuIcon, CloseIcon } from "./Icons";
import TimeAgo from "./TimeAgo";
import { NewsItem } from "../screens/News";
import { getDomainName, getShorterString } from '../utils';
import reactStringReplace from 'react-string-replace';
import * as WebBrowser from 'expo-web-browser';
import useGetMentionedDid from "../hooks/useGetMentionedDid";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import ImageViewer from 'react-native-image-zoom-viewer';

const Post = React.memo((props) => {
  return <PostDisplay {...props}/>;
});

function PostDisplay({post, isReply = false, showParent = true, verticalDivider = false, style, showRepostDetails = true, showReactions= true, fontSize = 13.5, stylePostContent}) {
  const { user, setPostDetailsVis, setProfileSelected, setCategory, translateY, setEditedPost, hidePostbox } = useContext(GlobalContext);
  const [body, setBody] = useState(post?.content?.body);
  const [isDeleted, setIsDeleted] = useState(false);
  const tailwind = useTailwind();

  /** Will open pane with post details */
  function showPostDetails() {
    Haptics.selectionAsync();
    translateY.value = 0;
    setPostDetailsVis(post.content.master ? post.content.master : post.stream_id)
  }

  /** Will open pane with post details */
  function showProfileDetails(did) {
    Haptics.selectionAsync();
    translateY.value = 0;
    setProfileSelected(did)
  }

  /** Will select the post's category and display its feed */
  function selectCategory(category) {
    Haptics.selectionAsync();
    translateY.value = 0;
    setCategory(category);
  }

  /** Will update the body of the post */
  function callbackEditPost(_body) {
    setBody(_body);
    hidePostbox();
  }

  /** Will hide the deleted post from the UI */
  function callbackDeletePost(_body) {
    setIsDeleted(true);
  }

  /** Will open link in WebBrowser */
  async function openNews(url) {
    await WebBrowser.openBrowserAsync(url);
  }

  const cleanBody = () => {
    let replacedText;

    // Match @-mentions
    replacedText = reactStringReplace(body, /@(\w+)/g, (match, i) => (
      <InteractiveMention mentions={post.content.mentions} key={match + i} match={match} i={i} showProfileDetails={showProfileDetails} />
    ));

    // Match URLs
    replacedText = reactStringReplace(replacedText, /(https?:\/\/\S+)/g, (match, i) => (
      <TouchableWithoutFeedback key={match + i} onPress={() => openNews(match)}>
        <View>
          <Text style={{ color: '#ff6b17', fontFamily: "GmarketMedium", backgroundColor: "#FFF" }}>{match}</Text>
        </View>
      </TouchableWithoutFeedback>
    ));

    return replacedText;
  };

  if(!post || !post.content) {
    return null;
  }

  if(isDeleted) {
    return null;
  }

  return(
    <>
      <View style={[tailwind(`flex w-full flex-col mb-2 ${!verticalDivider ? "border-b border-slate-200" : "" } ${isReply ? "" : "px-5 py-4"}`), style]}>
        {/** Will show the parent post if any */}
        {(showParent && post.content.reply_to && post.reply_to_details) &&
          <>
            {/**<TouchableOpacity activeOpacity={0.6} style={[tailwind('flex flex-row items-center mb-3')]} onPress={() => showPostDetails()}>
              <>
                <CommentIcon color="#959595" />
                <Text style={tailwind('text-secondary items-center ml-1')}>Replied to <Username details={post.reply_to_creator_details} style={tailwind('text-secondary font-normal')} /></Text>
              </>
            </TouchableOpacity>*/}
              <Post stylePostContent={{paddingBottom: 20}} showReactions={false} post={{stream_id: post.reply_to, content: post.reply_to_details, creator_details: post.reply_to_creator_details, context_details: post.context_details, context: post.context}} isReply={true} verticalDivider={true} />
          </>
        }

        <View style={[tailwind('flex flex-row items-start')]}>
          <View style={[tailwind('justify-center flex flex-col items-center')]}>
            <TouchableHighlight onPress={() => showProfileDetails(post.creator_details.did)} underlayColor="transparent">
              <UserPfp height={37} details={post.creator_details} />
            </TouchableHighlight>
            {verticalDivider &&
              <View style={[tailwind('bg-slate-200 flex-1 mt-2 mb-1'), {width: 1}]} />
            }
          </View>
          <View style={[tailwind('flex flex-1 flex-col')]}>

            {/** Username and post metadata */}
            <View style={tailwind('ml-2 flex flex-row items-center')}>
              <View style={tailwind('flex flex-1 flex-row items-center flex-wrap')}>
                <TouchableHighlight onPress={() => showProfileDetails(post.creator)} underlayColor="transparent" >
                  <Username details={post.creator_details} />
                </TouchableHighlight>
                <View style={[tailwind('ml-2 mr-2')]}>
                  <InterpunctIcon />
                </View>

                {/** Display time */}
                <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, color: "#959595", marginRight: 6}]}><TimeAgo timestamp={post.timestamp} /></Text>

                {/** Display category name */}
                {(post.context != context && post.context != undefined) &&
                  <Button title={post.context_details?.context_details?.displayName} color="orange" size="xs" onPress={() => selectCategory({stream_id: post.context, content: post.context_details?.context_details})} />
                }
              </View>

              {/** Show post menu if user is creator */}
              {user?.did == post.creator &&
                <TouchableOpacity onPress={() => setEditedPost({value: post, callback: callbackEditPost, callbackDelete: callbackDeletePost})} style={[tailwind('flex flex-row items-center rounded-md py-2 px-1 -mr-1')]}>
                  <PostMenuIcon />
                </TouchableOpacity>
              }

            </View>

            {/** Post content */}
            <TouchableOpacity activeOpacity={0.7} style={[tailwind('ml-1 px-1 flex flex-1 rounded-md mr-8')]} onPress={() => showPostDetails()}>
              <>
                {(body && body != "") ?
                  <Text style={[tailwind('text-slate-900 font-normal'), { marginTop: 5, paddingBottom: 5, fontSize: fontSize, lineHeight: fontSize * 1.47 }, stylePostContent]}>
                    {cleanBody()}
                  </Text>
                :
                  <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-1 mb-1 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1 text-center')}>This post isn't available or has been deleted.</Text>
                  </View>
                }


                {/** Display media attached if any */}
                <View style={tailwind("items-start")}>
                  <Media media={post.content.media} />
                </View>
              </>
            </TouchableOpacity>

            {/** Display URL Metadata */}
            {(post.indexing_metadata?.urlMetadata && post.indexing_metadata?.urlMetadata.title) &&
              <View style={tailwind("w-full")}>
                <NewsItem item={{
                  title: getShorterString(post.indexing_metadata.urlMetadata.title, 60),
                  image: post.indexing_metadata.urlMetadata.image,
                  url: post.indexing_metadata.urlMetadata.source,
                  hostname: getDomainName(post.indexing_metadata.urlMetadata.source)
                }} />
              </View>
            }

            {/** Quoted post details if any */}
            {(showRepostDetails && post.content.repost != null) &&
              <View >
                <Post post={post.repost_details} style={[tailwind('rounded-md border border-secondary p-3'), {width: "95%"}]} />
              </View>
            }

            {/** Post CTAs */}
            {showReactions &&
              <View style={[tailwind('flex flex-row mt-0')]}>
                <CommentCTA post={post} />
                <LikeCTA post={post} />
                <RepostCTA post={post} />
              </View>
            }
          </View>
        </View>
      </View>
    </>
  )
}

const InteractiveMention = ({match, showProfileDetails, mentions}) => {
  const did = useGetMentionedDid(match, mentions);

  if(match == "everyone") {
    return(
      <Text style={{ color: '#ff6b17', fontFamily: "GmarketMedium" }}>@{match}</Text>
    )
  } else if(did) {
    return(
      <TouchableWithoutFeedback onPress={() => showProfileDetails(did)}>
        <Text style={{ color: '#ff6b17', fontFamily: "GmarketMedium" }}>@{match}</Text>
      </TouchableWithoutFeedback>
    )
  } else {
    return(
      <>@{match}</>
    )
  }

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
    <TouchableOpacity activeOpacity={0.7} style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} onPress={() => openReplyBox()} underlayColor="#f1f5f9">
      <>
        <CommentIcon />
        <Text style={[tailwind('text-slate-900 text-sm font-normal ml-1'), { fontFamily: "GmarketMedium" }]}>
          {post.count_replies}
        </Text>
      </>
    </TouchableOpacity>
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
    <TouchableOpacity activeOpacity={0.7} style={[tailwind('flex flex-row items-center ml-1 rounded-md py-1 px-2')]} onPress={() => like()} underlayColor="#f1f5f9">
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
    </TouchableOpacity>
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
    <TouchableOpacity activeOpacity={0.7} style={[tailwind('flex flex-row items-center ml-1 rounded-md py-1 px-2')]} onPress={() => showRepostPane()} underlayColor="#f1f5f9">
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
    </TouchableOpacity>
  )
}

const Media = ({media}) => {
  const tailwind = useTailwind();
  const statusBarHeight = useStatusBarHeight();
  const [loaded, setLoaded] = useState(false);
  const [modalVis, setModalVis] = useState(false);
  const { width } = Dimensions.get('window');

  if(media && media.length > 0) {
    return(
      <>
        <TouchableOpacity activeOpacity={0.8} style={[tailwind('rounded-md border border-secondary'), { marginBottom: 6, marginTop: 2 }]} onPress={() => setModalVis(true)}>
          <Image
            style={[tailwind('rounded-md'), { height: width - 87, width: width - 87 }]}
            onLoad={() => setLoaded(true)}
            loadingIndicatorSource={require("../assets/loader_001.gif")}
            source={loaded ?
                { uri: media[0].url }
              :
                require("../assets/loader_001.gif")
              } />
        </TouchableOpacity>
        {modalVis &&
          <Modal visible={true} transparent={true} style={{backgroundColor: "#000"}} statusBarTranslucent>
            <View style={[tailwind("h-full w-full"), {backgroundColor: "#000", paddingTop: statusBarHeight + 10}]}>
              <View style={[tailwind('flex justify-end w-full'), {height: 40}]}>
                <TouchableOpacity onPress={() => setModalVis(!modalVis)} style={{left: 20}} activeOpacity={0.6}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
              <ImageViewer imageUrls={media} onSwipeDown={() => setModalVis(!modalVis)} enableSwipeDown={true} loadingRender={() => { return <ActivityIndicator style={{marginTop: 10}} size="small" color="#fff" /> }}/>
            </View>
          </Modal>
        }
      </>
    )
  } else {
    return null
  }
}

export default Post;
