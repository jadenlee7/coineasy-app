import React, { useState, useContext, useEffect } from "react";
import { Text, View, TouchableOpacity, Image, TouchableHighlight, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';

import fetch from 'cross-fetch';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from "@react-navigation/core";

import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import { onboard_context, edu_context } from '../utils/config.js';
import { InterpunctIcon, NotificationsIcon } from "../components/Icons";

const News = ({ navigation, route }) => {

    const {  orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [news, setNews] = useState([]);
    const [nav, setNav] = useState("news");
    const [eduCategories, setEduCategories] = useState([]);
    const [onboardCategories, setOnboardCategories] = useState([]);

    const statusBarHeight = useStatusBarHeight();


    useEffect(() => {
        loadData();

        navigation.addListener('tabPress', (e) => {
            Haptics.selectionAsync();
        });
    }, [])

    async function loadData() {
        loadNews();
        loadOnboard();
        loadEasEdu();
    }

    /** Will load news from Coineasy RSS feed */
    async function loadNews() {
        let res = await fetch("https://rss.app/feeds/_z2HKiiCTPGaK4EIn.json");
        let results = await res.json();
        setNews(results.items);
    }

    /** Will load onboard categories */
    async function loadOnboard() {
        let { data, error } = await orbis.api.from("orbis_contexts").select().eq('context', onboard_context).order('created_at', { ascending: false });
        setOnboardCategories(data);
    }

    /** Will load easy edu categories */
    async function loadEasEdu() {
        let { data, error } = await orbis.api.from("orbis_contexts").select().eq('context', edu_context).order('created_at', { ascending: false });
        setEduCategories(data);
    }

    return(
        <View style={tailwind('flex flex-1 bg-white')}>
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../assets/HeaderBg.png')} 
            />

            <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',marginTop: 19,}}>
                <Text style={[tailwind('text-slate-900 px-2'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20,marginLeft: 10, }]}>Explore EASY World!</Text>

                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')} style={{marginRight: 20,}}>
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>

            <View style={tailwind('flex flex-col flex-1')}>
                <View style={tailwind('flex flex-row mt-30px px-5')}>
                    <NavItem setNav={setNav} nav={nav} item="news" label="NEWS" />
                    <NavItem setNav={setNav} nav={nav} item="onboard" label="FEATURED" />
                    <NavItem setNav={setNav} nav={nav} item="easy-edu" label="EASY EDU" />
                </View>

                <ScrollView 
                    style={tailwind('flex flex-col w-full px-4 mt-20px')} 
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={loadData} />
                    }
                >
                    <ActivityContent nav={nav} news={news} onboardCategories={onboardCategories} eduCategories={eduCategories} />
                </ScrollView>
            </View>
        </View>
    )
}

/** Activity feed based on navigation selected */
const ActivityContent = ({nav, news, onboardCategories, eduCategories}) => {
  switch (nav) {
    case "news":
      return(
        <>
        {news.length == 0 ?
          <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
        :
          <>
            {news.map((item, key) => {
              return (
                <NewsItem item={item} key={key} />
              );
            })}
          </>
        }
        </>
      )
    case "onboard":
      return(
        <>
          {onboardCategories.length == 0 ?
            <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
          :
            <>
              {onboardCategories.map((item, key) => {
                return (
                  <OnboardItem item={item} key={item.stream_id} />
                );
              })}
            </>
          }
        </>
      );
    case "easy-edu":
      return(
        <>
        {eduCategories.length == 0 ?
          <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
        :
          <>
            {eduCategories.map((item, key) => {
              return (
                <OnboardItem item={item} key={item.stream_id} />
              );
            })}
          </>
        }
        </>
      );
    default:

  }
}

const NavItem = ({ setNav, nav, label, item }) => {
  const tailwind = useTailwind();

  function select(item) {
    setNav(item)
    Haptics.selectionAsync();
  }

  return(
    <TouchableHighlight style={tailwind(`rounded-full py-3 border flex-1 border-slate-800 ${nav == item ? " bg-slate-800" : ""} ${item == "onboard" ? "mr-3 ml-3" : ""}`)} onPress={() => select(item)} underlayColor="#f8fafc">
      <Text style={[tailwind(`text-center ${nav == item ? "text-white" : "text-slate-900" }`), { fontSize: 11, fontFamily: "GmarketBold" }]}>{label}</Text>
    </TouchableHighlight>
  )
}

/** Rendering a news item */
export const NewsItem = ({item}) => {
  const tailwind = useTailwind();

  async function openNews() {
    let result = await WebBrowser.openBrowserAsync(item.url);
  }

  return(
    <TouchableHighlight style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-10px')} onPress={() => openNews()} underlayColor="#f8fafc">
      <>
        {item.image &&
          <Image
            resizeMode="cover"
            style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100, marginRight: 3 }]}
            source={{
              uri: item.image
            }}  />
        }

        <View style={tailwind('flex flex-col ml-2 flex-1 justify-center')}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{item.title}</Text>
          <View style={tailwind('flex flex-row items-center mt-2')}>
            {item.author &&
              <>
                <Text style={[tailwind(`flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>{item.author}</Text>
                <View style={tailwind('flex ml-2 mr-2')}>
                  <InterpunctIcon />
                </View>
              </>
            }
            <Text style={[tailwind(`items-center flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>{item.hostname}</Text>
          </View>
        </View>
      </>
    </TouchableHighlight>
  )
}

/** Rendering onboard and easy edu items */
const OnboardItem = ({item}) => {
    const { setCategory, setScreen, setPreviousScreen } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const navigation = useNavigation()

    function selectCat() {
        setCategory(item);
        navigation.replace('Navigator')
    }

    return(
        <TouchableHighlight style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-10px')} onPress={() => selectCat()} underlayColor="#f8fafc">
            <>
                {/** Display image if any */}
                {item.content.imageUrl &&
                    <Image
                        resizeMode="cover"
                        style={[tailwind('rounded-md'), { aspectRatio: 1, width: 70 }]}
                        source={{
                            uri: item.content.imageUrl
                        }}  
                    />
                }
                <View style={tailwind('flex flex-col ml-2 flex-1 justify-center')}>
                    <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{item.content.displayName}</Text>
                </View>
            </>
        </TouchableHighlight>
    )
}

export default News
