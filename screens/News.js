import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, RefreshControl, ScrollView, Text, TouchableHighlight, TouchableOpacity, View } from 'react-native';
import fetch from 'cross-fetch';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import { useTailwind } from 'tailwind-rn';

import Header from '../components/Header';
import { InterpunctIcon } from '../components/Icons';
import Post from '../components/Post';
import TimeAgo from '../components/TimeAgo';
import { GlobalContext } from '../contexts/GlobalContext';
import useFeed from '../hooks/useFeed';
import useStatusBarHeight from '../hooks/useStatusBarHeight';

const RSS_URL = 'https://rss.app/feeds/v1.1/toWoTRT92EnG175n.json';

const News = ({navigation, route}) => {
    const {
        setCurrentRoute,
        setScrollAnim,
        setOffsetAnim,
    } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();
    const [headlines, setHeadlines] = useState([]);
    const [rssLoading, setRssLoading] = useState(true);
    const [rssError, setRssError] = useState(null);
    const {
        items: communityNews,
        loading: communityLoading,
        refreshing: communityRefreshing,
        loadingMore,
        error: communityError,
        hasMore,
        backendConfigured,
        refresh: refreshCommunity,
        loadMore,
    } = useFeed('news', {tag: '#NEWS', limit: 20});

    const loadHeadlines = useCallback(async () => {
        setRssLoading(true);
        setRssError(null);
        try {
            const response = await fetch(RSS_URL);
            if (!response.ok) throw new Error(`RSS request failed: ${response.status}`);
            const result = await response.json();
            setHeadlines(Array.isArray(result?.items) ? result.items : []);
        } catch (cause) {
            setRssError(cause instanceof Error ? cause : new Error(String(cause)));
        } finally {
            setRssLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHeadlines();
    }, [loadHeadlines]);

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            Haptics.selectionAsync();
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
            navigation.goBack();
            return true;
        });
        return () => subscription.remove();
    }, [navigation, setOffsetAnim, setScrollAnim]);

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name);
        }, [route.name, setCurrentRoute])
    );

    const refreshAll = useCallback(async () => {
        await Promise.allSettled([refreshCommunity(), loadHeadlines()]);
    }, [loadHeadlines, refreshCommunity]);

    return (
        <View style={tailwind('flex flex-1 bg-white')}>
            <Header />
            <ScrollView
                style={{flex: 1}}
                contentContainerStyle={{paddingTop: statusBarHeight > 25 ? 90 + statusBarHeight : 105 + statusBarHeight, paddingBottom: 40}}
                refreshControl={<RefreshControl refreshing={communityRefreshing || rssLoading} onRefresh={refreshAll} />}
            >
                <Text style={[tailwind('text-slate-900 px-5'), {fontSize: 18, fontFamily: 'GmarketBold', lineHeight: 22}]}>EASY NEWS</Text>
                <Text style={[tailwind('text-secondary px-5'), {fontSize: 11, lineHeight: 18, marginTop: 5}]}>Community signals and curated crypto headlines.</Text>

                <View style={{marginTop: 22}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8}}>
                        <Text style={{fontFamily: 'GmarketBold', fontSize: 15, color: '#0F172A'}}>Community #NEWS</Text>
                        <Text style={{fontFamily: 'GmarketMedium', fontSize: 10, color: '#FF6B17'}}>EASYGO</Text>
                    </View>
                    {communityLoading && communityNews.length === 0 ? (
                        <ActivityIndicator style={{marginVertical: 20}} size="small" color="#020617" />
                    ) : communityNews.length > 0 ? (
                        communityNews.map((post) => <Post key={post.stream_id} post={post} />)
                    ) : (
                        <View style={tailwind('bg-slate-50 px-5 py-5 items-center mx-6 rounded-md')}>
                            <Text style={[tailwind('text-slate-900 text-center'), {fontFamily: 'GmarketBold'}]}>
                                {!backendConfigured ? 'Community news is getting connected.' : communityError ? "Community news couldn't load." : 'No #NEWS posts yet.'}
                            </Text>
                            <Text style={[tailwind('text-secondary text-center'), {marginTop: 8, lineHeight: 19}]}>
                                {!backendConfigured ? 'Add the backend URL to load EasyGo posts.' : communityError ? 'Pull to refresh and try again.' : 'Add #NEWS when sharing a community update.'}
                            </Text>
                        </View>
                    )}
                    {hasMore && (
                        <TouchableOpacity
                            disabled={loadingMore}
                            onPress={loadMore}
                            style={{alignSelf: 'center', marginVertical: 14, borderRadius: 18, backgroundColor: '#F1F5F9', paddingHorizontal: 18, paddingVertical: 10}}
                        >
                            {loadingMore
                                ? <ActivityIndicator size="small" color="#020617" />
                                : <Text style={{fontFamily: 'GmarketBold', fontSize: 12, color: '#0F172A'}}>More community news</Text>}
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{marginTop: 26, paddingHorizontal: 16}}>
                    <Text style={{fontFamily: 'GmarketBold', fontSize: 15, color: '#0F172A', marginHorizontal: 4, marginBottom: 10}}>Latest headlines</Text>
                    {rssLoading && headlines.length === 0 ? (
                        <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
                    ) : rssError && headlines.length === 0 ? (
                        <View style={tailwind('bg-slate-50 px-5 py-5 items-center mx-2 rounded-md')}>
                            <Text style={[tailwind('text-slate-900 text-center'), {fontFamily: 'GmarketBold'}]}>Headlines couldn't load.</Text>
                            <TouchableOpacity onPress={loadHeadlines} style={{marginTop: 12, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9}}>
                                <Text style={{color: 'white', fontFamily: 'GmarketBold', fontSize: 12}}>Try again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : headlines.map((item) => <NewsItem item={item} key={item.id || item.url} />)}
                </View>
            </ScrollView>
        </View>
    );
};

export const NewsItem = ({item}) => {
    const tailwind = useTailwind();
    const html = typeof item.content_html === 'string' ? item.content_html : '';
    const imageMatch = html.match(/src=["']([^"']+)["']/i);
    const imageUrl = item.image || imageMatch?.[1] || null;

    const openNews = async () => {
        if (item.url) await WebBrowser.openBrowserAsync(item.url);
    };

    return (
        <TouchableHighlight
            style={tailwind('flex flex-row p-2 rounded-lg border border-slate-200 mb-10px')}
            onPress={openNews}
            underlayColor="#f8fafc"
        >
            <>
                {imageUrl && (
                    <Image
                        style={[tailwind('rounded-md'), {aspectRatio: 1, height: 100, marginRight: 3}]}
                        source={imageUrl}
                        transition={200}
                        contentFit="cover"
                        priority="high"
                    />
                )}
                <View style={tailwind('flex flex-col ml-2 flex-1 justify-between')}>
                    <Text style={[tailwind('text-slate-900'), {fontSize: 12, fontFamily: 'GmarketBold', lineHeight: 16}]}>{item.title}</Text>
                    <View style={tailwind('flex flex-row items-center mt-2')}>
                        {item.authors?.[0]?.name && (
                            <>
                                <Text style={[tailwind('flex flex-row text-secondary'), {fontSize: 11, lineHeight: 15}]}>By {item.authors[0].name}</Text>
                                <View style={tailwind('flex ml-2 mr-2')}><InterpunctIcon /></View>
                                <TimeAgo timestamp={Date.parse(item.date_published) / 1000} style={[tailwind('flex flex-row text-secondary'), {fontSize: 11, lineHeight: 15}]} />
                            </>
                        )}
                        <Text style={[tailwind('items-center flex flex-row text-secondary'), {fontSize: 11, lineHeight: 15}]}>{item.hostname}</Text>
                    </View>
                </View>
            </>
        </TouchableHighlight>
    );
};

export default News;
