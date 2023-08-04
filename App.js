import '@orbisclub/orbis-sdk/utils/polyfills_light_crypto';
import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
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

import Navigation from "./components/Navigation";
import Header from "./components/Header";
import Modal from "./components/Modal";
import ConfettiCannon from 'react-native-confetti-cannon';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';

/** Import Orbis SDK */
import { Orbis } from "@orbisclub/orbis-sdk";

/** Initialize the Orbis class object */
let orbis = new Orbis({
  useLit: false,
  store: AsyncStorage,
  storeAsync: true
});

export default function App() {
  const [user, setUser] = useState();
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [repostVis, setRepostVis] = useState(null);
  const [postDetailsVis, setPostDetailsVis] = useState();
  const [updateProfileVis, setUpdateProfileVis] = useState(false);

  const confetti = useRef();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [profileSelected, setProfileSelected] = useState();

  /** Load fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketBold': require('./assets/fonts/GmarketSansBold.otf'),
  });

  /** Will check if user is connected on load to automatically re-connect user */
  useEffect(() => {
    connect();
    loadPosts();
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

  /** Will retrieve all posts shared in the global context */
  async function loadPosts() {
    setRefreshing(true);
    let { data } = await orbis.getPosts({
      context: context
    });
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }

  /** Load all categories / contexts under the global context */
  async function loadContexts() {
    let { data, error } = await orbis.api.from("orbis_contexts").select().eq('context', context).order('created_at', { ascending: false });
    setCategories(data);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    let { data } = await orbis.getPosts({
      context: context
    });
    console.log("Data loaded.");
    if(data) {
      console.log(data.length + " posts retrieved.");
      setPosts(data);
    }
    setRefreshing(false);
  }, []);

  /** Wait for fonts to be loaded before rendering the app */
  if(!fontsLoaded) {
    return null
  }

  return (
    <GlobalContext.Provider value={{ user, setUser, updateProfileVis, setUpdateProfileVis, screen, setScreen, profileSelected, setProfileSelected, userConnecting, setUserConnecting, orbis, showConnectModal, setShowConnectModal, confetti, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis, posts, setPosts, refreshing, onRefresh, loadPosts, categories, loadContexts }}>
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


        {/** Display connect modal if user clicked on connect button */}
        {showConnectModal &&
          <ConnectModal />
        }

        {/** Display the edit profile details modal */}
        {updateProfileVis &&
          <UpdateProfileModal />
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
      if(!profileSelected) {
        return null;
      } else {
        return(
          <Profile did={profileSelected} />
        );
      }
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
