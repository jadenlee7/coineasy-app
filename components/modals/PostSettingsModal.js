import React, { useState, useContext, useRef } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, Platform, StyleSheet, TouchableHighlight } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import Modal from "../Modal";
import Button from "../Button";
import { sleep } from '../../utils';
import { GlobalContext } from "../../contexts/GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showMessage } from "react-native-flash-message";
import { SuccessIcon } from "../Icons";
import { UserPfp } from "../User";
import useDidToAddress from "../../hooks/useDidToAddress";
import useGetUsername from "../../hooks/useGetUsername";
import moment from "moment";

const list_report = [
    {label: 'It\'s spam'},
    {label: 'Nudity or sexual activity'},
    {label: 'Hate speech or symbols'},
    {label: 'Violence or dangerous'},
    {label: 'Bullying or harassment'},
    {label: 'Scam or fraud'},
    {label: 'False information'},
];

export default function PostSettingsModal() {    
    const { 
        orbis,
        user,
        showPostbox,
        postboxVis,
        editedPost,
        setEditedPost,
        listBlockedUser,
        setListBlockedUser,
        listHiddenPost,
        setListHiddenPost,
        listMutedUsers,
        setListMutedUsers,
        modalPostSettingsRef,
        showReportBack,
        setShowReportBack,
        userData,
        setUserData
    } = useContext(GlobalContext);

    const windowSize = Dimensions.get('window')

    const tailwind = useTailwind();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [checked, setChecked] = useState();

    const [showBlockBack, setShowBlockBack] = useState(false)
    const [showHideBack, setShowHideBack] = useState(false)
    const [showMuteBack, setShowMuteBack] = useState(false)

    const [loader, setLoader] = useState(false)

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation3 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation4 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation5 = useRef(new Animated.Value(windowSize.width)).current;

    const { address, chain } = useDidToAddress(editedPost?.value.creator_details.did);
    const username = useGetUsername(editedPost?.value.creator_details.profile, address, editedPost?.value.creator_details);

    function hide() {
        setEditedPost(null);
        Keyboard.dismiss()
        Haptics.selectionAsync();
        modalPostSettingsRef.current?.close()
    }
    
    async function editPost() {
        modalPostSettingsRef.current?.close()
        showPostbox();
    }

    async function deletePost() {

        // if post newer than 06/09/2024 16:36:01
        // remove 15 oranges awarded during creation
        if(editedPost?.value.timestamp > 1725633361){
            const tempData = userData ?? {}

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: -15,
                        type: 'Post Deletion'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: -15,
                                type: 'Post Deletion'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                        {
                            numberOranges: -15,
                            type: 'Post Deletion'
                        },
                    ]
                }]
            }

            tempData.numberOranges ? tempData.numberOranges -= 15 : tempData.numberOranges = 0

            setUserData({...tempData})
            console.log(JSON.stringify(tempData));
            

            var tempProfile = user.profile
            tempProfile.data = tempData
            const res = await orbis.updateProfile(tempProfile);
        }
        
        setLoading(true);
        let res = await orbis.deletePost(editedPost?.value.stream_id);
        setLoading(false);
        setSuccess(true);
        if(editPost.type != 'notCreatorReposted'){
            editedPost.callbackDelete();
        }
        await sleep(1500);
        setEditedPost(null);
    }

    const doAnimation = (ref1, ref2, value1, value2, return_function) => {
        Animated.parallel([
            Animated.timing(ref1, {
                toValue: value1,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(ref2, {
                toValue: value2,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(return_function);
    }

    const showBlock = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation3, -windowSize.width, 0)
        setShowBlockBack(true)
    }
    
    function onBackBlockPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation3, 0, windowSize.width, () => {setShowBlockBack(false);setSuccess(false);})
    }

    const showReport = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, -windowSize.width, 0)
        setShowReportBack(true)
    }
    
    function onBackReportPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, 0, windowSize.width,() => {setShowReportBack(false);setSuccess(false);})
    }

    function sendReport () {
        Haptics.selectionAsync();
        setLoading(true);

        setTimeout(() => {
            setLoading(false);

            hide();
            showMessage({
                message: "This post was reported !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }, 3000)
    }

    const onHidePress = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation4, -windowSize.width, 0)
        setShowHideBack(true)
    }
    const onBackHidePress = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation4, 0, windowSize.width,() => {setShowHideBack(false);setSuccess(false);})
    }

    const onMutePress = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation5, -windowSize.width, 0)
        setShowMuteBack(true)
    }
    const onBackMutePress = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation5, 0, windowSize.width,() => {setShowMuteBack(false);setSuccess(false);})

    }

    const blockUser = async () => {
        Haptics.selectionAsync()
        try {
            setLoader(true)
    
            const userInfo = editedPost.value.creator_details.did
            let temp_list = listBlockedUser
            if(listBlockedUser && !listBlockedUser?.includes(userInfo)){
                temp_list.push(userInfo)
            }else{
                temp_list = [userInfo]
            }

            if(temp_list){
                setListBlockedUser([...temp_list])
                await AsyncStorage.setItem("list_blocked_user", JSON.stringify(temp_list));
            }

            setLoader(false)
            hide()
    
            showMessage({
                message: "@"+username+" is now blocked !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        } catch (error) {
            Alert(error)            
        }
    }

    const hidePost = async () => {
        try {
            setLoader(true)
    
            const postInfo = editedPost.value.stream_id
            let temp_list = listHiddenPost
            if(listHiddenPost && !listHiddenPost?.includes(postInfo)){
                temp_list.push(postInfo)
            }else{
                temp_list = [postInfo]
            }

            if(temp_list){
                setListHiddenPost([...temp_list])
                await AsyncStorage.setItem("list_hidden_post", JSON.stringify(temp_list));
            }

            setLoader(false)
            hide()
    
            showMessage({
                message: "This post by @"+username+" is now hidden !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        } catch (error) {
            Alert(error)            
        }
    }

    const MuteUser = async () => {
        try {
            setLoader(true)
    
            const userInfo = editedPost.value.creator_details.did
            let temp_list = listMutedUsers
            if(listMutedUsers && !listMutedUsers?.includes(userInfo)){
                temp_list.push(userInfo)
            }else{
                temp_list = [userInfo]
            }

            if(temp_list){
                setListMutedUsers([...temp_list])
                await AsyncStorage.setItem("list_muted_users", JSON.stringify(temp_list));
            }

            setLoader(false)
            hide()
    
            showMessage({
                message: "@"+username+" is now muted !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        } catch (error) {
            Alert(error)            
        }
    }


    /** We hide the repost modal if the postbox is also visible, (this means that the user is quote posting) */
    if(postboxVis) {
        return null;
    } else if(editedPost?.type == 'notCreator' || editedPost?.type == 'notCreatorReposted'){
        return(
            // <Modal hide={() => {hide();setSuccess(false);}} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
            <>
                <View 
                    style={[
                        tailwind('flex flex-col w-full'), 
                        {
                            height: 
                                showReportBack && Platform.OS == 'ios' ? 
                                    windowSize.height - 100 
                                : showReportBack ? 
                                    windowSize.height - 60 
                                // : showBlockBack && Platform.OS == 'ios' ?
                                //     windowSize.height - 400 
                                // : showBlockBack ?
                                //     windowSize.height - 250 

                                : 
                                    'auto'
                        }
                    ]}
                >
                    <Animated.View style={[tailwind('flex flex-col'), {transform: [{ translateX: moveAnimation1 }],marginTop: 5,marginBottom: 50,}]}>
                        <Button color="rounded-red-gray" title="Report Post" style={{marginBottom: 10, width: '90%', alignSelf: 'center',}} onPress={() => showReport()} />
                        <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8 flex-row items-center justify-center'), {marginBottom: 10, width: '90%', alignSelf: 'center'}]} onPress={() => showBlock()} underlayColor="#f8fafc">
                            <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18, color:'red' }]}>Block @{username}</Text>
                        </TouchableHighlight>
                        <Button color="rounded-gray" title="Hide" style={{marginBottom: 10, width: '90%', alignSelf: 'center'}} onPress={() => onHidePress()} />
                        <Button color="rounded-gray" title="Mute" style={{marginBottom: 10, width: '90%', alignSelf: 'center'}} onPress={() => onMutePress()} />
                    </Animated.View>

                    {showReportBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackReportPress()}} style={{position: 'absolute',left: 15, top: 0}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop:30,alignSelf: 'center',}}>
                                <UserPfp 
                                    details={editedPost?.value.creator_details} 
                                    style={{alignSelf: 'center',marginTop: -30,width: 60,height: 60}}
                                    badge_style={{right:Dimensions.get('window').width/2.7,top:-30}}
                                />

                                <Text style={{textAlign:'center',fontWeight: 'bold',fontSize: 19,marginTop: 2,}}>Why are you reporting this post ?</Text>
                                <Text style={{color: '#959595',textAlign:'center',margin: 15,marginTop: 5,marginBottom: 10,fontSize: 12,}}>Your report is anonymous, except if you're reporting an intellectual property infringement</Text>
                                {list_report.map(e => {
                                    return(
                                        <TouchableOpacity 
                                            style={{backgroundColor: '#F6F6F6',borderRadius: 25,height: 50,marginTop: 10,flexDirection:'row', justifyContent: 'space-between',alignItems: 'center',}} 
                                            key={Math.random()}
                                            onPress={() => {
                                                checked == e.label ?  setChecked(null) : setChecked(e.label)
                                            }}
                                        >
                                            <Text style={{fontWeight: 'bold',fontSize: 17,paddingLeft: 20}}>{e.label}</Text>

                                            <View style={{backgroundColor: 'white',width: 26,height: 26,borderWidth: 1,borderColor: '#999',borderRadius: 13,marginRight: 15, justifyContent: 'center',alignItems: 'center',}}>
                                                {checked == e.label && (
                                                    <View style={{backgroundColor: '#FF6E31',width: 24,height: 24,borderRadius: 13,justifyContent: 'center',alignItems: 'center',}}>
                                                        <View style={{backgroundColor: 'white',width: 10,height: 10,borderRadius: 5,}} />
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )
                                })}

                                
                                {loading ? (
                                    <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%',backgroundColor: '#FF6E31',marginTop: 30,}]}>
                                        <ActivityIndicator size="small" color="#020617" />
                                    </View>
                                ) : checked ? (
                                    <Button color="orange" size='centered' onPress={() => sendReport()} title="Send" style={{marginBottom: 0, marginTop: 30,}} />
                                ) : (
                                    <Button color="disabled" title="Send" style={{marginBottom: 0, marginTop: 30,}} />
                                )}
                            </Animated.View>
                        </>
                    )}

                    {showBlockBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackBlockPress()}} style={{position: 'absolute',left: 15, top: 0}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation3 }],position: 'absolute',width: '90%',marginTop: 30,alignSelf: 'center',}}>
                                <UserPfp 
                                    details={editedPost?.value.creator_details} 
                                    style={{alignSelf: 'center',marginTop: -30,}} 
                                    badge_style={{right:Dimensions.get('window').width/2.6,top:-30}}
                                />

                                <Text style={styles.modalText}>Block @{username} ?</Text>
                                <Text style={{marginTop: 10, color: '#959595', fontSize: 14,textAlign:'center'}}>
                                    @{username} will no longer be able to follow or see your posts
                                </Text>

                                <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                                    <Button 
                                        loading={loader}
                                        size="md" 
                                        color="orange" 
                                        title="Block" 
                                        onPress={blockUser} 
                                        style={{width: '100%',alignItems: 'center',height:50,justifyContent: 'center',marginTop: 14,}}
                                    />
                                    
                                    <Button 
                                        size="md" 
                                        color="white" 
                                        title="Cancel" 
                                        onPress={() => {Haptics.selectionAsync();onBackBlockPress()}} 
                                        style={{width: '100%',alignItems: 'center',marginTop: 15,height: 50,justifyContent: 'center',}}
                                    />
                                </View>
                            </Animated.View>
                        </>
                    )}

                    {showHideBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackHidePress()}} style={{position: 'absolute',left: 15, top: 0}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation4 }],position: 'absolute',width: '90%',marginTop: 30,alignSelf: 'center',}}>
                                <UserPfp 
                                    details={editedPost?.value.creator_details} 
                                    style={{alignSelf: 'center',marginTop: -30,}}
                                    badge_style={{right:Dimensions.get('window').width/2.6,top:-30}}
                                />

                                <Text style={styles.modalText}>Hide this post by @{username} ?</Text>
                                <Text style={{marginTop: 10, color: '#959595', fontSize: 14,textAlign:'center'}}>
                                    This post will be hidden and not be shown on feed.
                                </Text>

                                <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                                    <Button 
                                        loading={loader}
                                        size="md" 
                                        color="orange" 
                                        title="Hide" 
                                        onPress={hidePost} 
                                        style={{width: '100%',alignItems: 'center',height:50,justifyContent: 'center',marginTop: 14,}}
                                    />

                                    <Button 
                                        size="md" 
                                        color="white" 
                                        title="Cancel" 
                                        onPress={() => {Haptics.selectionAsync();onBackHidePress()}} 
                                        style={{width: '100%',alignItems: 'center',marginTop: 15,height: 50,justifyContent: 'center',}}
                                    />
                                </View>
                            </Animated.View>
                        </>
                    )}

                    {showMuteBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackMutePress()}} style={{position: 'absolute',left: 15, top: 0}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation5 }],position: 'absolute',width: '90%',marginTop: 30,alignSelf: 'center',}}>
                                <UserPfp 
                                    details={editedPost?.value.creator_details} 
                                    style={{alignSelf: 'center',marginTop: -30,}}
                                    badge_style={{right:Dimensions.get('window').width/2.6,top:-30}}
                                />

                                <Text style={styles.modalText}>Mute @{username} ?</Text>
                                <Text style={{marginTop: 10, color: '#959595', fontSize: 14,textAlign:'center'}}>
                                    You won't see posts from @{username} or get notifications.
                                </Text>

                                <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                                    <Button 
                                        loading={loader}
                                        size="md" 
                                        color="orange" 
                                        title="Mute" 
                                        onPress={MuteUser} 
                                        style={{width: '100%',alignItems: 'center',height:50,justifyContent: 'center',marginTop: 14,}}
                                    />

                                    <Button 
                                        size="md" 
                                        color="white" 
                                        title="Cancel" 
                                        onPress={() => {Haptics.selectionAsync();onBackMutePress()}} 
                                        style={{width: '100%',alignItems: 'center',marginTop: 15,height: 50,justifyContent: 'center',}}
                                    />
                                </View>
                            </Animated.View>
                        </>
                    )}
                </View>
            </>
            // </Modal>
        )
    }else{
        return(
            // <Modal hide={() => hide()} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
            <>
                <View style={[tailwind('flex flex-col w-full p-5'), {marginTop: -10,}]}>
                    {loading ?
                        <>
                            <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Deleting post:</Text>
                            <View style={[tailwind('flex w-full justify-center'), {marginBottom: 25}]}>
                                <ActivityIndicator style={{marginTop: 15}} size="small" color="#020617" />
                            </View>
                        </>
                    :
                        <>
                            {success ?
                                <View style={[tailwind('flex w-full items-center')]}>
                                    <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25, marginBottom: 8 }]}>Success!</Text>
                                    <Image
                                        style={{height: 50, width: 50, marginBottom: 40}}
                                        source={require('../../assets/check_icon.png')} 
                                    />
                                </View>
                            :
                                <>
                                    {/** Repost CTA */}
                                    <Button color="rounded-gray" onPress={() => editPost()} title="Edit" style={{marginBottom: 10}} />
                                    <Button color="rounded-red" onPress={() => deletePost()} title="Delete" style={{marginBottom: 20}} />
                                </>
                            }
                        </>
                    }
                </View>
            </>
            // </Modal>
        )
    }
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width:'80%',
        height: 500,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2,
    },
    buttonOpen: {
        backgroundColor: '#F194FF',
    },
    buttonClose: {
        backgroundColor: '#2196F3',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        fontWeight: 'bold',
        fontSize: 18,
        textAlign:'center',
        marginTop: 10,
    },
  });