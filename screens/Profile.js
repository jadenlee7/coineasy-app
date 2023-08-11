import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, ActivityIndicator, RefreshControl, TouchableHighlight } from 'react-native';
import Header from "../components/Header";
import Post from "../components/Post";
import Button from "../components/Button";
import { UserPfp, Username } from "../components/User";
import SecondHeader from "../components/SecondHeader";
import ProfileDetails from "../components/ProfileDetails";

export default function Profile() {
  const { user, setUser, orbis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [profile, setProfile] = useState();

  useEffect(() => {
    getProfile();
  }, [user]);

  async function getProfile() {
    const { data, error } = await orbis.getProfile(user.did);
    setProfile(data);
  }

  async function logout() {
    let res = await orbis.logout();
    setUser(null);
  }
  return(
    <>
      <SecondHeader label="" showBack={false} cta="settings" />

      {profile ?
        <ProfileDetails profile={user} />
      :
        <View style={tailwind('flex flex-row items-start w-full justify-center mt-6 flex-1')}>
          <ActivityIndicator style={{marginTop: 25}} size="small" color="#020617" />
        </View>
      }



      {/**
      <View style={tailwind('flex flex-col')}>
        <TouchableHighlight style={[tailwind(`bg-slate-50 px-8 py-6`)]} onPress={() => logout()}>
          <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>Logout</Text>
        </TouchableHighlight>
      </View>
      */}
    </>
  )
}
