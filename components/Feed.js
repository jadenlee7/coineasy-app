import React, { useState, useContext, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { Username } from "./User";
import Post from "./Post";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';

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

              {/** Show loading state at the bottom also (to enable infinite scrolling) */}
              {(refreshingBottom && posts && posts.length > 0) &&
                <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
              }
          </>

  		</ScrollView>
    </>
  )
}

const RepostIcon = () => {
  return(
    <Svg width="20" height="13" viewBox="0 0 20 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M9.03007 12.5001C9.62031 12.5001 10.0972 12.0348 10.0972 11.4589C10.0972 10.8829 9.62031 10.4176 9.03007 10.4176H6.16828C5.57804 10.4176 5.10118 9.95231 5.10118 9.37636V4.33447H6.16828C6.59846 4.33447 6.98862 4.08066 7.15536 3.69019C7.32209 3.29972 7.22872 2.85393 6.92526 2.55457L4.79105 0.472049C4.37421 0.0653066 3.69727 0.0653066 3.28043 0.472049L1.14622 2.55457C0.839424 2.85393 0.749387 3.29972 0.916123 3.69019C1.08286 4.08066 1.46968 4.33447 1.9032 4.33447H2.9703V9.37636C2.9703 11.1009 4.40422 12.5001 6.17162 12.5001H9.03007ZM10.9703 0.333842C10.38 0.333842 9.90315 0.799155 9.90315 1.3751C9.90315 1.95105 10.38 2.41636 10.9703 2.41636H13.832C14.4223 2.41636 14.8991 2.88167 14.8991 3.45762V8.49951H13.832C13.4019 8.49951 13.0117 8.75332 12.845 9.14379C12.6782 9.53426 12.7716 9.98005 13.0751 10.2794L15.2093 12.3619C15.6261 12.7687 16.3031 12.7687 16.7199 12.3619L18.8541 10.2794C19.1609 9.98005 19.2509 9.53426 19.0842 9.14379C18.9175 8.75332 18.5306 8.49951 18.0971 8.49951H17.03V3.45762C17.03 1.73303 15.5961 0.333842 13.8287 0.333842H10.9703Z" fill="#959595"/>
    </Svg>
  )
}
