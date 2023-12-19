import './utils/polyfill';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Keyboard, Platform, Animated } from 'react-native';

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
import PostPane from "./components/panes/PostPane";
import AppNavigator from './navigation/AppNavigator';
import { GlobalContext } from "./contexts/GlobalContext";
import RepostModal from "./components/modals/RepostModal";
import ConnectModal from "./components/modals/ConnectModal";
import PostboxModal from "./components/modals/PostboxModal";
import SettingsModal from "./components/modals/SettingsModal";
import NotificationsPane from "./components/panes/NotificationsPane";
import PostSettingsModal from "./components/modals/PostSettingsModal";
import UpdateProfileModal from "./components/modals/UpdateProfileModal";
import { context, onboard_context, edu_context } from './utils/config.js';
import PushNotificationsModal from "./components/modals/PushNotificationsModal";

/** Expo */
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';


/** Import Orbis SDK */
import { Orbis } from "@orbisclub/orbis-sdk";

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
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [previousScreen, setPreviousScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [repost, setRepost] = useState(false);
  const [postDetailsVis, setPostDetailsVis] = useState();
  const [updateProfileVis, setUpdateProfileVis] = useState(false);
  const [pushNotifsVis, setPushNotifsVis] = useState(false);
  const [settingsVis, setSettingsVis] = useState(false);
  const [postSettingsModalVis, setPostSettingsModalVis] = useState(false);
  const [postboxVis, setPostboxVis] = useState(false);
  const [replyTo, setReplyTo] = useState();
  const [editedPost, setEditedPost] = useState();
  const [quotedPost, setQuotedPost] = useState();
  const [shareProfileVis, setShareProfileVis] = useState(false);
  const [notificationsVis, setNotificationsVis] = useState(false);

  const [listBlockedUser, setListBlockedUser] = useState(null)
//   const [listFollowers, setListFollowers] = useState([])

  const confetti = useRef();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBottom, setRefreshingBottom] = useState(false);
  const [profileSelected, setProfileSelected] = useState();
  const [isReady, setIsReady] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const url = Linking.useURL();
  const responseListener = useRef();
  const homeFeedRef = useRef();
  const categoryFeedRef = useRef();
  const newsFeedRef = useRef();
  const translateY = useSharedValue(0);

  const [categoryPosts, setCategoryPosts] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [newsPosts, setNewsPosts] = useState(null)
  const [selectedNews, setSelectedNews] = useState(null)
  const [currentRoute, setCurrentRoute] = useState(null)

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
    'GmarketMediumV2': require('./assets/fonts/GmarketSansMedium_V2.ttf'),
    'GmarketBold': require('./assets/fonts/GmarketSansBold.otf'),
  });

  useEffect(() => {
    saveUserInStorage();

    async function saveUserInStorage() {
      if(user) {
        await AsyncStorage.setItem("user-connected", user.did);
      }
    }
  }, [user]);

  const onLayoutRootView = useCallback(async () => {
   if (isReady) {
     await SplashScreen.hideAsync();
   }
 }, [isReady]);

  /** Will check if user is connected on load to automatically re-connect user */
  useEffect(() => {
    connect();
    loadContexts();
    fecthBlockedUser()

    /** Will re-connect automatically the user to the account found in local storage */
    async function connect() {
      /** Check if user exists in local storage */
      let _userDid = await AsyncStorage.getItem("user-connected");
      console.log("User connected is:", _userDid);
      if(_userDid) {
        setUser({did: _userDid})
      }
      setIsReady(true);

      /** Retrieve user details */
      let res = await orbis.isConnected();
      if(res.status == 200) {
        setUser(res.details);
      }
    }

    // Will fetch all blocked user
    async function fecthBlockedUser() {
      /** Check if user exists in local storage */

    //   await AsyncStorage.removeItem("list_blocked_user");


      let temp_list = await AsyncStorage.getItem("list_blocked_user");
      const list_blocked_user = JSON.parse(temp_list)

      if(list_blocked_user) {
        setListBlockedUser([...list_blocked_user])
      }
    }
  }, []);

  useEffect(() => {
    page = 0;
    loadPosts();
  }, [category]);


  /** Will be triggered when a user is blocked */
  useEffect(() => {
    loadPosts();
  }, [listBlockedUser]);

  /** Will be triggered when a new deeplink is received */
  useEffect(() => {
    if (url) {
      handleURL(url);
    }
  }, [url]);

  /** Handle notifications received, will open right screen or pane based on the notification received */
  useEffect(() => {
   responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
     try {
       //console.log("response:", response);
       let data = response.notification?.request?.content?.data;
       console.log("Enter addNotificationResponseReceivedListener:", data);

       switch (data?.type) {
         /** Open post pane for reactions */
         case "reaction":
           console.log("Open post id:" + data.post_id);
           hideModals();
           setPostDetailsVis(data.post_id);
           break;
         /** Open post pane for replies */
         case "reply":
           console.log("Open post id:" + data.post_id);
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
           console.log("Open post id:" + data.post_id);
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
    console.log("Enter handleURL with:", url);
    const { path, queryParams } = Linking.parse(url);
    console.log("queryParams:", queryParams);
    console.log("path:", path);
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
        if(Platform.OS === 'ios') {
          WebBrowser.dismissBrowser();
        }

        //setLoading(true);
        console.log("Connecting with Google with token:" + token);
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
          console.log("url:", url);
          if(url.includes("google-auth")) {
            console.log("URL contains google-auth")
            token = queryParams.token;
            console.log("token:", token);
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
    console.log("Enter googleConnect with:", token);
    let resUser = await orbis.connect_v2({
       provider: "oauth",
       oauth: {
         type: "google",
         token: token
       }
     });
     console.log("resUser:", resUser);

     if(resUser.status == 200) {
       setUser(resUser.details);
       AsyncStorage.setItem("provider-type", "google");
       callbackConnect();
     } else {
       //setLoading(false);
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
    console.log("_contexts:", _contexts);
    let { data } = await orbis.getPosts({
      contexts: category ? [category.stream_id] : _contexts,
      include_child_contexts: true
    });
    // console.log(data?.map(e => {
    //     if(e.repost_details?.content != null){
    //         console.log('LAAAAAAAAA');
    //         console.log(e);
    //     }
    // }));
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }

  /** This will load more posts and add those to the current list */
  async function loadMorePosts() {
    console.log("Enter loadMorePosts() with page:", page);
    if(refreshingBottom) {
      console.log("Already refreshing.");
      return;
    }
    if (posts.length % 50 === 0) {
      setRefreshingBottom(true);
      page++;
      console.log("Enter loadMorePosts with page:", page);
      let { data } = await orbis.getPosts(
        {
          contexts: category ? [category.stream_id] : [context, onboard_context, edu_context],
          include_child_contexts: true
        },
        page
      );

      let _posts = [...posts, ...data];
      setRefreshingBottom(false);
      setPosts(_posts);
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
    console.log("Data loaded.");
    if(error) {
      console.log("Error getPosts:", error);
    }
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }, [category]);

  async function callbackConnect() {
    setPushNotifsVis(true);
  }

  /** Show postbox while saving the callback function */
  function showPostbox(callback) {
    console.log("Enter showPostbox with:", callback);
    if(callback) {
      callbackPostShared = callback;
    } else {
      callbackPostShared = defaultCallbackPostShared;
    }

    setPostboxVis(true);
    Haptics.selectionAsync();
  }

  function hidePostbox() {
    setPostboxVis(false);
    setRepost(false);
    setReplyTo(null);
    setEditedPost(null);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  /** Will be called when a new post is being shared */
  function defaultCallbackPostShared(_post) {
    console.log("Enter defaultCallbackPostShared:", _post);
    let _posts = [_post, ...posts];
    setPosts(_posts);
    setPostboxVis(false);
    setRepost(false);
    setReplyTo(null);
    Keyboard.dismiss();
    Haptics.selectionAsync();
  }

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
  if(!fontsLoaded) {
    return null
  }

  /** Wait for app to be ready before rendering it */
  if (!isReady) {
    return null;
  }

  return (
    <>
      <StatusBar translucent={true} backgroundColor="#00000000" style="light"/>
      <View onLayout={onLayoutRootView} style={{width: "100%", height: "100%"}}>
        <GlobalContext.Provider value={{ 
                user,
                setUser,
                updateProfileVis,
                setUpdateProfileVis,
                screen,
                setScreen,
                profileSelected,
                setProfileSelected,
                userConnecting,
                setUserConnecting,
                orbis,
                showConnectModal,
                setShowConnectModal,
                confetti,
                repost,
                setRepost,
                postDetailsVis,
                setPostDetailsVis,
                posts,
                setPosts,
                refreshing,
                refreshingBottom,
                onRefresh,
                loadPosts,
                loadMorePosts,
                categories,
                loadContexts,
                callbackConnect,
                pushNotifsVis,
                setPushNotifsVis,
                postboxVis,
                showPostbox,
                hidePostbox,
                callbackPostShared,
                replyTo,
                setReplyTo,
                setSettingsVis,
                setShareProfileVis,
                category,
                setCategory,
                setNotificationsVis,
                scrolled,
                setScrolled,
                homeFeedRef,
                categoryFeedRef,
                newsFeedRef,
                scrollToTop,
                translateY,
                setPostSettingsModalVis,
                editedPost,
                setEditedPost,
                previousScreen,
                setPreviousScreen,
                scrollAnim,
                offsetAnim,
                setClampedScroll,
                navbarTranslate,
                setOffsetAnim,
                setScrollAnim,
                setRefreshing,
                categoryPosts, 
                setCategoryPosts,
                selectedCategory, 
                setSelectedCategory,
                newsPosts, 
                setNewsPosts,
                selectedNews, 
                setSelectedNews,
                currentRoute,
                setCurrentRoute,
                listBlockedUser,
                setListBlockedUser,
                // listFollowers,
                // setListFollowers
            }}
        >
          <TailwindProvider utilities={utilities}>
            {user ?
              <AppNavigator />
            :
              <Login />
            }

            {/** Show selected post details in a pane */}
            {/* {postDetailsVis != null &&
              <PostPane />
            } */}

            {/** Display connect modal if user clicked on connect button */}
            {showConnectModal &&
              <ConnectModal />
            }

            {/** Display the edit profile details modal */}
            {updateProfileVis &&
              <UpdateProfileModal />
            }

            {/** Display push notifications pane */}
            {pushNotifsVis &&
              <PushNotificationsModal />
            }

            {/** Render repost modal */}
            {repost !== false &&
              <RepostModal />
            }

            {/** Share post container */}
            {postboxVis &&
              <PostboxModal />
            }

            {/** Settings container */}
            {settingsVis &&
              <SettingsModal />
            }

            {/** Show post settings modal */}
            {editedPost != null &&
              <PostSettingsModal />
            }

            {/** QR modal container */}
            {shareProfileVis &&
              <QR hide={() => setShareProfileVis(false)} />
            }

            {/** Show notifications pane */}
            {notificationsVis &&
              <NotificationsPane />
            }

            <Confetti confetti={confetti}/>
          </TailwindProvider>
        </GlobalContext.Provider>
      </View>
    </>
  );
}

const Confetti = ({confetti}) => {
  return(
      <ConfettiCannon fadeOut={true} fallSpeed={2500} count={150} origin={{x: -400, y: 0}} autoStart={false} ref={confetti} />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
