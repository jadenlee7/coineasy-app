import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { StyleSheet, View, Keyboard, Platform, Animated, Image, Dimensions, Text, SafeAreaView } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { TailwindProvider } from 'tailwind-rn';
import * as SplashScreen from 'expo-splash-screen';
import { useSharedValue } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Login from "./screens/Login";
import utilities from './tailwind.json';
import QR from "./components/modals/QR.js";
import AppNavigator from './navigation/AppNavigator';
import { GlobalContext } from "./contexts/GlobalContext";
import RepostModal from "./components/modals/RepostModal";
import PostboxModal from "./components/modals/PostboxModal";
import PostSettingsModal from "./components/modals/PostSettingsModal";
import UpdateProfileModal from "./components/modals/UpdateProfileModal";
import PushNotificationsModal from "./components/modals/PushNotificationsModal";
import NicknameModal from "./components/modals/NicknameModal";
import StartupErrorBoundary from './components/StartupErrorBoundary';
import { SOCIAL_CATEGORIES } from './data/socialCategories';

// Privy integration (Phase 1: Base chain only; EasyChain is Phase 2-gated).
// Required polyfills load before this module from entrypoint.js.
import { PrivyProvider, usePrivy } from '@privy-io/expo';
import useAuthSync from './hooks/useAuthSync';
import {
  EASYGO_BASE_CHAIN,
  EASYGO_PRIVY_CONFIG,
  getEasyGoPrivyClient,
} from './utils/privyClient';
import { easyGoPrivyStorage } from './utils/privyStorage';

// Phase 1 chain: Base mainnet (chainId 8453). EasyChain is gated by
// PHASE.EASYCHAIN_ENABLED in EASYGO_BUILD_PLAN.md and added in Phase 2.
const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
const COURSE_PROGRESS_KEY = 'easygo_course_progress';
const STARTUP_CONFIG_CODE = 'STARTUP-CONFIG-01';
const isSet = (value) => typeof value === 'string' && value.trim().length > 0;
const collectMissingPrivyEnvVars = () => {
  const missing = [];

  if (!isSet(PRIVY_APP_ID)) {
    missing.push('EXPO_PUBLIC_PRIVY_APP_ID');
  }

  if (!isSet(PRIVY_CLIENT_ID)) {
    missing.push('EXPO_PUBLIC_PRIVY_CLIENT_ID');
  }

  return missing;
};

/** Expo */
import { useFonts } from 'expo-font';
// import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';


import moment from 'moment';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ClaimOrangesModal from './components/modals/ClaimOrangesModal';
// import { Asset } from 'expo-asset';

/**
 * AuthBridge — runs inside <PrivyProvider> so usePrivy() is available.
 * Watches Privy auth state, syncs to backend via useAuthSync, and writes
 * the resulting profile into the shared presentation state.
 */
function AuthBridge() {
  const privy = usePrivy();
  const { profile } = useAuthSync(privy);
  const { setUser, setUserData } = useContext(GlobalContext);

  useEffect(() => {
    let cancelled = false;

    const syncPresentationState = async () => {
      let localCourses = [];
      const courseProgressOwner = privy?.user?.id || profile?.privyDid || profile?.id || 'device';
      try {
        const stored = await AsyncStorage.getItem(`${COURSE_PROGRESS_KEY}:${courseProgressOwner}`);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) localCourses = parsed;
      } catch (error) {
        console.warn('[courses] unable to load local progress', error);
      }
      if (cancelled) return;

      if (profile) {
        // Map the backend profile into the presentation shape used by the app.
        const profileData = {
          ...(profile.data || {}),
          ...(localCourses.length ? { courses: localCourses } : {}),
          courseProgressOwner,
          easygoUserId: profile.id,
          walletAddress: profile.walletAddress || null,
        };
        setUser({
          id: profile.id,
          did: profile.privyDid || `privy:${profile.id}`,
          profile: {
            username: profile.displayName || profile.username || null,
            pfp: profile.pfp || null,
            description: profile.bio || profile.description || null,
            data: profileData,
          },
        });
        setUserData(profileData);
      } else if (privy?.isReady && privy?.user) {
        // Keep the app usable when the local backend is not running yet. The
        // backend profile replaces this minimal Privy shape as soon as sync wins.
        const fallbackData = {
          ...(localCourses.length ? { courses: localCourses } : {}),
          courseProgressOwner,
        };
        setUser((current) => current || {
          id: privy.user.id,
          did: `privy:${privy.user.id}`,
          profile: { username: null, pfp: null, description: null, data: fallbackData },
        });
        setUserData((current) => current || fallbackData);
      } else if (privy?.isReady && !privy?.user) {
        setUser(null);
        setUserData(null);
      }
    };

    syncPresentationState();
    return () => { cancelled = true; };
  }, [profile, privy?.isReady, privy?.user]);

  return null;
}

function FullStartupSignal({ onStartupStatus }) {
  const privy = usePrivy();
  const readyRef = useRef(Boolean(privy?.isReady));
  readyRef.current = Boolean(privy?.isReady);

  useEffect(() => {
    let active = true;
    void (async () => {
      await onStartupStatus?.({ step: 'full-provider-child', status: 'passed' });
      if (active) {
        await onStartupStatus?.({
          step: 'full-provider-ready',
          status: readyRef.current ? 'passed' : 'pending',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [onStartupStatus]);

  useEffect(() => {
    if (privy?.isReady) {
      onStartupStatus?.({ step: 'full-provider-ready', status: 'passed' });
    }
  }, [onStartupStatus, privy?.isReady]);

  return null;
}

function EasyGoPrivyBoundary({ alreadyMounted, children }) {
  if (alreadyMounted) return children;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      client={getEasyGoPrivyClient()}
      clientId={PRIVY_CLIENT_ID}
      config={EASYGO_PRIVY_CONFIG}
      storage={easyGoPrivyStorage}
      supportedChains={[EASYGO_BASE_CHAIN]}
    >
      {children}
    </PrivyProvider>
  );
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[startup] unable to retain splash screen', error);
});

let callbackPostShared;
let page = 0;
export default function App({ onStartupStatus, privyAlreadyMounted = false }) {
  return (
    <StartupErrorBoundary>
      <EasyGoApp
        onStartupStatus={onStartupStatus}
        privyAlreadyMounted={privyAlreadyMounted}
      />
    </StartupErrorBoundary>
  );
}

function EasyGoApp({ onStartupStatus, privyAlreadyMounted }) {
  const missingPrivyEnv = collectMissingPrivyEnvVars();
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
  const [nicknameVis, setNicknameVis] = useState(false)
  const [connectType, setConnectType] = useState('')
  const [connectModalVis, setConnectModalVis] = useState(false);

  const [listBlockedUser, setListBlockedUser] = useState(null)
  const [listHiddenPost, setListHiddenPost] = useState(null)
  const [listMutedUsers, setListMutedUsers] = useState(null)

  const [listAccount, setListAccount] = useState([])

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState(SOCIAL_CATEGORIES);
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
  const [newGiftsCount, setNewGiftsCount] = useState(false)

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
    inputRange: [50, Platform.OS == 'ios' ? 170 : 120],
    outputRange: [0, Platform.OS == 'ios' ? -170 : -150],
    extrapolate: 'clamp'
  });
  
  /** Load fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansMedium_ios.ttf') : require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium_ios.ttf'),
    'GmarketBold': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansBold_ios.ttf') : require('./assets/fonts/GmarketSansBold.ttf'),
  });

  useEffect(() => {
    if (!user) return;
    setSwitchLoading(false);
    setSettingsVis(false);
    setSwitchAccountVis(false);
    modalSwitchRef.current?.close();
  }, [user]);


    const onLayoutRootView = useCallback(async () => {
        if (isLayoutReady) {
            try {
                await SplashScreen.hideAsync();
            } catch (error) {
                console.warn('[startup] unable to hide splash screen', error);
            }
        }
    }, [isLayoutReady]);
    

  useEffect(() => {
    const loadLocalList = async (key, setter) => {
      try {
        const stored = await AsyncStorage.getItem(key);
        const parsed = stored ? JSON.parse(stored) : [];
        setter(Array.isArray(parsed) ? parsed : []);
      } catch {
        setter([]);
      }
    };

    Promise.all([
      loadLocalList('list_blocked_user', setListBlockedUser),
      loadLocalList('list_hidden_post', setListHiddenPost),
      loadLocalList('list_muted_users', setListMutedUsers),
    ]).finally(() => {
      setCategories(SOCIAL_CATEGORIES);
      setIsLayoutReady(true);
    });
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
                        break;

                    /** Open post pane for mentions */
                    case "mention":
                        hideModals();
                        setPostDetailsVis(data.post_id);
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
        // Legacy OAuth callback URLs are no longer authentication inputs.
        // Privy owns OAuth state and token exchange inside screens/Login.js.
        if (Platform.OS === 'ios') await WebBrowser.dismissBrowser();
        console.warn('[auth] ignored legacy google-auth callback; use Privy login instead');
        setLoading(false);
    }

    function hideModals() {
        translateY.value = 0;
        setShareProfileVis(false);
        setPostDetailsVis(null);
        setProfileSelected(null);
    }

    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        // Screen feeds own their server state through useFeed/usePosts.
        setRefreshing(false);
    }

    /** This will load more posts and add those to the current list */
    async function loadMorePosts() {
        setRefreshingBottom(false);
    }

    /** Load all categories / contexts under the global context */
    async function loadContexts() {
        setCategories(SOCIAL_CATEGORIES);
    }

    const onRefresh = useCallback(async () => {
        setRefreshing(false);
    }, []);

    async function callbackConnect(detailUser) {

        console.log('CALLBACK CONNECT');
        console.log(detailUser);
        
        if(connectType == "signup"){
            handleModalNicknamePress()
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

    if (missingPrivyEnv.length > 0) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.configContainer}>
                    <Text style={styles.brand}>EasyGo</Text>
                    <Text style={styles.configCode}>{STARTUP_CONFIG_CODE}</Text>
                    <Text style={styles.configTitle}>필수 환경변수가 설정되지 않았습니다.</Text>
                    <Text style={styles.configText}>
                        앱이 즉시 종료되지 않도록 부팅을 중단했습니다. 아래 값이 현재 EAS 빌드 환경과 앱 번들에 포함되어야 합니다.
                    </Text>
                    <Text style={styles.configBullets}>- {missingPrivyEnv.join('\n- ')}</Text>
                </View>
            </SafeAreaView>
        );
    }


    /** Wait for app to be ready before rendering it */
    if (!isLayoutReady) {
        return null;
    }

    return (
        <EasyGoPrivyBoundary alreadyMounted={privyAlreadyMounted}>
        <>
            <StatusBar translucent={true} backgroundColor="#00000000" style="black"/>
            <GestureHandlerRootView onLayout={onLayoutRootView} style={{width: "100%", height: "100%"}}>
                <GlobalContext.Provider value={{ 
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
                        newGiftsCount, setNewGiftsCount,
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
                    <FullStartupSignal onStartupStatus={onStartupStatus} />
                    <AuthBridge />

                    <TailwindProvider utilities={utilities}>
                        {user ? (
                            <>
                                <AppNavigator />

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

                                {addressCopied && (
                                    <View style={{backgroundColor: 'rgba(0,0,0,0.5)',width: '100%', height: '100%',position: 'absolute',justifyContent:'center',alignItems:'center',}}>
                                        <Image
                                            style={{width: 150, height: 150,alignSelf:'center',}}
                                            resizeMode='contain'
                                            source={require('./assets/link_copied.png')}
                                        />
                                    </View>
                                )}
                            </>
                        ) : (
                            <Login />
                        )}

                        {/* <Confetti confetti={confetti}/> */}
                    </TailwindProvider>
                </GlobalContext.Provider>
            </GestureHandlerRootView>
        </>
      </EasyGoPrivyBoundary>
    );
}

const Confetti = ({confetti}) => {
    return(
        <ConfettiCannon fadeOut={true} fallSpeed={2500} count={150} origin={{x: -400, y: 0}} autoStart={false} ref={confetti} />
    )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  configContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  brand: {
    color: '#FF6813',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 12,
  },
  configCode: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  configTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  configText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  configBullets: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'left',
  },
});
