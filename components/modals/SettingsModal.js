import React, { useState, useContext, useRef } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, Text, View, ActivityIndicator, Image, Animated, TouchableOpacity, Dimensions, Platform, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnectModal } from '@walletconnect/modal-react-native'
import * as WebBrowser from 'expo-web-browser';
import { UserPfp, Username } from "../User";
import { showMessage } from "react-native-flash-message";
import { SuccessIcon } from "../Icons";

export default function SettingsModal() {
    const { user, setUser, orbis, setSettingsVis, setPushNotifsVis, listBlockedUser, setListBlockedUser } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { provider } = useWalletConnectModal();
    
    const [showBack, setShowBack] = useState(false)
    const [showBackBlockedUsers, setShowBackBlockedUsers] = useState(false)
    const [logOutLoading, setLogOutLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const [listBlockLoader, setListBlockLoader] = useState([])
    const [blockedUsers, setBlockedUsers] = useState([])

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(Dimensions.get('window').width)).current;
    const moveAnimation3 = useRef(new Animated.Value(Dimensions.get('window').width)).current;

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

    const showAppManagement = () => {
        Haptics.selectionAsync();

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

        setShowBack(true)
    }

    const showBlockedUsers = () => {
        try {
            Haptics.selectionAsync();
    
            listBlockedUser?.map(async e => {
                const { data, error } = await orbis.getProfile(e);
                blockedUsers.push(data)
                setBlockedUsers([...blockedUsers])
            })
    
            Animated.parallel([
                Animated.timing(moveAnimation1, {
                    toValue: -Dimensions.get('window').width,
                    duration: 300,
                    useNativeDriver: true
                }),
                Animated.timing(moveAnimation3, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start();
    
            setShowBackBlockedUsers(true)
        } catch (error) {
            console.log(error);
            alert('ICI : '+error)
        }
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
            setShowBack(false)
        });
    }

    function onBackBlockedUsersPress() {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation3, {
                toValue: Dimensions.get('window').width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setBlockedUsers([])
            setShowBackBlockedUsers(false)
        });
    }

    const BlockedUser = ({blockedUser, index}) => {   
        
        /** Will unblock the user */
        async function doUnblock (blockedUser, index_follow) {
            listBlockLoader[index_follow] = true
            setListBlockLoader([...listBlockLoader])

            console.log(listBlockedUser);
            // const temp_list = listBlockedUser
            listBlockedUser.splice(index, 1);

            await AsyncStorage.setItem("list_blocked_user", JSON.stringify(listBlockedUser));             
            setListBlockedUser([...listBlockedUser])

            blockedUsers.splice(index, 1)
            setBlockedUsers([...blockedUsers])
            
            listBlockLoader[index_follow] = false
            setListBlockLoader([...listBlockLoader])

            showMessage({
                message: blockedUser.details.profile.username+" has been unblocked !",
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
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: blockedUser.details.did })}}
                >
                    <UserPfp details={blockedUser.details} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex mt-1")}>
                            <Text style={[tailwind("text-secondary"), {maxWidth: 150}]} numberOfLines={1}>
                                <Username details={blockedUser.details}/>
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                        tailwind(`px-5 rounded-full border ${listBlockLoader[index] ? "bg-main-400" : "bg-main"}`), 
                        {
                            borderColor: "transparent",
                            paddingVertical: listBlockLoader[index] ? 3.2 : 5
                        }
                    ]}
                    onPress={() => doUnblock(blockedUser, index)}
                >
                    {listBlockLoader[index] ?
                        <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                    :
                        <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>Unblock</Text>
                    }
                </TouchableOpacity>

            </View>
        )
    }


    return(
        <Modal hide={() => hideSettings()} animateModal={true} bottomDuration={200} bottomStart={-100}>
            <View style={{height: 65, zIndex: 2}}>
                {showBack ? (
                    <TouchableOpacity onPress={() => onBackPress()} style={{padding: 20,marginBottom: 0,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : showBackBlockedUsers ? (
                    <TouchableOpacity onPress={() => onBackBlockedUsersPress()} style={{position: 'absolute',top: 20, left: 20,}}>
                        <Image
                            style={{width: 30,height: 30}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                ) : (
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
                                <BlockedUser blockedUser={e} index={index} key={Math.random()}/>
                            );
                        }) : (
                            <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                                <Text style={tailwind('text-secondary items-center ml-1')}>You don't have blocked users.</Text>
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
