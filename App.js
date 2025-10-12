import './utils/polyfill';
import 'react-native-reanimated';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StyleSheet, View, Keyboard, Platform, Animated, Image, Dimensions } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { TailwindProvider } from 'tailwind-rn';
import * as SplashScreen from 'expo-splash-screen';
import { useSharedValue } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { sleep } from './utils';
import Login from "./screens/Login";
import utilities from './tailwind.json';
import QR from "./components/modals/QR.js";
import AppNavigator from './navigation/AppNavigator';
import { GlobalContext } from "./contexts/GlobalContext";
import RepostModal from "./components/modals/RepostModal";
import PostboxModal from "./components/modals/PostboxModal";
import NotificationsPane from "./components/panes/NotificationsPane";
import PostSettingsModal from "./components/modals/PostSettingsModal";
import UpdateProfileModal from "./components/modals/UpdateProfileModal";
import { context, onboard_context, edu_context } from './utils/config.js';
import PushNotificationsModal from "./components/modals/PushNotificationsModal";
import NicknameModal from "./components/modals/NicknameModal";

// Privy Integration
// import 'fast-text-encoding';
// import 'react-native-get-random-values';
// import '@ethersproject/shims';
// import { PrivyProvider} from '@privy-io/expo';

// const easyChain = {
//   id: 1313161855,
//   name: "EasyChain",
//   rpcUrls: {
//     default: {
//       http: ["https://0x4e45427f.rpc.aurora-cloud.dev"],
//     },
//   },
//   blockExplorers: {
//     default: {
//       name: "EasyChain Explorer",
//       url: "https://0x4e45427f.explorer.aurora-cloud.dev",
//     },
//   },
//   nativeCurrency: {
//     name: "USD Coin",
//     symbol: "USDC",
//     decimals: 6,
//   },
// };

/** Expo */
import { useFonts } from 'expo-font';
// import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';


/** Import Orbis SDK */
import { Orbis } from "@orbisclub/orbis-sdk";
import moment from 'moment';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ClaimOrangesModal from './components/modals/ClaimOrangesModal';
// import { Asset } from 'expo-asset';

/** Initialize the Orbis class object */
let orbis = new Orbis({
  useLit: false,
  store: AsyncStorage,
  storeAsync: true,
  litCloud: true,
  PINATA_GATEWAY: 'https://orbis.mypinata.cloud/ipfs/',
  PINATA_API_KEY: '194337be204670686a63',
  PINATA_SECRET_API_KEY: "d69ee5685fec8cd9012e9e02d28c6d017d22770de68c703f72eb368537b609bf"
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

let callbackPostShared;
let page = 0;
export default function App() {
  const [user, setUser] = useState();
  const [userData, setUserData] = useState();
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [previousScreen, setPreviousScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [repost, setRepost] = useState(false);
  const [postDetailsVis, setPostDetailsVis] = useState();
  const [updateProfileVis, setUpdateProfileVis] = useState(false);
  const [pushNotifsVis, setPushNotifsVis] = useState(false);
  const [newFeatureVis, setNewFeatureVis] = useState(false);
  const [newFeatureAlertVis, setNewFeatureAlertVis] = useState(false);
  const [showClaimOranges, setShowClaimOranges] = useState(false)
  const [todayOranges, setTodayOranges] = useState(Math.floor(Math.random() * (20 - 5) + 5))
  const [settingsVis, setSettingsVis] = useState(false);
  const [switchAccountVis, setSwitchAccountVis] = useState(false);
  const [adAlreadyClaimed, setAdAlreadyClaimed] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)



  const [switchLoading, setSwitchLoading] = useState(false)
  const [loading, setLoading] = useState(false);

  const [postSettingsModalVis, setPostSettingsModalVis] = useState(false);
  const [postboxVis, setPostboxVis] = useState(false);
  const [replyTo, setReplyTo] = useState();
  const [editedPost, setEditedPost] = useState(null);
  const [shareProfileVis, setShareProfileVis] = useState(false);
  const [showImageSender, setShowImageSender] = useState(null);
  const [listMessages, setListMessages] = useState([])
  const [notificationsVis, setNotificationsVis] = useState(false);
  const [nicknameVis, setNicknameVis] = useState(false)
  const [connectType, setConnectType] = useState('')
  const [connectModalVis, setConnectModalVis] = useState(false);

  const [listBlockedUser, setListBlockedUser] = useState(null)
  const [listHiddenPost, setListHiddenPost] = useState(null)
  const [listMutedUsers, setListMutedUsers] = useState(null)

  const [listAccount, setListAccount] = useState([])

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBottom, setRefreshingBottom] = useState(false);
  const [profileSelected, setProfileSelected] = useState();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const translateY = useSharedValue(0);
  const url = Linking.useURL();
  
  const confetti = useRef();
  const responseListener = useRef();
  const homeFeedRef = useRef();
  const categoryFeedRef = useRef();
  const newsFeedRef = useRef();
  const modalSwitchRef = useRef(null); 
  const modalSettingsRef = useRef(null); 
  const modalPostSettingsRef = useRef(null); 
  const modalProfileRef = useRef(null); 
  const modalPostBoxRef = useRef(null); 
  const modalNicknameRef = useRef(null); 

  const snapPoints = useMemo(() => ['50%', '50%'], []);
  const snapPointsLarge = useMemo(() => [Platform.OS == 'ios' ? '87%' : '95%', Platform.OS == 'ios' ? '87%' : '95%'], []);
  const handleModalPostBoxPress = useCallback(() => modalPostBoxRef.current?.present(), []);
  const handleModalNicknamePress = useCallback(() => modalNicknameRef.current?.present(), []);
  
  const [categoriesVis, setCategoriesVis] = useState(false);
  const [showReportBack, setShowReportBack] = useState(false)
  const [activityClaim, setActivityClaim] = useState(false)
  const [inviteClaim, setInviteClaim] = useState(false)

  const [categoryPosts, setCategoryPosts] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [newsPosts, setNewsPosts] = useState(null)
  const [selectedNews, setSelectedNews] = useState(null)
  const [currentRoute, setCurrentRoute] = useState(null)

  const [tabViewHeight, setTabViewHeight] = useState(500)

  const { provider } = useWalletConnectModal();    

  const [scrollAnim, setScrollAnim] = useState(new Animated.Value(0));
  const [offsetAnim, setOffsetAnim] = useState(new Animated.Value(0));
  const [clampedScroll, setClampedScroll] = useState(Animated.diffClamp(
    Animated.add(
      scrollAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolateLeft: 'clamp'
      }),
      offsetAnim
    ), 0, 1
  ));
  const navbarTranslate = clampedScroll.interpolate({
    inputRange: [50, Platform.OS == 'ios' ? 170 : 150],
    outputRange: [0, Platform.OS == 'ios' ? -170 : -150],
    extrapolate: 'clamp'
  });
  
  /** Load fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium_ios.ttf'),
    'GmarketBold': require('./assets/fonts/GmarketSansBold.ttf'),
  });

  useEffect(() => {
    saveUserInStorage();

    async function saveUserInStorage() {
      if(user) {
        if(!user?.profile || !user?.profile?.username){
            const { data, error } = await orbis.getProfile(user.did);
            user.profile = data.details.profile
        }

        const listDid = await AsyncStorage.getItem("user-connected")
        const currentCeramicSession = await AsyncStorage.getItem("ceramic-session")
        var listConnected = JSON.parse(listDid)
        const indexUser = listConnected?.findIndex(e => e.user.did == user.did)

        if(listConnected && listConnected.length > 0){
            if(typeof indexUser !== 'undefined' && indexUser != -1){
                listConnected[indexUser].time = moment().format('YYYY-MM-DD HH:mm:ss')
                listConnected[indexUser].user = user
            }else{
                listConnected.push({
                    'user': user, 
                    'time': moment().format('YYYY-MM-DD HH:mm:ss'),
                    'ceramicSession': currentCeramicSession
                })
            }
        }else{
            listConnected = [{
                'user': user,
                'time': moment().format('YYYY-MM-DD HH:mm:ss'),
                'ceramicSession': currentCeramicSession
            }]
        }

        await AsyncStorage.setItem("user-connected", JSON.stringify(listConnected));

        if(typeof indexUser !== 'undefined' && indexUser != -1){
            await orbis.isConnected(listConnected[indexUser].ceramicSession);
        }else if(currentCeramicSession){
            await orbis.isConnected(currentCeramicSession);
        }else{
            await orbis.isConnected();
        }
  
        setListAccount([...listConnected])
        setSwitchLoading(false)
        setSettingsVis(false);
        setSwitchAccountVis(false)

        modalSwitchRef.current?.close()
      }else{
        let res = await orbis.logout();
        
        provider?.disconnect().then(async res => {
            setUser(null);
            setUserData(null);
        }).catch(e => {
            console.log(e);
            setUser(null);
            setUserData(null);
        })

        modalSwitchRef.current?.close()
      }
    }
  }, [user]);


    const onLayoutRootView = useCallback(async () => {
        if (isLayoutReady) {
            await SplashScreen.hideAsync();
        }
    }, [isLayoutReady]);
    

  /** Will check if user is connected on load to automatically re-connect user */
    useEffect(() => {
        connect();
        loadContexts();
        fecthBlockedUser();
        fecthHiddenPost();
        fecthMuteUser();

        /** Will re-connect automatically the user to the account found in local storage */
        async function connect() {
            /** Check if user exists in local storage */
            //   await AsyncStorage.removeItem("user-connected");

            let _userDid = await AsyncStorage.getItem("user-connected");
            let listDid = []
            if(_userDid){
                if(_userDid.charAt(0) != '['){
                    await AsyncStorage.removeItem("user-connected");
                }else{
                    listDid = JSON.parse(_userDid)
                }
            }
            
            if(listDid && listDid.length != 0) {
                if(listDid.length > 1){
                    listDid.sort((a, b) => (a.time < b.time) ? 1 : -1)
                }

                const { data, error } = await orbis.getProfile(listDid[0]?.user?.did);                

                setUser({...listDid[0].user})
                if(data.details?.profile?.data){
                    setUserData({...data.details.profile.data})
                }else{
                    setUserData({...listDid[0].user.profile?.data})
                }
                setIsLayoutReady(true);
                
            }else{
                /** Retrieve user details */
                let res = await orbis.isConnected();

                if(res.status == 200) {
                    setUser(res.details);
                    setUserData(res.details.profile?.data);
                }
                
                setIsLayoutReady(true);
            }

        }

        // Will fetch all blocked user
        async function fecthBlockedUser() {
            let temp_list = await AsyncStorage.getItem("list_blocked_user");
            const list_blocked_user = JSON.parse(temp_list)

            if(list_blocked_user) {
                setListBlockedUser([...list_blocked_user])
            }
        }
        // Will fetch Hidden post
        async function fecthHiddenPost() {
            let temp_list = await AsyncStorage.getItem("list_hidden_post");
            const list_hidden_post = JSON.parse(temp_list)

            if(list_hidden_post) {
                setListHiddenPost([...list_hidden_post])
            }
        }
        // Will fetch mute users
        async function fecthMuteUser() {
            let temp_list = await AsyncStorage.getItem("list_muted_users");
            const list_muted_users = JSON.parse(temp_list)

            if(list_muted_users) {
                setListMutedUsers([...list_muted_users])
            }
        }
    }, []);

    useEffect(() => {
        page = 0;
        loadPosts();
    }, [category]);

    /** Will be triggered when a new deeplink is received */
    useEffect(() => {
        url && handleURL(url)
    }, [url]);

    /** Handle notifications received, will open right screen or pane based on the notification received */
    useEffect(() => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
            try {
                let data = response.notification?.request?.content?.data;

                switch (data?.type) {
                    /** Open post pane for reactions */
                    case "reaction":
                        hideModals();
                        setPostDetailsVis(data.post_id);
                        break;
                    /** Open post pane for replies */
                    case "reply":
                        hideModals();
                        setPostDetailsVis(data.master ? data.master : data.post_id);

                        await sleep(4000);
                        if(feedRef?.current && data.master) {
                            //setScrolled(0);
                            feedRef.current.scrollToItem({ animated: true, item: data.post_id });
                        }
                        break;

                    /** Open post pane for mentions */
                    case "mention":
                        hideModals();
                        setPostDetailsVis(data.post_id);

                        await sleep(4000);
                        if(feedRef?.current && data.master) {
                            //setScrolled(0);
                            feedRef.current.scrollToItem({ animated: true, item: data.post_id });
                        }
                        break;
                    default:
                        break;
                }
            } catch(e) {
                console.log("Error addNotificationResponseReceivedListener:", e);
            }
        });

        return () => {
            Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    /** Will handle links opened with the coineasy:// sheme */
    async function handleURL(url) {
        const { path, queryParams } = Linking.parse(url);
        let token;
        switch (path) {
            case "user":
                setScreen("profile");
                setProfileSelected(queryParams.did);
                hideModals();
                break;
            case "google-auth":
                token = queryParams.token;

                /** Dismiss browser if on iOS */
                Platform.OS === 'ios' && WebBrowser.dismissBrowser()

                if(token) {
                    try {
                        googleConnect(token);
                    } catch(e) {
                        console.log("Error authenticating with Google:", e);
                        //setLoading(false);
                    }
                }
                break;
            default:
                try {
                    if(url.includes("google-auth")) {
                        console.log("URL contains google-auth")
                        token = queryParams.token;
                        googleConnect(token);
                    } else if(url.includes("profile")) {
                        setScreen("profile");
                        setProfileSelected(queryParams.did);
                        hideModals();
                    }
                } catch(e) {
                    console.log("Error authenticating with Google:", e);
                }
                break;
        }
    }

    async function googleConnect(token) {
        let resUser = await orbis.connect_v2({
            provider: "oauth",
            oauth: {
                type: "google",
                token: token
            }
        });

        if(resUser.status == 200) {
            const { data, error } = await orbis.getProfile(resUser.details.did);
            if(connectType == "signin" && (!data.details.profile?.data?.alreadyLogin && (!data.details.profile?.username || !data.details.profile?.pfp || !data.details.profile?.description))){

                let options= {
                    did: resUser.details.did,
                    context,
                    include_child_contexts: true
                };
        
                let { data } = await orbis.getPosts(options);
                if(data.length == 0){
                    provider?.disconnect().then(async res => {
                        await AsyncStorage.removeItem("provider-type");       
                        setUser(null);
                        setUserData(null);
                        setLoading(false)
                    }).catch(e => {
                        setUser(null);
                        setUserData(null);
                        setLoading(false)
                    })
                    
                    if(!provider){
                        setUser(null);
                        setUserData(null);
                    }
        
                    setLoading(false)
                    setConnectModalVis(false)
                    alert("You haven't signed up with this account before, do you want to sign up ?")
                }else{
                    setUser(resUser.details);
                    setUserData(resUser.details.profile?.data);
                    AsyncStorage.setItem("provider-type", "google");
                    setLoading(false)
                    callbackConnect(resUser.details);
                }
            }else{
                setUser(resUser.details);
                setUserData(resUser.details.profile?.data);
                AsyncStorage.setItem("provider-type", "google");
                setLoading(false)
                callbackConnect(resUser.details);
            }
        }
    }

    function hideModals() {
        translateY.value = 0;
        setShareProfileVis(false);
        setPostDetailsVis(null);
        setProfileSelected(null);
    }

    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        setPosts([]);
        setRefreshing(true);
        let _contexts = [context, onboard_context, edu_context];
        let { data } = await orbis.getPosts({
            contexts: category ? [category.stream_id] : _contexts,
            include_child_contexts: true
        });

        if(data) {
            data.map(async (e, indexPost) => {
                if(e.content.media?.length > 0){
                    e.content.media.map(async (elt, indexImage) => {
                        if(elt.url){
                            await Image.getSize(elt.url, (width, height) => {elt.width = width; elt.height = height});
                        }else if(elt[0].url){
                            await Image.getSize(elt[0].url, (width, height) => {elt[0].width = width; elt[0].height = height});
                        }else{
                            console.log(elt);
                        }        

                        if(indexImage == e.content.media.length-1 && indexPost == data.length -1){
                            setPosts(data);
                            setRefreshing(false);
                        }
                    })
                }else{
                    if(indexPost == data.length -1){
                        setPosts(data);
                        setRefreshing(false);
                    }
                }
            })
        }else{
            setRefreshing(false);
        }
    }

    /** This will load more posts and add those to the current list */
    async function loadMorePosts() {
        if(refreshingBottom) {
            return;
        }
        if (posts.length % 50 === 0) {
            setRefreshingBottom(true);
            page++;
            let { data } = await orbis.getPosts({
                contexts: category ? [category.stream_id] : [context, onboard_context, edu_context],
                include_child_contexts: true
            }, page);

            if(data){
                data.map(async (e, indexPost) => {
                    if(e.content.media?.length > 0){
                        e.content.media.map(async (elt, indexImage) => {
                            if(elt.url){
                                await Image.getSize(elt.url, (width, height) => {elt.width = width; elt.height = height});
                            }else if(elt[0].url){
                                await Image.getSize(elt[0].url, (width, height) => {elt[0].width = width; elt[0].height = height});
                            }
            
                            if(indexImage == e.content.media.length-1 && indexPost == data.length -1){
                                let _posts = [...posts, ...data];
                                setRefreshingBottom(false);
                                setPosts(_posts);
                            }
                        })
                    }else{
                        if(indexPost == data.length -1){
                            let _posts = [...posts, ...data];
                            setRefreshingBottom(false);
                            setPosts(_posts);
                        }
                    }
                })
            }
        } else {
            console.log("Reached the end.");
        }
    }

    /** Load all categories / contexts under the global context */
    async function loadContexts() {
        let { data, error } = await orbis.api.from("orbis_contexts").select().eq('context', context).order('created_at', { ascending: false });
        setCategories(data);
    }

    const onRefresh = useCallback(async () => {
        page = 0;
        setRefreshing(true);
        let { data, error } = await orbis.getPosts({
            contexts: category ? [category.stream_id] : [context, onboard_context, edu_context],
            include_child_contexts: true
        });

        error && console.log("Error getPosts:", error);
        data && setPosts(data)

        setRefreshing(false);
    }, [category]);

    async function callbackConnect(detailUser) {

        console.log('CALLBACK CONNECT');
        console.log(detailUser);
        
        if(connectType == "signup"){
            handleModalNicknamePress()

            if(detailUser && detailUser?.profile){
                if(detailUser?.profile?.data){
                    detailUser.profile.data.alreadyLogin = true
                }else{
                    detailUser.profile.data = {alreadyLogin: true}
                }

                const res = await orbis.updateProfile(detailUser.profile);
            }
            setLoading(false);
        }else{
            const showNotificationDate = await AsyncStorage.getItem("showNotificationDate")
            const showNewFeatureDate = await AsyncStorage.getItem("showNewFeatureDate")

            if(moment().format('YYYY-MM-DD') >= showNotificationDate || !showNotificationDate){
                setPushNotifsVis(true);
            }else if(moment().format('YYYY-MM-DD') >= showNewFeatureDate || !showNewFeatureDate){
                setNewFeatureVis(true);
            }

            setLoading(false);
            setConnectModalVis(false)
        }
        
        modalSwitchRef.current?.close()
    }

    /** Show postbox while saving the callback function */
    function showPostbox(callback) {
        console.log("Enter showPostbox with:", callback);
        callbackPostShared = callback ?? defaultCallbackPostShared;

        console.log('la');
        console.log(callbackPostShared);

        handleModalPostBoxPress()
        Haptics.selectionAsync();
    }

    function hidePostbox() {
        modalPostBoxRef.current?.close()

        setRepost(false);
        setReplyTo(null);
        setEditedPost(null);

        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    /** Will be called when a new post is being shared */
    async function defaultCallbackPostShared(_post) {
        console.log("Enter defaultCallbackPostShared:", _post);
        let _posts = [_post, ...posts];
        setPosts(_posts);

        const today = moment().format('YYYY-MM-DD');
        const tempData = userData ?? {};
        if (!tempData.todayActivities || tempData.todayActivities.date !== today) {
            // Reset activities if date has changed
            tempData.todayActivities = {
                date: today,
                posts: 0,
                comments: 0,
                likes: 0,
            };
        }

        // Orange Reward
        if(replyTo){
            if (_post.content.body.length >= 20 || _post.content.media || _post.content.body.includes("http://") || _post.content.body.includes("https://")) {
                if (tempData.todayActivities.comments < 3) {
                    tempData.todayActivities.comments += 1;
                }
            }
        }else{
            if (_post.content.body.length >= 50 || _post.content.media || _post.content.body.includes("http://") || _post.content.body.includes("https://")) {
                tempData.todayActivities.posts += 1;
            }
        }
        
        setUserData({...tempData})
        
        var tempProfile = user.profile
        tempProfile.data = tempData
        const res = await orbis.updateProfile(tempProfile);

        hidePostbox()
    }

    // TEMP BACKUP
    /** Will be called when a new post is being shared */
    // async function defaultCallbackPostShared(_post) {
    //     console.log("Enter defaultCallbackPostShared:", _post);
    //     let _posts = [_post, ...posts];
    //     setPosts(_posts);

    //     // Orange Reward
    //     const tempData = userData ?? {}
    //     if(replyTo){
    //         if(tempData.listClaimedOranges){
    //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
    //             if(index != -1){
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
    //             }else{
    //                 const listReward = [{
    //                     numberOranges: 3,
    //                     type: 'Comment'
    //                 }]
    //                 tempData.comment?.number == 19 && listReward.push({
    //                     numberOranges: 50,
    //                     type: 'Comments Milestone achieved'
    //                 })
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
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

    //         if(tempData.comment){
    //             tempData.comment.number += 1
    //             tempData.comment.gained += 3
    //         }else{
    //             tempData.comment = {
    //                 number: 1,
    //                 gained: 3,
    //                 lastComment: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 3 : tempData.activityUnclaimed = {number: 3}
    //         tempData.comment.number == 20 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.comment.number == 20 ? tempData.activityUnclaimed = {number: 53} : null
    //         tempData.comment.number == 20 ? tempData.comment.number = 0 : null


    //     }else if(repost){

    //         if(tempData.listClaimedOranges){
    //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
    //             if(index != -1){
    //                 tempData.listClaimedOranges[index].listOranges.push({
    //                     numberOranges: 5,
    //                     type: 'Repost'
    //                 })
    //                 if(tempData.reaction?.number == 29){
    //                     tempData.listClaimedOranges[index].listOranges.push({
    //                         numberOranges: 50,
    //                         type: 'Reactions Milestone achieved'
    //                     })
    //                 }
    //             }else{
    //                 const listReward = [{
    //                     numberOranges: 5,
    //                     type: 'Repost'
    //                 }]
    //                 tempData.reaction?.number == 29 && listReward.push({
    //                     numberOranges: 50,
    //                     type: 'Reactions Milestone achieved'
    //                 })
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
    //             }
    //         }else{
    //             tempData.listClaimedOranges = [{
    //                 date: moment().format('YYYY-MM-DD'),
    //                 listOranges: [
    //                     {
    //                         numberOranges: 5,
    //                         type: 'Repost'
    //                     },
    //                 ]
    //             }]
    //         }

    //         if(tempData.reaction){
    //             tempData.reaction.number += 1
    //             tempData.reaction.gained += 5
    //         }else{
    //             tempData.reaction = {
    //                 number: 1,
    //                 gained: 5,
    //                 lastReaction: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 5 : tempData.activityUnclaimed = {number: 5}
    //         tempData.reaction.number == 30 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.reaction.number == 30 ? tempData.activityUnclaimed = {number: 55} : null
    //         tempData.reaction.number == 30 ? tempData.reaction.number = 0 : null
    
    //     }else{

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
    //                 const listReward = [{
    //                     numberOranges: 15,
    //                     type: 'Post'
    //                 }]
    //                 if(tempData.post?.number == 9){
    //                     listReward.push({
    //                         numberOranges: 50,
    //                         type: 'Posting Milestone achieved'
    //                     })
    //                 }
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
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

    //         if(tempData.post){
    //             tempData.post.number += 1
    //             tempData.post.gained += 15
    //         }else{
    //             tempData.post = {
    //                 number: 1,
    //                 gained: 15,
    //                 lastPost: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 15 : tempData.activityUnclaimed = {number: 15}
    //         tempData.post.number == 10 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.post.number == 10 ? tempData.activityUnclaimed = {number: 65} : null
    //         tempData.post.number == 10 ? tempData.post.number = 0 : null
    //     }
        
    //     setUserData({...tempData})
        
    //     var tempProfile = user.profile
    //     tempProfile.data = tempData
    //     const res = await orbis.updateProfile(tempProfile);

    //     hidePostbox()
    // }


    function scrollToTop() {
        if(homeFeedRef?.current) {
            homeFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        } else if(categoryFeedRef?.current){
            categoryFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        } else if(newsFeedRef?.current){
            newsFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        }
    }

    /** Wait for fonts to be loaded before rendering the app */
    // const loadFonts = async () => {
    //     await Font.loadAsync({
    //         'GmarketMedium': require('./assets/fonts/GmarketSansMedium.ttf'),
    //         'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium.ttf'),
    //         'GmarketBold': require('./assets/fonts/GmarketSansBold.ttf'),
    //     });
    // };

    // if(!loadFonts) {
    //     return null
    // }

    if(!fontsLoaded) {
        return null
    }


    /** Wait for app to be ready before rendering it */
    if (!isLayoutReady) {
        return null;
    }

    return (
        // <PrivyProvider 
        //     appId="cmfgz756i00hzjx0bfbwlttgz" 
        //     supportedChains={[easyChain]}
        //     // config={{
        //     //     evmChains: [easyChain],
        //     // }}
        // >
        <>
            <StatusBar translucent={true} backgroundColor="#00000000" style="black"/>
            <GestureHandlerRootView onLayout={onLayoutRootView} style={{width: "100%", height: "100%"}}>
                <GlobalContext.Provider value={{ 
                        orbis,
                        confetti,
                        refreshing,
                        categories,
                        postboxVis,
                        refreshingBottom,
                        callbackPostShared,
                        
                        onRefresh,
                        loadPosts,
                        showPostbox,
                        hidePostbox,
                        loadContexts,
                        loadMorePosts,
                        callbackConnect,
                        defaultCallbackPostShared,

                        homeFeedRef,
                        newsFeedRef,
                        categoryFeedRef,
                        modalSwitchRef,
                        modalProfileRef,
                        modalPostBoxRef,
                        modalNicknameRef,
                        modalSettingsRef,
                        modalPostSettingsRef,

                        user, setUser,
                        userData, setUserData,
                        posts, setPosts,
                        screen, setScreen,
                        repost, setRepost,
                        replyTo, setReplyTo,

                        setSettingsVis,
                        setShareProfileVis,
                        setSwitchAccountVis,
                        setNotificationsVis,
                        setPostSettingsModalVis,

                        category, setCategory,
                        scrolled, setScrolled,
                        editedPost, setEditedPost,
                        pushNotifsVis, setPushNotifsVis,
                        newFeatureVis, setNewFeatureVis,
                        previousScreen, setPreviousScreen,
                        postDetailsVis, setPostDetailsVis,
                        userConnecting, setUserConnecting,
                        profileSelected, setProfileSelected,
                        updateProfileVis, setUpdateProfileVis,
                        showConnectModal, setShowConnectModal,
                        newFeatureAlertVis, setNewFeatureAlertVis,

                        scrollToTop,
                        translateY,
                        scrollAnim,
                        offsetAnim,
                        navbarTranslate,
                        setClampedScroll,
                        setOffsetAnim,
                        setScrollAnim,
                        setRefreshing,

                        loading, setLoading,
                        newsPosts, setNewsPosts,
                        connectType, setConnectType,
                        listAccount, setListAccount,
                        nicknameVis, setNicknameVis,
                        inviteClaim, setInviteClaim,
                        listMessages, setListMessages,
                        currentRoute, setCurrentRoute,
                        selectedNews, setSelectedNews,
                        todayOranges, setTodayOranges,
                        addressCopied, setAddressCopied,
                        switchLoading, setSwitchLoading,
                        tabViewHeight, setTabViewHeight,
                        categoryPosts, setCategoryPosts,
                        categoriesVis, setCategoriesVis,
                        activityClaim, setActivityClaim,
                        listHiddenPost, setListHiddenPost,
                        listMutedUsers, setListMutedUsers,
                        showReportBack, setShowReportBack,
                        showImageSender, setShowImageSender,
                        listBlockedUser, setListBlockedUser,
                        connectModalVis, setConnectModalVis,
                        selectedCategory, setSelectedCategory,
                        showClaimOranges, setShowClaimOranges,
                        adAlreadyClaimed, setAdAlreadyClaimed,
                    }}
                >

                    <TailwindProvider utilities={utilities}>
                        {user ?
                            <AppNavigator />
                        :
                            <Login />
                        }

                        {/** Display the edit profile details modal */}
                        <UpdateProfileModal />

                        {/** Display push notifications pane */}
                        {pushNotifsVis &&
                            <PushNotificationsModal />
                        }

                        {/** Display nickname pane */}
                        <NicknameModal />

                        {/** Render repost modal */}
                        {repost !== false &&
                            <RepostModal />
                        }

                        {/** Share post container */}
                        <PostboxModal />

                        {/** Show post settings modal */}
                        <BottomSheetModalProvider>
                            <BottomSheetModal
                                ref={modalPostSettingsRef}
                                index={1}
                                snapPoints={showReportBack ? snapPointsLarge : snapPoints}
                                handleIndicatorStyle={{backgroundColor: 'black',}}
                                handleStyle={{height: 40,justifyContent: 'center',}}
                                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                            >
                                <PostSettingsModal />
                            </BottomSheetModal>
                        </BottomSheetModalProvider>

                        {/** QR modal container */}
                        {shareProfileVis &&
                            <QR hide={() => setShareProfileVis(false)} />
                        }

                        {/** Show notifications pane */}
                        {notificationsVis &&
                            <NotificationsPane />
                        }

                        {addressCopied && (
                            <View style={{backgroundColor: 'rgba(0,0,0,0.5)',width: '100%', height: '100%',position: 'absolute',justifyContent:'center',alignItems:'center',}}>
                                <Image
                                    style={{width: 150, height: 150,alignSelf:'center',}}
                                    resizeMode='contain'
                                    source={require('./assets/link_copied.png')}
                                />
                            </View>
                        )}

                        {/* <Confetti confetti={confetti}/> */}
                    </TailwindProvider>
                </GlobalContext.Provider>
            </GestureHandlerRootView>
        </>
    );
}

const Confetti = ({confetti}) => {
    return(
        <ConfettiCannon fadeOut={true} fallSpeed={2500} count={150} origin={{x: -400, y: 0}} autoStart={false} ref={confetti} />
    )
}

const styles = StyleSheet.create();