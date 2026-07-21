import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import HeaderImage from '../components/HeaderImage';
import { CloseIcon, SmallSearchIcon } from '../components/Icons';
import Post from '../components/Post';
import User from '../components/User';
import { GlobalContext } from '../contexts/GlobalContext';
import { SOCIAL_CATEGORIES } from '../data/socialCategories';
import useFeed from '../hooks/useFeed';
import useStatusBarHeight from '../hooks/useStatusBarHeight';
import { api } from '../utils/api';
import { adaptSocialProfile, getEasyGoUserId } from '../utils/socialPostAdapter';

const RECENT_SEARCH_KEY = 'easygo_recent_profile_searches';
const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

const Search = ({navigation}) => {
    const { user } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();
    const inputRef = useRef(null);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [people, setPeople] = useState([]);
    const [peopleLoading, setPeopleLoading] = useState(false);
    const [peopleError, setPeopleError] = useState(null);
    const [recentSearches, setRecentSearches] = useState([]);
    const [viewerFollowingIds, setViewerFollowingIds] = useState(new Set());
    const trimmedQuery = debouncedQuery.trim();
    const searchActive = trimmedQuery.length >= 2;
    const {
        items: posts,
        loading: postsLoading,
        refreshing: postsRefreshing,
        loadingMore,
        error: postsError,
        hasMore,
        refresh: refreshPosts,
        loadMore,
    } = useFeed('search', {
        query: trimmedQuery,
        limit: 20,
        autoLoad: searchActive,
    });

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        let active = true;
        AsyncStorage.getItem(RECENT_SEARCH_KEY).then((stored) => {
            if (!active || !stored) return;
            try {
                const parsed = JSON.parse(stored);
                const valid = Array.isArray(parsed)
                    ? parsed.filter((item) => getEasyGoUserId(item?.details)).slice(0, 10)
                    : [];
                setRecentSearches(valid);
            } catch {
                setRecentSearches([]);
            }
        });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        const ownUserId = getEasyGoUserId(user);
        if (!ownUserId) return;
        let active = true;
        api.follows.following(ownUserId, {limit: 200}).then((result) => {
            if (!active) return;
            setViewerFollowingIds(new Set((result?.rows || []).map((item) => item.id)));
        }).catch(() => {
            if (active) setViewerFollowingIds(new Set());
        });
        return () => { active = false; };
    }, [user]);

    useEffect(() => {
        if (!searchActive) {
            setPeople([]);
            setPeopleError(null);
            setPeopleLoading(false);
            return;
        }

        let active = true;
        const peopleQuery = trimmedQuery.replace(/^[@#]/, '');
        setPeopleLoading(true);
        setPeopleError(null);
        api.profiles.search(peopleQuery, {limit: 20}).then((result) => {
            if (!active) return;
            setPeople((result?.rows || []).map(adaptSocialProfile).filter(Boolean));
        }).catch((cause) => {
            if (!active) return;
            setPeople([]);
            setPeopleError(cause instanceof Error ? cause : new Error(String(cause)));
        }).finally(() => {
            if (active) setPeopleLoading(false);
        });
        return () => { active = false; };
    }, [searchActive, trimmedQuery]);

    const storeRecentSearches = async (next) => {
        setRecentSearches(next);
        await AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
    };

    const openUser = async (details) => {
        const userId = getEasyGoUserId(details);
        if (!userId) return;
        Haptics.selectionAsync();
        const next = [
            {details, date: new Date().toISOString()},
            ...recentSearches.filter((item) => getEasyGoUserId(item.details) !== userId),
        ].slice(0, 10);
        await storeRecentSearches(next);
        navigation.navigate('ProfileSelected', {did: details.did, back: 'search'});
    };

    const deleteRecentSearch = async (userId) => {
        Haptics.selectionAsync();
        await storeRecentSearches(recentSearches.filter((item) => getEasyGoUserId(item.details) !== userId));
    };

    const updateFollowState = (userId, following) => {
        setViewerFollowingIds((current) => {
            const next = new Set(current);
            if (following) next.add(userId);
            else next.delete(userId);
            return next;
        });
    };

    const clearSearch = () => {
        setQuery('');
        setDebouncedQuery('');
        Keyboard.dismiss();
    };

    const renderUser = (details, recent = false) => {
        const userId = getEasyGoUserId(details);
        return (
            <View key={userId} style={{position: 'relative'}}>
                <TouchableOpacity
                    activeOpacity={0.65}
                    onPress={() => openUser(details)}
                    style={tailwind('flex flex-row items-center border-b border-secondary py-3 px-5')}
                >
                    <User
                        details={details}
                        showFollowButton={!recent}
                        initialFollowing={viewerFollowingIds.has(userId)}
                        onFollowChange={updateFollowState}
                    />
                </TouchableOpacity>
                {recent && (
                    <TouchableOpacity
                        onPress={() => deleteRecentSearch(userId)}
                        hitSlop={{top: 12, right: 12, bottom: 12, left: 12}}
                        style={{position: 'absolute', right: 14, top: 20}}
                    >
                        <CloseIcon />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={tailwind('flex flex-1 bg-white')}>
            <HeaderImage />
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.goBack()}
                style={{position: 'absolute', top: statusBarHeight + 14, left: 14, zIndex: 3, width: 38, height: 38, alignItems: 'center', justifyContent: 'center'}}
            >
                <Image style={{width: 24, height: 24}} resizeMode="contain" source={require('../assets/back_button.png')} />
            </TouchableOpacity>
            <View style={{paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12}}>
                <View style={{height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#CBD5E1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14}}>
                    <SmallSearchIcon color="#64748B" />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search people, posts, or #tags"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        style={{flex: 1, marginLeft: 10, fontSize: 15, color: '#0F172A'}}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}>
                            <CloseIcon />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {!searchActive ? (
                <ScrollView keyboardShouldPersistTaps="handled">
                    <Text style={[tailwind('text-slate-900 px-5'), {fontFamily: 'GmarketBold', fontSize: 16, marginTop: 6}]}>Explore topics</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 15, paddingVertical: 14}}>
                        {SOCIAL_CATEGORIES.map((category) => (
                            <TouchableOpacity
                                key={category.id}
                                onPress={() => navigation.navigate('Categories', {loadPosts: true, category})}
                                style={{height: 38, borderRadius: 19, backgroundColor: category.accent, justifyContent: 'center', paddingHorizontal: 16, marginHorizontal: 5}}
                            >
                                <Text style={{color: 'white', fontFamily: 'GmarketBold', fontSize: 11}}>{category.tag}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <Text style={[tailwind('text-slate-900 px-5'), {fontFamily: 'GmarketBold', fontSize: 16, marginTop: 8, marginBottom: 8}]}>Recent people</Text>
                    {recentSearches.length > 0
                        ? recentSearches.map((item) => renderUser(item.details, true))
                        : (
                            <View style={tailwind('bg-slate-50 px-5 py-5 items-center mt-2 mx-6 rounded-md')}>
                                <Text style={tailwind('text-secondary text-center')}>Your EasyGo profile searches will appear here.</Text>
                            </View>
                        )}
                </ScrollView>
            ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                    <Text style={[tailwind('text-slate-900 px-5'), {fontFamily: 'GmarketBold', fontSize: 16, marginTop: 6, marginBottom: 6}]}>People</Text>
                    {peopleLoading
                        ? <ActivityIndicator style={{marginVertical: 18}} size="small" color="#FF6B17" />
                        : people.map((details) => renderUser(details))}
                    {!peopleLoading && people.length === 0 && (
                        <Text style={[tailwind('text-secondary px-5'), {fontSize: 12, marginVertical: 12}]}>
                            {!BACKEND_CONFIGURED ? 'Connect the EasyGo backend to search people.' : peopleError ? "People search couldn't load." : 'No matching people.'}
                        </Text>
                    )}

                    <Text style={[tailwind('text-slate-900 px-5'), {fontFamily: 'GmarketBold', fontSize: 16, marginTop: 14, marginBottom: 6}]}>Posts</Text>
                    {(postsLoading || postsRefreshing) && posts.length === 0
                        ? <ActivityIndicator style={{marginVertical: 18}} size="small" color="#020617" />
                        : posts.map((post) => <Post key={post.stream_id} post={post} />)}
                    {!postsLoading && posts.length === 0 && (
                        <Text style={[tailwind('text-secondary px-5'), {fontSize: 12, marginVertical: 12}]}>
                            {!BACKEND_CONFIGURED ? 'Connect the EasyGo backend to search posts.' : postsError ? "Post search couldn't load." : 'No matching posts.'}
                        </Text>
                    )}
                    {hasMore && (
                        <TouchableOpacity
                            disabled={loadingMore}
                            onPress={loadMore}
                            style={{alignSelf: 'center', marginVertical: 18, borderRadius: 18, backgroundColor: '#F1F5F9', paddingHorizontal: 18, paddingVertical: 10}}
                        >
                            {loadingMore
                                ? <ActivityIndicator size="small" color="#020617" />
                                : <Text style={{fontFamily: 'GmarketBold', fontSize: 12, color: '#0F172A'}}>Load more posts</Text>}
                        </TouchableOpacity>
                    )}
                    {postsError && (
                        <TouchableOpacity onPress={refreshPosts} style={{alignSelf: 'center', marginBottom: 24}}>
                            <Text style={{color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 12}}>Try post search again</Text>
                        </TouchableOpacity>
                    )}
                    <View style={{height: 40}} />
                </ScrollView>
            )}
        </View>
    );
};

export default Search;
