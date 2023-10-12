import React, { useContext } from "react";
import { Text, View, ActivityIndicator, Animated, RefreshControl, Platform } from 'react-native';

import { useTailwind } from 'tailwind-rn';
import { useScrollToTop } from "@react-navigation/native";

import Post from "./Post";
import { Username } from "./User";
import { RepostIcon } from "./Icons";
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

export default function Feed({posts, refreshing, refreshingBottom, onRefresh, loadMore, header}) {
  const { feedRef, scrollAnim } = useContext(GlobalContext);
  const tailwind = useTailwind();

  const statusBarHeight = useStatusBarHeight();

  const onEndReached = async () => {
    if(loadMore) {
      loadMore()
    }
  }

  useScrollToTop(feedRef);

  return(
    <>
      {(refreshing && posts.length == 0) ?
        <ActivityIndicator style={{marginTop: 160}} size="small" color="#020617" />
      :
        <>
          {posts.length > 0 ?
            <Animated.FlatList
              ref={feedRef}
              style={tailwind('w-full')}
              data={posts}
              ListHeaderComponent={header}
              ListHeaderComponentStyle={tailwind('flex flex-1')}
              renderItem={({item, index}) => {
                if(index == 0){
                    return (
                        <>
                            <View style={{height: Platform.OS == 'ios' ? 0 : 100 + statusBarHeight, width: '100%', backgroundColor: 'white',}} />
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
                  progressViewOffset={100 + statusBarHeight}
                  style={{marginTop: 100 + statusBarHeight}}
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
        <View style={[tailwind('flex flex-row items-center px-5 mt-3'), { marginBottom: -5 }]}>
          <RepostIcon color="#959595" />
          <Text style={tailwind('text-secondary items-center ml-1')}><Username details={post.creator_details} style={tailwind('text-secondary font-normal')} /> reposted</Text>
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
