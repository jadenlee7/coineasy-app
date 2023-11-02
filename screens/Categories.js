import React, { useCallback, useContext, useEffect, useState } from "react";
import { ScrollView, RefreshControl, Text, View, TouchableOpacity, Image, TouchableHighlight, Animated, Dimensions, BackHandler } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { useFocusEffect } from '@react-navigation/native';

import { BackIcon, NotificationsIcon } from "../components/Icons";
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import Feed from "../components/Feed";
import Header from "../components/Header";
import HeaderImage from "../components/HeaderImage";

let page = 0;

const Categories = ({ navigation, route }) => {
    const { orbis, currentRoute, selectedNews,setSelectedNews, categories, category, setCategory, loadContexts, refreshing, setRefreshing, refreshingBottom, setRefreshingBottom, showPostbox, setScrollAnim, setOffsetAnim, categoryFeedRef, categoryPosts, setCategoryPosts, selectedCategory, setSelectedCategory, setCurrentRoute} = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [])
    );

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
    async function loadCategoryPosts(category) {
        setCategoryPosts([]);
        setRefreshing(true);
        let { data } = await orbis.getPosts({
            contexts: [category.stream_id],
            include_child_contexts: true
        });
        if(data) {
            console.log(data.length + " category posts retrieved.");
            setCategoryPosts(data);
        }
        setRefreshing(false);
    }

    /** This will load more posts and add those to the current list */
    async function loadMoreCategoryPosts() {
        console.log("Enter loadMoreCategoryPosts() with page:", page);
        if(refreshingBottom) {
            console.log("Already refreshing.");
            return;
        }
        if (categoryPosts.length % 50 === 0) {
            setRefreshingBottom(true);
            page++;
            console.log("Enter loadMoreCategoryPosts with page:", page);
            let { data } = await orbis.getPosts(
                {
                    contexts: [selectedCategory.stream_id],
                    include_child_contexts: true
                },
                page
            );

            let _posts = [...categoryPosts, ...data];
            setRefreshingBottom(false);
            setCategoryPosts(_posts);
        } else {
            console.log("Reached the end category.");
        }
    }

    const onRefresh = useCallback(async () => {
        page = 0;
        setRefreshing(true);
        let { data, error } = await orbis.getPosts({
          contexts: [selectedCategory.stream_id],
          include_child_contexts: true
        });
        console.log("Data loaded.");
        if(error) {
          console.log("Error getPosts:", error);
        }
        if(data) {
          console.log(data.length + " posts retrieved.");
          setCategoryPosts(data);
        }
        setRefreshing(false);
      }, [selectedCategory]);

    const Category = ({category}) => {
        const tailwind = useTailwind();

        function selectCat() {
            Haptics.selectionAsync()
            setSelectedCategory(category);
            loadCategoryPosts(category)
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
        }
    
        return(
            <TouchableHighlight 
                style={[tailwind('flex flex-col border border-slate-200 rounded-md mb-4 items-center'), {width: "29%", aspectRatio: 1, marginRight: "4%"}]}
                underlayColor="#f8fafc" 
                onPress={() => selectCat()}
            >
                <View style={[tailwind("bg-slate-950 rounded-md mb-2 justify-center overflow-hidden"), { width: "100%", height: "100%", opacity: 1 }]} >
                    {/** Category image */}
                    {category.content.imageUrl &&
                        <Image
                            style={[tailwind("absolute"), { width: "100%", height: "100%" }]}
                            source={{
                                uri: category.content.imageUrl,
                                cache: 'force-cache'
                            }}
                        />
                    }
            
                    {/** Dark background */}
                    <View style={[tailwind("absolute bg-slate-950"), { width: "100%", height: "100%", opacity: 0.35 }]} />
            
                    {/** Category name */}
                    <Text style={[tailwind("text-center w-full mt-7 mb-2"), { fontSize: 12, lineHeight: 16, fontFamily: "GmarketBold", color: "#FFF" }]}>{category.content.displayName}</Text>
                </View>
            </TouchableHighlight>
        )
    }

    return(
        <View style={tailwind('flex flex-1 bg-white')}>

            { !selectedCategory ? (
                <>
                    <HeaderImage />

                    <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',marginTop: 21,marginBottom: 10,}}>
                        <Text style={[tailwind('text-slate-900 px-2'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20,marginLeft: 10, }]}>Categories</Text>

                        <TouchableOpacity 
                            activeOpacity={0.7} 
                            onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}
                            style={{marginRight: 20,marginTop: -2,}}
                        >
                            <NotificationsIcon />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={tailwind('flex flex-row items-start px-5 py-2 w-full flex-wrap')}
                        refreshControl={
                            <RefreshControl refreshing={false} onRefresh={loadContexts} />
                        }
                    >
                        {/** Loop and display categories */}
                        {categories.map((category, key) => {
                            return (
                                <Category key={key} category={category} />
                            );
                        })}
                        <View style={{height: 50}}/>
                    </ScrollView>
                </>
            ) : (
                <>
                    <Header route={route.name} backCategory={() => setSelectedCategory(null)}/>
                    <View style={tailwind('flex flex-col flex-1')}>
                        <View style={tailwind('flex flex-1 bg-white')}>
                        <Feed posts={categoryPosts} refreshing={refreshing} refreshingBottom={refreshingBottom} onRefresh={onRefresh} loadMore={loadMoreCategoryPosts} feedRef={categoryFeedRef}/>
        
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

export default Categories
