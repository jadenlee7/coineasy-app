import React, { useState, useContext, useEffect, useCallback } from "react";
import { Text, View, TouchableOpacity, Image as RNImage, TouchableHighlight, ScrollView, ActivityIndicator, RefreshControl, Dimensions, Animated, BackHandler } from 'react-native';

import fetch from 'cross-fetch';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';

import { Image } from 'expo-image';

import { GlobalContext } from "../contexts/GlobalContext";
import { InterpunctIcon } from "../components/Icons";
import Header from "../components/Header";
import TimeAgo from "../components/TimeAgo.js";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

const News = ({ navigation, route }) => {

    const { 
        category, 
        setCategory, 
        selectedCategory, 
        setSelectedCategory, 
        currentRoute, 
        setCurrentRoute,
        setScrollAnim, 
        setOffsetAnim, 
        selectedNews, 
        setSelectedNews,
    } = useContext(GlobalContext);

    const tailwind = useTailwind();

    const [news, setNews] = useState([]);

    const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
        Haptics.selectionAsync()

        setScrollAnim(new Animated.Value(0));
        setOffsetAnim(new Animated.Value(0));
        navigation.goBack()
        return true;
    });

    useEffect(() => {
        return () => backhandler.remove();
    }, [navigation])
    

    useEffect(() => {
        loadData();
    }, [])

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [])
    );

    async function loadData() {
        loadNews();
    }

    /** Will load news from Coineasy RSS feed */
    async function loadNews() {
        // let res = await fetch("https://rss.app/feeds/_z2HKiiCTPGaK4EIn.json");
        let res = await fetch("https://rss.app/feeds/v1.1/toWoTRT92EnG175n.json");
        let results = await res.json();
        setNews(results.items);
    }

    const statusBarHeight = useStatusBarHeight();
    
    return(
        <View style={tailwind('flex flex-1 bg-white')}>
            <Header />

            <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',marginTop: statusBarHeight > 25 ? 90 + statusBarHeight : 105 + statusBarHeight,}}>
                <Text style={[tailwind('text-slate-900 px-5'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20, }]}>
                    EASY NEWS
                </Text>
            </View>

            <View style={[tailwind('flex flex-col flex-1')]}>
                <ScrollView 
                    style={tailwind('flex flex-col w-full px-4 mt-20px')} 
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={loadData} />
                    }
                >
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
                </ScrollView>
            </View>
        </View>
    )
}

/** Rendering a news item */
export const NewsItem = ({item}) => {
    const tailwind = useTailwind();
  
    async function openNews() {
        await WebBrowser.openBrowserAsync(item.url);
    }

    const news_image = item.content_html?.slice(item.content_html.indexOf('src="') + 5,item.content_html.indexOf('" style'));
  
    return(
        <TouchableHighlight 
            style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-10px')} 
            onPress={() => openNews()} 
            underlayColor="#f8fafc"
        >
            <>
                {item.image ?
                    <Image
                        style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100, marginRight: 3 }]}
                        source={item.image}
                        transition={200}
                        contentFit="cover"
                        priority="high"
                    />
                : typeof news_image !== 'undefined' &&
                    <Image
                        style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100, marginRight: 3 }]}
                        source={news_image}
                        transition={200}
                        contentFit="cover"
                        priority="high"
                    />
                }

                <View style={tailwind('flex flex-col ml-2 flex-1 justify-between')}>
                    <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 16,}]}>{item.title}</Text>
                    <View style={tailwind('flex flex-row items-center mt-2')}>
                        {item.authors && item.authors.length > 0 && item.authors[0].name &&
                            <>
                                <Text style={[tailwind(`flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>By {item.authors[0].name}</Text>
                                <View style={tailwind('flex ml-2 mr-2')}>
                                    <InterpunctIcon />
                                </View>
                                <TimeAgo timestamp={Date.parse(item.date_published)/1000} style={[tailwind(`flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}/>
                            </>
                        }
                        <Text style={[tailwind(`items-center flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>{item.hostname}</Text>
                    </View>
                </View>
            </>
    
        </TouchableHighlight>
    )
  }

export default News
