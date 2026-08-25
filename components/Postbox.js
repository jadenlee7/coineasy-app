import React, { useContext, useState, useEffect, useRef } from "react";
import { Alert, Text, View, TouchableOpacity, TouchableHighlight, TextInput, ActivityIndicator, Platform, Image, ScrollView, BackHandler, Dimensions, KeyboardAvoidingView, Animated, Keyboard } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import Post from "./Post";
import Button from "./Button";
import User, { UserPfp, Username } from "./User";
import { checkContextAccess, isOwner } from "../utils";
import { GlobalContext } from "../contexts/GlobalContext";
import { BackIcon, ImagePickerIcon, CaretDownIcon, CloseIcon, LockIcon, UnlockIcon, CameraIcon } from "./Icons";
import usePosts from "../hooks/usePosts";
import useReplies from "../hooks/useReplies";
import { api } from "../utils/api";
import { adaptSocialAuthor } from "../utils/socialPostAdapter";
import { useDeviceAccountOperationLease } from "../contexts/DeviceAccountDataContext";

const { width, height } = Dimensions.get('window')

function postboxReplyParentId(replyTo) {
    return replyTo?.easygo?.postId || replyTo?.stream_id || null;
}

function postboxEditedPostId(editedPost) {
    return editedPost?.value?.easygo?.postId || editedPost?.value?.stream_id || null;
}

export function createPostboxComposeTarget({ editedPost, openGeneration = 0, replyTo, repost }) {
    const editedPostId = postboxEditedPostId(editedPost);
    const replyParentId = postboxReplyParentId(replyTo);
    return Object.freeze({
        mode: editedPostId ? 'edit' : replyParentId ? 'reply' : repost ? 'repost' : 'post',
        editedPostId,
        replyParentId,
        openGeneration: Number.isFinite(openGeneration) ? openGeneration : 0,
    });
}

export function samePostboxComposeTarget(left, right) {
    return Boolean(
        left
        && right
        && left.mode === right.mode
        && left.editedPostId === right.editedPostId
        && left.replyParentId === right.replyParentId
        && left.openGeneration === right.openGeneration
    );
}

export function postboxComposeTargetKey(target) {
    return JSON.stringify([
        target?.mode || 'post',
        target?.editedPostId || null,
        target?.replyParentId || null,
        target?.openGeneration || 0,
    ]);
}

function categoryIdentity(category) {
    return category?.stream_id
        || category?.id
        || category?.content?.id
        || category?.content?.displayName
        || null;
}

export function postboxCategoryRequiresAccess(category) {
    return Boolean(
        category?.content?.accessRules
        && category.content.accessRules.length > 0
    );
}

export function createPostboxDraft(editedPost) {
    const content = editedPost?.value?.content || {};
    const category = editedPost ? {
        content: editedPost.value?.context_details?.context_details
            || content.context_details
            || null,
        stream_id: editedPost.value?.context || content.context || null,
    } : false;
    return {
        category,
        media: Array.isArray(content.media) ? [...content.media] : [],
        mentions: Array.isArray(content.mentions) ? [...content.mentions] : [],
        message: typeof content.body === 'string' ? content.body : '',
    };
}

export default function Postbox({isReply = false, openGeneration = 0}) {
    const { 
        user, 
        userData,
        setShowConnectModal, 
        hidePostbox, 
        replyTo, 
        repost, 
        callbackPostShared,
        defaultCallbackPostShared,
        category, 
        categories, 
        editedPost, 
        selectedCategory, 
        selectedNews, 
        currentRoute,
        categoriesVis,
        setCategoriesVis
    } = useContext(GlobalContext);
    const { lease, isCurrentLease } = useDeviceAccountOperationLease();
    const tailwind = useTailwind();
    const replyParentId = postboxReplyParentId(replyTo);
    const composeTarget = createPostboxComposeTarget({
        editedPost,
        openGeneration,
        replyTo,
        repost,
    });
    const composeTargetKey = postboxComposeTargetKey(composeTarget);
    const initialDraft = createPostboxDraft(editedPost);
    const initialHasAccess = !postboxCategoryRequiresAccess(initialDraft.category);
    const { create: createPost, update: updatePost, backendConfigured } = usePosts({ autoLoad: false });
    const { create: createReply } = useReplies(replyParentId, { autoLoad: false });

    const textInputRef = useRef();
    const mentionsRef = useRef(initialDraft.mentions);
    const liveComposeTargetRef = useRef(composeTarget);
    const liveMentionOwnerUserIdRef = useRef(user?.id || null);
    const mentionRequestGenerationRef = useRef(0);
    const accessRequestGenerationRef = useRef(0);
    const selectedCategoryIdentityRef = useRef(categoryIdentity(initialDraft.category));
    const composeOperationGenerationRef = useRef(0);
    const composeOperationRef = useRef(null);
    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(width)).current;
    liveComposeTargetRef.current = composeTarget;
    liveMentionOwnerUserIdRef.current = user?.id || null;

    const [message, setMessage] = useState(initialDraft.message);
    const [loading, setLoading] = useState(false);
    const [categorySelected, setCategorySelected] = useState(initialDraft.category);
    const [hasAccess, setHasAccess] = useState(initialHasAccess);
    const [mentionsBoxVis, setMentionsBoxVis] = useState(false);
    const [currentMention, setCurrentMention] = useState(null);
    const [listMedia, setListMedia] = useState(initialDraft.media);
    const [fullListFollow, setFullListFollow] = useState([])
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const nextDraft = createPostboxDraft(editedPost);
        composeOperationGenerationRef.current += 1;
        composeOperationRef.current = null;
        accessRequestGenerationRef.current += 1;
        mentionsRef.current = nextDraft.mentions;
        selectedCategoryIdentityRef.current = categoryIdentity(nextDraft.category);
        setMessage(nextDraft.message);
        setListMedia(nextDraft.media);
        setCategorySelected(nextDraft.category);
        setHasAccess(!postboxCategoryRequiresAccess(nextDraft.category));
        setMentionsBoxVis(false);
        setCurrentMention(null);
        setLoading(false);
        setCategoriesVis(false);
        moveAnimation1.setValue(0);
        moveAnimation2.setValue(width);
    }, [composeTargetKey, moveAnimation1, moveAnimation2, setCategoriesVis])

    useEffect(() => {
        void getListFollow()
        return () => {
            mentionRequestGenerationRef.current += 1;
        };
    }, [backendConfigured, isCurrentLease, lease, user?.id])

    useEffect(() => {
        function onKeyboardDidShow(e) {setKeyboardHeight(e.endCoordinates.height);}
        function onKeyboardDidHide(e) {setKeyboardHeight(0);}

        const keyboardOpen = Keyboard.addListener('keyboardDidShow', onKeyboardDidShow);
        const keyboardClose = Keyboard.addListener('keyboardDidHide', onKeyboardDidHide);
        return () => {
            keyboardOpen.remove();
            keyboardClose.remove();
        };
    }, [])

    function isCurrentComposeTarget(operationTarget, operationLease) {
        return Boolean(
            operationLease
            && isCurrentLease(operationLease)
            && samePostboxComposeTarget(liveComposeTargetRef.current, operationTarget)
        );
    }

    function beginComposeOperation(operationLease, operationTarget) {
        const existing = composeOperationRef.current;
        if (existing && isCurrentComposeOperation(existing)) return null;
        const operation = Object.freeze({
            generation: ++composeOperationGenerationRef.current,
            lease: operationLease,
            target: operationTarget,
        });
        composeOperationRef.current = operation;
        return operation;
    }

    function isCurrentComposeOperation(operation) {
        return Boolean(
            operation
            && composeOperationRef.current === operation
            && operation.generation === composeOperationGenerationRef.current
            && isCurrentComposeTarget(operation.target, operation.lease)
        );
    }

    function finishComposeOperation(operation) {
        if (composeOperationRef.current !== operation) return;
        composeOperationRef.current = null;
        if (isCurrentComposeTarget(operation.target, operation.lease)) setLoading(false);
    }

    async function getListFollow() {
        const operationLease = lease;
        const operationUserId = user?.id || null;
        const requestGeneration = ++mentionRequestGenerationRef.current;
        const isCurrentRequest = () => Boolean(
            operationLease
            && isCurrentLease(operationLease)
            && requestGeneration === mentionRequestGenerationRef.current
            && liveMentionOwnerUserIdRef.current === operationUserId
        );
        if (!operationLease || !isCurrentLease(operationLease)) return;
        setFullListFollow([]);
        if (!operationUserId || !backendConfigured) return;

        try {
            const [followersResult, followingResult] = await Promise.all([
                api.follows.followers(operationUserId, { limit: 100 }),
                api.follows.following(operationUserId, { limit: 100 }),
            ]);
            if (!isCurrentRequest()) return;
            const followers = (followersResult?.rows || []).map((profile) => ({
                details: { ...adaptSocialAuthor(profile), type: 'Followers' },
            }));
            const following = (followingResult?.rows || []).map((profile) => ({
                details: { ...adaptSocialAuthor(profile), type: 'Following' },
            }));
            setFullListFollow([...followers, ...following]);
        } catch (error) {
            if (!isCurrentRequest()) return;
            console.warn('[Postbox] unable to load mention suggestions', error);
            setFullListFollow([]);
        }
    }

    async function checkAccess(temp_cat) {
        const operationLease = lease;
        const operationTarget = composeTarget;
        const operationCategoryIdentity = categoryIdentity(temp_cat);
        const requestGeneration = ++accessRequestGenerationRef.current;
        selectedCategoryIdentityRef.current = operationCategoryIdentity;
        const isCurrentSelection = () => Boolean(
            samePostboxComposeTarget(liveComposeTargetRef.current, operationTarget)
            && requestGeneration === accessRequestGenerationRef.current
            && selectedCategoryIdentityRef.current === operationCategoryIdentity
        );
        const isCurrentRequest = () => Boolean(
            isCurrentComposeTarget(operationTarget, operationLease)
            && isCurrentSelection()
        );
        if (!postboxCategoryRequiresAccess(temp_cat)) {
            if (isCurrentSelection()) setHasAccess(true);
            return;
        }
        if (!operationLease || !isCurrentComposeTarget(operationTarget, operationLease)) return;
        if (isCurrentRequest()) setHasAccess(false);
        try {
            await checkContextAccess(user, temp_cat.content.accessRules, () => {
                if (isCurrentRequest()) setHasAccess(true);
            });
        } catch (error) {
            if (isCurrentRequest()) console.log(error);
        }
    }

    /** Pre-select category if one already selected in the feed */
    useEffect(() => {
        const editCategory = createPostboxDraft(editedPost).category;
        const temp_cat = composeTarget.mode === 'edit'
            ? editCategory
            : category || selectedCategory || selectedNews
                ? currentRoute == 'Categories'
                    ? selectedCategory
                    : currentRoute == 'News'
                        ? selectedNews
                        : category
                : false;
        selectedCategoryIdentityRef.current = categoryIdentity(temp_cat);
        setCategorySelected(temp_cat);
        void checkAccess(temp_cat || null);
    }, [category, composeTargetKey, currentRoute, isCurrentLease, lease, selectedCategory, selectedNews])

    async function edit() {
        const operationLease = lease;
        const operationTarget = composeTarget;
        if (!operationLease || !isCurrentComposeTarget(operationTarget, operationLease)) return;
        if (composeOperationRef.current && isCurrentComposeOperation(composeOperationRef.current)) return;
        Haptics.selectionAsync();
        const operationEditedPost = editedPost;
        const operationCategory = categorySelected;
        const postId = operationTarget.editedPostId;
        const body = message.trim();
        if (!backendConfigured) {
            Alert.alert('Backend not connected', 'Add EXPO_PUBLIC_BACKEND_URL to .env before editing.');
            return;
        }
        if (!user || !postId) {
            Alert.alert('Post unavailable', 'Sign in again and reopen the post before editing.');
            return;
        }
        if (!body) {
            Alert.alert('Write something first', 'A post needs some text.');
            return;
        }

        const categoryTag = categorySelected?.tag || categorySelected?.content?.displayName;
        const normalizedCategoryTag = typeof categoryTag === 'string' && categoryTag.startsWith('#') ? categoryTag : null;
        const publishBody = normalizedCategoryTag && !body.toLowerCase().includes(normalizedCategoryTag.toLowerCase())
            ? `${body}\n\n${normalizedCategoryTag}`
            : body;
        if (publishBody.length > 2000) {
            Alert.alert('Post is too long', 'Shorten the post to 2,000 characters or fewer.');
            return;
        }

        const firstMedia = listMedia?.[0];
        const mediaUrl = firstMedia?.url || firstMedia?.[0]?.url || null;
        const operation = beginComposeOperation(operationLease, operationTarget);
        if (!operation) return;
        setLoading(true);
        try {
            const updated = await updatePost(postId, { body: publishBody, mediaUrl });
            if (!isCurrentComposeOperation(operation)) return;
            if (!updated) {
                Alert.alert('Could not edit post', 'Check the backend connection and try again.');
                return;
            }
            operationEditedPost?.callback?.(
                updated.content.body,
                updated.content.media,
                operationCategory || null
            );
            if (!operationEditedPost?.callback && isCurrentComposeOperation(operation)) hidePostbox();
        } finally {
            finishComposeOperation(operation);
        }
    }

    /** Create a root post or reply through the EasyGo backend. */
    async function send() {
        const operationLease = lease;
        const operationTarget = composeTarget;
        if (!operationLease || !isCurrentComposeTarget(operationTarget, operationLease)) return;
        let operation = null;

        try {
            if (composeOperationRef.current && isCurrentComposeOperation(composeOperationRef.current)) return;
            Haptics.selectionAsync();
            const body = message.trim();

            if (!backendConfigured) {
                Alert.alert('Backend not connected', 'Add EXPO_PUBLIC_BACKEND_URL to .env before publishing.');
                return;
            }
            if (!user) {
                showConnect();
                return;
            }
            if (repost) {
                Alert.alert('Reposts are coming next', 'EasyGo repost publishing is not connected yet.');
                return;
            }
            if (!body) {
                Alert.alert('Write something first', 'A post or reply needs some text before it can be published.');
                return;
            }

            const operationReplyTo = replyTo;
            const operationRepost = repost;
            const operationCategory = categorySelected;
            const operationMentions = [...mentionsRef.current];
            const operationCallback = callbackPostShared || defaultCallbackPostShared;
            const categoryTag = operationCategory?.tag || operationCategory?.content?.displayName;
            const normalizedCategoryTag = typeof categoryTag === 'string' && categoryTag.startsWith('#') ? categoryTag : null;
            const publishBody = !operationReplyTo && normalizedCategoryTag && !body.toLowerCase().includes(normalizedCategoryTag.toLowerCase())
                ? `${body}\n\n${normalizedCategoryTag}`
                : body;
            if (publishBody.length > 2000) {
                Alert.alert('Post is too long', 'Shorten the post so the category hashtag fits within 2,000 characters.');
                return;
            }

            let _context = null;
            let master;
            if(operationReplyTo) {
                _context = operationReplyTo.content.context;
                if(operationReplyTo.content.master) {
                    master = operationReplyTo.content.master;
                } else {
                    master = operationReplyTo.stream_id;
                }
            }
            else if(operationRepost) {
                _context = operationRepost.context;
            } else if(operationCategory) {
                _context = operationCategory.stream_id;
            }

            operation = beginComposeOperation(operationLease, operationTarget);
            if (!operation) return;
            setLoading(true);
            let content = {
                body: publishBody,
                context: _context,
                media: listMedia ? listMedia : null,
                repost: operationRepost ? operationRepost.stream_id : null,
                reply_to: operationReplyTo ? operationReplyTo.stream_id : null,
                master: master ? master : null,
                mentions: operationMentions,
                repost_details: operationRepost
            };

            const firstMedia = listMedia?.[0];
            const mediaUrl = firstMedia?.url || firstMedia?.[0]?.url || null;
            const created = operationReplyTo
                ? await createReply({ body: publishBody, mediaUrl })
                : await createPost({ body: publishBody, mediaUrl });
            if (!isCurrentComposeOperation(operation)) return;

            if(created) {
                setMessage("");
                mentionsRef.current = [];

                const temp_details = {}
                temp_details.context_details = operationCategory?.content
                temp_details.context_id = operationCategory?.stream_id
                let _callbackContent = {
                    ...created,
                    content: { ...created.content, ...content },
                    repost_details: operationRepost,
                    context: operationCategory?.stream_id,
                    context_details: operationCategory ? temp_details : null,
                }

                /** If any trigger callback after the post is shared */
                await operationCallback?.(_callbackContent);
                if (!isCurrentComposeOperation(operation)) return;

                hidePostbox();
                return;

            //     const tempData = userData ?? {}                

            //     if(!replyTo && userData.rewardFirstPost == 'reward pending'){
            //         if(tempData.listClaimedOranges){
            //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
            //             if(index != -1){
            //                 tempData.listClaimedOranges[index].listOranges.push({
            //                     numberOranges: 50,
            //                     type: 'First Post'
            //                 })
            //             }else{
            //                 tempData.listClaimedOranges.push({
            //                     date: moment().format('YYYY-MM-DD'),
            //                     listOranges: [
            //                         {
            //                             numberOranges: 50,
            //                             type: 'First Post'
            //                         },
            //                     ]
            //                 })
            //             }
            //         }else{
            //             tempData.listClaimedOranges = [{
            //                 date: moment().format('YYYY-MM-DD'),
            //                 listOranges: [
            //                     {
            //                         numberOranges: 50,
            //                         type: 'First Post'
            //                     },
            //                 ]
            //             }]
            //         }

            //         if(tempData.post){
            //             tempData.post.number += 1
            //             tempData.post.gained += 50
            //         }else{
            //             tempData.post = {
            //                 number: 1,
            //                 gained: 50,
            //                 lastPost: moment().format('YYYY-MM-DD HH:mm')
            //             }
            //         }

            //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.activityUnclaimed = {number: 50}        
            //         tempData.rewardFirstPost = 'claimed'
            //         setUserData({...tempData})
            //     }else if(!replyTo){
            //         if(tempData.listClaimedOranges){
            //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
            //             if(index != -1){
            //                 tempData.listClaimedOranges[index].listOranges.push({
            //                     numberOranges: 15,
            //                     type: 'Post'
            //                 })

            //                 if(tempData.post?.number == 9){
            //                     tempData.listClaimedOranges[index].listOranges.push({
            //                         numberOranges: 50,
            //                         type: 'Posting Milestone achieved'
            //                     })
            //                 }
            //             }else{
            //                 if(tempData.post?.number == 9){
            //                     tempData.listClaimedOranges.push({
            //                         date: moment().format('YYYY-MM-DD'),
            //                         listOranges: [
            //                             {
            //                                 numberOranges: 15,
            //                                 type: 'Post'
            //                             },
            //                             {
            //                                 numberOranges: 50,
            //                                 type: 'Posting Milestone achieved'
            //                             }
            //                         ]
            //                     })
            //                 }else{
            //                     tempData.listClaimedOranges.push({
            //                         date: moment().format('YYYY-MM-DD'),
            //                         listOranges: [
            //                             {
            //                                 numberOranges: 15,
            //                                 type: 'Post'
            //                             },
            //                         ]
            //                     })
            //                 }
            //             }
            //         }else{
            //             tempData.listClaimedOranges = [{
            //                 date: moment().format('YYYY-MM-DD'),
            //                 listOranges: [
            //                     {
            //                         numberOranges: 15,
            //                         type: 'Post'
            //                     },
            //                 ]
            //             }]
            //         }
            //         if(tempData.post.number == 9){
            //             tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 65 : tempData.activityUnclaimed = {number: 65}
            //         }else{
            //             tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 15 : tempData.activityUnclaimed = {number: 15}
            //         }
                    
            //         if(tempData.post){
            //             if(tempData.post.number == 9){
            //                 tempData.post.number = 0
            //                 tempData.post.gained += 65
            //             }else{
            //                 tempData.post.number += 1
            //                 tempData.post.gained += 15
            //             }
            //         }else{
            //             tempData.post = {
            //                 number: 1,
            //                 gained: 15,
            //                 lastPost: moment().format('YYYY-MM-DD HH:mm')
            //             }
            //         }

            //         setUserData({...tempData})
            //     }else if(replyTo){
            //         if(tempData.listClaimedOranges){
            //             console.log('ici');
                        
            //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
            //             if(index != -1){

            //                 console.log('index: '+index);
                            
            //                 tempData.listClaimedOranges[index].listOranges.push({
            //                     numberOranges: 3,
            //                     type: 'Comment'
            //                 })
            //                 if(tempData.comment?.number == 19){
            //                     tempData.listClaimedOranges[index].listOranges.push({
            //                         numberOranges: 50,
            //                         type: 'Comments Milestone achieved'
            //                     })
            //                 }

            //                 console.log(tempData.listClaimedOranges);
                            
            //             }else{
            //                 console.log('pas dindex');
                            
            //                 if(tempData.comment?.number == 19){
            //                     tempData.listClaimedOranges.push({
            //                         date: moment().format('YYYY-MM-DD'),
            //                         listOranges: [
            //                             {
            //                                 numberOranges: 3,
            //                                 type: 'Comment'
            //                             },
            //                             {
            //                                 numberOranges: 50,
            //                                 type: 'Comments Milestone achieved'
            //                             },
            //                         ]
            //                     })
            //                 }else{
            //                     tempData.listClaimedOranges.push({
            //                         date: moment().format('YYYY-MM-DD'),
            //                         listOranges: [
            //                             {
            //                                 numberOranges: 3,
            //                                 type: 'Comment'
            //                             },
            //                         ]
            //                     })

            //                 }

            //                 console.log('listClaimedOranges');
                            
            //                 console.log(tempData.listClaimedOranges);
            //                 console.log(' ');


            //             }
            //         }else{
            //             tempData.listClaimedOranges = [{
            //                 date: moment().format('YYYY-MM-DD'),
            //                 listOranges: [
            //                     {
            //                         numberOranges: 3,
            //                         type: 'Comment'
            //                     },
            //                 ]
            //             }]
            //         }

            //         console.log('activity unclaimed');
            //         console.log(tempData.activityUnclaimed );
            //         console.log(' ');

                    
            //         if(tempData.comment.number == 19){
            //             tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 53 : tempData.activityUnclaimed = {number: 53}
            //         }else{
            //             tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 3 : tempData.activityUnclaimed = {number: 3}
            //         }
            //         console.log(tempData.activityUnclaimed );

            //         console.log('comment');
            //         console.log(tempData.comment);
            //         console.log(' ');

                    
            //         if(tempData.comment){
            //             if(tempData.comment.number == 19){
            //                 tempData.comment.number = 0
            //                 tempData.comment.gained += 50
            //             }else{
            //                 tempData.comment.number += 1
            //                 tempData.comment.gained += 3
            //             }
            //         }else{
            //             tempData.comment = {
            //                 number: 1,
            //                 gained: 3,
            //                 lastComment: moment().format('YYYY-MM-DD HH:mm')
            //             }
            //         }
            //         console.log(tempData.comment);
            //         console.log(' ');

            //         console.log('temp data');
            //         console.log(tempData);
            //         console.log(' ');

                    

            //         setUserData({...tempData})
            //     }

            //     var tempProfile = user.profile
            //     tempProfile.data = tempData
            //     Profile reward syncing moved to the backend.

            //     setLoading(false);
            } else {
                Alert.alert('Could not publish', 'Please check your connection and try again.');
            }

            // hidePostbox()
        } catch(e) {
            if (!operation || !isCurrentComposeOperation(operation)) return;
            console.log("Error sharing post: ", e);
            Alert.alert('Could not publish', 'Please check your connection and try again.');
        } finally {
            if (operation) finishComposeOperation(operation);
        }
    }

    /** Will show connect modal and return haptic feedback */
    async function showConnect() {
        Haptics.selectionAsync();
        setShowConnectModal(true)
    }

    function showMediaComingSoon() {
        Haptics.selectionAsync();
        Alert.alert('Media uploads are coming next', 'Text posts and replies work now. EasyGo media storage is the next backend step.');
    }

    function openCategory() {
        Haptics.selectionAsync();
        Keyboard.dismiss()

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: -width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start();

        setCategoriesVis(true)
    }
    
    function closeCategory() {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setCategoriesVis(false)
        });
    }

    function getWordAtCharCount(str, charCount) {
        // Adjust the index to 0-based (JavaScript uses 0-based indices)
        let index = charCount;
        if(charCount == -1) {
            index = 0;
        } else if(charCount > 1) {
            index = charCount + 1
        }

        // Check bounds
        if (index < 0 || index >= str.length) {
            return null;
        }

        // Find the start of the word
        let start = index;
        while (start > 0 && str[start] !== ' ') {
            start--;
        }

        // Find the end of the word
        let end = index;
        while (end < str.length && str[end] !== ' ') {
            end++;
        }

        // Return the word
        return str.substring(start, end).trim();
    }

    function handleTextChange(value) {
        setMessage(value);

        // Find the word currently focused on
        const words = value.split(' ');
        let cursorPosition = value.lastIndexOf(' ');
        //console.log("words:", words);
        const _currentWord = getWordAtCharCount(value, cursorPosition);
        if(_currentWord?.includes("@")) {
            setMentionsBoxVis(true);
            setCurrentMention(_currentWord.replace("@", ""));
        } else {
            setMentionsBoxVis(false);
            setCurrentMention(null);
        }
    }

    function mentionUser(mention) {
        /** Save username to did */
        let _mentionName = mention.profile?.username?.replaceAll(" ", "");
        const new_mention = {
            username: "@" + _mentionName,
            did: mention.did
        }
        mentionsRef.current.push(new_mention);

        // let seenObjects = [];
        // let listWithoutDuplicates = mentions.filter(objet => {
        //     if (!seenObjects.hasOwnProperty(objet.did)) {
        //         seenObjects[objet.did] = true;
        //         return true;
        //     }
        //     return false;
        // });
        
        // let _message = "";
        // listWithoutDuplicates.forEach((e, index) => {
        //     if(index != listWithoutDuplicates.length-1){
        //         _message += e.username+" "
        //     }else{
        //         _message += e.username
        //     }
        // });

        // let _message;
        // if(currentMention && currentMention != "") {
        //     _message = message.replace(currentMention, _mentionName);
        // } else {
        //     _message = "@" + _mentionName;
        // }

        const at_index = message.lastIndexOf('@')
        setMessage(message.slice(0, at_index) + new_mention.username + " ");
        setMentionsBoxVis(false);
        textInputRef?.current?.focus();
    }

    useEffect(() => {
        const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
            if(categoriesVis){
                setCategoriesVis(false)
                return true
            }
            hidePostbox()
            return true
        })

        return () => backhandler.remove()
    }, [categoriesVis, hidePostbox, setCategoriesVis])


    const UserLoop = ({term, mentionUser}) => {
        const { user } = useContext(GlobalContext);
        const tailwind = useTailwind();
        const [users, setUsers] = useState([]);
        const [followUsers, setFollowUsers] = useState([]);
        const [usersLoading, setUsersLoading] = useState(false);

        useEffect(() => {
            searchUsers();

            async function searchUsers() {
                setUsersLoading(true);

                let result = term != '' ? fullListFollow.filter(e => e.details?.profile?.username?.startsWith(term)) : fullListFollow

                let seenObjects = {};
                let listWithoutDuplicates = result.filter(objet => {
                    if (!seenObjects.hasOwnProperty(objet.details.did)) {
                        seenObjects[objet.details.did] = true;
                        return true;
                    }
                    return false;
                });

                setUsers([]);
                setFollowUsers(listWithoutDuplicates)
                setUsersLoading(false);
            }
        }, [fullListFollow, term]);

        /** Show loasing state */
        if(usersLoading) {
            return(
                <View style={tailwind("mt-2")}>
                    <ActivityIndicator size="small" color="#FF6B17" />
                </View>
            )
        }

        /** Loop through all users */
        return (
            <ScrollView keyboardShouldPersistTaps='handled'>
                {/** Show everyone tag if user is admin */}
                {(isOwner(user?.did) && "everyone".includes(term)) &&
                    <TouchableOpacity style={tailwind("p-2 px-4")} activeOpacity={0.6} onPress={() => mentionUser({did: "did:@:everyone", profile: {username: "everyone"}})}>
                        <View style={tailwind('flex flex-row items-center')}>
                            <Image
                                style={[tailwind('rounded-full'), { height: 40, width: 40 }]}
                                source={require('../assets/pfp_everyone.png')}
                            />
                            <Text style={[tailwind('ml-2 text-main'), { fontFamily: "GmarketBold", fontSize: 13, lineHeight: 19, color: "#FF6B17" }]} >everyone</Text>
                        </View>
                    </TouchableOpacity>
                }

                {/** Loop through follow users */}
                {followUsers.map((_user, key) => {
                    return (
                        <UserRow key={_user.did ? _user.did : _user.details.did} details={_user.details} mentionUser={mentionUser} isFollow={true}/>
                    );
                })}

                {/** Loop through users */}
                {users.map((_user, key) => {
                    return (
                        <UserRow key={_user.did ? _user.did : _user.details.did} details={_user.details} mentionUser={mentionUser} isFollow={false}/>
                    );
                })}
            </ScrollView>
        )
    }

    const UserRow = ({details, mentionUser, isFollow}) => {
        const tailwind = useTailwind();
        return(
            <TouchableOpacity style={tailwind("p-2 px-4")} activeOpacity={0.6} onPress={() => mentionUser(details)}>
                <User details={details} isFollow={isFollow}/>
            </TouchableOpacity>
        )
    }

    const Category = ({category, setCategoriesVis, setCategorySelected}) => {

        function select() {
            Haptics.selectionAsync();

            Animated.parallel([
                Animated.timing(moveAnimation1, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true
                }),
                Animated.timing(moveAnimation2, {
                    toValue: width,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start(() => {
                setCategorySelected(category);
                setCategoriesVis(false);
                checkAccess(category);
                textInputRef.current?.focus()
            });
        }

        return(
            <Button
                title={category.content.displayName}
                style={{width: "48%", marginRight: "2%", marginBottom: 10}}
                color="rounded-gray"
                onPress={() => select()}
            />
        )
    }

    const Media = ({media, deleteMedia, index}) => {
        const tailwind = useTailwind();
        const [ratioHeight, setRatioHeight] = useState(400)

        if(media && media.length > 0) { 

            Image.getSize(media[0].url, (width, height) => {
                const ratioWidth = (Dimensions.get('window').width - 40)/width
                const newHeight = height*ratioWidth
                setRatioHeight(newHeight)
            })

            return(
                <View style={{marginTop: 0,marginBottom: 10,marginLeft: typeof index === 'undefined' ? 0 : index != 0 ? 10 : 20,borderWidth: 0}}>
                    <Image
                        style={[
                            tailwind('rounded-md'), 
                            { 
                                width: width - 40,
                                height:ratioHeight,
                                resizeMode: 'contain',
                            }
                        ]}
                        source={{
                            uri: media[0].url,
                        }}
                        
                    />
                    <TouchableHighlight onPress={deleteMedia} style={{ position: "absolute", right: 6, top: 6}} underlayColor="transparent">
                        <CloseIcon />
                    </TouchableHighlight>
                </View>
            )
        }
    }

    const deleteMedia = (index) => {
        listMedia.splice(index, 1)
        setListMedia([...listMedia])
    }

    return (
        <>
            {/* {(repost != false && repost != null) ? ( */}
            <ScrollView style={[tailwind('w-full'), {maxHeight: Dimensions.get('screen').height,marginTop: categoriesVis ? -16 : -20}]} keyboardShouldPersistTaps='handled'>

                    <Animated.View style={[tailwind('flex flex-col items-start p-5'), {transform: [{ translateX: moveAnimation1 }]}]}>
                        {/** Top bar with user details and cancel button */}
                        <View style={tailwind('flex flex-row mb-10px w-full items-center')}>
                            <View style={tailwind('flex-1')}>
                                {replyTo ?
                                    <View style={tailwind('flex flex-row items-center')}>
                                        <UserPfp details={user} height={20} />
                                        <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, lineHeight: 18, color: "#959595", marginLeft: 8, marginRight: 4}]}>Replying to</Text>
                                        <Text style={{fontWeight: 'bold',marginTop: Platform.OS == 'ios' ? 0 : -5,}}>@</Text>
                                        <Username details={replyTo.creator_details} style={{fontSize: 13,}} />
                                    </View>
                                :
                                    <User details={user} height={40} />
                                }
                            </View>
                            {!replyTo &&
                                <Button
                                    title={categorySelected?.content?.displayName ? categorySelected.content.displayName : categorySelected?.context?.displayName ? categorySelected.context.displayName : "Category"}
                                    iconRight={<CaretDownIcon style={{color: 'white',marginLeft: 8,}} />}
                                    color="orange"
                                    size="icon"
                                    onPress={() => openCategory()}
                                />
                            }

                        </View>

                        {(categorySelected?.content?.accessRules && categorySelected?.content?.accessRules.length > 0) &&
                            <View style={tailwind('bg-slate-50 px-2 py-3 items-center mb-1 rounded-md flex-row justify-center w-full')} >
                                {hasAccess ?
                                    <UnlockIcon color="#959595" style={{marginRight: 2}} />
                                :
                                    <LockIcon color="#959595" style={{marginRight: 2}} />
                                }

                                <Text style={tailwind('text-secondary items-center ml-1')}>This category is {hasAccess ? "opened" : "gated"}.</Text>
                            </View>
                        }

                        {replyTo && <View style={[tailwind('bg-slate-200 flex-1'), {width: 1, height:50,position: 'absolute',top: 45,left: 30}]} />}

                        {!replyTo && userData?.rewardFirstPost == 'reward pending' && (
                            <View style={{backgroundColor: '#FFE9E3',width:'100%', alignSelf:'center',borderRadius: 10,paddingVertical: 10}}>
                                <Text style={{color:'#FF6E31',fontWeight: 'bold',textAlign: 'center',}}>Share one useful idea with the EasyGo community.</Text>
                            </View>
                        )}

                        {hasAccess && !categoriesVis &&
                            <TextInput
                                ref={textInputRef}
                                onChangeText={loading ? () => console.log("Disabled.") : handleTextChange}
                                autoFocus={hasAccess}
                                numberOfLines={1}
                                value={message}
                                //editable={!loading}
                                style={[
                                    tailwind('w-full'), 
                                    { 
                                        fontSize: 14,
                                        fontFamily: message == "" && Platform.OS == 'ios' ? "GmarketMedium_ios" : "GmarketMedium",
                                        minHeight: 55,
                                        lineHeight: 20,
                                        paddingBottom: 10,
                                        width: width - 40,
                                        marginTop: replyTo ? -5 : 0,
                                        marginLeft: replyTo ? 25: 0,
                                    }
                                ]}
                                placeholder={replyTo ? "Post your reply" : "Tell us about your story!" }
                                placeholderTextColor="#64748b"
                                multiline={true}
                            />
                        }

                        {listMedia.length == 1 ? (
                            <View style={tailwind("items-start")}>
                                <Media media={listMedia[0]} deleteMedia={() => deleteMedia(0)}/>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal={true}
                                style={{width: width, marginLeft: -20}}
                                showsHorizontalScrollIndicator={false}
                            >
                                { listMedia.map((item, index) => {
                                    return(
                                        <Media media={item} deleteMedia={() => deleteMedia(index)} index={index} key={Math.random()}/>
                                    )
                                })}
                                <View style={{width: 20}}/>
                            </ScrollView>
                        )}

                        {/** Show repost details if user is replying to a post */}
                        {(repost != false && repost != null) &&
                            <Post post={repost} quotedPost={true} isRepost={true} style={tailwind('rounded-md border border-secondary p-4')} />
                        }
                    </Animated.View>

                    {categoriesVis && 
                        <Animated.View style={[{
                            transform: [{ translateX: moveAnimation2 }], 
                            padding: 5,
                            marginTop: 
                                (categorySelected?.content?.accessRules && categorySelected?.content?.accessRules.length > 0) && listMedia.length != 0 ? -310 
                                : (categorySelected?.content?.accessRules && categorySelected?.content?.accessRules.length > 0) && listMedia.length == 0 ? -140 
                                : listMedia.length != 0 ? -500 
                                : -90
                            }]}
                        >
                            <View style={{flexDirection: 'row',alignItems: 'center',justifyContent: 'center',height: 50}}>
                                <TouchableOpacity onPress={() => closeCategory()} style={{padding: 12,marginBottom: 0,position: 'absolute',left: 0}}>
                                    <Image
                                        style={{width: 27,height: 27}}
                                        resizeMode='contain'
                                        source={require('../assets/back_button.png')}
                                        defaultSource={require('../assets/back_button.png')}
                                    />
                                </TouchableOpacity>

                                <Text style={{fontWeight: 'bold',fontSize: 18,textAlign:'center'}}>Choose Category</Text>
                            </View>

                            <View style={[tailwind('flex flex-row w-full flex-wrap mt-2'), {marginLeft: 3,}]}>
                                {/** Loop and display categories */}
                                {categories.map((category, key) => {
                                    return (
                                        <Category key={key} category={category} setCategoriesVis={setCategoriesVis} setCategorySelected={setCategorySelected} />
                                    );
                                })}
                            </View>
                        </Animated.View>
                    }


                {/** Show mentions box if needed */}
                {mentionsBoxVis == true && !categoriesVis &&
                    <View style={[tailwind('flex flex-col pt-1 border-t border-secondary' ), { height: 120,width: width,}]}>
                        <UserLoop term={currentMention} mentionUser={mentionUser} />
                    </View>
                }

                <View style={{height: Platform.OS == 'ios' ? 400 : 50}}/>
            </ScrollView>
            
            {!categoriesVis && (
                <KeyboardAvoidingView style={[tailwind('flex flex-row w-full p-3 px-5'), {position: 'absolute',bottom: Platform.OS == 'ios' ? 20 : 0, backgroundColor: 'white',}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {Keyboard.isVisible() && Platform.OS == 'ios' && (
                        <View style={{position: 'absolute',bottom: keyboardHeight-20,width: width,flexDirection:'row',paddingHorizontal: 20, backgroundColor: 'white',height: 50,alignItems:'center',}}>
                            <View style={tailwind('flex flex-1 flex-row items-start')}>
                                <TouchableOpacity onPress={showMediaComingSoon} style={{marginTop: 5}}>
                                    <ImagePickerIcon />
                                </TouchableOpacity>
        
                                <TouchableOpacity onPress={showMediaComingSoon} style={{marginLeft: 15,}}>
                                    <CameraIcon />
                                </TouchableOpacity>
                            </View>
        
                            {/** Post button */}
                            <Button
                                loading={loading}
                                title={editedPost != null ? "Edit" : "Post"}
                                color="orange"
                                size="sm"
                                style={{height: 30,justifyContent: 'center',}}
                                onPress={editedPost ? () => edit() : () => send()}
                            />
                        </View>
                    )}

                    {/** Image picker icon */}
                    <View style={tailwind('flex flex-1 flex-row items-start')}>
                        <TouchableOpacity onPress={showMediaComingSoon} style={{marginTop: 5}}>
                            <ImagePickerIcon />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={showMediaComingSoon} style={{marginLeft: 15,}}>
                            <CameraIcon />
                        </TouchableOpacity>
                    </View>

                    {/** Post button */}
                    <Button
                        loading={loading}
                        title={editedPost != null ? "Edit" : "Post"}
                        color="orange"
                        size="sm"
                        style={{height: 30,justifyContent: 'center',}}
                        onPress={editedPost ? () => edit() : () => send()}
                    />
                </KeyboardAvoidingView>
            )}
        </>
    )
}
