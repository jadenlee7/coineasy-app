import React, { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTailwind } from 'tailwind-rn';

import Post from '../../../components/Post.js';
import { context } from '../../../utils/config.js';
import { GlobalContext } from '../../../contexts/GlobalContext.js';
import { PostMenuIcon, RepostIcon } from '../../../components/Icons.js';
import { Username } from '../../../components/User.js';
import moment from 'moment';

const ProfileFeed = (props) => {
    const { user, setUser, userData, setUserData, orbis, tabViewHeight, setTabViewHeight, setEditedPost } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const { profile, type } = props

    const [posts, setPosts] = useState([]);
    const [refreshing, setRefreshing] = useState(true);
  
    useEffect(() => {
        loadPosts();
    }, [type == 'selected' ? profile : user])
  
    async function checkLikes(post, number){
        var userHasChanged = false
        var tempData = userData

        const indexLikedPost = tempData.post?.listLikedPost?.findIndex(elt => elt.stream_id == post.stream_id)
        
        console.log(' ');
        console.log('ici');

        if(indexLikedPost >= 0){
            console.log('la');
            console.log(tempData.post.listLikedPost[indexLikedPost].milestone);
        }else{
            console.log((indexLikedPost == -1 || !tempData.post?.listLikedPost));
        }
        console.log(post.count_likes >= number 
            && (
                (indexLikedPost == -1 || !tempData.post?.listLikedPost) || (
                    indexLikedPost >= 0 
                    && number == 100 
                    && tempData.post.listLikedPost[indexLikedPost].milestone == 50
                )
            )
        );


        if(
            post.count_likes >= number 
            && (
                (indexLikedPost == -1 || !tempData.post?.listLikedPost) || (
                    indexLikedPost >= 0 
                    && number == 100 
                    && tempData.post.listLikedPost[indexLikedPost].milestone == 50
                )
            )
        ){

            console.log(' ');
            console.log('ici pour '+number);
            console.log(post.stream_id);
            console.log(' ');

            userHasChanged = true

            tempData.numberOranges ? tempData.numberOranges += number : tempData.numberOranges = number
            if(tempData.post?.listLikedPost){
                tempData.post.listLikedPost.push({
                    stream_id: post.stream_id,
                    milestone: number
                })
            }else if(tempData.post){
                tempData.post.listLikedPost = [{
                    stream_id: post.stream_id,
                    milestone: number
                }]
            }else{
                tempData.post = {
                    listLikedPost: [{
                        stream_id: post.stream_id,
                        milestone: number
                    }]
                }
            }

            if(tempData.listClaimedOranges){
                const dayIndex = tempData.listClaimedOranges.findIndex(elt => elt.date == moment().format('YYYY-MM-DD'))
                if(dayIndex >= 0){
                    tempData.listClaimedOranges[dayIndex].listOranges.push({
                        numberOranges: number,
                        type: 'Post reaches '+number+' likes'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: number,
                                type: 'Post reaches '+number+' likes'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                        {
                            numberOranges: number,
                            type: 'Post reaches '+number+' likes'
                        },
                    ]
                }]
            }
        }



                
        if(userHasChanged){
            setUserData({...tempData})
            
            var tempProfile = user.profile            
            tempProfile.data = tempData
            await orbis.updateProfile(tempProfile);
        }
    }

    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        setRefreshing(true);
        setPosts([]);
    
        let options= {
            did: type == 'selected' ? profile.did : user.did,
            context,
            include_child_contexts: true
        };
  
        let { data } = await orbis.getPosts(options);
        if(data) {
            data.map(async (e, indexPost) => {

                // await checkLikes(e, 5)
                // await checkLikes(e, 100)


                if(e.content.media?.length > 0){
                    e.content.media.map(async (elt, indexImage) => {
                        if(elt.url){
                            await Image.getSize(elt.url, (width, height) => {elt.width = width; elt.height = height});
                        }else if(elt[0].url){
                            await Image.getSize(elt[0].url, (width, height) => {elt[0].width = width; elt[0].height = height});
                        }
    
                        if(indexImage == e.content.media.length-1 && indexPost == data.length -1){
                            setPosts(data);
                        }
                    })
                }else{
                    if(indexPost == data.length -1){
                        setPosts(data);
                    }
                }
            })
            

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
                <View style={tailwind('flex flex-col')} key={Math.random()}>
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
                <Post key={Math.random()} post={post} />
            );
        }
    });

    // return(
    //     <Feed posts={posts} refreshing={refreshing} onRefresh={loadPosts} />
    // )
}

export default ProfileFeed

const styles = StyleSheet.create({})