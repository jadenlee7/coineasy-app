import React, { useState, useContext, useEffect, useRef, memo } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { Username } from "./User";
import Post from "./Post";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl, Image, ActivityIndicator, FlatList } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { RepostIcon } from "./Icons";
import Animated, {
  withTiming,
  useAnimatedStyle,
  useSharedValue,
  useAnimatedScrollHandler
} from 'react-native-reanimated';
const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
  const paddingToBottom = 10;
  return layoutMeasurement.height + contentOffset.y >=
    contentSize.height - paddingToBottom;
};

export default function Feed({posts, refreshing, refreshingBottom, onRefresh, loadMore, header}) {
  const { user, orbis, setScrolled, screen, feedRef, translateY } = useContext(GlobalContext);
  const tailwind = useTailwind();

  const lastContentOffset = useSharedValue(0);
  const isScrolling = useSharedValue(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (
        lastContentOffset.value > event.contentOffset.y &&
        isScrolling.value
      ) {
        translateY.value = 0;
      } else if (
        lastContentOffset.value < event.contentOffset.y &&
        isScrolling.value
      ) {
        translateY.value = event.contentOffset.y > 140 ? -140 : -event.contentOffset.y;
      }
      lastContentOffset.value = event.contentOffset.y;
    },
    onBeginDrag: (e) => {
      isScrolling.value = true;
    },
    onEndDrag: (e) => {
      isScrolling.value = false;
    },
  });


  function handleScroll(event) {
     setScrolled(event.nativeEvent.contentOffset.y);
  }

  function resetScroll() {
    console.log("Enter resetScroll");
    setScrolled(0);
  }

  const onStartReached = async () => {
    //console.log("Enter onStartReached");
  }

  const onEndReached = async () => {
    console.log("Enter onEndReached");
    if(loadMore) {
      loadMore()
    }
  }

  return(
    <>
      {(refreshing && posts.length == 0) ?
        <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
      :
        <>
          {posts.length > 0 ?
            <Animated.FlatList
              ref={feedRef}
              style={tailwind('w-full')}
              //ref={scrollViewRef}
              //inverted={true}
              data={posts}
              ListHeaderComponent={header}
              ListHeaderComponentStyle={tailwind('flex flex-1')}
              onScroll={scrollHandler}
              //ListFooterComponent={<View style={tailwind("h-3")}></View>}
              renderItem={({item}) => <PostInFeed post={item} key={item.stream_id} />}
              keyExtractor={item => item.stream_id}
              refreshing={refreshing}
              scrollEventThrottle={16}
              onStartReached={onStartReached}
              onEndReached={onEndReached}
              onStartReachedThreshold={4} // optional
              onEndReachedThreshold={1} // optional
              onRefresh={onRefresh} />
          :
            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
              <Text style={tailwind('text-secondary items-center ml-1')}>There isn't any post shared here.</Text>
            </View>
          }
        </>
      }


      {(refreshingBottom && posts && posts.length > 0) &&
        <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
      }
      {/**
  		<ScrollView
        contentContainerStyle={tailwind('w-full')}
        scrollEventThrottle={400}
        onScroll={({nativeEvent}) => {
          if (isCloseToBottom(nativeEvent)) {
            if(loadMore) {
              loadMore();
            }
          }
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} />
        }>
            <>
              {refreshing &&
                <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
              }
              <>
                {(posts && posts.length > 0) ?
                <>
                  {posts.map((post) => {
                    if(post) {
                      if(post?.content?.repost != null && post.content.body == " ") {
                        return (
                          <View style={tailwind('flex flex-col')} key={post.stream_id}>
                            <View style={[tailwind('flex flex-row items-center px-5 mt-3'), { marginBottom: -5 }]}>
                              <RepostIcon />
                              <Text style={tailwind('text-secondary items-center ml-1')}><Username details={post.creator_details} style={tailwind('text-secondary font-normal')} /> reposted</Text>
                            </View>
                            <Post post={post.repost_details} showRepostDetails={false} />
                          </View>
                        );
                      } else {
                        return (
                          <Post post={post} key={post.stream_id} />
                        );
                      }
                    } else {
                      console.log("post:", post)
                      return null;
                    }
                  })}
                </>
              :
                <>
                  {refreshing == false &&
                  <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1')}>There isn't any post shared here.</Text>
                  </View>
                  }
                </>
              }
              </>

              {//Show loading state at the bottom also (to enable infinite scrolling)}
              {(refreshingBottom && posts && posts.length > 0) &&
                <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
              }
          </>

  		</ScrollView>
      */}
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
