// App.js (refactorisé / optimisé)
import './utils/polyfill';
import 'react-native-reanimated';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StyleSheet, View, Keyboard, Platform, Animated, Image } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { TailwindProvider } from 'tailwind-rn';
import * as SplashScreen from 'expo-splash-screen';
import { useSharedValue } from 'react-native-reanimated';
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

/** Expo */
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';

/** Orbis SDK */
import { Orbis } from "@orbisclub/orbis-sdk";
import moment from 'moment';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ClaimOrangesModal from './components/modals/ClaimOrangesModal';

/** Initialize the Orbis class object (singleton) */
export const orbis = new Orbis({
  useLit: false,
  store: AsyncStorage,
  storeAsync: true,
  litCloud: true,
  PINATA_GATEWAY: 'https://orbis.mypinata.cloud/ipfs/',
  PINATA_API_KEY: '194337be204670686a63',
  PINATA_SECRET_API_KEY: "d69ee5685fec8cd9012e9e02d28c6d017d22770de68c703f72eb368537b609bf"
});

SplashScreen.preventAutoHideAsync();

let callbackPostShared; // still used across Postbox flow

export default function App() {
  /** ---------- Refs ---------- */
  const pageRef = useRef(0);
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

  /** ---------- States ---------- */
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [previousScreen, setPreviousScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [repost, setRepost] = useState(false);
  const [postDetailsVis, setPostDetailsVis] = useState(null);
  const [updateProfileVis, setUpdateProfileVis] = useState(false);
  const [pushNotifsVis, setPushNotifsVis] = useState(false);
  const [newFeatureVis, setNewFeatureVis] = useState(false);
  const [newFeatureAlertVis, setNewFeatureAlertVis] = useState(false);
  const [showClaimOranges, setShowClaimOranges] = useState(false);
  const [todayOranges, setTodayOranges] = useState(Math.floor(Math.random() * (20 - 5) + 5));
  const [settingsVis, setSettingsVis] = useState(false);
  const [switchAccountVis, setSwitchAccountVis] = useState(false);
  const [adAlreadyClaimed, setAdAlreadyClaimed] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const [switchLoading, setSwitchLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [postSettingsModalVis, setPostSettingsModalVis] = useState(false);
  const [postboxVis, setPostboxVis] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editedPost, setEditedPost] = useState(null);
  const [shareProfileVis, setShareProfileVis] = useState(false);
  const [showImageSender, setShowImageSender] = useState(null);
  const [listMessages, setListMessages] = useState([]);
  const [notificationsVis, setNotificationsVis] = useState(false);
  const [nicknameVis, setNicknameVis] = useState(false);
  const [connectType, setConnectType] = useState('');
  const [connectModalVis, setConnectModalVis] = useState(false);

  const [listBlockedUser, setListBlockedUser] = useState(null);
  const [listHiddenPost, setListHiddenPost] = useState(null);
  const [listMutedUsers, setListMutedUsers] = useState(null);

  const [listAccount, setListAccount] = useState([]);
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBottom, setRefreshingBottom] = useState(false);
  const [profileSelected, setProfileSelected] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const translateY = useSharedValue(0);
  const url = Linking.useURL();

  const [categoriesVis, setCategoriesVis] = useState(false);
  const [showReportBack, setShowReportBack] = useState(false);
  const [activityClaim, setActivityClaim] = useState(false);
  const [inviteClaim, setInviteClaim] = useState(false);

  const [categoryPosts, setCategoryPosts] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newsPosts, setNewsPosts] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);

  const [tabViewHeight, setTabViewHeight] = useState(500);

  const { provider } = useWalletConnectModal();

  const [scrollAnim] = useState(new Animated.Value(0));
  const [offsetAnim] = useState(new Animated.Value(0));
  const [clampedScroll] = useState(Animated.diffClamp(
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
    inputRange: [50, Platform.OS === 'ios' ? 170 : 150],
    outputRange: [0, Platform.OS === 'ios' ? -170 : -150],
    extrapolate: 'clamp'
  });

  /** Fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansMedium_ios.ttf') : require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium_ios.ttf'),
    'GmarketBold': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansBold_ios.ttf') : require('./assets/fonts/GmarketSansBold.ttf'),
  });

  /** ---------- Helpers ---------- */

  // Wrap Image.getSize into a Promise so we can await it
  const getImageSizeAsync = (uri) => {
    return new Promise((resolve) => {
      if (!uri) return resolve(null);
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null) // onError resolve null (prevents unhandled rejection)
      );
    });
  };

  // Process a single post's media => set width/height properties consistently
  const processPostMedia = async (post) => {
    if (!post?.content?.media?.length) return post;

    // media can be array of objects or nested arrays (the original code handled both)
    const media = post.content.media;
    const processed = await Promise.all(media.map(async (elt) => {
      // elt may be object with url or array-like
      if (elt?.url) {
        const size = await getImageSizeAsync(elt.url);
        if (size) { elt.width = size.width; elt.height = size.height; }
        return elt;
      } else if (Array.isArray(elt) && elt[0]?.url) {
        const size = await getImageSizeAsync(elt[0].url);
        if (size) { elt[0].width = size.width; elt[0].height = size.height; }
        return elt;
      } else {
        return elt;
      }
    }));

    post.content.media = processed;
    return post;
  };

  // Process an array of posts' media in parallel then return processed posts
  const processPostsMedia = async (postsArray = []) => {
    if (!postsArray || postsArray.length === 0) return postsArray;
    const processed = await Promise.all(postsArray.map(processPostMedia));
    return processed;
  };

  /** ---------- Core actions (useCallback to maintain stable references) ---------- */

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  const hideModals = useCallback(() => {
    translateY.value = 0;
    setShareProfileVis(false);
    setPostDetailsVis(null);
    setProfileSelected(null);
  }, [translateY]);

  // load categories / contexts
  const loadContexts = useCallback(async () => {
    try {
      const { data } = await orbis.api.from("orbis_contexts").select().eq('context', context).order('created_at', { ascending: false });
      setCategories(data || []);
    } catch (e) {
      console.warn("loadContexts error", e);
    }
  }, []);

  // load posts (first page)
  const loadPosts = useCallback(async () => {
    try {
      setRefreshing(true);
      pageRef.current = 0;
      const _contexts = category ? [category.stream_id] : [context, onboard_context, edu_context];

      const { data } = await orbis.getPosts({
        contexts: _contexts,
        include_child_contexts: true
      });
      setRefreshing(false);

      if (data && data.length) {
        const processed = await processPostsMedia(data);
        setPosts(processed);
      } else {
        setPosts([]);
      }
      setRefreshing(false);
    } catch (e) {
      setRefreshing(false);
      console.error("loadPosts error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [category]);

  // load more posts (pagination)
  const loadMorePosts = useCallback(async () => {
    try {
      if (refreshingBottom) return;
      // guard: only allow next page if current posts length indicates more pages
      // (original logic used posts.length % 50 === 0)
      if (posts.length % 50 !== 0) {
        console.log("Reached the end.");
        return;
      }

      setRefreshingBottom(true);
      pageRef.current = (pageRef.current || 0) + 1;

      const res = await orbis.getPosts({
        contexts: category ? [category.stream_id] : [context, onboard_context, edu_context],
        include_child_contexts: true
      }, pageRef.current);
      setRefreshingBottom(false);

      if (res?.data && res.data.length) {
        const processed = await processPostsMedia(res.data);
        setPosts(prev => [...prev, ...processed]);
      }
    } catch (e) {
      setRefreshingBottom(false);
      console.error("loadMorePosts error", e);
    } finally {
      setRefreshingBottom(false);
    }
  }, [category, posts.length, refreshingBottom]);

  const onRefresh = useCallback(async () => {
    pageRef.current = 0;
    setRefreshing(true);
    try {
      const { data } = await orbis.getPosts({
        contexts: category ? [category.stream_id] : [context, onboard_context, edu_context],
        include_child_contexts: true
      });
      setRefreshing(false);
      if (data) {
        const processed = await processPostsMedia(data);
        setPosts(processed);
      }
      setRefreshing(false);
    } catch (e) {
      console.error("onRefresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [category]);

  // callback after connect/signup flows
  const callbackConnect = useCallback(async (detailUser) => {
    try {
      if (connectType === "signup") {
        // show nickname modal
        modalNicknameRef.current?.present?.();
        if (detailUser?.profile) {
          detailUser.profile.data = detailUser.profile.data || {};
          detailUser.profile.data.alreadyLogin = true;
          await orbis.updateProfile(detailUser.profile);
        }
        setLoading(false);
        return;
      }

      // default post sign-in UX
      const showNotificationDate = await AsyncStorage.getItem("showNotificationDate");
      const showNewFeatureDate = await AsyncStorage.getItem("showNewFeatureDate");

      if (moment().format('YYYY-MM-DD') >= (showNotificationDate || '0000-00-00')) {
        setPushNotifsVis(true);
      } else if (moment().format('YYYY-MM-DD') >= (showNewFeatureDate || '0000-00-00')) {
        setNewFeatureVis(true);
      }

      setLoading(false);
      setConnectModalVis(false);
    } catch (e) {
      console.error("callbackConnect error", e);
      setLoading(false);
    } finally {
      modalSwitchRef.current?.close?.();
    }
  }, [connectType]);

  // show postbox
  const showPostbox = useCallback((callback) => {
    callbackPostShared = callback ?? defaultCallbackPostShared;
    modalPostBoxRef.current?.present?.();
    Haptics.selectionAsync();
  }, []);

  const hidePostbox = useCallback(() => {
    modalPostBoxRef.current?.close?.();
    setRepost(false);
    setReplyTo(null);
    setEditedPost(null);
    Keyboard.dismiss();
    Haptics.selectionAsync();
  }, []);

  // default callback when a post is shared
  const defaultCallbackPostShared = useCallback(async (_post) => {
    setPosts(prev => [_post, ...prev]);

    const today = moment().format('YYYY-MM-DD');
    const tempData = userData ? { ...userData } : {};

    if (!tempData.todayActivities || tempData.todayActivities.date !== today) {
      tempData.todayActivities = { date: today, posts: 0, comments: 0, likes: 0 };
    }

    // Orange Reward logic simplified (same business logic you had)
    if (replyTo) {
      if (_post.content.body?.length >= 20 || _post.content.media || _post.content.body?.includes("http")) {
        tempData.todayActivities.comments = (tempData.todayActivities.comments || 0) + Math.min(1, 1);
      }
    } else {
      if (_post.content.body?.length >= 50 || _post.content.media || _post.content.body?.includes("http")) {
        tempData.todayActivities.posts = (tempData.todayActivities.posts || 0) + 1;
      }
    }

    setUserData({ ...tempData });

    // update orbis profile
    try {
      if (user?.profile) {
        const tempProfile = { ...user.profile, data: tempData };
        await orbis.updateProfile(tempProfile);
      }
    } catch (e) {
      console.warn("updateProfile error:", e);
    }

    hidePostbox();
  }, [replyTo, user, userData, hidePostbox]);

  // scrollToTop
  const scrollToTop = useCallback(() => {
    if (homeFeedRef?.current?.scrollToOffset) {
      homeFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
    } else if (categoryFeedRef?.current?.scrollToOffset) {
      categoryFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
    } else if (newsFeedRef?.current?.scrollToOffset) {
      newsFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
    }
  }, []);

  /** ---------- Mount effects ---------- */

  // Save user in storage when user changes
  useEffect(() => {
    async function saveUserInStorage() {
      if (!user) {
        // logout flow
        try {
          await orbis.logout();
        } catch (e) {
          console.warn("orbis.logout error", e);
        }
        try {
          await provider?.disconnect();
        } catch (e) {
          // ignore
        } finally {
          setUser(null);
          setUserData(null);
          modalSwitchRef.current?.close?.();
        }
        return;
      }

      try {
        // ensure profile fetch if incomplete
        if (!user?.profile || !user?.profile?.username) {
          const { data } = await orbis.getProfile(user.did);
          user.profile = data?.details?.profile || user.profile;
        }

        const listDidRaw = await AsyncStorage.getItem("user-connected");
        const currentCeramicSession = await AsyncStorage.getItem("ceramic-session");
        let listConnected = [];
        if (listDidRaw && listDidRaw.charAt(0) === '[') {
          listConnected = JSON.parse(listDidRaw);
        }

        const indexUser = listConnected?.findIndex(e => e.user?.did === user.did);
        const entry = { user, time: moment().format('YYYY-MM-DD HH:mm:ss'), ceramicSession: currentCeramicSession };

        if (indexUser != -1) {
          listConnected[indexUser] = { ...listConnected[indexUser], ...entry };
        } else {
          listConnected.unshift(entry);
        }

        await AsyncStorage.setItem("user-connected", JSON.stringify(listConnected));

        // restore orbis session
        if (indexUser != -1 && listConnected[indexUser]?.ceramicSession) {
          await orbis.isConnected(listConnected[indexUser].ceramicSession);
        } else if (currentCeramicSession) {
          await orbis.isConnected(currentCeramicSession);
        } else {
          await orbis.isConnected();
        }

        setListAccount([...listConnected]);
        setSwitchLoading(false);
        setSettingsVis(false);
        setSwitchAccountVis(false);
        modalSwitchRef.current?.close?.();
      } catch (e) {
        console.error("saveUserInStorage error", e);
      }
    }

    saveUserInStorage();
  }, [user, provider]);

  // initial boot: reconnect, load contexts, fetch local lists
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        // connect logic (restore last user)
        const _userDid = await AsyncStorage.getItem("user-connected");
        let listDid = [];
        if (_userDid && _userDid.charAt(0) === '[') {
          listDid = JSON.parse(_userDid);
        } else if (_userDid) {
          // invalid format stored: clear it
          await AsyncStorage.removeItem("user-connected");
        }

        if (listDid && listDid.length > 0) {
          if (listDid.length > 1) listDid.sort((a, b) => (a.time < b.time ? 1 : -1));
          const p = listDid[0];
          const { data } = await orbis.getProfile(p?.user?.did);
          if (mounted) {
            setUser({ ...p.user });
            setUserData(data?.details?.profile?.data || p.user?.profile?.data || null);
            setIsReady(true);
          }
        } else {
          const res = await orbis.isConnected();
          if (res?.status === 200 && mounted) {
            setUser(res.details);
            setUserData(res.details.profile?.data);
          }
          if (mounted) setIsReady(true);
        }

        // local lists
        const tempBlocked = JSON.parse(await AsyncStorage.getItem("list_blocked_user") || "null");
        tempBlocked && setListBlockedUser(tempBlocked);

        const tempHidden = JSON.parse(await AsyncStorage.getItem("list_hidden_post") || "null");
        tempHidden && setListHiddenPost(tempHidden);

        const tempMuted = JSON.parse(await AsyncStorage.getItem("list_muted_users") || "null");
        tempMuted && setListMutedUsers(tempMuted);

        // load contexts in background
        await loadContexts();
      } catch (e) {
        console.error("boot error", e);
        if (mounted) setIsReady(true);
      }
    }

    boot();

    return () => { mounted = false; };
  }, [loadContexts]);

  // re-load posts when category changes
  useEffect(() => {
    pageRef.current = 0;
    loadPosts();
  }, [category, loadPosts]);

  // handle incoming deep links
  useEffect(() => {
    if (url) {
      (async () => {
        const { path, queryParams } = Linking.parse(url);
        try {
          if (path === "user") {
            setScreen("profile");
            setProfileSelected(queryParams.did);
            hideModals();
          } else if (path === "google-auth") {
            const token = queryParams.token;
            Platform.OS === 'ios' && WebBrowser.dismissBrowser();
            token && await googleConnect(token);
          } else {
            // fallback checks
            if (url.includes("google-auth")) {
              const token = Linking.parse(url).queryParams?.token;
              token && await googleConnect(token);
            } else if (url.includes("profile")) {
              setScreen("profile");
              setProfileSelected(queryParams.did);
              hideModals();
            }
          }
        } catch (e) {
          console.error("handleURL error", e);
        }
      })();
    }
  }, [url, hideModals]);

  // notifications response handler
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const data = response.notification?.request?.content?.data || {};
        switch (data?.type) {
          case "reaction":
            hideModals();
            setPostDetailsVis(data.post_id);
            break;
          case "reply":
          case "mention":
            hideModals();
            setPostDetailsVis(data.master ? data.master : data.post_id);
            await sleep(4000);
            if (feedRef?.current && data.master) {
              feedRef.current.scrollToItem?.({ animated: true, item: data.post_id });
            }
            break;
          default:
            break;
        }
      } catch (e) {
        console.error("Notification response handling error:", e);
      }
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [hideModals]);

  // Google connect helper (keeps existing logic)
  async function googleConnect(token) {
    setLoading(true);
    try {
      const resUser = await orbis.connect_v2({
        provider: "oauth",
        oauth: { type: "google", token }
      });

      if (resUser.status === 200) {
        const { data } = await orbis.getProfile(resUser.details.did);
        const profileData = data?.details?.profile?.data;
        setUser(resUser.details);
        setUserData(profileData || resUser.details.profile?.data);
        await AsyncStorage.setItem("provider-type", "google");
        setLoading(false);
        callbackConnect(resUser.details);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("googleConnect error:", e);
      setLoading(false);
    }
  }

  /** ---------- Memoized GlobalContext value ---------- */
  const globalContextValue = useMemo(() => ({
    orbis,
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
    scrolled: 0,
    setScrolled: () => {},
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
    setClampedScroll: () => {},
    setOffsetAnim: () => {},
    setScrollAnim: () => {},
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
  }), [
    categories, postboxVis, refreshingBottom, user, userData, posts, screen, repost,
    postSettingsModalVis, category, loading, listAccount, todayOranges, connectModalVis
  ]);

  /** ---------- Ready / fonts gating ---------- */
  if (!fontsLoaded) return null;
  if (!isReady) return null;

  return (
    <>
      <StatusBar translucent={true} backgroundColor="#00000000" style="black"/>
      <GestureHandlerRootView onLayout={onLayoutRootView} style={{width: "100%", height: "100%"}}>
        <GlobalContext.Provider value={globalContextValue}>
          <TailwindProvider utilities={utilities}>
            {user ? <AppNavigator /> : <Login />}

            <UpdateProfileModal />

            {pushNotifsVis && <PushNotificationsModal />}

            <NicknameModal />

            {repost !== false && <RepostModal />}

            <PostboxModal />

            <BottomSheetModalProvider>
              <BottomSheetModal
                ref={modalPostSettingsRef}
                index={1}
                snapPoints={showReportBack ? (Platform.OS === 'ios' ? ['87%','87%'] : ['95%','95%']) : ['50%','50%']}
                handleIndicatorStyle={{backgroundColor: 'black'}}
                handleStyle={{height: 40, justifyContent: 'center'}}
                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
              >
                <PostSettingsModal />
              </BottomSheetModal>
            </BottomSheetModalProvider>

            {shareProfileVis && <QR hide={() => setShareProfileVis(false)} />}

            {notificationsVis && <NotificationsPane />}

            {addressCopied && (
              <View style={{backgroundColor: 'rgba(0,0,0,0.5)',width: '100%', height: '100%',position: 'absolute',justifyContent:'center',alignItems:'center'}}>
                <Image
                  style={{width: 150, height: 150,alignSelf:'center'}}
                  resizeMode='contain'
                  source={require('./assets/link_copied.png')}
                />
              </View>
            )}
          </TailwindProvider>
        </GlobalContext.Provider>
      </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({});