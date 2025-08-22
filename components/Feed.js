import React, { useContext, useState } from "react";
import { Text, View, ActivityIndicator, Animated, RefreshControl, Platform, Image, ImageBackground, TouchableOpacity, Dimensions } from 'react-native';

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import PagerView from 'react-native-pager-view';
import { useTailwind } from 'tailwind-rn';
import { useScrollToTop } from "@react-navigation/native";


import Post from "./Post";
import { Username } from "./User";
import { RepostIcon } from "./Icons";
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function Feed({posts, refreshing, refreshingBottom, onRefresh, loadMore, header, feedRef }) {
    const { orbis, userData, homeFeedRef, scrollAnim, listBlockedUser, listHiddenPost, listMutedUsers, setShowClaimOranges, setTodayOranges, setAdAlreadyClaimed} = useContext(GlobalContext);
    const tailwind = useTailwind();

    const statusBarHeight = useStatusBarHeight();

    const [indexSwiper, setIndexSwiper] = useState(0)

    const onEndReached = async () => {
        if(loadMore) {
            loadMore()
        }
    }
    
    let filteredPosts = posts.filter(e => !listBlockedUser?.includes(e.creator) && !listBlockedUser?.includes(e.reply_to_creator_details?.did)) 
    filteredPosts = filteredPosts.filter(e => !listHiddenPost?.includes(e.stream_id) && !listHiddenPost?.includes(e.reply_to))
    filteredPosts = filteredPosts.filter(e => !listMutedUsers?.includes(e.creator) && !listMutedUsers?.includes(e.reply_to_creator_details?.did))

    filteredPosts.map(async (e)=>{
        if(e.content.reply_to){
            const resultPost = await orbis.getPost(e.content.reply_to)

            e.reply_to_details.count_likes = resultPost.data?.count_likes
            e.reply_to_details.count_replies = resultPost.data?.count_replies
            e.reply_to_details.count_repost = resultPost.data?.count_repost
            e.reply_to_details.timestamp = resultPost.data?.timestamp
        }

        return e
    })

    useScrollToTop(feedRef ? feedRef : homeFeedRef);

    const onBannerPress = () => {
        Haptics.selectionAsync()
                
        if(userData?.adReward?.lastClaim){
            setAdAlreadyClaimed(true)
        }else{
            setTodayOranges(200)
            setShowClaimOranges(true)
        }
    }    

    return(
        <>
            {(refreshing && posts.length == 0) ?
                <ActivityIndicator style={{marginTop: 190}} size="small" color="#020617" />
            :
                <>
                {posts.length > 0 ?
                    <Animated.FlatList
                        ref={feedRef ? feedRef : homeFeedRef}
                        style={tailwind('w-full')}
                        data={filteredPosts}
                        ListHeaderComponent={header}
                        ListHeaderComponentStyle={tailwind('flex flex-1')}
                        renderItem={({item, index}) => {
                            if(index == 0){
                                return (
                                    <>
                                        <View style={{height: Platform.OS == 'ios' ? 0 : 55 + statusBarHeight, width: '100%', backgroundColor: 'white',}} />

                                        <PagerView 
                                            style={{height: 100, width: '100%', marginVertical: 10,}} 
                                            initialPage={0}
                                            orientation='horizontal'
                                            onPageSelected={(props) => setIndexSwiper(props.nativeEvent.position)}
                                        >
                                            <TouchableOpacity 
                                                key="1"
                                                onPress={onBannerPress}
                                            >
                                                <Image
                                                    resizeMode="stretch"
                                                    style={{height:'100%', width: '100%'}}
                                                    source={require('../assets/ads/home_ad_1.png')}
                                                />
                                            </TouchableOpacity>
                                            <View key="2">
                                                <Image
                                                    resizeMode="stretch"
                                                    style={{height:'100%', width:'100%'}}
                                                    source={require('../assets/ads/home_ad_2.png')}
                                                />
                                            </View>
                                        </PagerView>

                                        <View 
                                            style={{
                                                borderRadius: 10,
                                                overflow:'hidden',                                                    
                                                position: 'absolute',
                                                top: Platform.OS == 'ios' ? 22 : 130 + statusBarHeight,
                                                right: 10,
                                            }}
                                        >
                                            <BlurView
                                                tint="dark"
                                                intensity={25}
                                                style={{
                                                    borderRadius: 10,
                                                    width: 55,
                                                    height: 22,

                                                    justifyContent:'center',alignItems:'center',
                                                }}
                                            >
                                                <Text style={{color:'white', textAlign: 'center',fontSize: 13,}}>{indexSwiper+1}/2</Text>
                                            </BlurView>
                                            
                                        </View>

                                        <PostInFeed post={item} key={item.stream_id} />
                                    </>
                                )
                            }else{
                                return (<PostInFeed post={item} key={item.stream_id} />)
                            }
                        }}
                        keyExtractor={item => item.stream_id}
                        refreshing={refreshing}
                        scrollEventThrottle={16}
                        onEndReached={onEndReached}
                        onStartReachedThreshold={4} // optional
                        onEndReachedThreshold={1} // optional
                        refreshControl={
                            <RefreshControl
                                colors={["#020617"]}
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                progressViewOffset={120 + statusBarHeight}
                                style={{marginTop: 120 + statusBarHeight}}
                            />
                        }
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollAnim }} }],
                            { useNativeDriver: true }
                        )}
                    />
                :
                    <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md mt-160px')} >
                        <Text style={tailwind('text-secondary items-center ml-1')}>There isn't any post shared here.</Text>
                    </View>
                }
                </>
            }


            {(refreshingBottom && posts && posts.length > 0) &&
                <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
            }
        </>
    )
}

const PostInFeed = React.memo(({post}) => {
    const tailwind = useTailwind();

    if(post?.content?.repost != null && post.content.body == " ") {
        return (
            <View style={tailwind('flex flex-col')}>
                <View style={[tailwind('flex flex-row items-center px-5 mt-3'), { marginBottom: -2 }]}>
                    <RepostIcon color="#959595" />
                    <Text style={tailwind('text-secondary items-center ml-1')}>
                        <Username details={post.creator_details} style={tailwind('text-secondary font-normal')} /> reposted
                    </Text>
                </View>
                <Post post={post.repost_details} showRepostDetails={false} />
            </View>
        );
    } else {
        return (
            <Post post={post} />
        );
    }
});