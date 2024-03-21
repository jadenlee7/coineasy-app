import React, { useState, useContext, useEffect, useCallback } from "react";
import { Text, View, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback, Pressable, Modal, ActivityIndicator, Dimensions, ScrollView, Animated, Platform, StyleSheet } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import { useRoute } from '@react-navigation/native';
import reactStringReplace from 'react-string-replace';
import { useNavigation } from '@react-navigation/core';
import ImageViewer from 'react-native-image-zoom-viewer';
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";

import { Image } from 'expo-image';

import Button from "./Button";
import TimeAgo from "./TimeAgo";
import { NewsItem } from "../screens/News";
import { UserPfp, Username } from "./User";
import { context } from '../utils/config.js';
import { GlobalContext } from "../contexts/GlobalContext";
import { getDomainName, getShorterString } from '../utils';
import useGetMentionedDid from "../hooks/useGetMentionedDid";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import { CommentIcon, InterpunctIcon, LikeIcon, RepostIcon, PostMenuIcon, CloseIcon, RepostIcon2, CommentIcon2, LikeIcon2, SuccessIcon } from "./Icons";
import { showMessage } from "react-native-flash-message";

const Post = React.memo((props) => {
  return <PostDisplay {...props}/>;
});

const PostDisplay = (props) => {

    const { user, setPostDetailsVis, setCategory, setEditedPost, hidePostbox, setScrollAnim, setOffsetAnim } = useContext(GlobalContext);
    const {
        post,
        isReply = false,
        showParent = true,
        verticalDivider = false,
        style,
        showRepostDetails = true,
        showReactions= true,
        fontSize = 13.5,
        stylePostContent,
        isRepost = false,
        quotedPost = false,
        notTouchable
    } = props

    let navigation;
    let route;

    try {
        navigation = useNavigation();
        route = useRoute();
    } catch (error) {
        console.log(error);        
    }

    const [body, setBody] = useState(post?.content?.body);
    const [postContext, setPostContext] = useState(post?.content?.context ? post.content.context : post?.context);
    const [postContextDetails, setPostContextDetails] = useState(post?.content?.context_details ? post.content.context_details : post?.context_details);
    const [listMedia, setListMedia] = useState(post?.content?.media)

    const [isDeleted, setIsDeleted] = useState(false);
    const [modalVis, setModalVis] = useState(false);
    const [imageIndex, setImageIndex] = useState(0)

    const [showSuccessMessage, setShowSuccessMessage] = useState(false)

    const [lengthMore,setLengthMore] = useState(false);
    const onTextLayout = useCallback(e => {
        var count_lines = 0
        e.nativeEvent.lines.map(e => {
            if(e.text.indexOf("\n") != 0) count_lines += 1
        })

        setLengthMore(count_lines > 4);
    },[]);

    const tailwind = useTailwind();

    const statusBarHeight = useStatusBarHeight();

    let list_images = [];
    if(listMedia?.length > 1){
        list_images = listMedia.map((elt) => {return({'url': elt[0].url})})
    }else if(listMedia?.length == 1){
        list_images = [{'url': listMedia[0].url ? listMedia[0].url : listMedia[0][0].url}]
    }

    /** Will open pane with post details */
    function showPostDetails() {
        Haptics.selectionAsync();
        setPostDetailsVis(post.content.master ? post.content.master : post.stream_id)
        navigation.navigate('PostDetails')
    }

    /** Will open pane with post details */
    function showProfileDetails(did) {
        Haptics.selectionAsync();
        navigation.navigate('ProfileSelected', { did })
        // translateY.value = 0;
        // setProfileSelected(did)
    }

    /** Will select the post's category and display its feed */
    function selectCategory(category) {
        Haptics.selectionAsync();
        setCategory(category);
        setScrollAnim(new Animated.Value(0));
        setOffsetAnim(new Animated.Value(0));

        if(route?.name !== 'Categories'){
            navigation.replace('Navigator')
        }
    }

    /** Will update the body of the post */
    function callbackEditPost(_body, _listMedia, _selectedCategory) {
        setBody(_body);
        setListMedia(_listMedia);
        setPostContext(_selectedCategory.stream_id)

        const temp_details = {}
        temp_details.context_details = _selectedCategory.content
        temp_details.context_id = _selectedCategory.stream_id
        setPostContextDetails({...temp_details})
        
        post.content.body = _body
        post.content.media = _listMedia
        post.context = _selectedCategory.stream_id
        post.context_details = temp_details

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
                <Text style={{ color: '#ff6b17', fontFamily: "GmarketMedium", backgroundColor: "#FFF" }}>{match}</Text>
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

    const onImagePress = (index) => {
        setModalVis(true)
        setImageIndex(index)
    }

    const Media = ({media, index, isRepost}) => {
        const tailwind = useTailwind();
        const screenWidth = Dimensions.get('window');
        const [ratioHeight, setRatioHeight] = useState(screenWidth.width - 87)

        const renderImage = (values) => {
            const {width, height} = values.nativeEvent.source
            if(width > height){
                const ratioWidth = (isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87)/width
                const newHeight = height*ratioWidth < screenWidth.width - 87 ? height*ratioWidth : screenWidth.width - 87
                setRatioHeight(newHeight)
            }
        }

        if(media && media.length > 0) {
            return(
                <View style={{marginLeft: index && index != 0 ? 8 : 0}} key={Math.random()}>
                    <TouchableOpacity 
                        activeOpacity={0.8} 
                        style={[tailwind('rounded-md border border-secondary'), { marginBottom: 6, marginTop: 2 }]} 
                        onPress={() => onImagePress(index)}
                    >
                        <Image
                            style={[
                                tailwind('rounded-md'), 
                                { 
                                    height: ratioHeight,
                                    width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87 ,
                                    marginLeft: isRepost && !quotedPost ? -20 : 0,
                                }
                            ]}
                            source={media[0].url ? media[0].url : media[0][0].url}
                            placeholder={require("../assets/loader_001.gif")}
                            transition={1000}
                            contentFit="contain"
                            onLoad={(values) => renderImage(values)}
                            priority="high"
                        />

                        {/* <Image
                            style={[
                                tailwind('rounded-md'), 
                                { 
                                    height: ratioHeight,
                                    width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87 ,
                                    marginLeft: isRepost && !quotedPost ? -20 : 0,
                                }
                            ]}
                            onLoad={(values) => renderImage(values)}
                            source={{ uri: media[0].url ? media[0].url : media[0][0].url}}
                            defaultSource={require("../assets/loader_001.gif")} // A static image to display while loading the image source.
                            progressiveRenderingEnabled={true}
                        /> */}
                    </TouchableOpacity>
                </View>
            )
        } else {
            return null
        }
    }

    // if(body == 'Gma'){
    //     console.log('POSTTTT');
    //     console.log(post);
    // }

    const delay = ms => new Promise(res => setTimeout(res, ms));


    return(
        <>
            <View style={[tailwind(`flex w-full flex-col ${!verticalDivider ? "border-b border-slate-200" : "" } ${isReply ? "" : "px-5 py-4"}`), style, {backgroundColor: 'white',}]}>
                {/** Will show the parent post if any */}
                {(showParent && post.content.reply_to && post.reply_to_details) &&
                    <Post 
                        stylePostContent={{paddingBottom: 10}}
                        showReactions={true} 
                        post={{
                            stream_id: post.reply_to,
                            content: post.reply_to_details,
                            creator_details: post.reply_to_creator_details,
                            context_details: postContextDetails,
                            context: postContext
                        }}
                        isReply={true}
                        verticalDivider={true} 
                    />
                }

                <View style={[tailwind('flex flex-row items-start')]}>
                    <View style={[tailwind('justify-center flex flex-col items-center')]}>
                        <TouchableHighlight onPress={() => showProfileDetails(post.creator_details.did)} underlayColor="transparent">
                            <UserPfp height={37} details={post.creator_details} origin={'feed'}/>
                        </TouchableHighlight>

                        {verticalDivider && <View style={[tailwind('bg-slate-200 flex-1 mt-2 mb-1'), {width: 1}]} />}
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
                                <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, color: "#959595", marginRight: 6}]}>
                                    <TimeAgo timestamp={isReply ? post.content.timestamp : post.timestamp} />
                                </Text>

                                {/** Display category name */}
                                {(postContext != undefined && (postContextDetails?.context_details?.displayName || postContextDetails?.displayName)) &&
                                    <Button 
                                        title={postContextDetails?.displayName ? postContextDetails.displayName : postContextDetails?.context_details?.displayName}
                                        color="orange"
                                        size="xs"
                                        onPress={() => selectCategory({stream_id: postContext, content: postContextDetails?.context_details ? postContextDetails.context_details : postContextDetails})} 
                                    />
                                }
                            </View>

                            {/** Show post menu */}
                            <TouchableOpacity 
                                onPress={() => 
                                    {user?.did == post.creator ? 
                                        setEditedPost({value: post, callback: callbackEditPost, callbackDelete: callbackDeletePost}) 
                                        : setEditedPost({type:'notCreator',value: post, callback: callbackEditPost, callbackDelete: callbackDeletePost})
                                    }
                                } 
                                style={[tailwind('flex flex-row items-center rounded-md py-2 px-1 -mr-1')]}
                            >
                                <PostMenuIcon />
                            </TouchableOpacity>
                        </View>

                        {/** Post content */}
                        <TouchableOpacity 
                            activeOpacity={0.7} 
                            style={[tailwind('ml-1 px-1 rounded-md mr-8')]} 
                            onPress={() => showPostDetails()} 
                            disabled={notTouchable ? true : false}
                        >
                                {body && body == 'Message sans body' ?(
                                    <Text style={[tailwind('text-slate-900 font-normal'), { marginTop: 5, paddingBottom: 0, }, stylePostContent]} />
                                ) : (body && body != "") ?
                                    <>
                                        <Text 
                                            selectable
                                            onTextLayout={onTextLayout}
                                            numberOfLines={notTouchable ? undefined : 6}
                                            style={[
                                                tailwind('text-slate-900 font-normal'), 
                                                {
                                                    marginTop: 5,
                                                    paddingBottom: 5,
                                                    fontSize: fontSize,
                                                    lineHeight: fontSize * 1.47
                                                }, 
                                                stylePostContent
                                            ]
                                        }>
                                            {cleanBody()}
                                        </Text>
                                        {lengthMore && typeof notTouchable === 'undefined' &&
                                            <Text 
                                                onPress={() => showPostDetails()} 
                                                style={{ lineHeight: 21,marginBottom: 10,color: '#FF6E31', fontWeight: 'bold', }}
                                            >
                                                ... Show more
                                            </Text>
                                        }
                                    </>
                                :
                                    <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-1 mb-1 rounded-md')} >
                                        <Text style={tailwind('text-secondary items-center ml-1 text-center')}>This post isn't available or has been deleted.</Text>
                                    </View>
                                }


                                {/** Display media attached if any */}
                                {listMedia?.length == 1 ? (
                                    <View style={tailwind("items-start")}>
                                        <Media media={listMedia} isRepost={isRepost}/>
                                    </View>
                                ) : listMedia?.length > 1 ? (
                                        <ScrollView horizontal={true} style={{width: quotedPost && isRepost ? Dimensions.get('window').width - 105 : quotedPost ? Dimensions.get('window').width - 135 : Dimensions.get('window').width}}>
                                            { listMedia?.map((item, index) => {
                                                return(
                                                    <Media media={item} index={index} key={Math.random()} isRepost={isRepost}/>
                                                )
                                            })}
                                            <View style={{width: 70}} key={Math.random()}/>
                                        </ScrollView>
                                ) : null}

                                {modalVis && listMedia.length > 0 &&
                                    <Modal 
                                        visible={true}
                                        transparent={true}
                                        style={{backgroundColor: "#000"}}
                                        statusBarTranslucent
                                        onRequestClose={() => setModalVis(false)}
                                    >
                                        <View style={[tailwind("h-full w-full"), {backgroundColor: "#000", paddingTop: statusBarHeight + 10}]}>
                                            <View style={[tailwind('flex justify-end w-full'), {height: 40}]}>
                                                <TouchableOpacity onPress={() => setModalVis(!modalVis)} style={{left: 20}} activeOpacity={0.6}>
                                                    <CloseIcon />
                                                </TouchableOpacity>
                                            </View>

                                            {showSuccessMessage && (
                                                <View style={{backgroundColor: '#3D3D3D',width: Dimensions.get('window').width-20,alignSelf: 'center',flexDirection:'row',alignItems: 'center', height: 60,borderRadius: 10}}>
                                                    <SuccessIcon style={{marginLeft: 20,}}/>
                                                    <Text style={{marginLeft: 10,color:'white'}}>Media saved to library !</Text>
                                                </View>
                                            )}

                                            <ImageViewer 
                                                imageUrls={list_images}
                                                index={imageIndex}
                                                onSwipeDown={() => setModalVis(!modalVis)} 
                                                enableSwipeDown={true} 
                                                loadingRender={() => { return (
                                                    <ActivityIndicator style={{marginTop: 10}} 
                                                        size="small" 
                                                        color="#fff" 
                                                    /> 
                                                )}}
                                                onSave={async (uri) => {
                                                    try {
                                                        // Request device storage access permission
                                                        const { status } = await MediaLibrary.requestPermissionsAsync();
                                                        if (status === "granted") {
                                                            const splitted = uri.split('/')
                                                            const filename = splitted[splitted.length-1]
                                                            
                                                            const fileUri = FileSystem.documentDirectory + filename + `.jpg`;
                                                            const res = await FileSystem.downloadAsync(uri, fileUri);
                                                            await MediaLibrary.saveToLibraryAsync(res.uri);

                                                            setShowSuccessMessage(true)
                                                            await delay(2000);
                                                            setShowSuccessMessage(false)

                                                        } else {
                                                            alert('Please enable permission to access your media library')
                                                        }
                                                      } catch (error) {
                                                        console.log(error);
                                                        alert('Failed to save media')
                                                      }
                                                }}
                                                menus={(props) => {
                                                    return(
                                                        <Modal 
                                                            animationType="slide" 
                                                            transparent={true}
                                                            onRequestClose={props.cancel}
                                                        >
                                                            <View style={styles.centeredView}>
                                                                <View style={styles.modalView}>
                                                                    <Button color="orange" size='centered' onPress={props.saveToLocal} title="Save to the Album" style={{marginBottom: 0, marginTop: 0,width:'100%'}} />

                                                                    <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8'), {marginTop: 20,width:'100%',alignItems: 'center',}]} onPress={props.cancel} underlayColor="#f8fafc">
                                                                        <Text style={[{fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18 }]}>Cancel</Text>
                                                                    </TouchableHighlight>
                                                                </View>
                                                            </View>
                                                        </Modal>
                                                    )
                                                }}
                                            />
                                        </View>
                                    </Modal>
                                }
                        </TouchableOpacity>

                        {/** Display URL Metadata */}
                        {(post.indexing_metadata?.urlMetadata && post.indexing_metadata?.urlMetadata.title) &&
                            <View style={{width: Platform.OS == 'ios' ? '97.5%' : '97%',marginLeft: 8}}>
                                <NewsItem 
                                    item={{
                                        title: getShorterString(post.indexing_metadata.urlMetadata.title, 60),
                                        image: post.indexing_metadata.urlMetadata.image,
                                        url: post.indexing_metadata.urlMetadata.source,
                                        hostname: getDomainName(post.indexing_metadata.urlMetadata.source)
                                    }} 
                                />
                            </View>
                        }

                        {/** Quoted post details if any */}
                        {(showRepostDetails && post.content.repost != null) &&
                            <View style={{width: Platform.OS == 'ios' ? '97.5%' : '97%',marginLeft: 8}}>
                                <Post post={post.repost_details} quotedPost={true} style={[tailwind('rounded-md border border-secondary p-3')]} />
                            </View>
                        }

                        {/** Post CTAs */}
                        {showReactions &&
                            <View style={[
                                tailwind('flex flex-row'), 
                                {
                                    marginTop: showRepostDetails && post.content.repost != null ? 6 : showParent ? -3 : 0,
                                    marginBottom: showParent ? 6 : 0,
                                }
                            ]}>
                                <CommentCTA post={post} isReply={isReply} />
                                <LikeCTA post={post} isReply={isReply} />
                                <RepostCTA post={post} isReply={isReply} />
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

export const CommentCTA = ({post, isReply}) => {
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
        <CommentIcon2 />
        <Text style={[tailwind('text-slate-900 text-sm font-normal ml-1'), { fontFamily: "GmarketMedium" }]}>
          {isReply && typeof post.reply_to_details?.count_replies !== 'undefined' ? post.reply_to_details?.count_replies : isReply ? post.content.count_replies : post.count_replies}
        </Text>
      </>
    </TouchableOpacity>
  )
}


export const LikeCTA = ({post, isReply}) => {
  const [hasLiked, setHasLiked] = useState(false);
  const numLikes = 
    isReply && typeof post.reply_to_details?.count_likes !== 'undefined' && post.reply_to_details?.count_likes ? 
        post.reply_to_details?.count_likes 
    : isReply && (post.content.count_likes || post.content.count_likes == 0) ? 
        post.content.count_likes 
    : post.count_likes
  const [countLikes, setCountLikes] = useState(numLikes ? numLikes : 0);
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
      }else{
        setHasLiked(false);
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
    //   if(Number.isInteger(post.count_likes)){
    //       setCountLikes(post.count_likes + 1);
    //   }

      setCountLikes(countLikes ? countLikes+1 : numLikes+1)

      let res = await orbis.react(
        post.stream_id,
        "like"
      );
    } else {
      alert("You must be connected to react to posts.");
    }
  }

  return(
    <TouchableOpacity activeOpacity={0.7} style={[tailwind('flex flex-row items-center ml-1 rounded-md py-1 px-2')]} onPress={() => like()} underlayColor="#f1f5f9">
      <>
        {hasLiked ?
          <LikeIcon2 active={true} />
        :
          <LikeIcon2 active={false} />
        }

        <Text style={[tailwind('text-sm font-normal ml-1'), { fontFamily: "GmarketMedium", color: hasLiked ? "#FF6B17" : "#0F172A" }]}>
          {countLikes ? countLikes : numLikes}
        </Text>
      </>
    </TouchableOpacity>
  )
}

export const RepostCTA = ({post, isReply}) => {
  const { user, orbis, showConnectModal, setShowConnectModal, setRepost } = useContext(GlobalContext);
  const [hasLiked, setHasLiked] = useState(false);
  const numRepost = 
    isReply && typeof post.reply_to_details?.count_repost !== 'undefined' && post.reply_to_details?.count_repost ? 
        post.reply_to_details?.count_repost 
    : isReply && (post.content.count_repost || post.content.count_repost == 0) ? 
        post.content.count_repost 
    : post.count_repost
  const [countReposts, setCountReposts] = useState(numRepost ? numRepost : 0);
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
          <RepostIcon2 color="#FF6B17" />
        :
          <RepostIcon2 />
        }

        <Text style={[tailwind('text-sm font-normal ml-1'), { fontFamily: "GmarketMedium", color: hasLiked ? "#FF6B17" : "#0F172A" }]}>
            {(countReposts || countReposts == 0) ? countReposts : numRepost}
        </Text>
      </>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      marginTop: 22,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalView: {
      margin: 20,
      backgroundColor: 'white',
      borderRadius: 20,
      padding: 35,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
});

export default Post;
