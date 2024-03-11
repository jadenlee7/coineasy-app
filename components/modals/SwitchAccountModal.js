import React, { useState, useContext, useEffect, useRef } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, Animated, TouchableOpacity, Dimensions, Platform, ScrollView, TouchableHighlight } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import TimeAgo from "../TimeAgo";
import { UserPfp, Username } from "../User";
import { GoogleIcon, InterpunctIcon, SuccessIcon, WalletConnectIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";

import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletConnectModal, useWalletConnectModal } from "@walletconnect/modal-react-native";

const windowSize = Dimensions.get('window')
const projectId = '9fe6eef52f4985e5849a5c1e2c80fabb'

export default function SwitchAccountModal() {
    const { user, setUser, orbis, setSwitchAccountVis, listAccount, callbackConnect, switchLoading, setSwitchLoading } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [checked, setChecked] = useState(null);

    const [showAddAccountBack, setShowAddAccountBack] = useState(false)
    const [connectLoading, setConnectLoading] = useState(false)
    const [retryCount, setRetryCount] = useState(0);

    let link = Linking.createURL();

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;

    const { isOpen, open, close, provider, isConnected, address } = useWalletConnectModal();

    const [multipleConnect, setMultipleConnect] = useState(false)

    const providerMetadata = {
        name: 'CoinEasy',
        description: 'Your crypto community',
        url: 'https://www.coineasy.xyz/',
        icons: ['https://static.wixstatic.com/media/317847_0f38e5d4152e4a6784465cb321ce1071~mv2.png/v1/fill/w_408,h_52,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/Group%201312318223.png'],
        redirect: {
            native: link,
        }
    }

    const sessionParams = {
        namespaces: {
            eip155: {
                methods: [
                    'eth_sendTransaction',
                    'eth_signTransaction',
                    'eth_sign',
                    'personal_sign',
                    'eth_signTypedData',
                ],
                chains: ['eip155:1'],
                events: ['chainChanged', 'accountsChanged'],
                rpcMap: {},
            },
        },
    }

    function hideSettings() {
        setSwitchAccountVis(false);
        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    useEffect(() => {
        console.log('enter useEffect for provider and isConnected');
        if(isConnected && provider != null && multipleConnect) {
            console.log('real try to connect with WC on Switch');
            connectWithWC(provider);
        }
    }, [provider, isConnected])

    async function connectWithWC(_provider) {
        setConnectLoading(true);
        setMultipleConnect(false)

        let resUser = await orbis.connect_v2({
            provider: _provider,
            appName: "CoinEasyApp"
        });

        if(resUser.status == 200) {
            setUser(resUser.details);
            AsyncStorage.setItem("provider-type", "wallet-connect");
            callbackConnect()
        } else {
            alert("There was an error logging you in, please retry. Error: " + resUser.status);
            setConnectLoading(false);
        }
    }
    

    const switchAccount = async (index) => {
        Haptics.selectionAsync();
        setSwitchLoading(true)

        let res = await orbis.logout();

        await AsyncStorage.removeItem("provider-type");       
        if(provider){
            provider?.disconnect().then( res => {
            }).catch(e => {
                console.log(e);
            })
        }

        // console.log(listAccount);
        setUser(listAccount[checked.index].user)
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

    const onAddAccountPress = () => {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, -windowSize.width, 0)
        setShowAddAccountBack(true)
    }
    
    function onBackPress() {
        Haptics.selectionAsync();
        doAnimation(moveAnimation1, moveAnimation2, 0, windowSize.width, () => {setShowAddAccountBack(false);})
    }

    /** Will trigget the auth flow for Apple */
    async function connectWithApple(identityToken, userId, email) {
        setConnectLoading(true);
        Haptics.selectionAsync();

        try {
            let resUser = await orbis.connect_v2({
                provider: "oauth",
                oauth: {
                    type: "apple",
                    token: identityToken
                }
            });
            if(resUser.status == 200) {
                setUser(resUser.details);

                AsyncStorage.setItem("provider-type", "apple");
                callbackConnect()
                setConnectLoading(false);
            } else {
                if(retryCount < 3) {
                    /** Increment retry count */
                    let _retryCount = retryCount + 1;
                    setRetryCount(_retryCount);

                    /** Retry connecting with Apple */
                    connectWithApple(identityToken, userId, email)
                } else {
                    /** Exceeded max retry count, returns error */
                    alert("There was an error logging you in, please retry. Error: " + resUser.status);
                    setConnectLoading(false);
                }
            }
        } catch(e) {
            alert("There was an error logging you in, please retry.");
            setConnectLoading(false);
        }
    }

    /** Will open WebBrowser to connect with Google using our Oauth API */
    async function connectWithGoogle() {
        Haptics.selectionAsync();
        let link = Linking.createURL('google-auth');
        setConnectLoading(true);

        WebBrowser.openBrowserAsync('https://lit.orbis.club/oauth-google/' + encodeURIComponent(link))
        .then(() => {
        }).catch(e => {
            alert("An unexpected error occured. Please try again.");
            console.log(e);
        })
    }

    const connectWallet = () => {
        Haptics.selectionAsync();
        console.log('Connect Wallet pressed !');
        setMultipleConnect(true);
        open();
    }
    
    return(
        <Modal hide={() => hideSettings()} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
            <Animated.View style={{transform: [{ translateX: moveAnimation1 }],paddingHorizontal: 20}}>
                <View style={{height: 65, zIndex: 2}}>
                    <View style={{padding: 20,marginBottom: 0,paddingLeft: 3}}>
                        <Text style={[tailwind('text-primary'), {fontSize: Platform.OS == 'ios' ? 18 : 15,}]}>Switch Account</Text>
                    </View>
                </View>

                {listAccount.map((e, index) => {
                    return(
                        <TouchableOpacity 
                            style={{borderColor: '#F6F6F6',borderWidth:1, borderRadius: 25,height: 50,marginTop: index == 0 ? -5 : 10,flexDirection:'row',alignItems: 'center',alignSelf: 'center',width: '100%'}} 
                            key={Math.random()}
                            onPress={() => setChecked({'user': e.user, 'index':index})}
                        >
                            <UserPfp 
                                details={e.user} 
                                style={{alignSelf: 'center',width: 30,height: 30,marginLeft: 15,}}
                                badge_style={{right:Dimensions.get('window').width/2.7,top:-30}}
                            />

                            <Username details={e.user} fontSize={15} style={{marginLeft: 15,}}/>

                            <View style={{backgroundColor: 'white',width: 26,height: 26,borderWidth: 1,borderColor: '#999',borderRadius: 13,justifyContent: 'center',alignItems: 'center',position: 'absolute',right: 10}}>
                                {((checked && checked.user.did == e.user.did) || (!checked && e.user.did == user.did)) && (
                                    <View style={{backgroundColor: '#FF6E31',width: 24,height: 24,borderRadius: 13,justifyContent: 'center',alignItems: 'center',}}>
                                        <View style={{backgroundColor: 'white',width: 10,height: 10,borderRadius: 5,}} />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    )
                })}

                <TouchableOpacity 
                    style={{borderColor: '#F6F6F6',borderWidth:1, borderRadius: 25,height: 50,marginTop: 15,flexDirection:'row',alignItems: 'center',alignSelf: 'center',width: '100%'}} 
                    onPress={() => onAddAccountPress()}
                >
                    <Image
                        style={{width: 30,height: 30,marginLeft: 15,}}
                        resizeMode='contain'
                        source={require('../../assets/add_icon.png')}
                        defaultSource={require('../../assets/add_icon.png')}
                    />

                    <Text style={[tailwind("text-main"), { fontFamily: "GmarketBold", fontSize: 15, lineHeight: 19, marginLeft: 15 }]}>Add account</Text>
                </TouchableOpacity>

                
                {switchLoading ? (
                    <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%',backgroundColor: '#FF6E31',marginTop: 30,}]}>
                        <ActivityIndicator size="small" color="#020617" />
                    </View>
                ) : checked ? (
                    <Button color="orange" size='centered' onPress={() => switchAccount()} title="Switch" style={{marginBottom: 0, marginTop: 30,}} />
                ) : (
                    <Button color="disabled" title="Switch" style={{marginBottom: 0, marginTop: 30,}} />
                )}
            </Animated.View>

            {showAddAccountBack && (
                <>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackPress()}} style={{position: 'absolute',left: 15, top: 15}}>
                        <Image
                            style={{width: 25,height: 25}}
                            resizeMode='contain'
                            source={require('../../assets/back_button.png')}
                            defaultSource={require('../../assets/back_button.png')}
                        />
                    </TouchableOpacity>
                    
                    <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop: 50,alignSelf: 'center',}}>
                        {connectLoading ?
                            <>
                                <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Connecting to your account:</Text>
                                <View style={[tailwind('flex w-full justify-center')]}>
                                    <ActivityIndicator style={{marginTop: 15}} size="small" color="#020617" />
                                </View>
                            </>
                        :
                            <>
                                {/** Show Apple Auth only for Apple */}
                                {Platform.OS === 'ios' &&
                                    <AppleAuthentication.AppleAuthenticationButton
                                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                                        cornerRadius={100}
                                        style={{width: "100%",height: 47}}
                                        onPress={async () => {
                                            try {
                                                /** Login with Apple */
                                                const credential = await AppleAuthentication.signInAsync({
                                                    requestedScopes: [
                                                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                                                        AppleAuthentication.AppleAuthenticationScope.EMAIL
                                                    ]
                                                });

                                                /** Authenticate with PKP */
                                                connectWithApple(credential.identityToken, credential.user, credential.email);
                                            } catch (e) {
                                                console.log("Error connecting with Apple:", e);
                                            }
                                        }} 
                                    />
                                }

                                {/** Connect with Google */}
                                <Button 
                                    color="rounded-gray" 
                                    title="Continue with Google" 
                                    icon={<GoogleIcon style={{marginRight: 8}} />} 
                                    style={{marginTop: 10}} 
                                    onPress={connectWithGoogle} 
                                />

                                {/** Connect with Wallet Connect */}
                                <Button 
                                    color="rounded-gray"
                                    title="With Wallet Connect" 
                                    icon={<WalletConnectIcon style={{marginRight: 8}} />} 
                                    style={{marginTop: 10}} 
                                    onPress={() => connectWallet()} 
                                />

                                <WalletConnectModal 
                                    projectId={projectId} 
                                    providerMetadata={providerMetadata} 
                                    sessionParams={sessionParams} 
                                />
                            </>
                        }
                    </Animated.View>
                </>
            )}
        </Modal>

    )
}
