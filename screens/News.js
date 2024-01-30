import React, { useState, useContext, useEffect, useCallback } from "react";
import { Text, View, TouchableOpacity, Image, TouchableHighlight, ScrollView, ActivityIndicator, RefreshControl, Dimensions, Animated, BackHandler } from 'react-native';

import fetch from 'cross-fetch';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';

import { GlobalContext } from "../contexts/GlobalContext";
import { onboard_context, edu_context } from '../utils/config.js';
import { InterpunctIcon, NotificationsIcon } from "../components/Icons";
import Header from "../components/Header";
import Feed from "../components/Feed";
import HeaderImage from "../components/HeaderImage";
import moment from "moment";

let page = 0

const News = ({ navigation, route }) => {

    const { orbis, category, setCategory, selectedCategory, setSelectedCategory, currentRoute, setCurrentRoute, refreshing, setRefreshing, refreshingBottom, setRefreshingBottom, setScrollAnim, setOffsetAnim, newsFeedRef, selectedNews, setSelectedNews, newsPosts, setNewsPosts, showPostbox } = useContext(GlobalContext);

    const tailwind = useTailwind();

    const [news, setNews] = useState([]);
    const [nav, setNav] = useState("news");
    const [eduCategories, setEduCategories] = useState([]);
    const [onboardCategories, setOnboardCategories] = useState([]);

    const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
        Haptics.selectionAsync()
        if(currentRoute == 'Categories'){
            if (selectedCategory) {
                setSelectedCategory(null)
                return true;
            }else{
                setScrollAnim(new Animated.Value(0))
                setOffsetAnim(new Animated.Value(0))
                navigation.goBack()
                return true;
            }
        } else if(currentRoute == 'News'){
            if (selectedNews) {
                setSelectedNews(null)
                return true;
            }else{
                setScrollAnim(new Animated.Value(0));
                setOffsetAnim(new Animated.Value(0));
                navigation.goBack()
                return true;
            }
        } else if(currentRoute == 'Home'){
            if (category) {
                setCategory(null)
            }
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
            navigation.replace('Navigator')
            return true
        }
    });

    useEffect(() => {
        return () => backhandler.remove();
    }, [navigation])
    

    /** Will retrieve all posts shared in the global context */
    async function loadNewsPosts(item) {
        setNewsPosts([]);
        setRefreshing(true);
        let { data } = await orbis.getPosts({
            contexts: [item.stream_id],
            include_child_contexts: true
        });
        if(data) {
            console.log(data.length + " news posts retrieved.");
            setNewsPosts(data);
        }
        setRefreshing(false);
    }

    /** This will load more posts and add those to the current list */
    async function loadMoreNewsPosts() {
        console.log("Enter loadMoreNewsPosts() with page:", page);
        if(refreshingBottom) {
            console.log("Already refreshing.");
            return;
        }
        if (newsPosts.length % 50 === 0) {
            setRefreshingBottom(true);
            page++;
            console.log("Enter loadMorenewsPosts with page:", page);
            let { data } = await orbis.getPosts(
                {
                    contexts: [selectedNews.stream_id],
                    include_child_contexts: true
                },
                page
            );

            let _posts = [...selectedNews, ...data];
            setRefreshingBottom(false);
            setNewsPosts(_posts);
        } else {
            console.log("Reached the end news.");
        }
    }

    const onRefresh = useCallback(async () => {
        page = 0;
        setRefreshing(true);
        console.log(selectedNews);
        let { data, error } = await orbis.getPosts({
          contexts: [selectedNews.stream_id],
          include_child_contexts: true
        });
        console.log("Data loaded.");
        if(error) {
          console.log("Error getPosts:", error);
        }
        if(data) {
          console.log(data.length + " posts retrieved.");
          setNewsPosts(data);
        }
        setRefreshing(false);
      }, [selectedNews]);


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

        // Switch 1inch Network to first position
        const indexItem = data.findIndex(e => e.content.displayName == '1inch Network')
        const first_element = data.splice(indexItem, 1)[0];
        data.splice(0, 0, first_element);

        setOnboardCategories(data);
    }

    /** Will load easy edu categories */
    async function loadEasEdu() {
        let { data, error } = await orbis.api.from("orbis_contexts").select().eq('context', edu_context).order('created_at', { ascending: false });
        setEduCategories(data);
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
  
    /** Rendering onboard and easy edu items */
    const OnboardItem = ({item}) => {
        const { setScrollAnim, setOffsetAnim } = useContext(GlobalContext);
        const tailwind = useTailwind();
    
        function selectCat() {
            Haptics.selectionAsync()
            setSelectedNews(item)
            loadNewsPosts(item)
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
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
  

    return(
        <View style={tailwind('flex flex-1 bg-white')}>
            { !selectedNews ? (
                <>
                    <HeaderImage />

                    <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',marginTop: 21,}}>
                        <Text style={[tailwind('text-slate-900 px-5'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20, }]}>Explore EASY World!</Text>

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
                </>
            ) : (
                <>
                    <Header route={route.name} backNews={() => setSelectedNews(null)}/>
                    <View style={tailwind('flex flex-col flex-1')}>
                        <View style={tailwind('flex flex-1 bg-white')}>
                            <Feed posts={newsPosts} refreshing={refreshing} refreshingBottom={refreshingBottom} onRefresh={onRefresh} loadMore={loadMoreNewsPosts} feedRef={newsFeedRef}/>
            
                            {/** Share button */}
                            <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 15, right: 15} ]} onPress={() => showPostbox()}>
                                <Image
                                    style={{ height: 70, width: 70 }}
                                    source={require('../assets/share_btn.png')} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}
        </View>
    )
}

/** Rendering a news item */
export const NewsItem = ({item}) => {
    const tailwind = useTailwind();
  
    async function openNews() {
      let result = await WebBrowser.openBrowserAsync(item.url);
    }

    const news_image = item.content_html?.slice(item.content_html.indexOf('src="') + 5,item.content_html.indexOf('" style'));
  
    return(
        <TouchableHighlight style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-10px')} onPress={() => openNews()} underlayColor="#f8fafc">
            <>
                {item.image ?
                    <Image
                        resizeMode="cover"
                        style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100, marginRight: 3 }]}
                        source={{
                            uri: item.image
                        }}  
                    />
                : typeof news_image !== 'undefined' &&
                    <Image
                        resizeMode="cover"
                        style={[tailwind('rounded-md'), { aspectRatio: 1, height: 100, marginRight: 3 }]}
                        source={{
                            uri: news_image
                        }}  
                    />
                }
        
                <View style={tailwind('flex flex-col ml-2 flex-1 justify-center')}>
                    <Text style={[tailwind(`text-slate-900`), { fontSize: 12, fontFamily: "GmarketBold", lineHeight: 15 }]}>{item.title}</Text>
                    <View style={tailwind('flex flex-row items-center mt-2')}>
                        {item.authors && item.authors.length > 0 && item.authors[0].name &&
                            <>
                                <Text style={[tailwind(`flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>{item.authors[0].name}</Text>
                                <View style={tailwind('flex ml-2 mr-2')}>
                                    <InterpunctIcon />
                                </View>
                                <Text style={[tailwind(`flex flex-row text-secondary`), { fontSize: 11, lineHeight: 15 }]}>{moment(item.date_published).format('DD/MM/YYYY')}</Text>
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
