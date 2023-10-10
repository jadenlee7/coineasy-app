import React, { useState, useContext, useEffect } from "react";
import { View, TouchableOpacity, Image, ActivityIndicator, Dimensions, Text, Keyboard } from 'react-native';

import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GlobalContext } from "../contexts/GlobalContext";
import ProfileDetails from "../components/ProfileDetails";
import { SettingsIcon } from "../components/Icons";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import * as Haptics from 'expo-haptics';

import Modal from "../components/Modal";
import Button from "../components/Button";

const Profile = ({ navigation, route }) => {
    const { user, setUser, orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();


    const [profile, setProfile] = useState();
    const [showModal, setShowModal] = useState(false)

    useEffect(() => {
        getProfile();
        navigation.addListener('tabPress', (e) => {
            Haptics.selectionAsync();
        });
    }, [user]);

    async function getProfile() {
        const { data, error } = await orbis.getProfile(user.did);
        setProfile(data);
    }

    function hideSettings() {
        setShowModal(false);
        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    async function logout() {
        Haptics.selectionAsync();
        setSettingsVis(false);
        AsyncStorage.removeItem("user-connected");
        let res = await orbis.logout();
        console.log("res:", res);

        let providerType = await AsyncStorage.getItem("provider-type");
        if(providerType == "wallet-connect") {
            provider?.disconnect();
        }

        setUser(null);
    }

    async function openHelp() {
        Haptics.selectionAsync();
        let result = await WebBrowser.openBrowserAsync("https://drive.google.com/file/d/1x8ZvprutJSuv96KVz3vLyXHWXwi8AaVS/view?usp=sharing");
    }

    function openPrivacyPolicy() {
        Haptics.selectionAsync();
        alert("Coming soon");
    }

    function openTerms() {
        Haptics.selectionAsync();
        alert("Coming soon");
    }

    return(
        <>
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../assets/HeaderBg.png')} 
            />

            <TouchableOpacity style={{position: 'absolute',top: 90,right: 30,zIndex: 2,}}  activeOpacity={0.7} onPress={() => setShowModal(true)}>
                <SettingsIcon />
            </TouchableOpacity>

            {profile ?
                <ProfileDetails profile={user} />
            :
                <View style={tailwind('flex flex-row items-start w-full justify-center mt-6 flex-1')}>
                    <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
                </View>
            }

            {showModal && (
                <Modal visible hide={() => hideSettings()} animateModal={true} bottomDuration={200} bottomStart={-100}>
                    <View style={[tailwind('flex flex-col w-full p-5')]}>
                        <Text style={[tailwind('text-primary mb-5')]}>Settings & Privacy</Text>
                        <Button color="rounded-gray" title="Help" style={{marginBottom: 10}} onPress={() => openHelp()} />
                        <Button color="rounded-gray" title="Privacy Policy" style={{marginBottom: 10}} onPress={() => openPrivacyPolicy()} />
                        <Button color="rounded-gray" title="Terms and Conditions" style={{marginBottom: 10}} onPress={() => openTerms()} />
                        <Button color="rounded-red" title="Logout" onPress={() => logout()} style={{marginBottom: 30}}  />
                    </View>
                </Modal>
            )}
        </>
  )
}

export default Profile
