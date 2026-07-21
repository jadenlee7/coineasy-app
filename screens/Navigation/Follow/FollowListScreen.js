import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/core';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import User from '../../../components/User';
import { getEasyGoUserId } from '../../../utils/socialPostAdapter';

export default function FollowListScreen({
    items = [],
    emptyText,
    error,
    backendConfigured = true,
    refreshing = false,
    onRefresh,
    viewerFollowerIds,
    viewerFollowingIds,
    onFollowChange,
}) {
    const navigation = useNavigation();
    const tailwind = useTailwind();

    const openProfile = (details) => {
        Haptics.selectionAsync();
        navigation.navigate('ProfileSelected', { did: details.did });
    };

    return (
        <FlatList
            data={items}
            keyExtractor={(details) => String(getEasyGoUserId(details) || details.did)}
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={items.length === 0 ? {flexGrow: 1} : undefined}
            renderItem={({item}) => {
                const userId = getEasyGoUserId(item);
                return (
                    <TouchableOpacity
                        activeOpacity={0.65}
                        onPress={() => openProfile(item)}
                        style={[tailwind('flex flex-row items-center border-b border-secondary py-3 px-5'), {minHeight: 66}]}
                    >
                        <User
                            details={item}
                            subtitle={viewerFollowerIds?.has(userId) ? 'Follows you' : null}
                            showFollowButton={true}
                            initialFollowing={viewerFollowingIds?.has(userId)}
                            onFollowChange={onFollowChange}
                        />
                    </TouchableOpacity>
                );
            }}
            ListEmptyComponent={
                <View style={tailwind('bg-slate-50 px-5 py-5 items-center mt-4 mx-6 rounded-md')}>
                    <Text style={[tailwind('text-slate-900 text-center'), {fontFamily: 'GmarketBold'}]}>
                        {!backendConfigured
                            ? 'Follower lists are getting connected.'
                            : error
                                ? "We couldn't load this list."
                                : emptyText}
                    </Text>
                    <Text style={[tailwind('text-secondary text-center'), {marginTop: 8, lineHeight: 19}]}>
                        {!backendConfigured
                            ? 'Add the backend URL to load live follow data.'
                            : error
                                ? 'Check your connection and try again.'
                                : 'This list will update as the community grows.'}
                    </Text>
                    {error && onRefresh && (
                        <TouchableOpacity
                            onPress={onRefresh}
                            style={{marginTop: 14, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9}}
                        >
                            <Text style={{color: 'white', fontFamily: 'GmarketBold', fontSize: 13}}>Try again</Text>
                        </TouchableOpacity>
                    )}
                </View>
            }
        />
    );
}
