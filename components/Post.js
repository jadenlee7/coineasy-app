import React, { useState, useContext, useEffect, useCallback, useRef, useMemo } from "react";
import { Text, View, Image as RNImage, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback, Pressable, Modal, ActivityIndicator, Dimensions, ScrollView, Animated, Platform, StyleSheet, Alert, Linking } from 'react-native';

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
import { GlobalContext } from "../contexts/GlobalContext";
import { getDomainName, getShorterString } from '../utils';
import useGetMentionedDid from "../hooks/useGetMentionedDid";
import { AntDesign, Entypo, Feather } from "@expo/vector-icons";
import { InterpunctIcon, PostMenuIcon, RepostIcon2, CommentIcon2, LikeIcon2, SuccessIcon } from "./Icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import moment from "moment";

// const listPost = [
//     1712122694, 
//     1711023640, 
//     1710312877, 
//     1710147978, 
//     1709716199, 
//     1709544853, 
//     1709205686, 
//     1709094196, 
//     1708680202, 
//     1708578728, 
//     1708499834, 
//     1707873845, 
// ]

const listPostFailure = [
    1707811820, // --> bug 2
    1707787339, // --> bug 2
    1707388758, // --> bug 2
    1707379256, // --> bug 2
    1707109006,  // --> bug 2
    1708499786, // -->  bug 2
    1708420612, // -->  bug 2
    1708403907, // -->  bug 2
    1708322086, // -->  bug 2
    1708321902, // -->  bug 2
    1708321741, // -->  bug 2
    1707896173, // -->  bug 2
    1708500015, // -->  bug 2
    1708680086, // -->  bug 2
]

const Post = React.memo((props) => {
  return <PostDisplay {...props}/>;
});

const PostDisplay = (props) => {


    const { user, setPostDetailsVis, setCategory, setEditedPost, hidePostbox, setScrollAnim, setOffsetAnim, modalPostSettingsRef } = useContext(GlobalContext);
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

    const handleModalPostBoxPress = useCallback(() => modalPostSettingsRef.current?.present(), []);

    try {
        navigation = useNavigation();
        route = useRoute();
    } catch (error) {
        console.log(error);        
    }

    const settingsRef = useRef(null);
    const snapPoints = useMemo(() => ['75%','75%'], []);
    const handleSettingsPress = useCallback(() => {
        settingsRef.current?.present();
    }, []);

    const [body, setBody] = useState(post?.content?.body);
    const [postContext, setPostContext] = useState(post?.content?.context ? post.content.context : post?.context);
    const [postContextDetails, setPostContextDetails] = useState(post?.content?.context_details ? post.content.context_details : post?.context_details);
    const [listMedia, setListMedia] = useState(post?.content?.media)

    const [isDeleted, setIsDeleted] = useState(false);
    const [modalVis, setModalVis] = useState(false);
    const [imageIndex, setImageIndex] = useState(0)
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [lengthMore,setLengthMore] = useState(false);

    const onTextLayout = useCallback(e => {
        var count_lines = 0
        e.nativeEvent.lines.map(e => {
            if(e.text.indexOf("\n") != 0) count_lines += 1
        })

        setLengthMore(count_lines > 4);
    },[]);

    const tailwind = useTailwind();

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
            <InteractiveMention mentions={post.content.mentions} key={Math.random()} match={match} i={i} showProfileDetails={showProfileDetails} />
        ));

        // Match URLs
        replacedText = reactStringReplace(replacedText, /(https?:\/\/\S+)/g, (match, i) => (
            <TouchableWithoutFeedback key={Math.random()} onPress={() => openNews(match)}>
                <Text style={{ color: '#ff6b17', fontFamily: "GmarketMedium", backgroundColor: "#FFF" }}>{match}</Text>
            </TouchableWithoutFeedback>
        ));

        return replacedText;
    };

    const onImagePress = (index) => {
        setModalVis(true)
        setImageIndex(index)
    }

    const Media = ({media, index, isRepost}) => {
        const tailwind = useTailwind();
        const screenWidth = Dimensions.get('window');

        const imgObj = media && media[0].url ? media[0] : media[0][0]

        let ratioWidth
        let ratioHeight = screenWidth.width - 87
        let isHorizontal = false

        if(imgObj && imgObj.width && imgObj.width > imgObj.height){
            ratioWidth = (isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87)/imgObj.width
            ratioHeight = imgObj.height*ratioWidth < screenWidth.width - 87 ? imgObj.height*ratioWidth : screenWidth.width - 87
            isHorizontal = true
        }

        if(imgObj && imgObj.width) {
            return(
                <View style={{marginLeft: index && index != 0 ? 8 : 0}} key={Math.random()}>
                    <TouchableOpacity 
                        activeOpacity={0.8} 
                        style={[tailwind('rounded-md border border-secondary'), { marginBottom: 6, marginTop: 2 }]} 
                        onPress={() => onImagePress(index)}
                    >
                        {(listPostFailure.includes(post.timestamp) || post.content.context == 'kjzl6cwe1jw14aqybm3jlqo0aczxbogwehz8lrywu2r9ompi4pi0amaqjshapo6') ? (
                            <RNImage
                                style={[
                                    tailwind('rounded-md'), 
                                    { 
                                        height: isHorizontal ? ratioHeight : screenWidth.width - 87,
                                        width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87,
                                        marginLeft: isRepost && !quotedPost ? -20 : 0,
                                    }
                                ]}
                                source={{uri: imgObj.url}}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                style={[
                                    tailwind('rounded-md'), 
                                    { 
                                        height: isHorizontal ? ratioHeight : screenWidth.width - 87,
                                        width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87,
                                        marginLeft: isRepost && !quotedPost ? -20 : 0,
                                    }
                                ]}
                                source={imgObj.url}
                                placeholder={require("../assets/loader_001.gif")}
                                transition={1000}
                                contentFit="cover"
                                priority="high"
                            />
                        )}
                    </TouchableOpacity>
                </View>
            )
        } else {
            const [ratioHeight, setRatioHeight] = useState(screenWidth.width - 87)
            const [isHorizontal, setIsHorizontal] = useState(null)

            return(
                <View style={{marginLeft: index && index != 0 ? 8 : 0}} key={Math.random()}>
                    <TouchableOpacity 
                        activeOpacity={0.8} 
                        style={[tailwind('rounded-md border border-secondary'), { marginBottom: 6, marginTop: 2 }]} 
                        onPress={() => onImagePress(index)}
                    >
                        {(listPostFailure.includes(post.timestamp) || post.content.context == 'kjzl6cwe1jw14aqybm3jlqo0aczxbogwehz8lrywu2r9ompi4pi0amaqjshapo6') ? (
                            <RNImage
                                style={[
                                    tailwind('rounded-md'), 
                                    { 
                                        height: isHorizontal ? ratioHeight : screenWidth.width - 87,
                                        width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87,
                                        marginLeft: isRepost && !quotedPost ? -20 : 0,
                                    }
                                ]}
                                source={{uri: imgObj.url}}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                style={[
                                    tailwind('rounded-md'), 
                                    { 
                                        height: isHorizontal ? ratioHeight : screenWidth.width - 87,
                                        width: isRepost && !quotedPost ? screenWidth.width - 135  : quotedPost ? screenWidth.width - 160 : screenWidth.width - 87,
                                        marginLeft: isRepost && !quotedPost ? -20 : 0,
                                    }
                                ]}
                                source={imgObj.url}
                                placeholder={require("../assets/loader_001.gif")}
                                transition={1000}
                                contentFit="cover"
                                // onLoad={(values) => renderImage(values)}
                                priority="high"
                            />
                        )}
                    </TouchableOpacity>
                </View>
            )
        }
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const onSaveImageToLocal = async (uri) => {
        try{
            // Request device storage access permission
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === "granted") {
                const splitted = uri.split('/')
                const filename = splitted[splitted.length-1]
                
                const fileUri = FileSystem.documentDirectory + filename + `.jpg`;
                const res = await FileSystem.downloadAsync(uri, fileUri);
                await MediaLibrary.saveToLibraryAsync(res.uri);

                settingsRef.current?.close()
                setShowSuccessMessage(true)
                await delay(2000);
                setShowSuccessMessage(false)

            } else {
                Alert.alert('Media Permission', 'Please enable permission to access your media library', [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {text: 'Open Settings', onPress: () => Linking.openSettings()},
                ]);
            }
        } catch (error) {
        console.log(error);
        alert('Failed to save media')
        }
    }


    if(!post || !post.content) {
        return null;
    }

    if(isDeleted) {
        return null;
    }

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
                                        : setEditedPost({type:'notCreator',value: post, callback: callbackEditPost, callbackDelete: callbackDeletePost});
                                        handleModalPostBoxPress()
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
                                        statusBarTranslucent
                                        onRequestClose={() => setModalVis(false)}
                                    >
                                        <GestureHandlerRootView style={[tailwind("h-full w-full"), {height: Dimensions.get('window').height+50,marginTop: Platform.OS == 'ios' ? -30 : -10}]}>
                                            <View style={[tailwind('absolute w-full'), {height: 40,top: Platform.OS == 'ios' ? 80 : 50,zIndex: 2,justifyContent:'space-between',flexDirection:'row',alignItems:'center'}]}>
                                                <TouchableOpacity onPress={() => setModalVis(!modalVis)} activeOpacity={0.6} style={{left: 20}}>
                                                    <AntDesign name="close" size={24} color="white" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={handleSettingsPress} activeOpacity={0.6} style={{right: 20}}>
                                                    <Entypo name="dots-three-horizontal" size={24} color="white" />
                                                </TouchableOpacity>
                                            </View>

                                            {showSuccessMessage && (
                                                <View style={{position: 'absolute',top: 50,zIndex: 999999999999, backgroundColor: '#3D3D3D',width: Dimensions.get('window').width-20,alignSelf: 'center',flexDirection:'row',alignItems: 'center', height: 60,borderRadius: 10}}>
                                                    <SuccessIcon style={{marginLeft: 20,}}/>
                                                    <Text style={{marginLeft: 10,color:'white'}}>Media saved to library !</Text>
                                                </View>
                                            )}

                                            <ImageViewer 
                                                imageUrls={list_images}
                                                index={imageIndex}
                                                renderIndicator={(currentIndex, allSize) => {
                                                    return(
                                                        <View style={{position:'absolute',alignSelf:'center',top: 80, width: 100,height: 40,justifyContent:'center',alignItems:'center',zIndex: 99999999}}>
                                                            <Text style={{color: 'white'}}>{currentIndex}/{allSize}</Text>
                                                        </View>
                                                    )
                                                }}
                                                onSwipeDown={() => setModalVis(!modalVis)} 
                                                enableSwipeDown={true} 
                                                loadingRender={() => { return (
                                                    <ActivityIndicator style={{marginTop: 10}}  size="small"  color="#fff" /> 
                                                )}}
                                                onSave={(uri) => onSaveImageToLocal(uri)}
                                                onChange={(index) => {setCurrentIndex(index)}}
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

                                            <BottomSheetModalProvider>
                                                <BottomSheetModal
                                                    ref={settingsRef}
                                                    index={1}
                                                    snapPoints={snapPoints}
                                                    backgroundStyle={{backgroundColor: '#333',}}
                                                    handleIndicatorStyle={{backgroundColor: 'white',}}
                                                    handleStyle={{height: 40,justifyContent: 'center',}}
                                                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                                                >                                                    
                                                    <TouchableOpacity
                                                        style={{backgroundColor: '#595959',padding: 20,width: '90%',alignSelf:'center',marginTop: 20,borderRadius: 5,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}
                                                        onPress={() => onSaveImageToLocal(list_images[currentIndex].url)}
                                                    >
                                                        <Text style={{color: 'white'}}>Save the image</Text>
                                                        <Feather name="download" size={24} color="white" />
                                                    </TouchableOpacity>
                                                </BottomSheetModal>
                                            </BottomSheetModalProvider>


                                        </GestureHandlerRootView>
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
  const [countLikes, setCountLikes] = useState(numLikes ?? 0);
  const { user,setUser,userData,setUserData, orbis, showConnectModal, setShowConnectModal } = useContext(GlobalContext);
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
        Haptics.selectionAsync();
        setHasLiked(true);
        setCountLikes(countLikes ? countLikes+1 : numLikes+1)

        // Orange Reward
        const tempData = userData

        if(tempData.listClaimedOranges){
            const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
            if(index != -1){
                tempData.listClaimedOranges[index].listOranges.push({
                    numberOranges: 2,
                    type: 'Like'
                })
                if(tempData.reaction?.number == 29){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: 50,
                        type: 'Reactions Milestone achieved'
                    })
                }
            }else{
                const listReward = [{
                    numberOranges: 2,
                    type: 'Like'
                }]
                if(tempData.reaction?.number == 29){
                    listReward.push({
                        numberOranges: 50,
                        type: 'Reactions Milestone achieved'
                    })
                }
                tempData.listClaimedOranges.push({
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: listReward
                })
            }
        }else{
            tempData.listClaimedOranges = [{
                date: moment().format('YYYY-MM-DD'),
                listOranges: [
                    {
                        numberOranges: 2,
                        type: 'Like'
                    },
                ]
            }]
        }

        if(tempData.reaction){
            tempData.reaction.number += 1
            tempData.reaction.gained += 2
        }else{
            tempData.reaction = {
                number: 1,
                gained: 2,
                lastReaction: moment().format('YYYY-MM-DD HH:mm')
            }
        }

        tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 2 : tempData.activityUnclaimed = {number: 2}
        if(tempData.reaction.number == 30 && tempData.activityUnclaimed){
            tempData.activityUnclaimed.number += 50
        }
        tempData.reaction.number == 30 ? tempData.reaction.number = 0 : null

        setUserData({...tempData})

        var tempProfile = user.profile
        tempProfile.data = tempData

        await orbis.react(post.stream_id, "like");
        await orbis.updateProfile(tempProfile);

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
          {countLikes ?? numLikes}
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
