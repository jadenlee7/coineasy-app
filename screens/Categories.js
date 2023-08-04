import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import { ScrollView, RefreshControl, Keyboard, StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView, TouchableHighlight } from 'react-native';
import Header from "../components/Header";
import SecondHeader from "../components/SecondHeader";

export default function Categories() {
  const { user, orbis, repostVis, setRepostVis, postDetailsVis, setPostDetailsVis, categories, loadContexts } = useContext(GlobalContext);
  const tailwind = useTailwind();

  return(
    <>
      <SecondHeader label="Highlights for You"  />

      <ScrollView
        contentContainerStyle={tailwind('flex flex-row flex-1 items-start px-5 py-2 w-full flex-wrap')}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadContexts} />
        }>

        {/** Loop and display categories */}
        {categories.map((category, key) => {
          console.log("category:", category);
          return (
            <Category key={key} label={category.content.displayName} />
          );
        })}
      </ScrollView>
    </>
  )
}

const Category = ({label}) => {
  const tailwind = useTailwind();

  function selectCat() {
    console.log("Selecting category.");
  }

  return(
    <TouchableHighlight style={[tailwind('flex flex-col border border-slate-200 px-2 py-2 rounded-md m-1.5 items-center'), {width: "29%", aspectRatio: 1}]} underlayColor="#f8fafc" onPress={() => selectCat("")}>
      <>
        <View style={[tailwind("bg-slate-100 rounded-md mb-2 flex-1"), { aspectRatio: 1 }]} />
        <Text style={[tailwind("text-center w-full"), { fontSize: 12, lineHeight: 16, fontFamily: "GmarketBold" }]}>{label}</Text>
      </>
    </TouchableHighlight>
  )
}
