import React, { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native'

import { useTailwind } from 'tailwind-rn';

import Post from '../../components/Post';
import { context } from '../../utils/config.js';
import { GlobalContext } from '../../contexts/GlobalContext';

const ProfileReplies = (props) => {
    const { user, orbis,  tabViewHeight, setTabViewHeight } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const { profile } = props

    const [posts, setPosts] = useState([]);
    const [refreshing, setRefreshing] = useState(true);
  
    useEffect(() => {
        loadPosts();
    }, [profile])
  
    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        setRefreshing(true);
        setPosts([]);
    
        options = {
            did: profile.did,
            context,
            is_repost: true,
            include_child_contexts: true
        };
  
        let { data } = await orbis.getPosts(options);
        if(data) {
            setPosts(data);

            if(data.length == 50){
                setTabViewHeight(20000)
            }else if(data.length * 300 > tabViewHeight){
                setTabViewHeight(data.length * 300)
            }
        }
    
        setRefreshing(false);
    }
  
    if(refreshing) {
        return(
            <View style={{backgroundColor: 'white',height: 900}}>
                <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
            </View>
        )
    }
  
    if(posts.length == 0) {
        return(
            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                <Text style={tailwind('text-secondary items-center ml-1')}>There isn't any post shared here.</Text>
            </View>
        )
    }
  
    return posts.map((post, key) => {
        return (
            <Post key={key} post={post} />
        );
    });
}

export default ProfileReplies

const styles = StyleSheet.create({})