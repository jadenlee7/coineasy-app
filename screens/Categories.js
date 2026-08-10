import React, { useContext, useEffect } from 'react';
import { Animated, BackHandler, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import Feed from '../components/Feed';
import Header from '../components/Header';
import HeaderImage from '../components/HeaderImage';
import { NotificationsIcon } from '../components/Icons';
import { GlobalContext } from '../contexts/GlobalContext';
import useFeed from '../hooks/useFeed';
import useStatusBarHeight from '../hooks/useStatusBarHeight';
import { getSocialCategory, SOCIAL_CATEGORIES } from '../data/socialCategories';

const Categories = ({navigation, route}) => {
    const {
        selectedCategory,
        setSelectedCategory,
        setCurrentRoute,
        setScrollAnim,
        setOffsetAnim,
        showPostbox,
        setEditedPost,
        categoryFeedRef,
    } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();
    const activeCategory = getSocialCategory(selectedCategory);
    const activeTag = activeCategory?.tag || null;
    const {
        items: posts,
        loading,
        refreshing,
        loadingMore,
        error,
        backendConfigured,
        refresh,
        loadMore,
    } = useFeed('category', {
        tag: activeTag,
        limit: 20,
        autoLoad: Boolean(activeTag),
    });

    useEffect(() => {
        if (!route.params?.loadPosts) return;
        const nextCategory = getSocialCategory(route.params.category);
        if (nextCategory) setSelectedCategory(nextCategory);
    }, [route.params, setSelectedCategory]);

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name);
        }, [route.name, setCurrentRoute])
    );

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            Haptics.selectionAsync();
            if (selectedCategory) {
                setSelectedCategory(null);
                return true;
            }
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
            navigation.goBack();
            return true;
        });
        return () => subscription.remove();
    }, [navigation, selectedCategory, setOffsetAnim, setScrollAnim, setSelectedCategory]);

    const selectCategory = (category) => {
        Haptics.selectionAsync();
        setSelectedCategory(category);
        setScrollAnim(new Animated.Value(0));
        setOffsetAnim(new Animated.Value(0));
    };

    return (
        <View style={tailwind('flex flex-1 bg-white')}>
            {!activeCategory ? (
                <>
                    <HeaderImage />
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.goBack()}
                        style={{position: 'absolute', top: statusBarHeight + 14, left: 14, zIndex: 3, width: 38, height: 38, alignItems: 'center', justifyContent: 'center'}}
                    >
                        <Image style={{width: 24, height: 24}} resizeMode="contain" source={require('../assets/back_button.png')} />
                    </TouchableOpacity>
                    <View style={{marginTop: 21, flex: 1}}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {Haptics.selectionAsync(); navigation.navigate('Notifications');}}
                            style={{position: 'absolute', top: 0, right: 20, zIndex: 2}}
                        >
                            <NotificationsIcon />
                        </TouchableOpacity>
                        <Text style={[tailwind('text-slate-900 px-5'), {fontSize: 16, fontFamily: 'GmarketBold', lineHeight: 20, marginBottom: 10}]}>
                            Explore EasyGo
                        </Text>
                        <Text style={[tailwind('text-secondary px-5'), {fontSize: 12, lineHeight: 18, marginBottom: 14}]}>
                            Posts are grouped by community hashtags.
                        </Text>
                        <ScrollView contentContainerStyle={tailwind('flex flex-row items-start px-5 py-2 w-full flex-wrap')}>
                            {SOCIAL_CATEGORIES.map((category, index) => (
                                <TouchableOpacity
                                    key={category.id}
                                    activeOpacity={0.75}
                                    onPress={() => selectCategory(category)}
                                    style={{
                                        width: '31%',
                                        aspectRatio: 1,
                                        marginRight: index % 3 === 2 ? 0 : '3.5%',
                                        marginBottom: 14,
                                        borderRadius: 14,
                                        overflow: 'hidden',
                                        backgroundColor: category.accent,
                                        padding: 12,
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Text style={{color: 'rgba(255,255,255,0.7)', fontFamily: 'GmarketMedium', fontSize: 10}}>EASYGO</Text>
                                    <View>
                                        <Text style={{color: 'white', fontFamily: 'GmarketBold', fontSize: 12}}>{category.tag}</Text>
                                        <Text style={{color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 4}}>View posts</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <View style={{height: 40}} />
                        </ScrollView>
                    </View>
                </>
            ) : (
                <>
                    <Header route={route.name} backCategory={() => setSelectedCategory(null)} />
                    <View style={tailwind('flex flex-col flex-1 bg-white')}>
                        <View style={{paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4}}>
                            <Text style={{fontFamily: 'GmarketBold', fontSize: 18, color: '#0F172A'}}>{activeCategory.tag}</Text>
                            <Text style={{fontFamily: 'GmarketMedium', fontSize: 11, color: '#64748B', marginTop: 4}}>EasyGo community posts</Text>
                        </View>
                        <Feed
                            posts={posts}
                            refreshing={loading || refreshing}
                            refreshingBottom={loadingMore}
                            onRefresh={refresh}
                            loadMore={loadMore}
                            feedRef={categoryFeedRef}
                            error={error}
                            backendConfigured={backendConfigured}
                            showBanner={false}
                            emptyTitle={!backendConfigured ? undefined : `No ${activeCategory.tag} posts yet.`}
                            emptyDescription={!backendConfigured ? undefined : `Add ${activeCategory.tag} to a post to start this channel.`}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[tailwind('absolute'), {elevation: 10, bottom: 15, right: 15}]}
                            onPress={() => {setEditedPost(null); showPostbox();}}
                        >
                            <Image style={{height: 70, width: 70}} source={require('../assets/share_btn.png')} />
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
};

export default Categories;
