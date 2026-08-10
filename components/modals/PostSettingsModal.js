import React, { useState, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { Alert, Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, Platform, StyleSheet, TouchableHighlight } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import Modal from "../Modal";
import Button from "../Button";
import { sleep } from '../../utils';
import { GlobalContext } from "../../contexts/GlobalContext";
import {
    useDeviceAccountData,
    useDeviceAccountOperationLease,
} from '../../contexts/DeviceAccountDataContext';
import { showMessage } from "react-native-flash-message";
import { SuccessIcon } from "../Icons";
import { UserPfp } from "../User";
import useDidToAddress from "../../hooks/useDidToAddress";
import useGetUsername from "../../hooks/useGetUsername";
import usePosts from "../../hooks/usePosts";
import { getEasyGoUserId } from "../../utils/socialPostAdapter";

const list_report = [
    {label: 'It\'s spam'},
    {label: 'Nudity or sexual activity'},
    {label: 'Hate speech or symbols'},
    {label: 'Violence or dangerous'},
    {label: 'Bullying or harassment'},
    {label: 'Scam or fraud'},
    {label: 'False information'},
];

let nextPostSettingsOpenGeneration = 0;
let activePostSettingsPresentation = null;

function createPostSettingsTarget(source) {
    const post = source?.value;
    return Object.freeze({
        postId: post?.easygo?.postId || post?.stream_id || null,
        creatorDid: post?.creator_details?.did || post?.creator || null,
    });
}

function beginPostSettingsPresentation(source) {
    const target = createPostSettingsTarget(source);
    const presentation = Object.freeze({
        source,
        postId: target.postId,
        creatorDid: target.creatorDid,
        openGeneration: ++nextPostSettingsOpenGeneration,
    });
    activePostSettingsPresentation = presentation;
    return presentation;
}

function isCurrentPostSettingsPresentation(candidate) {
    return Boolean(
        candidate
        && activePostSettingsPresentation === candidate
        && activePostSettingsPresentation.postId === candidate.postId
        && activePostSettingsPresentation.creatorDid === candidate.creatorDid
        && activePostSettingsPresentation.openGeneration === candidate.openGeneration
    );
}

function invalidatePostSettingsPresentation(candidate) {
    if (activePostSettingsPresentation === candidate) {
        activePostSettingsPresentation = null;
    }
}

function isPostOwnedByUser(user, post) {
    const ownUserId = getEasyGoUserId(user);
    const authorUserId = post?.easygo?.authorId
        || getEasyGoUserId(post?.creator_details)
        || getEasyGoUserId(post?.creator);
    if (ownUserId && authorUserId) return ownUserId === authorUserId;

    const ownDid = user?.did || null;
    const creatorDid = post?.creator_details?.did || post?.creator || null;
    return Boolean(ownDid && creatorDid && ownDid === creatorDid);
}

export default function PostSettingsModal() {    
    const { 
        user,
        showPostbox,
        postboxVis,
        editedPost,
        setEditedPost,
        modalPostSettingsRef,
        showReportBack,
        setShowReportBack,
    } = useContext(GlobalContext);
    const {
        blockedAccounts: listBlockedUser,
        hiddenPosts: listHiddenPost,
        mutedAccounts: listMutedUsers,
        saveBlockedAccounts,
        saveHiddenPosts,
        saveMutedAccounts,
    } = useDeviceAccountData();
    const { isCurrentLease, lease } = useDeviceAccountOperationLease();

    const windowSize = Dimensions.get('window')

    const tailwind = useTailwind();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [checked, setChecked] = useState();

    const [showBlockBack, setShowBlockBack] = useState(false)
    const [showHideBack, setShowHideBack] = useState(false)
    const [showMuteBack, setShowMuteBack] = useState(false)

    const [loader, setLoader] = useState(false)
    const { remove: removePost, backendConfigured } = usePosts({ autoLoad: false });

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation3 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation4 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation5 = useRef(new Animated.Value(windowSize.width)).current;

    const presentationSourceRef = useRef(null);
    const livePresentationRef = useRef(null);
    if (
        presentationSourceRef.current !== editedPost
        || !livePresentationRef.current
    ) {
        presentationSourceRef.current = editedPost;
        livePresentationRef.current = beginPostSettingsPresentation(editedPost);
    }
    const openGeneration = livePresentationRef.current.openGeneration;

    const { address, chain } = useDidToAddress(editedPost?.value.creator_details.did);
    const username = useGetUsername(editedPost?.value.creator_details.profile, address, editedPost?.value.creator_details);
    const ownsSelectedPost = isPostOwnedByUser(user, editedPost?.value);

    const isCurrentOperation = (operation) => Boolean(
        operation
        && isCurrentLease(operation.expectedLease)
        && isCurrentPostSettingsPresentation(operation.expectedPresentation)
        && operation.expectedPostId === operation.expectedPresentation.postId
        && operation.expectedCreatorDid === operation.expectedPresentation.creatorDid
        && operation.expectedOpenGeneration === operation.expectedPresentation.openGeneration
    );

    const captureOperation = () => {
        const expectedLease = lease;
        const expectedPresentation = livePresentationRef.current;
        if (
            !expectedLease
            || !isCurrentLease(expectedLease)
            || !isCurrentPostSettingsPresentation(expectedPresentation)
        ) {
            return null;
        }
        return Object.freeze({
            expectedLease,
            expectedPresentation,
            expectedPostId: expectedPresentation.postId,
            expectedCreatorDid: expectedPresentation.creatorDid,
            expectedOpenGeneration: expectedPresentation.openGeneration,
            hiddenPostId: expectedPresentation.source?.value?.stream_id || expectedPresentation.postId,
            source: expectedPresentation.source,
            username,
        });
    };

    const resetPresentationState = () => {
        moveAnimation1.stopAnimation();
        moveAnimation2.stopAnimation();
        moveAnimation3.stopAnimation();
        moveAnimation4.stopAnimation();
        moveAnimation5.stopAnimation();
        moveAnimation1.setValue(0);
        moveAnimation2.setValue(windowSize.width);
        moveAnimation3.setValue(windowSize.width);
        moveAnimation4.setValue(windowSize.width);
        moveAnimation5.setValue(windowSize.width);
        setLoading(false);
        setSuccess(false);
        setChecked(undefined);
        setShowBlockBack(false);
        setShowHideBack(false);
        setShowMuteBack(false);
        setShowReportBack(false);
        setLoader(false);
    };

    useEffect(() => {
        if (!isCurrentPostSettingsPresentation(livePresentationRef.current)) {
            const mountedPresentation = beginPostSettingsPresentation(editedPost);
            presentationSourceRef.current = editedPost;
            livePresentationRef.current = mountedPresentation;
        }
        return () => invalidatePostSettingsPresentation(livePresentationRef.current);
    }, []);

    useLayoutEffect(() => {
        resetPresentationState();
    }, [openGeneration]);

    function hide(operation) {
        if (!isCurrentOperation(operation)) return false;
        invalidatePostSettingsPresentation(operation.expectedPresentation);
        setEditedPost((current) => (current === operation.source ? null : current));
        resetPresentationState();
        Keyboard.dismiss()
        Haptics.selectionAsync();
        modalPostSettingsRef.current?.close()
        return true;
    }
    
    async function editPost() {
        const operation = captureOperation();
        if (!operation) return;
        invalidatePostSettingsPresentation(operation.expectedPresentation);
        modalPostSettingsRef.current?.close()
        showPostbox();
    }

    async function deletePost() {
        const operation = captureOperation();
        if (!operation) return;
        const postId = operation.expectedPostId;
        if (!backendConfigured) {
            Alert.alert('Backend not connected', 'Add EXPO_PUBLIC_BACKEND_URL to .env before deleting.');
            return;
        }
        if (!postId) {
            Alert.alert('Post unavailable', 'Close this menu and reopen the post.');
            return;
        }

        setLoading(true);
        const removed = await removePost(postId);
        if (removed && isCurrentLease(operation.expectedLease)) {
            operation.source?.callbackDelete?.();
        }
        if (!isCurrentOperation(operation)) return;
        setLoading(false);
        if (!removed) {
            Alert.alert('Could not delete post', 'Check the backend connection and try again.');
            return;
        }

        setSuccess(true);
        await sleep(1500);
        if (!isCurrentOperation(operation)) return;
        hide(operation);
    }

    const doAnimation = (ref1, ref2, value1, value2, return_function) => {
        const expectedPresentation = livePresentationRef.current;
        if (!isCurrentPostSettingsPresentation(expectedPresentation)) return;
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
        ]).start(() => {
            if (!isCurrentPostSettingsPresentation(expectedPresentation)) return;
            return_function?.();
        });
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
        const operation = captureOperation();
        if (!operation) return;
        Haptics.selectionAsync();
        setLoading(true);

        setTimeout(() => {
            if (!isCurrentOperation(operation)) return;
            setLoading(false);

            showMessage({
                message: "This post was reported !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
            hide(operation);
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
        const operation = captureOperation();
        if (!operation) return;
        Haptics.selectionAsync()
        try {
            setLoader(true)
    
            const userInfo = operation.expectedCreatorDid;
            const temp_list = listBlockedUser?.includes(userInfo)
                ? listBlockedUser
                : [...(listBlockedUser || []), userInfo];
            const saved = await saveBlockedAccounts(temp_list);
            if (!isCurrentOperation(operation)) return;
            if (!saved) {
                setLoader(false);
                return;
            }

            setLoader(false)
            showMessage({
                message: "@"+operation.username+" is now blocked !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
            hide(operation)
        } catch {
            if (isCurrentOperation(operation)) {
                setLoader(false);
                Alert.alert('Could not block account', 'Please try again.');
            }
        }
    }

    const hidePost = async () => {
        const operation = captureOperation();
        if (!operation) return;
        try {
            setLoader(true)
    
            const postInfo = operation.hiddenPostId;
            const temp_list = listHiddenPost?.includes(postInfo)
                ? listHiddenPost
                : [...(listHiddenPost || []), postInfo];
            const saved = await saveHiddenPosts(temp_list);
            if (!isCurrentOperation(operation)) return;
            if (!saved) {
                setLoader(false);
                return;
            }

            setLoader(false)
            showMessage({
                message: "This post by @"+operation.username+" is now hidden !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
            hide(operation)
        } catch {
            if (isCurrentOperation(operation)) {
                setLoader(false);
                Alert.alert('Could not hide post', 'Please try again.');
            }
        }
    }

    const MuteUser = async () => {
        const operation = captureOperation();
        if (!operation) return;
        try {
            setLoader(true)
    
            const userInfo = operation.expectedCreatorDid;
            const temp_list = listMutedUsers?.includes(userInfo)
                ? listMutedUsers
                : [...(listMutedUsers || []), userInfo];
            const saved = await saveMutedAccounts(temp_list);
            if (!isCurrentOperation(operation)) return;
            if (!saved) {
                setLoader(false);
                return;
            }

            setLoader(false)
            showMessage({
                message: "@"+operation.username+" is now muted !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
            hide(operation)
        } catch {
            if (isCurrentOperation(operation)) {
                setLoader(false);
                Alert.alert('Could not mute account', 'Please try again.');
            }
        }
    }


    /** We hide the repost modal if the postbox is also visible, (this means that the user is quote posting) */
    if(postboxVis) {
        return null;
    } else if((editedPost?.type == 'notCreator' && !ownsSelectedPost) || editedPost?.type == 'notCreatorReposted'){
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
