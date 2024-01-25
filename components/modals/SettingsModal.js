import React, { useState, useContext, useRef } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, Text, View, ActivityIndicator, Image, Animated, TouchableOpacity, Dimensions, Platform, ScrollView, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnectModal } from '@walletconnect/modal-react-native'
import * as WebBrowser from 'expo-web-browser';
import { UserPfp, Username } from "../User";
import { showMessage } from "react-native-flash-message";
import { InterpunctIcon, SuccessIcon } from "../Icons";
import useDidToAddress from "../../hooks/useDidToAddress";
import useGetUsername from "../../hooks/useGetUsername";
import Post from "../Post";
import TimeAgo from "../TimeAgo";

export default function SettingsModal() {
    const { 
        setUser, 
        orbis, 
        setSettingsVis, 
        setPushNotifsVis, 
        listBlockedUser, 
        setListBlockedUser, 
        listMutedUsers, 
        setListMutedUsers,
        listHiddenPost,
        setListHiddenPost
    } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { provider } = useWalletConnectModal();
    
    const [showBack, setShowBack] = useState(false)
    const [showBackBlockedUsers, setShowBackBlockedUsers] = useState(false)
    const [showBackMutedUsers, setShowBackMutedUsers] = useState(false)
    const [showBackHiddenPosts, setShowBackHiddenPosts] = useState(false)
    const [logOutLoading, setLogOutLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const [listBlockLoader, setListBlockLoader] = useState([])
    const [blockedUsers, setBlockedUsers] = useState([])
    const [listMutedLoader, setListMutedLoader] = useState([])
    const [mutedUsers, setMutedUsers] = useState([])
    const [listHiddenLoader, setListHiddenLoader] = useState([])
    const [hiddenPosts, setHiddenPosts] = useState([])

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(Dimensions.get('window').width)).current;
    const moveAnimation3 = useRef(new Animated.Value(Dimensions.get('window').width)).current;
    const moveAnimation4 = useRef(new Animated.Value(Dimensions.get('window').width)).current;
    const moveAnimation5 = useRef(new Animated.Value(Dimensions.get('window').width)).current;

    function hideSettings() {
        setSettingsVis(false);
        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    async function openHelp() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1x8ZvprutJSuv96KVz3vLyXHWXwi8AaVS/view?usp=sharing");
    }

    async function openPrivacyPolicy() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing");
    }

    async function openTerms() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing");
    }

    async function logout() {
        setLogOutLoading(true)
        Haptics.selectionAsync();
        setSettingsVis(false);

        await AsyncStorage.removeItem("user-connected");
        let res = await orbis.logout();
        console.log("res:", res);

        await AsyncStorage.removeItem("provider-type");       
        if(provider){
            provider?.disconnect().then( res => {
                setUser(null);
                setLogOutLoading(false)
            }).catch(e => {
                console.log(e);
                setUser(null);
                setLogOutLoading(false)
            })
        }else{
            setUser(null);
        }
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

    const showAppManagement = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, -Dimensions.get('window').width, 0)
        setShowBack(true)
    }

    const showBlockedUsers = () => {
        Haptics.selectionAsync();

        listBlockedUser?.map(async e => {
            const { data, error } = await orbis.getProfile(e);
            blockedUsers.push(data)
            setBlockedUsers([...blockedUsers])
        })

        doAnimation(moveAnimation1, moveAnimation3, -Dimensions.get('window').width, 0)    
        setShowBackBlockedUsers(true)
    }

    const showMutedUsers = () => {
        Haptics.selectionAsync();

        listMutedUsers?.map(async e => {
            const { data, error } = await orbis.getProfile(e);
            mutedUsers.push(data)
            setMutedUsers([...mutedUsers])
        })
        doAnimation(moveAnimation1, moveAnimation4, -Dimensions.get('window').width, 0)       
        setShowBackMutedUsers(true)
    }

    const showHiddenPosts = () => {
        Haptics.selectionAsync();

        console.log('OUIIII');
        console.log(listHiddenPost);

        listHiddenPost?.map(async e => {
            const { data, error } = await orbis.getPost(e);
            console.log('!!!!!!');
            console.log(data);
            hiddenPosts.push(data)
            setHiddenPosts([...hiddenPosts])
        })
        doAnimation(moveAnimation1, moveAnimation5, -Dimensions.get('window').width, 0)       
        setShowBackHiddenPosts(true)
    }

    function showBoxConfirm() {
        Haptics.selectionAsync();
        setShowConfirm(true)
    }

    function hideBoxConfirm() {
        Haptics.selectionAsync();
        setShowConfirm(false)
    }

    async function deleteAccount() {
        Haptics.selectionAsync();

        const res = await orbis.updateProfile({
            pfp: null,
            cover: null,
            username: null,
            description: null,
        });

        logout()
    }

    function onBackPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, 0, Dimensions.get('window').width, () => setShowBack(false))
    }

    function onBackBlockedUsersPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation3, 0, Dimensions.get('window').width, () => {setBlockedUsers([]);setShowBackBlockedUsers(false)})
    }

    function onBackMutedUsersPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation4, 0, Dimensions.get('window').width, () => {setMutedUsers([]);setShowBackMutedUsers(false)})
    }

    function onBackHiddenPostsPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation5, 0, Dimensions.get('window').width, () => {setHiddenPosts([]);setShowBackHiddenPosts(false)})
    }

    const UserInfo = ({userInfo, index, type}) => {   

        console.log('LAAAA');
        console.log(userInfo);
        
        /** Will unblock the user */
        async function doUnblock (userInfo, index_follow) {
            listBlockLoader[index_follow] = true
            setListBlockLoader([...listBlockLoader])

            listBlockedUser.splice(index, 1);
            setListBlockedUser([...listBlockedUser])

            await AsyncStorage.setItem("list_blocked_user", JSON.stringify(listBlockedUser));             

            blockedUsers.splice(index, 1)
            setBlockedUsers([...blockedUsers])
            
            listBlockLoader[index_follow] = false
            setListBlockLoader([...listBlockLoader])

            showMessage({
                message: userInfo.details.profile.username+" has been unblocked !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }

        /** Will unmute the user */
        async function doUnmute (userInfo, index_follow) {
            listMutedLoader[index_follow] = true
            setListMutedLoader([...listMutedLoader])

            listMutedUsers.splice(index, 1);
            setListMutedUsers([...listMutedUsers])
            
            await AsyncStorage.setItem("list_muted_users", JSON.stringify(listMutedUsers));             

            mutedUsers.splice(index, 1)
            setMutedUsers([...mutedUsers])
            
            listMutedLoader[index_follow] = false
            setListMutedLoader([...listMutedLoader])

            showMessage({
                message: userInfo.details.profile.username+" has been unmuted !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }

        return (
            <View style={[tailwind("items-center flex flex-row border-b border-secondary"), {justifyContent: 'space-between',paddingRight: 10,}]}>
                <TouchableOpacity 
                    style={tailwind("items-center flex flex-row py-3 px-6 ")} 
                    underlayColor="#f1f5f9"
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: userInfo.details.did })}}
                >
                    <UserPfp details={userInfo.details} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex mt-1")}>
                            <Text style={[tailwind("text-secondary"), {maxWidth: 150}]} numberOfLines={1}>
                                <Username details={userInfo.details}/>
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {type == "blocked" ? (
                    <TouchableOpacity 
                        activeOpacity={0.7}
                        style={[
                            tailwind(`px-5 rounded-full border ${listBlockLoader[index] ? "bg-main-400" : "bg-main"}`), 
                            {
                                borderColor: "transparent",
                                paddingVertical: listBlockLoader[index] ? 3.2 : 5
                            }
                        ]}
                        onPress={() => doUnblock(userInfo, index)}
                    >
                        {listBlockLoader[index] ?
                            <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                        :
                            <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>Unblock</Text>
                        }
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        activeOpacity={0.7}
                        style={[
                            tailwind(`px-5 rounded-full border ${listMutedLoader[index] ? "bg-main-400" : "bg-main"}`), 
                            {
                                borderColor: "transparent",
                                paddingVertical: listMutedLoader[index] ? 3.2 : 5
                            }
                        ]}
                        onPress={() => doUnmute(userInfo, index)}
                    >
                        {listMutedLoader[index] ?
                            <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                        :
                            <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>Unmute</Text>
                        }
                    </TouchableOpacity>
                )}


            </View>
        )
    }

    const HiddenPost = ({postInfo, index}) => {   

        /** Will unhide the post */
        async function doUnhide (postInfo, index_hide) {
            listHiddenLoader[index_hide] = true
            setListHiddenLoader([...listHiddenLoader])

            listHiddenPost.splice(index_hide, 1);
            setListHiddenPost([...listHiddenPost])

            await AsyncStorage.setItem("list_hidden_post", JSON.stringify(listHiddenPost));             

            hiddenPosts.splice(index_hide, 1)
            setHiddenPosts([...hiddenPosts])
            
            listHiddenLoader[index_hide] = false
            setListHiddenLoader([...listHiddenLoader])

            showMessage({
                message: "This post has been unhidden !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }

        /** Will open pane with post details */
        function showPostDetails() {
            Haptics.selectionAsync();
            setPostDetailsVis(postInfo.content.master ? postInfo.content.master : postInfo.stream_id)
            navigation.navigate('PostDetails')
        }

        /** Will open pane with post details */
        function showProfileDetails(did) {
            Haptics.selectionAsync();
            console.log(postInfo);
            // navigation.navigate('ProfileSelected', { did })
        }

        return (
            <View style={[tailwind("items-center flex flex-row border-b border-secondary"), {justifyContent: 'space-between',paddingRight: 10,}]}>



                <View style={[tailwind('flex flex-row items-start'), {paddingLeft: 10,paddingVertical: 10,}]}>
                    <View style={[tailwind('justify-center flex flex-col items-center')]}>
                        <TouchableHighlight underlayColor="transparent">
                            <UserPfp height={37} details={postInfo.creator_details} origin={'feed'}/>
                        </TouchableHighlight>
                    </View>

                    <View style={[tailwind('flex flex-1 flex-col')]}>
                        {/** Username and post metadata */}
                        <View style={tailwind('ml-2 flex flex-row items-center')}>
                            <View style={tailwind('flex flex-1 flex-row items-center flex-wrap')}>
                                <TouchableHighlight onPress={() => showProfileDetails(postInfo.creator)} underlayColor="transparent" >
                                    <Username details={postInfo.creator_details} />
                                </TouchableHighlight>
                                
                                <View style={[tailwind('ml-2 mr-2')]}>
                                    <InterpunctIcon />
                                </View>

                                {/** Display time */}
                                <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, color: "#959595", marginRight: 6}]}>
                                    <TimeAgo timestamp={postInfo.timestamp} />
                                </Text>
                            </View>
                        </View>

                        {/** Post content */}
                        <TouchableOpacity activeOpacity={0.7} style={[tailwind('ml-1 px-1 flex flex-1 rounded-md mr-8')]}>

                            <Text 
                                numberOfLines={6}
                                style={[
                                    tailwind('text-slate-900 font-normal'), 
                                    {
                                        marginTop: 5,
                                        paddingBottom: 5,
                                        fontSize: 14,
                                        lineHeight: 14 * 1.47
                                    }, 
                                ]}
                            >
                                {postInfo.content.body}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>



                <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                        tailwind(`px-5 rounded-full border ${listHiddenLoader[index] ? "bg-main-400" : "bg-main"}`), 
                        {
                            borderColor: "transparent",
                            paddingVertical: listHiddenLoader[index] ? 3.2 : 5,
                            position: 'absolute',
                            right: 10
                        }
                    ]}
                    onPress={() => doUnhide(postInfo, index)}
                >
                    {listHiddenLoader[index] ?
                        <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                    :
                        <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>Unhide</Text>
                    }
                </TouchableOpacity>

            </View>
        )
    }


    return(
        <Modal hide={() => hideSettings()} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
            <View style={{height: 65, zIndex: 2}}>
                {showBack && !showConfirm ? (
                    <TouchableOpacity onPress={() => onBackPress()} style={{padding: 20,marginBottom: 0,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : showBackBlockedUsers && !showConfirm ? (
                    <TouchableOpacity onPress={() => onBackBlockedUsersPress()} style={{position: 'absolute',top: 20, left: 20,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : showBackMutedUsers && !showConfirm ? (
                    <TouchableOpacity onPress={() => onBackMutedUsersPress()} style={{position: 'absolute',top: 20, left: 20,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : showBackHiddenPosts && !showConfirm ? (
                    <TouchableOpacity onPress={() => onBackHiddenPostsPress()} style={{position: 'absolute',top: 20, left: 20,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : !showConfirm && (
                    <View style={{padding: 20,marginBottom: 0,}}>
                        <Text style={[tailwind('text-primary'), {fontSize: Platform.OS == 'ios' ? 18 : 15,}]}>Settings & Privacy</Text>
                    </View>
                )}
            </View>

            <Animated.View style={[tailwind('flex flex-col w-full p-5'), {transform: [{ translateX: moveAnimation1 }], marginTop: -20,marginBottom: 20,}]}>
                <Button color="rounded-gray" title="Notifications" style={{marginBottom: 10}} onPress={() => {hideSettings();setPushNotifsVis(true)}} />
                <Button color="rounded-gray" title="Help" style={{marginBottom: 10}} onPress={() => openHelp()} />
                <Button color="rounded-gray" title="Privacy Policy" style={{marginBottom: 10}} onPress={() => openPrivacyPolicy()} />
                <Button color="rounded-gray" title="Terms and Conditions" style={{marginBottom: 10}} onPress={() => openTerms()} />
                <Button color="rounded-gray" title="App Management" style={{marginBottom: 10}} onPress={() => showAppManagement()} />
                <Button color="rounded-gray" title="Blocked Users" style={{marginBottom: 10}} onPress={() => showBlockedUsers()} />
                <Button color="rounded-gray" title="Hidden Posts" style={{marginBottom: 10}} onPress={() => showHiddenPosts()} />
                <Button color="rounded-gray" title="Muted Users" style={{marginBottom: 10}} onPress={() => showMutedUsers()} />

                {logOutLoading ? (
                    <View style={[tailwind('bg-slate-100 rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%'}]}>
                        <ActivityIndicator size="small" color="#020617" />
                    </View>
                ) : (
                    <Button color="rounded-red" title="Sign out" onPress={() => logout()} />
                )}
            </Animated.View>

            {showBack && (
                <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop: 70,alignSelf: 'center',}}>
                    <Button color="rounded-gray" title="Delete Account" onPress={() => showBoxConfirm()} />
                </Animated.View>
            )}

            {showBackBlockedUsers && (
                <Animated.View style={{transform: [{ translateX: moveAnimation3 }],position: 'absolute',width: '100%',marginTop: 30,alignSelf: 'center',}}>
                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,}}>Blocked Users</Text>

                    <ScrollView style={{marginTop: 10,}}>
                        { blockedUsers.length != 0 ? blockedUsers.map((e, index) => {
                            return (
                                <UserInfo userInfo={e} index={index} key={Math.random()} type='blocked'/>
                            );
                        }) : (
                            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                                <Text style={tailwind('text-secondary items-center ml-1')}>You don't have blocked users.</Text>
                            </View>
                        )}
                    </ScrollView>

                </Animated.View>
            )}

            {showBackMutedUsers && (
                <Animated.View style={{transform: [{ translateX: moveAnimation4 }],position: 'absolute',width: '100%',marginTop: 30,alignSelf: 'center',}}>
                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,}}>Muted Users</Text>

                    <ScrollView style={{marginTop: 10,}}>
                        { mutedUsers.length != 0 ? mutedUsers.map((e, index) => {
                            return (
                                <UserInfo userInfo={e} index={index} key={Math.random()} type='Muted'/>
                            );
                        }) : (
                            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                                <Text style={tailwind('text-secondary items-center ml-1')}>You don't have muted users.</Text>
                            </View>
                        )}
                    </ScrollView>

                </Animated.View>
            )}

            {showBackHiddenPosts && (
                <Animated.View style={{transform: [{ translateX: moveAnimation5 }],position: 'absolute',width: '100%',marginTop: 30,alignSelf: 'center',}}>
                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,}}>Hidden Posts</Text>

                    <ScrollView style={{marginTop: 10,}}>
                        { hiddenPosts.length != 0 ? hiddenPosts.map((e, index) => {
                            return (
                                <HiddenPost postInfo={e} index={index} key={Math.random()}/>
                            );
                        }) : (
                            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                                <Text style={tailwind('text-secondary items-center ml-1')}>You don't have hidden posts.</Text>
                            </View>
                        )}
                    </ScrollView>

                </Animated.View>
            )}


            {showConfirm && (
                <Modal hide={() => hideBoxConfirm()} type='deleteAccount'>
                    <View style={[tailwind('flex flex-col items-center justify-center px-3'), {paddingTop: 25,}]}>

                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,}]}>Deleting Your{'\n'}EASY App Account?</Text>

                        <Image source={require('../../assets/deleteAccount_icon.png')} style={{height: 115,marginTop: 20,marginBottom: 20,alignSelf: 'center',}} resizeMode="contain"/>

                        <Text style={[tailwind(`text-secondary text-center text-slate-900`), {lineHeight: 20}]}>
                            By deleting your account, you will no longer have access to EASY App and will lose all your data, including points, activity history, and profile information.
                        </Text>

                        <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                            <Button 
                                size="md" 
                                color="black" 
                                title="Delete Account" 
                                onPress={deleteAccount} 
                                style={{width: '90%',alignItems: 'center',height:50,justifyContent: 'center',marginTop: 14,}}
                            />
                            <Button size="md" color="white" title="Not now" onPress={hideBoxConfirm} style={{width: '90%',alignItems: 'center',marginTop: 10,height: 50,justifyContent: 'center',}}/>
                        </View>


                    </View>
                </Modal>
            )}
        </Modal>

    )
}
