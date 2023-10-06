import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, Image, Dimensions, TouchableOpacity } from 'react-native';

import * as Haptics from 'expo-haptics';

import Post from "../../components/Post";
import { UserPfp } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, NotificationsIcon } from "../../components/Icons";

const PostDetails = ({navigation, route}) => {
    const { user, orbis, postDetailsVis, showPostbox, hidePostbox, setReplyTo } = useContext(GlobalContext);
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
                setPost(data);
            }
        }

        /** Will load replies */
        async function getReplies() {
            setRepliesLoading(true);
            const { data, error } = await orbis.getPosts(
                {
                master: postDetailsVis
                },
                0,
                50,
                true
            );

            if(data) {
                setReplies(data);
                setRepliesLoading(false);
            }
        }
    }, [postDetailsVis]);

    /** Open postbox and save reply to */
    function openReplyBox() {
        showPostbox(callback);
        setReplyTo(post);
    }

    function callback(newPost) {
        hidePostbox();
        console.log("Adding new post as a reply:", newPost);
        let _replies = [...replies, newPost];
        setReplies(_replies);
    }

    return(
        <View style={{flex: 1}}>
            
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../../assets/HeaderBg.png')} 
            />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 5,maxHeight:60}}>
                <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <View style={{zIndex:100000, justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </View>
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
                    <Post post={post} verticalDivider={true} fontSize={15} />

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
                                <Post post={reply} key={reply.stream_id} showParent={false} verticalDivider={true} style={{marginTop: -20}} />
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
