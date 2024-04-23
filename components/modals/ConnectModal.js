import React, { useState, useEffect, useContext } from "react";
import { Platform, ActivityIndicator, Text, View } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import { GoogleIcon, WalletConnectIcon } from "../Icons";

import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useWalletConnectModal, WalletConnectModal } from '@walletconnect/modal-react-native'

/** Replaces localStorage in React Native */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Import Context */
import { GlobalContext } from "../../contexts/GlobalContext";
import { context } from "../../utils/config";

const projectId = '9fe6eef52f4985e5849a5c1e2c80fabb'

/** Initialize Web3Auth
const clientId = "BG4j-f_WSYSoGywsSrwflv0g7EsKza9uUoEn9VVKmQfVWLf7UdOEviJtzuBePORoRIXQjRmxGrOuTMqsjPN6m50";
const web3auth = new Web3Auth(WebBrowser, {
  clientId,
  network: OPENLOGIN_NETWORK.CYAN, // or other networks
  useCoreKitKey: false,
});*/

/** Modal explaining what connecting is on mobile */
export default function ConnectModal({hide, type}) {
    const { user, setUser, orbis, callbackConnect, connectType, setConnectType, loading, setLoading, setConnectModalVis } = useContext(GlobalContext);
    const tailwind = useTailwind();
    
    const [retryCount, setRetryCount] = useState(0);

    let link = Linking.createURL();
    const { isOpen, open, close, provider, isConnected, address } = useWalletConnectModal();

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

    useEffect(() => {
        if(isConnected && provider != null && !user) {
            connectWithWC(provider);
        }
    }, [provider, isConnected])

    async function connectWithWC(_provider) {
        setLoading(true);

        let resUser = await orbis.connect_v2({
            provider: _provider,
            appName: "CoinEasyApp"
        });

        if(resUser.status == 200) {
            const { data, error } = await orbis.getProfile(resUser.details.did);
            console.log(' ');
            console.log('ALREADYLOGIN');
            console.log(data.details.profile.data);
            console.log(' ');
            if(connectType == "signin" && (!data.details.profile?.data?.alreadyLogin && (!data.details.profile?.username || !data.details.profile?.pfp || !data.details.profile?.description))){
    
                let options= {
                    did: resUser.details.did,
                    context,
                    include_child_contexts: true
                };
          
                let { data } = await orbis.getPosts(options);
                console.log(' ');
                console.log('POST USER');
                console.log(data);
                console.log(' ');
                if(data.length == 0){
                    provider?.disconnect().then(async res => {
                        await AsyncStorage.removeItem("provider-type");       
                        setUser(null);
                        setLoading(false)
                    }).catch(e => {
                        setUser(null);
                        setLoading(false)
                    })
        
                    if(!provider){
                        setUser(null);
                    }
        
                    setLoading(false);
                    setConnectModalVis(false)
                    alert("You haven't signed up with this account before, do you want to sign up ?")
                }
            }else{
                setUser(resUser.details);
                AsyncStorage.setItem("provider-type", "wallet-connect");
                setLoading(false);
                callbackConnect(resUser.details)
            }
        } else {
            alert("There was an error logging you in, please retry. Error: " + resUser.status);
            setLoading(false);
        }
    }

    /** Will trigget the auth flow for Apple */
    async function connectWithApple(identityToken, userId, email) {
        setLoading(true);
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
                const { data, error } = await orbis.getProfile(resUser.details.did);
                console.log(' ');
                console.log('ALREADYLOGIN');
                console.log(data.details.profile?.data);
                console.log(data.last_activity_timestamp);
                console.log(' ');
                if(connectType == "signin" && (!data.details.profile?.data?.alreadyLogin && (!data.details.profile?.username || !data.details.profile?.pfp || !data.details.profile?.description))){
        
                    let options= {
                        did: resUser.details.did,
                        context,
                        include_child_contexts: true
                    };
              
                    let { data } = await orbis.getPosts(options);
                    console.log(' ');
                    console.log('POST USER');
                    console.log(data);
                    console.log(' ');
                    if(data.length == 0){
                        provider?.disconnect().then(async res => {
                            await AsyncStorage.removeItem("provider-type");       
                            setUser(null);
                            setLoading(false)
                        }).catch(e => {
                            setUser(null);
                            setLoading(false)
                        })
            
                        if(!provider){
                            setUser(null);
                        }
            
                        setLoading(false)
                        setConnectModalVis(false)
                        alert("You haven't signed up with this account before, do you want to sign up ?")
                    }
        
        
                }else{
                    setUser(resUser.details);
                    AsyncStorage.setItem("provider-type", "apple");
                    callbackConnect(resUser.details)
                }
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
                    setLoading(false);
                }
            }
        } catch(e) {
            alert("There was an error logging you in, please retry.");
            console.log(e);
            setLoading(false);
        }
    }

    /** Will open WebBrowser to connect with Google using our Oauth API */
    async function connectWithGoogle() {
        Haptics.selectionAsync();
        let link = Linking.createURL('google-auth');
        setLoading(true);

        WebBrowser.openBrowserAsync('https://lit.orbis.club/oauth-google/' + encodeURIComponent(link))
        .then(() => {
            if(type == 'signup'){
                setConnectType('signup')
            }
        }).catch(e => {
            alert("An unexpected error occured. Please try again.");
        })
    }

    /** Will hide modal only if user isn't currently logging in */
    function hideModal() {
        if(loading) {
            alert("Can't close now.");
            return;
        } else {
            hide();
        }
    }

    return(
        <Modal hide={hideModal} type='small'>
            <View style={[tailwind('flex flex-col w-full p-5 pb-12 ')]}>
                {loading ?
                    <>
                        <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>
                            {type == 'signup' ? 'Creating your account:' : 'Connecting to your account:'}
                        </Text>
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
                            onPress={() => {Haptics.selectionAsync();open()}} 
                        />

                        <WalletConnectModal 
                            projectId={projectId} 
                            providerMetadata={providerMetadata} 
                            sessionParams={sessionParams} 
                        />
                    </>
                }
            </View>
        </Modal>
    )
}
