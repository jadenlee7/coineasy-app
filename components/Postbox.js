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

/** Init mentions object */
let mentions = [];

const { width, height } = Dimensions.get('window')

export default function Postbox({isReply = false}) {
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
    const tailwind = useTailwind();
    const replyParentId = replyTo?.easygo?.postId || replyTo?.stream_id || null;
    const { create: createPost, update: updatePost, backendConfigured } = usePosts({ autoLoad: false });
    const { create: createReply } = useReplies(replyParentId, { autoLoad: false });

    const textInputRef = useRef();
    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(width)).current;

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [categorySelected, setCategorySelected] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [mentionsBoxVis, setMentionsBoxVis] = useState(false);
    const [currentMention, setCurrentMention] = useState(null);
    const [listMedia, setListMedia] = useState([]);
    const [fullListFollow, setFullListFollow] = useState([])
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        /** If user is editing a post we pre-fill the content */
        if(editedPost) {
            setMessage(editedPost.value.content.body);
            setListMedia([...editedPost.value.content.media]);

            mentions = editedPost.value.content.mentions

            const temp_category = {}
            temp_category.content = editedPost.value.context_details?.context_details ? editedPost.value.context_details?.context_details : editedPost.value.content?.context_details
            temp_category.stream_id = editedPost.value.context ? editedPost.value.context : editedPost.value.content?.context

            setCategorySelected(temp_category)
        }
    }, [editedPost])

    useEffect(() => {
        getListFollow()
    }, [backendConfigured, user?.id])

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

    async function getListFollow() {
        if (!user?.id || !backendConfigured) {
            setFullListFollow([]);
            return;
        }

        try {
            const [followersResult, followingResult] = await Promise.all([
                api.follows.followers(user.id, { limit: 100 }),
                api.follows.following(user.id, { limit: 100 }),
            ]);
            const followers = (followersResult?.rows || []).map((profile) => ({
                details: { ...adaptSocialAuthor(profile), type: 'Followers' },
            }));
            const following = (followingResult?.rows || []).map((profile) => ({
                details: { ...adaptSocialAuthor(profile), type: 'Following' },
            }));
            setFullListFollow([...followers, ...following]);
        } catch (error) {
            console.warn('[Postbox] unable to load mention suggestions', error);
            setFullListFollow([]);
        }
    }

    async function checkAccess(temp_cat) {
        if(temp_cat?.content.accessRules && temp_cat?.content.accessRules.length > 0) {
            checkContextAccess(user, temp_cat.content.accessRules, () => setHasAccess(true)).catch(e => console.log(e))
        } else {
            setHasAccess(true);
        }
    }

    /** Pre-select category if one already selected in the feed */
    useEffect(() => {
        if(category || selectedCategory || selectedNews) {
            const temp_cat = currentRoute == 'Categories' ? selectedCategory : currentRoute == 'News' ? selectedNews : category
            setCategorySelected(temp_cat);
            checkAccess(temp_cat);
        }else{
            checkAccess(null)
        }
    }, [category, selectedCategory, selectedNews])

    async function edit() {
        if (loading) return;
        Haptics.selectionAsync();
        const postId = editedPost?.value?.easygo?.postId || editedPost?.value?.stream_id;
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
        setLoading(true);
        try {
            const updated = await updatePost(postId, { body: publishBody, mediaUrl });
            if (!updated) {
                Alert.alert('Could not edit post', 'Check the backend connection and try again.');
                return;
            }
            editedPost?.callback?.(
                updated.content.body,
                updated.content.media,
                categorySelected || null
            );
            if (!editedPost?.callback) hidePostbox();
        } finally {
            setLoading(false);
        }
    }

    /** Create a root post or reply through the EasyGo backend. */
    async function send() {

        try {
            if (loading) return;
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

            const categoryTag = categorySelected?.tag || categorySelected?.content?.displayName;
            const normalizedCategoryTag = typeof categoryTag === 'string' && categoryTag.startsWith('#') ? categoryTag : null;
            const publishBody = !replyTo && normalizedCategoryTag && !body.toLowerCase().includes(normalizedCategoryTag.toLowerCase())
                ? `${body}\n\n${normalizedCategoryTag}`
                : body;
            if (publishBody.length > 2000) {
                Alert.alert('Post is too long', 'Shorten the post so the category hashtag fits within 2,000 characters.');
                return;
            }

            let _context = null;
            let master;
            if(replyTo) {
                _context = replyTo.content.context;
                if(replyTo.content.master) {
                    master = replyTo.content.master;
                } else {
                    master = replyTo.stream_id;
                }
            }
            else if(repost) {
                _context = repost.context;
            } else if(categorySelected) {
                _context = categorySelected.stream_id;
            }

            setLoading(true);
            let content = {
                body: publishBody,
                context: _context,
                media: listMedia ? listMedia : null,
                repost: repost ? repost.stream_id : null,
                reply_to: replyTo ? replyTo.stream_id : null,
                master: master ? master : null,
                mentions: mentions,
                repost_details: repost
            };

            const firstMedia = listMedia?.[0];
            const mediaUrl = firstMedia?.url || firstMedia?.[0]?.url || null;
            const created = replyTo
                ? await createReply({ body: publishBody, mediaUrl })
                : await createPost({ body: publishBody, mediaUrl });

            if(created) {
                setMessage("");
                mentions = [];

                const temp_details = {}
                temp_details.context_details = categorySelected?.content
                temp_details.context_id = categorySelected?.stream_id
                let _callbackContent = {
                    ...created,
                    content: { ...created.content, ...content },
                    repost_details: repost,
                    context: categorySelected?.stream_id,
                    context_details: categorySelected ? temp_details : null,
                }

                /** If any trigger callback after the post is shared */
                if(callbackPostShared) {
                    await callbackPostShared(_callbackContent);
                }else{
                    await defaultCallbackPostShared(_callbackContent)
                }

                setLoading(false);
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
                setLoading(false);
            }

            // hidePostbox()
        } catch(e) {
            console.log("Error sharing post: ", e);
            Alert.alert('Could not publish', 'Please check your connection and try again.');
            setLoading(false);
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
        mentions.push(new_mention);

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
        }, [term]);

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
                                <Text style={{color:'#FF6E31',fontWeight: 'bold',textAlign: 'center',}}>Receive 50 Oranges Reward for your first post!</Text>
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
