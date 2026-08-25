import React, { useContext, useState } from "react";
import { Text, View, ActivityIndicator, Animated, RefreshControl, Platform, Image, TouchableOpacity } from 'react-native';

import { BlurView } from 'expo-blur';
import PagerView from 'react-native-pager-view';
import { useTailwind } from 'tailwind-rn';
import { useScrollToTop } from "@react-navigation/native";


import Post from "./Post";
import { Username } from "./User";
import { RepostIcon } from "./Icons";
import { GlobalContext } from "../contexts/GlobalContext";
import { useDeviceAccountData } from '../contexts/DeviceAccountDataContext';
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function Feed({posts = [], refreshing, refreshingBottom, onRefresh, loadMore, header, feedRef, error, backendConfigured = true, showBanner = true, emptyTitle, emptyDescription }) {
    const { homeFeedRef, scrollAnim } = useContext(GlobalContext);
    const {
        blockedAccounts: listBlockedUser,
        hiddenPosts: listHiddenPost,
        mutedAccounts: listMutedUsers,
    } = useDeviceAccountData();
    const tailwind = useTailwind();

    const statusBarHeight = useStatusBarHeight();

    const [indexSwiper, setIndexSwiper] = useState(0)

    const onEndReached = async () => {
        if(loadMore) {
            loadMore()
        }
    }
    
    const safePosts = Array.isArray(posts) ? posts : [];
    let filteredPosts = safePosts.filter(e => !listBlockedUser?.includes(e.creator) && !listBlockedUser?.includes(e.reply_to_creator_details?.did))
    filteredPosts = filteredPosts.filter(e => !listHiddenPost?.includes(e.stream_id) && !listHiddenPost?.includes(e.reply_to))
    filteredPosts = filteredPosts.filter(e => !listMutedUsers?.includes(e.creator) && !listMutedUsers?.includes(e.reply_to_creator_details?.did))

    useScrollToTop(feedRef ? feedRef : homeFeedRef);

    return(
        <>
            {(refreshing && safePosts.length == 0) ?
                <ActivityIndicator style={{marginTop: 190}} size="small" color="#020617" />
            :
                <>
                {filteredPosts.length > 0 ?
                    <Animated.FlatList
                        ref={feedRef ? feedRef : homeFeedRef}
                        style={tailwind('w-full')}
                        data={filteredPosts}
                        ListHeaderComponent={header}
                        ListHeaderComponentStyle={tailwind('flex flex-1')}
                        renderItem={({item, index}) => {
                            if(index == 0 && showBanner){
                                return (
                                    <>
                                        {/* <View style={{height: Platform.OS == 'ios' ? 0 : 55 + statusBarHeight, width: '100%', backgroundColor: 'red',}} /> */}

                                        <PagerView 
                                            style={{height: 100, width: '100%', marginTop: Platform.OS == 'ios' ? -58 : 60 + statusBarHeight}} 
                                            initialPage={0}
                                            orientation='horizontal'
                                            onPageSelected={(props) => setIndexSwiper(props.nativeEvent.position)}
                                        >
                                            <View key="1">
                                                <Image
                                                    resizeMode="stretch"
                                                    style={{height:'100%', width: '100%'}}
                                                    source={require('../assets/ads/home_ad_1.png')}
                                                />
                                            </View>
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
                                                top: Platform.OS == 'ios' ? 12 : 130 + statusBarHeight,
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
                        keyExtractor={item => String(item.stream_id)}
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
                                progressViewOffset={showBanner ? 120 + statusBarHeight : 0}
                                style={{marginTop: showBanner ? 120 + statusBarHeight : 0}}
                            />
                        }
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollAnim }} }],
                            { useNativeDriver: true }
                        )}
                    />
                :
                    <View style={[tailwind('bg-slate-50 px-5 py-5 items-center mx-6 rounded-md'), {marginTop: showBanner ? 160 : 30}]} >
                        <Text style={[tailwind('text-slate-900 text-center'), {fontFamily: 'GmarketBold'}]}>
                            {emptyTitle || (!backendConfigured
                                ? 'EasyGo feed is getting connected.'
                                : error
                                    ? "We couldn't load the feed."
                                    : 'No posts yet.')}
                        </Text>
                        <Text style={[tailwind('text-secondary text-center'), {marginTop: 8, lineHeight: 19}]}>
                            {emptyDescription || (!backendConfigured
                                ? 'Community posts will appear once the backend is ready.'
                                : error
                                    ? 'Check your connection and try again.'
                                    : 'Be the first to share something with the community.')}
                        </Text>
                        {error && onRefresh &&
                            <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={onRefresh}
                                style={{marginTop: 14, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9}}
                            >
                                <Text style={{color: 'white', fontFamily: 'GmarketBold', fontSize: 13}}>Try again</Text>
                            </TouchableOpacity>
                        }
                    </View>
                }
                </>
            }


            {(refreshingBottom && safePosts.length > 0) &&
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
