import React, { useContext, useEffect } from "react";
import { View, TouchableOpacity, Image, BackHandler, Animated } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { useFocusEffect } from '@react-navigation/native';

import Feed from "../components/Feed";
import Header from "../components/Header";
import { GlobalContext } from "../contexts/GlobalContext";
import useFeed from "../hooks/useFeed";
import DailyRunHomeCard from "../components/DailyRunHomeCard";
import useStatusBarHeight from "../hooks/useStatusBarHeight";


const Home = ({ navigation, route }) => {
    const { currentRoute,
        selectedCategory, 
        setSelectedCategory,selectedNews,setSelectedNews, 
        showPostbox, 
        category, 
        setCategory, 
        setScrollAnim, 
        setOffsetAnim, 
        setCurrentRoute, 
        setEditedPost
    } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const {
        items: posts,
        loading,
        refreshing,
        loadingMore,
        error,
        backendConfigured,
        refresh,
        loadMore,
    } = useFeed('home', { limit: 20 });
    const statusBarHeight = useStatusBarHeight();
    const homeHeaderHeight = statusBarHeight > 25
        ? 65 + statusBarHeight
        : 60 + statusBarHeight;

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [route.name, setCurrentRoute])
    );

    useEffect(() => {
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
            return false;
        });

        return () => backhandler.remove();
    }, [category, currentRoute, navigation, selectedCategory, selectedNews, setCategory, setOffsetAnim, setScrollAnim, setSelectedCategory, setSelectedNews])

    return(
        <>
            <Header />
            
            <View style={tailwind('flex flex-col flex-1')}>
                <View style={tailwind('flex flex-1 bg-white')}>
                    <View style={tailwind('flex flex-1')}>
                        <Feed
                            posts={posts}
                            refreshing={loading || refreshing}
                            refreshingBottom={loadingMore}
                            onRefresh={refresh}
                            loadMore={loadMore}
                            error={error}
                            backendConfigured={backendConfigured}
                            header={(
                                <View style={{paddingTop: homeHeaderHeight}}>
                                    <DailyRunHomeCard onPress={() => navigation.navigate('DailyRun')} />
                                </View>
                            )}
                        />
                    </View>

                    {/** Share button */}
                    <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 15, right: 15} ]} onPress={() => {setEditedPost(null);showPostbox()}}>
                        <Image
                            style={{ height: 70, width: 70 }}
                            source={require('../assets/share_btn.png')} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

        </>
    )
}

export default Home
