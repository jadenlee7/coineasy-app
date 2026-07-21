import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TabBar, TabView } from 'react-native-tab-view';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import { GlobalContext } from '../../../contexts/GlobalContext';
import HeaderImage from '../../../components/HeaderImage';
import FollowerScreen from './FollowerScreen';
import FollowingScreen from './FollowingScreen';
import CommonFollowerScreen from './CommonFollowerScreen';
import { api } from '../../../utils/api';
import { adaptSocialProfile, getEasyGoUserId } from '../../../utils/socialPostAdapter';

const TabBarHeight = 44;
const IndicatorWidth = 80;
const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

function adaptRows(result) {
    return (result?.rows || []).map(adaptSocialProfile).filter(Boolean);
}

const FollowNavigation = ({navigation, route}) => {
    const { user } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const { origin = 'Followers', profile, type } = route.params || {};
    const targetUserId = getEasyGoUserId(profile);
    const ownUserId = getEasyGoUserId(user);
    const showMutual = type === 'selected' && Boolean(ownUserId && targetUserId !== ownUserId);

    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [mutual, setMutual] = useState([]);
    const [viewerFollowerIds, setViewerFollowerIds] = useState(new Set());
    const [viewerFollowingIds, setViewerFollowingIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadFollowLists = useCallback(async (pullToRefresh = false) => {
        if (!targetUserId) {
            setError(new Error('Missing EasyGo user id'));
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (pullToRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const ownRequests = ownUserId
                ? [
                    api.follows.followers(ownUserId, {limit: 200}),
                    api.follows.following(ownUserId, {limit: 200}),
                ]
                : [Promise.resolve(null), Promise.resolve(null)];
            const [targetFollowersResult, targetFollowingResult, ownFollowersResult, ownFollowingResult] = await Promise.all([
                api.follows.followers(targetUserId, {limit: 200}),
                api.follows.following(targetUserId, {limit: 200}),
                ...ownRequests,
            ]);

            const nextFollowers = adaptRows(targetFollowersResult);
            const nextFollowing = adaptRows(targetFollowingResult);
            const ownFollowers = adaptRows(ownFollowersResult);
            const ownFollowing = adaptRows(ownFollowingResult);
            const ownFollowerIds = new Set(ownFollowers.map(getEasyGoUserId));
            const ownFollowingIds = new Set(ownFollowing.map(getEasyGoUserId));

            setFollowers(nextFollowers);
            setFollowing(nextFollowing);
            setViewerFollowerIds(ownFollowerIds);
            setViewerFollowingIds(ownFollowingIds);
            setMutual(nextFollowers.filter((details) => ownFollowerIds.has(getEasyGoUserId(details))));
        } catch (cause) {
            setError(cause instanceof Error ? cause : new Error(String(cause)));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [ownUserId, targetUserId]);

    useEffect(() => {
        loadFollowLists();
    }, [loadFollowLists]);

    const handleFollowChange = useCallback((changedUserId, nextFollowing) => {
        setViewerFollowingIds((current) => {
            const next = new Set(current);
            if (nextFollowing) next.add(changedUserId);
            else next.delete(changedUserId);
            return next;
        });

        if (targetUserId === ownUserId) {
            setFollowing((current) => {
                if (!nextFollowing) {
                    return current.filter((details) => getEasyGoUserId(details) !== changedUserId);
                }
                if (current.some((details) => getEasyGoUserId(details) === changedUserId)) return current;
                const details = followers.find((item) => getEasyGoUserId(item) === changedUserId)
                    || mutual.find((item) => getEasyGoUserId(item) === changedUserId);
                return details ? [details, ...current] : current;
            });
        }
    }, [followers, mutual, ownUserId, targetUserId]);

    const routes = useMemo(() => showMutual
        ? [
            {key: 'followers', title: 'Followers'},
            {key: 'following', title: 'Following'},
            {key: 'mutual', title: 'Mutual'},
        ]
        : [
            {key: 'followers', title: 'Followers'},
            {key: 'following', title: 'Following'},
        ], [showMutual]);
    const initialIndex = origin === 'Following' ? 1 : origin === 'Mutual' && showMutual ? 2 : 0;
    const [tabIndex, setIndex] = useState(initialIndex);

    const commonProps = {
        error,
        backendConfigured: BACKEND_CONFIGURED,
        refreshing,
        onRefresh: () => loadFollowLists(true),
        viewerFollowerIds,
        viewerFollowingIds,
        onFollowChange: handleFollowChange,
    };

    const displayName = profile?.profile?.username || 'This user';
    const renderScene = ({route: tabRoute}) => {
        if (loading) {
            return <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />;
        }
        if (tabRoute.key === 'followers') {
            return <FollowerScreen {...commonProps} items={followers} emptyText={`${displayName} doesn't have any followers yet.`} />;
        }
        if (tabRoute.key === 'following') {
            return <FollowingScreen {...commonProps} items={following} emptyText={`${displayName} doesn't follow anyone yet.`} />;
        }
        return <CommonFollowerScreen {...commonProps} items={mutual} emptyText="You don't have any mutual followers yet." />;
    };

    const renderTabBar = (props) => (
        <TabBar
            {...props}
            style={styles.tab}
            renderLabel={({route: tabRoute, focused}) => (
                <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>{tabRoute.title}</Text>
            )}
            indicatorStyle={[
                styles.indicator,
                {
                    width: IndicatorWidth,
                    left: (Dimensions.get('window').width / routes.length - IndicatorWidth) / 2,
                },
            ]}
        />
    );

    return (
        <View style={[tailwind('flex flex-1 flex-col'), {backgroundColor: 'white'}]}>
            <HeaderImage />
            <View style={{backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingTop: 4}}>
                <TouchableOpacity style={{margin: 15}} onPress={() => {Haptics.selectionAsync(); navigation.goBack();}}>
                    <Image
                        style={{width: 24, height: 24}}
                        resizeMode="contain"
                        source={require('../../../assets/back_button.png')}
                        defaultSource={require('../../../assets/back_button.png')}
                    />
                </TouchableOpacity>
            </View>
            <TabView
                navigationState={{index: tabIndex, routes}}
                onIndexChange={setIndex}
                renderScene={renderScene}
                renderTabBar={renderTabBar}
                initialLayout={{width: Dimensions.get('window').width}}
            />
        </View>
    );
};

export default FollowNavigation;

const styles = StyleSheet.create({
    label: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    tab: {
        elevation: 0,
        shadowOpacity: 0,
        backgroundColor: 'white',
        height: TabBarHeight,
        marginTop: -10,
    },
    indicator: {
        height: 4,
        borderRadius: 10,
        backgroundColor: '#FF6B17',
    },
});
