import React, { useState, useContext, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { Username } from "./User";
import Post from "./Post";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl, Image, ActivityIndicator, FlatList } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { RepostIcon } from "./Icons";

const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
  const paddingToBottom = 10;
  return layoutMeasurement.height + contentOffset.y >=
    contentSize.height - paddingToBottom;
};

export default function Feed({posts, refreshing, refreshingBottom, onRefresh, loadMore}) {
  const { user, orbis } = useContext(GlobalContext);
  const tailwind = useTailwind();

  return(
    <>
      {(refreshing && posts.length == 0) ?
        <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
      :
        <>
          {posts.length > 0 ?
            <FlatList
              style={tailwind('w-full')}
              //ref={scrollViewRef}
              //inverted={true}
              data={posts}
              //ListFooterComponent={<View style={tailwind("h-3")}></View>}
              renderItem={({item}) => <PostInFeed post={item} />}
              refreshing={refreshing}
              onEndReached={loadMore ? () => loadMore() : console.log("Failed to load more.")}
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

const PostInFeed = ({post}) => {
  const tailwind = useTailwind();

  if(post?.content?.repost != null && post.content.body == " ") {
    return (
      <View style={tailwind('flex flex-col')} key={post.stream_id}>
        <View style={[tailwind('flex flex-row items-center px-5 mt-3'), { marginBottom: -5 }]}>
          <RepostIcon color="#959595" />
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
}
