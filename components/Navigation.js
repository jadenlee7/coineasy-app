import React, { useState, useEffect, useRef, useContext } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, TouchableHighlight, Image } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import { NavHomeIcon, NavCategoriesIcon, NavChartIcon, NavProfileIcon } from "./Icons";

export default function Navigation() {
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const { screen } = useContext(GlobalContext);

  return(
    <SafeAreaView>
      <View style={[tailwind('w-full flex flex-row bg-white px-6 pt-3 pb-1 justify-center'), {elevation: 10}]}>
        <NavItem icon={<NavHomeIcon color={screen == "home" ? "#FF6E31" : "#959595" } />} item="home"/>
        <NavItem icon={<NavCategoriesIcon color={screen == "categories" ? "#FF6E31" : "#959595" } />} item="categories" />
        <NavItem icon={<NavChartIcon color={screen == "news" ? "#FF6E31" : "#959595" } />} item="news" />
        <NavItem icon={<NavProfileIcon color={screen == "profile" ? "#FF6E31" : "#959595" } />} item="profile" />
      </View>
    </SafeAreaView>
  )
}

/** Navigation component to select screen */
const NavItem = ({icon, item}) => {
  const tailwind = useTailwind();
  const { user, screen, setScreen, setPreviousScreen, setProfileSelected, setPostDetailsVis, scrollToTop, setCategory, translateY } = useContext(GlobalContext);

  function selectScreen(item) {
    translateY.value = 0;
    setPreviousScreen(screen);
    setScreen(item);
    setPostDetailsVis(null);

    if(item == "home") {
      scrollToTop();
      setCategory(null);
    }
    Haptics.selectionAsync();
  }

  return(
    <TouchableHighlight underlayColor="transparent" style={[tailwind('flex flex-1 items-center py-2 rounded-md justify-center')]} onPress={() => selectScreen(item)}>
      {icon}
    </TouchableHighlight>
  )
}
