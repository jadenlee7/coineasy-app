import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight, ScrollView } from 'react-native';
import Header from "../components/Header";
import SecondHeader from "../components/SecondHeader";
import * as Haptics from 'expo-haptics';

export default function Categories() {
  const { user, orbis, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [nav, setNav] = useState("news");

  return(
    <>
      <SecondHeader label="Explore EASY World!"  />

      <View style={tailwind('flex flex-col flex-1')}>
        <View style={tailwind('flex flex-row py-2 px-5 mb-1')}>
          <NavItem setNav={setNav} nav={nav} item="news" label="NEWS" />
          <NavItem setNav={setNav} nav={nav} item="onboard" label="ONBOARD" />
          <NavItem setNav={setNav} nav={nav} item="easy-edu" label="EASY EDU" />
        </View>

        <ScrollView style={tailwind('flex flex-col w-full px-4')}>
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
          <NewsItem />
        </ScrollView>
      </View>
    </>
  )
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
