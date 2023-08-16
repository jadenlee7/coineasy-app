import '@orbisclub/orbis-sdk/utils/polyfills_light_crypto';
import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Keyboard } from 'react-native';
import { TailwindProvider, useTailwind } from 'tailwind-rn';
import utilities from './tailwind.json';
import { context } from './utils/config.js';

/** Profile */
import Home from "./screens/Home";
import Categories from "./screens/Categories";
import News from "./screens/News";
import Profile from "./screens/Profile";
import Login from "./screens/Login";

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalContext } from "./contexts/GlobalContext";

import ConnectModal from "./components/modals/ConnectModal";
import UpdateProfileModal from "./components/modals/UpdateProfileModal";
import PushNotificationsModal from "./components/modals/PushNotificationsModal";
import RepostModal from "./components/modals/RepostModal";
import PostboxModal from "./components/modals/PostboxModal";
import SettingsModal from "./components/modals/SettingsModal";
import PostPane from "./components/panes/PostPane";
import ProfilePane from "./components/panes/ProfilePane";
import QR from "./components/modals/QR.js";

import Navigation from "./components/Navigation";
import Header from "./components/Header";
import Modal from "./components/Modal";
import Postbox from "./components/Postbox";
import ConfettiCannon from 'react-native-confetti-cannon';

/** Expo */
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';


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

let callbackPostShared;
let page = 0;
export default function App() {
  const [user, setUser] = useState();
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [repost, setRepost] = useState(false);
  const [postDetailsVis, setPostDetailsVis] = useState();
  const [updateProfileVis, setUpdateProfileVis] = useState(false);
  const [pushNotifsVis, setPushNotifsVis] = useState(false);
  const [settingsVis, setSettingsVis] = useState(false);
  const [postboxVis, setPostboxVis] = useState(false);
  const [replyTo, setReplyTo] = useState();
  const [quotedPost, setQuotedPost] = useState();
  const [shareProfileVis, setShareProfileVis] = useState(false);

  const confetti = useRef();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBottom, setRefreshingBottom] = useState(false);
  const [profileSelected, setProfileSelected] = useState();
  const url = Linking.useURL();
  const responseListener = useRef();

  /** Load fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketBold': require('./assets/fonts/GmarketSansBold.otf'),
  });

  /** Will check if user is connected on load to automatically re-connect user */
  useEffect(() => {
    connect();
    loadContexts();
    //logout();

    /** Will re-connect automatically the user to the account found in local storage */
    async function connect() {
      let res = await orbis.isConnected();
      if(res.status == 200) {
        setUser(res.details);
      }
    }
    async function logout() {
      let res = await orbis.logout();
    }
  }, []);

  useEffect(() => {
    page = 0;
    loadPosts();
  }, [category]);

  /** Will be triggered when a new deeplink is received */
  useEffect(() => {
    if (url) {
      handleURL(url);
    }
  }, [url]);

  /** Handle notifications received, will open right screen or pane based on the notification received */
  useEffect(() => {
   responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
     //console.log("response:", response);
     let data = response.notification?.request?.content?.data;

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
         setPostDetailsVis(data.post_id);
         break;
       default:

     }
   });

   return () => {
     Notifications.removeNotificationSubscription(responseListener.current);
   };
 }, []);

  async function handleURL(url) {
    const { path, queryParams } = Linking.parse(url);
    console.log("queryParams:", queryParams);
    console.log("path:", path);

    switch (path) {
      case "user":
        setProfileSelected(queryParams.did);
        setScreen("profile");
        hideModals();
        break;
      default:

    }
  }

  function hideModals() {
    setShareProfileVis(false);
  }

  /** Will retrieve all posts shared in the global context */
  async function loadPosts() {
    setPosts([]);
    setRefreshing(true);
    let { data } = await orbis.getPosts({
      context: category ? category.stream_id : context,
      include_child_contexts: true
    });
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }

  /** This will load more posts and add those to the current list */
  async function loadMorePosts() {
    if(refreshingBottom) {
      console.log("Already refreshing.");
      return;
    }
    if (posts.length % 50 === 0) {
      setRefreshingBottom(true);
      console.log("Enter loadMorePosts with page:", page + 1);
      let { data } = await orbis.getPosts(
        {
          context: category ? category.stream_id : context,
          include_child_contexts: true
        },
        page
      );
      page++;
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
    let { data } = await orbis.getPosts({
      context: category ? category.stream_id : context,
      include_child_contexts: true
    });
    console.log("Data loaded.");
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
    setReplyTo(false);
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
    Keyboard.dismiss();
    Haptics.selectionAsync();
  }

  /** Wait for fonts to be loaded before rendering the app */
  if(!fontsLoaded) {
    return null
  }

  return (
    <GlobalContext.Provider value={{ user, setUser, updateProfileVis, setUpdateProfileVis, screen, setScreen, profileSelected, setProfileSelected, userConnecting, setUserConnecting, orbis, showConnectModal, setShowConnectModal, confetti, repost, setRepost, postDetailsVis, setPostDetailsVis, posts, setPosts, refreshing, refreshingBottom, onRefresh, loadPosts, loadMorePosts, categories, loadContexts, callbackConnect, pushNotifsVis, setPushNotifsVis, postboxVis, showPostbox, hidePostbox, callbackPostShared, replyTo, setReplyTo, setSettingsVis, setShareProfileVis, category, setCategory }}>
      <TailwindProvider utilities={utilities}>
        {user ?
          <>
            <Header />
            <ActiveScreen />
            <Navigation />
          </>
        :
          <Login />
        }

        {/** Show selected post details in a pane */}
        {postDetailsVis != null &&
          <PostPane />
        }

        {/** Show user profile selected */}
        {profileSelected &&
          <ProfilePane did={profileSelected} />
        }

        {/** Display connect modal if user clicked on connect button */}
        {showConnectModal &&
          <ConnectModal />
        }

        {/** Display the edit profile details modal */}
        {updateProfileVis &&
          <UpdateProfileModal />
        }

        {/** Display Push notifications visibility */}
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

        {/** QR modal container */}
        {shareProfileVis &&
          <QR hide={() => setShareProfileVis(false)} />
        }

        <Confetti confetti={confetti}/>
      </TailwindProvider>
    </GlobalContext.Provider>
  );
}

/** Display active screen */
const ActiveScreen = () => {
  const { screen, setScreen, profileSelected } = useContext(GlobalContext);
  switch (screen) {
    case "home":
      return(
        <Home />
      );
    case "categories":
      return(
        <Categories />
      );
    case "news":
      return(
        <News />
      );
    case "profile":
      return(
        <Profile />
      );
    default:
      return;
  }
}

const Confetti = ({confetti}) => {
  const tailwind = useTailwind();

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
