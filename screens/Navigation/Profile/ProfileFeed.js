import React, { useContext, useEffect } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import Post from '../../../components/Post.js';
import { GlobalContext } from '../../../contexts/GlobalContext.js';
import useFeed from '../../../hooks/useFeed.js';
import { getEasyGoUserId } from '../../../utils/socialPostAdapter.js';

const ProfileFeed = ({ profile }) => {
    const { setTabViewHeight } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const authorId = getEasyGoUserId(profile);
    const {
        items: posts,
        loading,
        loadingMore,
        error,
        hasMore,
        backendConfigured,
        refresh,
        loadMore,
    } = useFeed('profile', { authorId, limit: 20 });

    useEffect(() => {
        setTabViewHeight(Math.max(500, posts.length * 360 + 180));
    }, [posts.length, setTabViewHeight]);

    if (loading) {
        return (
            <View style={{ backgroundColor: 'white', minHeight: 500 }}>
                <ActivityIndicator style={{ marginTop: 25 }} size="small" color="#020617" />
            </View>
        );
    }

    if (!authorId || posts.length === 0) {
        return (
            <View style={tailwind('bg-slate-50 px-5 py-5 items-center mt-4 mx-6 rounded-md')}>
                <Text style={[tailwind('text-slate-900 text-center'), { fontFamily: 'GmarketBold' }]}>
                    {!backendConfigured
                        ? 'EasyGo profile posts are getting connected.'
                        : error
                            ? "We couldn't load these posts."
                            : 'No posts yet.'}
                </Text>
                <Text style={[tailwind('text-secondary text-center'), { marginTop: 8, lineHeight: 19 }]}>
                    {!backendConfigured
                        ? 'Add the backend URL to load the live timeline.'
                        : error
                            ? 'Check your connection and try again.'
                            : 'Posts shared by this user will appear here.'}
                </Text>
                {error && (
                    <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={refresh}
                        style={{ marginTop: 14, borderRadius: 18, backgroundColor: '#FF6B17', paddingHorizontal: 18, paddingVertical: 9 }}
                    >
                        <Text style={{ color: 'white', fontFamily: 'GmarketBold', fontSize: 13 }}>Try again</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View>
            {posts.map((post) => (
                <Post key={post.stream_id} post={post} />
            ))}
            {hasMore && (
                <TouchableOpacity
                    disabled={loadingMore}
                    onPress={loadMore}
                    style={{ alignSelf: 'center', marginVertical: 18, borderRadius: 18, backgroundColor: '#F1F5F9', paddingHorizontal: 18, paddingVertical: 10 }}
                >
                    {loadingMore
                        ? <ActivityIndicator size="small" color="#020617" />
                        : <Text style={{ color: '#0F172A', fontFamily: 'GmarketBold', fontSize: 12 }}>Load more</Text>}
                </TouchableOpacity>
            )}
        </View>
    );
};

export default ProfileFeed;
