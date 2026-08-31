import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TabBar, TabView } from 'react-native-tab-view';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import { GlobalContext } from '../../../contexts/GlobalContext';
import { useDeviceAccountOperationLease } from '../../../contexts/DeviceAccountDataContext';
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

function followListTarget(lease, ownUserId, targetUserId) {
    if (!lease) return null;
    return Object.freeze({
        ownerUserId: lease.ownerUserId,
        sessionEpoch: lease.sessionEpoch,
        ownUserId: ownUserId || null,
        targetUserId: targetUserId || null,
    });
}

function sameFollowListTarget(left, lease, ownUserId, targetUserId) {
    return Boolean(
        left
        && lease
        && left.ownerUserId === lease.ownerUserId
        && left.sessionEpoch === lease.sessionEpoch
        && left.ownUserId === (ownUserId || null)
        && left.targetUserId === (targetUserId || null)
    );
}

const FollowNavigation = ({navigation, route}) => {
    const { user } = useContext(GlobalContext);
    const { lease, isCurrentLease } = useDeviceAccountOperationLease();
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
    const [presentedTarget, setPresentedTarget] = useState(null);
    const requestGenerationRef = useRef(0);
    const presentedTargetRef = useRef(null);
    const liveOwnUserIdRef = useRef(ownUserId);
    const liveTargetUserIdRef = useRef(targetUserId);
    liveOwnUserIdRef.current = ownUserId;
    liveTargetUserIdRef.current = targetUserId;

    const loadFollowLists = useCallback(async (pullToRefresh = false) => {
        const operationLease = lease;
        const operationOwnUserId = ownUserId;
        const operationTargetUserId = targetUserId;
        const requestGeneration = ++requestGenerationRef.current;
        const isCurrentRequest = () => (
            isCurrentLease(operationLease)
            && requestGeneration === requestGenerationRef.current
            && liveOwnUserIdRef.current === operationOwnUserId
            && liveTargetUserIdRef.current === operationTargetUserId
        );

        if (!operationLease || !isCurrentLease(operationLease)) return;
        if (!sameFollowListTarget(
            presentedTargetRef.current,
            operationLease,
            operationOwnUserId,
            operationTargetUserId,
        )) {
            const nextTarget = followListTarget(
                operationLease,
                operationOwnUserId,
                operationTargetUserId,
            );
            presentedTargetRef.current = nextTarget;
            setPresentedTarget(nextTarget);
            setFollowers([]);
            setFollowing([]);
            setMutual([]);
            setViewerFollowerIds(new Set());
            setViewerFollowingIds(new Set());
        }
        if (!operationTargetUserId) {
            setError(new Error('Missing EasyGo user id'));
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (pullToRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const ownRequests = operationOwnUserId
                ? [
                    api.follows.followers(operationOwnUserId, {
                        limit: 200,
                        expectedAuthUserId: operationLease.ownerUserId,
                    }),
                    api.follows.following(operationOwnUserId, {
                        limit: 200,
                        expectedAuthUserId: operationLease.ownerUserId,
                    }),
                ]
                : [Promise.resolve(null), Promise.resolve(null)];
            const [targetFollowersResult, targetFollowingResult, ownFollowersResult, ownFollowingResult] = await Promise.all([
                api.follows.followers(operationTargetUserId, {
                    limit: 200,
                    expectedAuthUserId: operationLease.ownerUserId,
                }),
                api.follows.following(operationTargetUserId, {
                    limit: 200,
                    expectedAuthUserId: operationLease.ownerUserId,
                }),
                ...ownRequests,
            ]);
            if (!isCurrentRequest()) return;

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
            if (!isCurrentRequest()) return;
            setError(cause instanceof Error ? cause : new Error(String(cause)));
        } finally {
            if (isCurrentRequest()) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [isCurrentLease, lease, ownUserId, targetUserId]);

    useEffect(() => {
        loadFollowLists();
        return () => {
            requestGenerationRef.current += 1;
        };
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
    const tabTargetKey = JSON.stringify([
        lease?.ownerUserId || null,
        lease?.sessionEpoch || null,
        ownUserId || null,
        targetUserId || null,
        origin,
        type || null,
    ]);
    const [tabSelection, setTabSelection] = useState(() => ({
        targetKey: tabTargetKey,
        index: initialIndex,
    }));
    const tabIndex = tabSelection.targetKey === tabTargetKey
        ? Math.min(tabSelection.index, routes.length - 1)
        : initialIndex;
    const setIndex = useCallback((index) => {
        setTabSelection({
            targetKey: tabTargetKey,
            index: Math.min(index, routes.length - 1),
        });
    }, [routes.length, tabTargetKey]);
    const presentsCurrentTarget = sameFollowListTarget(
        presentedTarget,
        lease,
        ownUserId,
        targetUserId,
    );

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
        if (!presentsCurrentTarget || loading) {
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
