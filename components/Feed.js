import React, { useState, useContext, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User from "./User";
import Post from "./Post";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from 'react-native';

export default function Feed({posts}) {
  const { user, orbis, refreshing, onRefresh } = useContext(GlobalContext);
  const tailwind = useTailwind();

  return(
    <>
  		<ScrollView
        contentContainerStyle={tailwind('items-center w-full')}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} />
        }>
        {refreshing ?
          <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
        :
          <>
            {(posts && posts.length > 0) ?
              <>
                {posts.map((post) => {
                  return (
                    <Post post={post} key={post.stream_id} />
                  );
                })}
              </>
            :
              <Text style={tailwind('text-gray-900 font-semibold mt-6')}></Text>
            }
          </>
        }

  		</ScrollView>
    </>
  )
}
