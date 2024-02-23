import React, { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTailwind } from 'tailwind-rn';

import Post from '../../../components/Post.js';
import { context } from '../../../utils/config.js';
import { GlobalContext } from '../../../contexts/GlobalContext.js';
import { PostMenuIcon, RepostIcon } from '../../../components/Icons.js';
import { Username } from '../../../components/User.js';

const ProfileReposts = (props) => {
    const { user, orbis,  tabViewHeight, setTabViewHeight, setEditedPost } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const { profile, type } = props

    const [posts, setPosts] = useState([]);
    const [refreshing, setRefreshing] = useState(true);
  
    useEffect(() => {
        loadPosts();
    }, [type == 'selected' ? profile : user])
  
    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        setRefreshing(true);
        setPosts([]);
    
        options = {
            did: type == 'selected' ? profile.did : user.did,
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
        if(post?.content?.repost != null && post.content.body == " ") {
            return (
                <View style={tailwind('flex flex-col')} key={key}>
                    <View style={[tailwind('flex flex-row justify-between px-5 mt-3'), { marginBottom: -2 }]}>
                        <View style={[tailwind('flex flex-row items-center')]}>
                            <RepostIcon color="#959595" />
                            <Text style={tailwind('text-secondary items-center ml-1')}>
                                <Username details={post.creator_details} style={tailwind('text-secondary font-normal')} /> reposted
                            </Text>
                        </View>
    
                        <TouchableOpacity 
                            onPress={() => 
                                {user?.did == post.creator ? 
                                    setEditedPost({value: post,}) 
                                    : setEditedPost({type:'notCreatorReposted',value: post,})
                                }
                            } 
                            style={[tailwind('flex flex-row items-center rounded-md py-2 px-1 -mr-1')]}
                        >
                            <PostMenuIcon />
                        </TouchableOpacity>
                    </View>
                    <Post post={post.repost_details} showRepostDetails={false} />
                </View>
            );
        } else {
            return (
                <Post key={key} post={post} />
            );
        }
    });
}

export default ProfileReposts

const styles = StyleSheet.create({})