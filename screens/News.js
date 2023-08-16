import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Text, View, TouchableOpacity, Image, TouchableHighlight, ScrollView, ActivityIndicator } from 'react-native';
import SecondHeader from "../components/SecondHeader";
import * as Haptics from 'expo-haptics';
import { onboard_context, edu_context } from '../utils/config.js';

export default function Categories() {
  const { user, orbis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [nav, setNav] = useState("onboard");
  const [onboardCategories, setOnboardCategories] = useState([]);
  const [eduCategories, setEduCategories] = useState([]);

  useEffect(() => {
    loadOnboard();
    loadEasEdu();
  }, [])

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
    <>
      <SecondHeader label="Explore EASY World!"  />

      <View style={tailwind('flex flex-col flex-1')}>
        <View style={tailwind('flex flex-row py-2 px-5 mb-1 px-12')}>
          {/**<NavItem setNav={setNav} nav={nav} item="news" label="NEWS" />*/}
          <NavItem setNav={setNav} nav={nav} item="onboard" label="ONBOARD" />
          <NavItem setNav={setNav} nav={nav} item="easy-edu" label="EASY EDU" />
        </View>

        <ScrollView style={tailwind('flex flex-col w-full px-4')}>
          <ActivityContent nav={nav} onboardCategories={onboardCategories} eduCategories={eduCategories} />
        </ScrollView>
      </View>
    </>
  )
}

/** Activity feed based on navigation selected */
const ActivityContent = ({nav, onboardCategories, eduCategories}) => {
  switch (nav) {
    case "news":
      return(
        <>
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
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
                console.log("item:", item);
                return (
                  <OnboardItem item={item} key={key} />
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
              console.log("item:", item);
              return (
                <OnboardItem item={item} key={key} />
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
const NewsItem = () => {
  const tailwind = useTailwind();

  function openNews() {

  }

  return(
    <TouchableHighlight style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-3')} onPress={() => openNews()} underlayColor="#f8fafc">
      <>
        <Image
          resizeMode="cover"
          style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100 }]}
          source={{
            uri: "https://images.cointelegraph.com/images/1434_aHR0cHM6Ly9zMy5jb2ludGVsZWdyYXBoLmNvbS91cGxvYWRzLzIwMjMtMDcvMjc4MTAzNTYtMDBjMi00OGE1LWJkMjYtMThmNDMxMTQwZWI0LmpwZw==.jpg"
          }}  />
        <View style={tailwind('flex flex-col ml-2 flex-1')}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>First Mover Asia: Why Is Tron Founder Justin Sun Keeping Some of His Coins in Valkyrie Digital Assets</Text>
          <Text style={[tailwind(`text-slate-400 mt-3`), { fontSize: 11, fontFamily: "GmarketMedium", lineHeight: 15 }]}>By Coinbase - 26mins ago</Text>
        </View>
      </>
    </TouchableHighlight>
  )
}

/** Rendering onboard and easy edu items */
const OnboardItem = ({item}) => {
  const { setCategory, setScreen } = useContext(GlobalContext);
  const tailwind = useTailwind();

  console.log("item:", item);

  function selectCat() {
    console.log("Selecting category.");
    setCategory(item);
    setScreen("home");
  }

  return(
    <TouchableHighlight style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-2')} onPress={() => selectCat()} underlayColor="#f8fafc">
      <>
        {/** Display image if any */}
        {item.content.imageUrl &&
          <Image
            resizeMode="cover"
            style={[tailwind('rounded-md'), { aspectRatio: 1, width: 70 }]}
            source={{
              uri: item.content.imageUrl
            }}  />
        }
        <View style={tailwind('flex flex-col ml-2 flex-1 justify-center')}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{item.content.displayName}</Text>
        </View>
      </>
    </TouchableHighlight>
  )
}
