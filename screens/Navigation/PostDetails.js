import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, Image, Dimensions, TouchableOpacity } from 'react-native';

import * as Haptics from 'expo-haptics';

import Post from "../../components/Post";
import { UserPfp } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon } from "../../components/Icons";
import HeaderImage from "../../components/HeaderImage";
import moment from "moment";

const PostDetails = ({navigation, route}) => {
    const { user, setUser,userData, setUserData, orbis, postDetailsVis, showPostbox, hidePostbox, setReplyTo } = useContext(GlobalContext);
    const tailwind = useTailwind();
    
    const [ post, setPost ] = useState();
    const [ replies, setReplies ] = useState([]);
    const [ repliesLoading, setRepliesLoading ] = useState(false);

    const statusBarHeight = useStatusBarHeight();


    /** Check if user liked this post */
    useEffect(() => {
        getPost();
        getReplies();

        /** Will load main post details */
        async function getPost() {
            let { data, error } = await orbis.getPost(postDetailsVis);
            if(data) {
                    if(data.content.media?.length > 0){
                        data.content.media.map(async (elt, indexImage) => {
                            if(elt.url){
                                await Image.getSize(elt.url, (width, height) => {elt.width = width; elt.height = height});
                            }else if(elt[0].url){
                                await Image.getSize(elt[0].url, (width, height) => {elt[0].width = width; elt[0].height = height});
                            }
        
                            if(indexImage == data.content.media.length-1){
                                setPost(data);
                            }
                        })
                    }else{
                        setPost(data);
                    }
                // setPost(data);
            }
        }

        /** Will load replies */
        async function getReplies() {
            setRepliesLoading(true);
            const { data, error } = await orbis.getPosts(
                { master: postDetailsVis },
                0,
                50,
                true
            );

            if(data) {
                data.map(async (e, indexPost) => {
                    if(e.content.media?.length > 0){
                        e.content.media.map(async (elt, indexImage) => {
                            if(elt.url){
                                await Image.getSize(elt.url, (width, height) => {elt.width = width; elt.height = height});
                            }else if(elt[0].url){
                                await Image.getSize(elt[0].url, (width, height) => {elt[0].width = width; elt[0].height = height});
                            }
        
                            if(indexImage == e.content.media.length-1 && indexPost == data.length -1){
                                setReplies(data);
                            }
                        })
                    }else{
                        if(indexPost == data.length -1){
                            setReplies(data);
                        }
                    }
                })

                // setReplies(data);
                setRepliesLoading(false);
            }
        }
    }, [postDetailsVis]);

    /** Open postbox and save reply to */
    function openReplyBox() {
        showPostbox(callback);
        setReplyTo(post);
    }

    async function callback(newPost) {

        // Orange Reward
        const tempData = userData
        if(tempData.comment){
            tempData.comment.number += 1
            tempData.comment.gained += 3
        }else{
            tempData.comment = {
                number: 1,
                gained: 3,
                lastComment: moment().format('YYYY-MM-DD HH:mm')
            }
        }
        tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 3 : tempData.activityUnclaimed = {number: 3}
        setUserData({...tempData})

        var tempProfile = user.profile
        tempProfile.data = tempData
        await orbis.updateProfile(tempProfile);

        hidePostbox();
        console.log("Adding new post as a reply:", newPost);
        let _replies = [...replies, newPost];
        setReplies(_replies);
    }

    return(
        <View style={{flex: 1}}>
            
            <HeaderImage />


            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4,maxHeight:60}}>
                {/* <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <View style={{zIndex:100000, justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </View>
                </TouchableOpacity> */}

                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>

            <View style={[tailwind('flex pt-2 flex-1'),{backgroundColor: 'white',}]}>
                <ScrollView>
                {post ?
                    <View style={{marginTop: -10}}>
                    {/** Show master post */}
                    <Post post={post} verticalDivider={true} fontSize={15} notTouchable={true}/>

                    {/** Show replies */}
                    <View style={[tailwind('flex flex-col')]}>
                        {repliesLoading ?
                        <View style={{marginBottom: 30, marginTop: -10}}>
                            <ActivityIndicator size="small" color="#020617" />
                        </View>
                        :
                        <>
                            {replies.map((reply) => {
                            return (
                                <Post post={reply} key={reply.stream_id} showParent={false} verticalDivider={true} style={{marginTop: -20}} notTouchable={true}/>
                            );
                            })}
                        </>
                        }

                    </View>

                    {/** Reply postbox CTA */}
                    <TouchableHighlight style={[tailwind('flex flex-row rounded-full mx-4 items-center'), { marginTop: -10, backgroundColor: "#F6F6F6", marginBottom: 25, padding: 5 }]} underlayColor="#EFEFEF" onPress={() => openReplyBox()}>
                        <>
                        <UserPfp details={user} height={35} />
                        <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, lineHeight: 18, color: "#959595", marginLeft: 6}]}>Reply</Text>
                        </>
                    </TouchableHighlight>
                    </View>
                :
                    <ActivityIndicator size="small" color="#020617" />
                }
                </ScrollView>
            </View>
        </View>
    )
}

export default PostDetails
