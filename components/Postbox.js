import React, { useContext, useState, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, TouchableHighlight, TextInput, ActivityIndicator, Platform, Image, ScrollView, BackHandler, Dimensions, KeyboardAvoidingView, Animated, Keyboard } from 'react-native';

import mime from 'mime'
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as ImagePicker from 'expo-image-picker';

import Post from "./Post";
import Button from "./Button";
import { getTimestamp } from "../utils";
import { context } from '../utils/config.js';
import User, { UserPfp, Username } from "./User";
import { checkContextAccess, isOwner } from "../utils";
import { GlobalContext } from "../contexts/GlobalContext";
import { BackIcon, ImagePickerIcon, CaretDownIcon, CloseIcon, LockIcon, UnlockIcon, CameraIcon } from "./Icons";

/** Init mentions object */
let mentions = [];

export default function Postbox({isReply = false}) {
    const { user, orbis, setShowConnectModal, hidePostbox, replyTo, repost, callbackPostShared, category, categories, editedPost, selectedCategory, selectedNews, currentRoute } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const textInputRef = useRef();
    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(Dimensions.get('window').width)).current;

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [categoriesVis, setCategoriesVis] = useState(false);
    const [categorySelected, setCategorySelected] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [mentionsBoxVis, setMentionsBoxVis] = useState(false);
    const [currentMention, setCurrentMention] = useState(null);
    const [listMedia, setListMedia] = useState([]);
    const [keepFocus, setKeepFocus] = useState(false)
    const [fullListFollow, setFullListFollow] = useState([])

    useEffect(() => {
        /** Make sure mentions is reset */
        mentions = [];

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

        getListFollow()
    }, [])

    async function getListFollow() {
        const result_followers = await orbis.getProfileFollowers(user.did);
        const result_following = await orbis.getProfileFollowing(user.did);

        result_followers.data.forEach(e => e.details.type = 'Followers');
        result_following.data.forEach(e => e.details.type = 'Following');

        const full_list_follow = [...result_followers.data, ...result_following.data];
        setFullListFollow([...full_list_follow])
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
        try {
            Haptics.selectionAsync();
            setLoading(true);
            let content = {...editedPost.value.content};
            content.body = message;
            content.media = listMedia ? listMedia : null
            content.mention = mentions

            if(categorySelected){
                content.context = categorySelected.stream_id
                content.context_details = categorySelected.content
            }
            
            /** Share edited post */
            let res = await orbis.editPost(editedPost.value.stream_id, content);
            console.log("res:", res);

            if(res.status == 200) {
                editedPost.callback(
                    message,
                    listMedia,
                    categorySelected
                );
                setMessage("");
                mentions = [];
            } else {
                console.log("res:", res);
                alert("Error editing post.");
            }

            /** Stop loading indicator */
            setLoading(false);
        } catch(e) {
            alert("Error editing post.");
            setLoading(false);
        }
    }

    /** Will share message with Orbis */
    async function send() {
        try {
            Haptics.selectionAsync();
            let _context = context;
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
                body: message != '' ? message : 'Message sans body',
                context: _context,
                media: listMedia ? listMedia : null,
                repost: repost ? repost.stream_id : null,
                reply_to: replyTo ? replyTo.stream_id : null,
                master: master ? master : null,
                mentions: mentions,
                repost_details: repost
            };

            let res = await orbis.createPost(content);

            /** Wait for new post to be indexed */
            if(res.status == 200) {

                //await sleep(1000);
                setMessage("");
                mentions = [];

                const temp_details = {}
                temp_details.context_details = categorySelected?.content
                temp_details.context_id = categorySelected?.stream_id
                let _callbackContent = {
                    creator: user.did,
                    creator_details: {
                        did: user.did,
                        profile: user.profile
                    },
                    stream_id: res.doc,
                    content: content,
                    count_replies: 0,
                    count_likes: 0,
                    count_repost: 0,
                    timestamp: getTimestamp(),
                    repost_details: repost,
                    context: categorySelected?.stream_id,
                    context_details: categorySelected ? temp_details : null,
                }

                /** If any trigger callback after the post is shared */
                if(callbackPostShared) {
                    callbackPostShared(_callbackContent);
                }

                setLoading(false);
            } else {
                console.log(res);
                alert(res.result);
                setLoading(false);
            }
        } catch(e) {
            console.log("Error sharing post: ", e);
        }
    }

    /** Will show connect modal and return haptic feedback */
    async function showConnect() {
        Haptics.selectionAsync();
        setShowConnectModal(true)
    }

    /** Will open the media library and allow user to select a photo */
    async function openCamera() {
        setKeepFocus(true)

        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

            console.log(permissionResult);

            if (permissionResult.granted === false) {
                alert("You have refused to allow this app to access your camera.");
            } else {
                let result = await ImagePicker.launchCameraAsync();
    
                if(!result.canceled){
                    /** Handle Image picked */
                    let imagePath = result.assets[0].uri;
                    setCameraLoading(true);
        
                    const imageType = mime.getType(imagePath)
        
                    /** Create file object */
                    let file = {
                        name: "test",
                        type: imageType,
                        uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                    }
        
                    /** Upload Image to IPFS */
                    const resUpload = await orbis.uploadMedia(file);
        
                    /** Handle result returned by Orbis SDK */
                    if(resUpload.status == 200) {
                        let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                        let media = [{
                            gateway: resUpload.result.gateway,
                            url: finalUrl
                        }]
                        listMedia.push(media)
        
                        setListMedia([...listMedia]);
                        setCameraLoading(false);
                    } else {
                        alert("Error uploading image.");
                        setCameraLoading(false);
                    }
                }
            }

            setKeepFocus(false)
        } catch (error) {
            console.log('ICI');
            console.log(error);
            setKeepFocus(false)
        }

    }



    /** Will open the media library and allow user to select a photo */
    async function selectPhoto() {
        try {
            /** Open Image library to allow user to select a picture */
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Images",
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.25,
            });

            if (!result.canceled) {
                /** Handle Image picked */
                let imagePath = result.assets[0].uri;
                setImageLoading(true);

                const imageType = mime.getType(imagePath)

                /** Create file object */
                let file = {
                    name: "test",
                    type: imageType,
                    uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                }

                /** Upload Image to IPFS */
                const resUpload = await orbis.uploadMedia(file);

                /** Handle result returned by Orbis SDK */
                if(resUpload.status == 200) {
                    let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                    let media = [{
                        gateway: resUpload.result.gateway,
                        url: finalUrl
                    }]
                    listMedia.push(media)

                    setListMedia([...listMedia]);
                    setImageLoading(false);
                } else {
                    alert("Error uploading image.");
                    setImageLoading(false);
                }
            }
        } catch(e) {
            console.log("Error selecting photo:", e);
            setImageLoading(false);
        }
    }

    function openCategory() {
        Haptics.selectionAsync();
        Keyboard.dismiss()

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: -Dimensions.get('window').width,
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
                toValue: Dimensions.get('window').width,
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

    BackHandler.addEventListener('hardwareBackPress', function () {
        if(categoriesVis){
            setCategoriesVis(false)
            return true
        }else{
            hidePostbox()
            return true
        }
    })


    const UserLoop = ({term, mentionUser}) => {
        const { user, orbis } = useContext(GlobalContext);
        const tailwind = useTailwind();
        const [users, setUsers] = useState([]);
        const [followUsers, setFollowUsers] = useState([]);
        const [usersLoading, setUsersLoading] = useState(false);

        useEffect(() => {
            searchUsers();

            async function searchUsers() {
                setUsersLoading(true);

                const {data, error} = await orbis.getProfilesByUsername(term);

                let result = term != '' ? fullListFollow.filter(e => e.details?.profile?.username?.startsWith(term)) : fullListFollow

                let seenObjects = {};
                let listWithoutDuplicates = result.filter(objet => {
                    if (!seenObjects.hasOwnProperty(objet.details.did)) {
                        seenObjects[objet.details.did] = true;
                        return true;
                    }
                    return false;
                });

                let listWithoutCommon = data.filter(elt1 => !result.some(elt2 => elt2.details.did === elt1.did));

                setUsers(listWithoutCommon);
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
                {(isOwner(user.did) && "everyone".includes(term)) &&
                    <TouchableOpacity style={tailwind("p-2 px-4")} activeOpacity={0.6} onPress={() => mentionUser({did: "did:@:everyone", profile: {username: "everyone"}})}>
                        <View style={tailwind('flex flex-row items-center')}>
                            <Image
                                style={[tailwind('rounded-full'), { height: 40, width: 40 }]}
                                source={require('../assets/pfp-everyone.png')}
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
                    toValue: Dimensions.get('window').width,
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
        if(media && media.length > 0) {
            return(
                <View style={{marginLeft: index != 0 ? 8 : 0,marginTop: 10,marginBottom: 10,}} key={Math.random()}>
                    <Image
                        style={[tailwind('rounded-md shadow-md border border-secondary'), { height: 150, width: 150 }]}
                        source={{
                            uri: media[0].url,
                        }}
                    />
                    <TouchableHighlight onPress={deleteMedia} style={{ position: "absolute", right: -5, top: -5}} underlayColor="transparent">
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
            <ScrollView style={[tailwind('w-full'), {maxHeight: Dimensions.get('screen').height,}]} keyboardShouldPersistTaps='handled'>
                {/* <View style={tailwind('flex flex-col items-start w-full p-5')}> */}

                    <Animated.View style={[tailwind('flex flex-col items-start p-5'), {transform: [{ translateX: moveAnimation1 }]}]}>
                        {/** Top bar with user details and cancel button */}
                        <View style={tailwind('flex flex-row mb-10px w-full items-center')}>
                            <View style={tailwind('flex-1')}>
                                {replyTo ?
                                    <View style={tailwind('flex flex-row items-center')}>
                                        <UserPfp details={user} height={20} />
                                        <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, lineHeight: 18, color: "#959595", marginLeft: 8, marginRight: 4}]}>Replying to</Text>
                                        <Text style={{fontWeight: 'bold',marginTop: -5,}}>@</Text>
                                        <Username details={replyTo.creator_details} style={{fontSize: 13}} />
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

                                <Text style={tailwind('text-secondary items-center ml-1')}>This category is gated.</Text>
                            </View>
                        }

                        {replyTo && <View style={[tailwind('bg-slate-200 flex-1'), {width: 1, height:50,position: 'absolute',top: 45,left: 30}]} />}

                        {hasAccess &&
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
                                        fontFamily: message == "" && Platform.OS == 'ios' ? "GmarketMedium" : "GmarketMedium",
                                        minHeight: 55,
                                        lineHeight: 20,
                                        paddingBottom: 10,
                                        width: Dimensions.get('window').width - 40,
                                        marginTop: replyTo ? -5 : 0,
                                        marginLeft: replyTo ? 25: 0,
                                    }
                                ]}
                                placeholder={replyTo ? "Post your reply" : "Tell us about your story!" }
                                placeholderTextColor="#64748b"
                                multiline={true}
                                onBlur={e => {if(keepFocus){e.target.focus()}}}
                            />
                        }

                        {listMedia.length == 1 ? (
                            <View style={tailwind("items-start")}>
                                <Media media={listMedia[0]} deleteMedia={() => deleteMedia(0)}/>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal={true}
                                // style={{width: Dimensions.get('window').width}}
                            >
                                { listMedia.map((item, index) => {
                                    return(
                                        <Media media={item} deleteMedia={() => deleteMedia(index)} index={index}/>
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
                        <Animated.View style={[tailwind('flex'), {transform: [{ translateX: moveAnimation2 }], padding: 12,marginTop: (categorySelected?.content?.accessRules && categorySelected?.content?.accessRules.length > 0) ? -195 : -145,}]}>
                            <TouchableOpacity onPress={() => closeCategory()} style={{padding: 5,marginBottom: 0,}}>
                                <Image
                                    style={{width: 27,height: 27}}
                                    resizeMode='contain'
                                    source={require('../assets/back_button.png')}
                                    defaultSource={require('../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            <View style={[tailwind('flex flex-row w-full flex-wrap mt-2')]}>
                                {/** Loop and display categories */}
                                {categories.map((category, key) => {
                                    return (
                                        <Category key={key} category={category} setCategoriesVis={setCategoriesVis} setCategorySelected={setCategorySelected} />
                                    );
                                })}
                            </View>
                        </Animated.View>
                    }

                {/* </View> */}

                {/** Show mentions box if needed */}
                {mentionsBoxVis == true && !categoriesVis &&
                    <View style={[tailwind('flex flex-col pt-1 border-t border-secondary' ), { height: 120,width: Dimensions.get('window').width,}]}>
                        <UserLoop term={currentMention} mentionUser={mentionUser} />
                    </View>
                }

            </ScrollView>
            
            {!categoriesVis && (
                <KeyboardAvoidingView style={[tailwind('flex flex-row w-full p-3 px-5'), {position: 'absolute',bottom: 10}]} behavior='height'>
                    {/** Image picker icon */}
                    <View style={tailwind('flex flex-1 flex-row items-start')}>
                        {imageLoading ?
                            <ActivityIndicator size="small" color="#FF6B17" />
                        :
                            <TouchableOpacity onPress={() => selectPhoto()} style={{marginTop: 5}}>
                                <ImagePickerIcon />
                            </TouchableOpacity>
                        }

                        {cameraLoading ?
                            <ActivityIndicator size="small" color="#FF6B17" style={{marginLeft: 17,}}/>
                        :
                            <TouchableOpacity onPress={() => {setKeepFocus(true);openCamera()}} style={{marginLeft: 15,}}>
                                <CameraIcon />
                            </TouchableOpacity>
                        }
                    </View>

                    {/** Post button */}
                    <Button
                        loading={loading}
                        title={editedPost != null ? "Edit" : "Post"}
                        color="orange"
                        size="sm"
                        style={{height: 30}}
                        onPress={editedPost ? () => edit() : () => send()}
                    />
                </KeyboardAvoidingView>
            )}
        </>
    )
}