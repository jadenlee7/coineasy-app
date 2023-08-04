import React, { useState, useEffect, useRef, useContext } from "react";
import { Dimensions, SafeAreaView, StyleSheet, Text, View, TouchableHighlight, Image } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';

export default function Navigation() {
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const { screen } = useContext(GlobalContext);

  return(
    <SafeAreaView>
      <View style={[tailwind('w-full flex flex-row bg-white px-6 pt-3 pb-1 justify-center'), {elevation: 10}]}>
        <NavItem icon={<HomeIcon color={screen == "home" ? "#FF6E31" : "#959595" } />} item="home"/>
        <NavItem icon={<CategoriesIcon color={screen == "categories" ? "#FF6E31" : "#959595" } />} item="categories" />
        <NavItem icon={<ChartIcon color={screen == "news" ? "#FF6E31" : "#959595" } />} item="news" />
        <NavItem icon={<ProfileIcon color={screen == "profile" ? "#FF6E31" : "#959595" } />} item="profile" />
      </View>
    </SafeAreaView>
  )
}

/** Navigation component to select screen */
const NavItem = ({icon, item}) => {
  const tailwind = useTailwind();
  const { user, setScreen, setProfileSelected, setPostDetailsVis } = useContext(GlobalContext);

  function selectScreen(item) {
    if(item == "profile") {
      setProfileSelected(user.did);
    } else {
      setProfileSelected(null);
    }
    setScreen(item)
    setPostDetailsVis(null);
    Haptics.selectionAsync();
  }

  return(
    <TouchableHighlight underlayColor="#f8fafc" style={[tailwind('flex flex-1 items-center py-2 rounded-md justify-center')]} onPress={() => selectScreen(item)}>
      {icon}
    </TouchableHighlight>
  )
}

/** Icons for navigation */
const HomeIcon = ({color}) => {
  return(
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M23.6666 11.2885V19.1168C23.6666 21.6252 21.7066 23.6668 19.2916 23.6668H14.9166V18.0668C14.9166 17.3202 14.3099 16.7135 13.5633 16.7135H10.4366C9.68992 16.7135 9.09492 17.3202 9.09492 18.0668V23.6668H4.70825C2.29325 23.6668 0.333252 21.6252 0.333252 19.1168V11.2885C0.333252 9.94682 0.904919 8.67515 1.88492 7.80015L9.17659 1.40682C10.8216 -0.0281836 13.1899 -0.0281836 14.8233 1.40682L22.1149 7.80015C23.1066 8.67515 23.6666 9.94682 23.6666 11.2885Z" fill={color} />
    </Svg>
  )
}

const CategoriesIcon = ({color}) => {
  return(
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Rect width="10.2857" height="10.2857" rx="2" fill={color}/>
      <Rect y="13.7144" width="10.2857" height="10.2857" rx="2" fill={color} />
      <Rect x="13.7144" width="10.2857" height="10.2857" rx="2" fill={color} />
      <Rect x="13.7144" y="13.7144" width="10.2857" height="10.2857" rx="2" fill={color} />
    </Svg>
  )
}

const ChartIcon = ({color}) => {
  return(
    <Svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M6.40375 10.189H1.12925C0.603081 10.189 0.166748 10.6253 0.166748 11.1515V18.7745C0.166748 19.3006 0.603081 19.737 1.12925 19.737H6.40375C6.92991 19.737 7.36625 19.3006 7.36625 18.7745V11.1515C7.36625 10.6253 6.94275 10.189 6.40375 10.189Z" fill={color} />
      <Path d="M15.6438 5.42773H10.4977C9.97149 5.42773 9.53516 5.86407 9.53516 6.39023V18.7744C9.53516 19.3006 9.97149 19.7369 10.4977 19.7369H15.6438C16.17 19.7369 16.6063 19.3006 16.6063 18.7744V6.39023C16.6063 5.86407 16.17 5.42773 15.6438 5.42773Z" fill={color} />
      <Path d="M24.871 0.666504H19.5965C19.0704 0.666504 18.634 1.10284 18.634 1.629V18.7743C18.634 19.3005 19.0704 19.7368 19.5965 19.7368H24.871C25.3972 19.7368 25.8335 19.3005 25.8335 18.7743V1.629C25.8335 1.10284 25.3972 0.666504 24.871 0.666504Z" fill={color} />
    </Svg>
  )
}

const ProfileIcon = ({color}) => {
  return(
    <Svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Path d="M21 16C21.7956 16 22.5587 16.3161 23.1213 16.8787C23.6839 17.4413 24 18.2044 24 19V19.715C24 23.292 19.79 26 14 26C8.21 26 4 23.433 4 19.715V19C4 18.2044 4.31607 17.4413 4.87868 16.8787C5.44129 16.3161 6.20435 16 7 16H21ZM14 2C14.7879 2 15.5681 2.15519 16.2961 2.45672C17.0241 2.75825 17.6855 3.20021 18.2426 3.75736C18.7998 4.31451 19.2417 4.97595 19.5433 5.7039C19.8448 6.43185 20 7.21207 20 8C20 8.78793 19.8448 9.56815 19.5433 10.2961C19.2417 11.0241 18.7998 11.6855 18.2426 12.2426C17.6855 12.7998 17.0241 13.2417 16.2961 13.5433C15.5681 13.8448 14.7879 14 14 14C12.4087 14 10.8826 13.3679 9.75736 12.2426C8.63214 11.1174 8 9.5913 8 8C8 6.4087 8.63214 4.88258 9.75736 3.75736C10.8826 2.63214 12.4087 2 14 2Z" fill={color} />
    </Svg>
  )
}
