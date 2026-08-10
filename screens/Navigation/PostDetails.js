import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import HeaderImage from '../../components/HeaderImage';
import { NotificationsIcon } from '../../components/Icons';
import Post from '../../components/Post';
import { UserPfp } from '../../components/User';
import { GlobalContext } from '../../contexts/GlobalContext';
import { useDeviceAccountOperationLease } from '../../contexts/DeviceAccountDataContext';
import useReplies from '../../hooks/useReplies';
import { api } from '../../utils/api';
import { adaptSocialPost } from '../../utils/socialPostAdapter';

const BACKEND_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);

const PostDetails = ({ navigation, route }) => {
  const {
    user,
    postDetailsVis,
    setPostDetailsVis,
    showPostbox,
    setReplyTo,
  } = useContext(GlobalContext);
  const { isCurrentLease, lease } = useDeviceAccountOperationLease();
  const tailwind = useTailwind();
  const postId = route.params?.postId || postDetailsVis;
  const [post, setPost] = useState(null);
  const [postTargetId, setPostTargetId] = useState(null);
  const [postLoading, setPostLoading] = useState(Boolean(postId && BACKEND_CONFIGURED));
  const [postError, setPostError] = useState(null);
  const requestGenerationRef = useRef(0);
  const livePostIdRef = useRef(postId);
  const postTargetIdRef = useRef(null);
  livePostIdRef.current = postId;
  const {
    replies,
    loading: repliesLoading,
    loadingMore,
    hasMore,
    error: repliesError,
    refresh: refreshReplies,
    loadMore,
  } = useReplies(postId, { limit: 30 });

  useEffect(() => {
    if (postId) setPostDetailsVis(postId);
  }, [postId, setPostDetailsVis]);

  const loadPost = useCallback(async () => {
    const expectedLease = lease;
    const expectedPostId = postId;
    const requestGeneration = ++requestGenerationRef.current;
    const isCurrentRequest = () => (
      isCurrentLease(expectedLease)
      && requestGeneration === requestGenerationRef.current
      && livePostIdRef.current === expectedPostId
    );

    if (!expectedLease || !isCurrentLease(expectedLease)) return null;
    if (postTargetIdRef.current !== expectedPostId) setPost(null);
    postTargetIdRef.current = expectedPostId;
    setPostTargetId(expectedPostId);
    if (!BACKEND_CONFIGURED || !expectedPostId) {
      setPost(null);
      setPostLoading(false);
      setPostError(null);
      return null;
    }

    setPostLoading(true);
    setPostError(null);
    try {
      const result = await api.posts.get(expectedPostId, {
        expectedAuthUserId: expectedLease.ownerUserId,
      });
      if (!isCurrentRequest()) return null;
      const next = adaptSocialPost(result?.post || result);
      setPost(next);
      return next;
    } catch (cause) {
      if (!isCurrentRequest()) return null;
      setPostError(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    } finally {
      if (isCurrentRequest()) setPostLoading(false);
    }
  }, [isCurrentLease, lease, postId]);

  useEffect(() => {
    loadPost();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [loadPost]);

  const currentPost = postTargetId === postId ? post : null;
  const currentPostError = postTargetId === postId ? postError : null;
  const currentPostLoading = postTargetId === postId
    ? postLoading
    : Boolean(BACKEND_CONFIGURED && postId);

  const refreshAll = async () => {
    await Promise.all([loadPost(), refreshReplies()]);
  };

  const openReplyBox = () => {
    if (!currentPost) return;
    showPostbox(() => {});
    setReplyTo(currentPost);
  };

  const emptyMessage = !BACKEND_CONFIGURED
    ? 'Connect the EasyGo backend to open this post.'
    : !postId
      ? 'No post was selected.'
      : currentPostError
        ? "This post couldn't load. It may have been deleted."
        : 'Post unavailable.';

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <HeaderImage />
      <View style={{
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 5,
        paddingRight: 20,
        paddingTop: 4,
        maxHeight: 60,
      }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ margin: 15 }}
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
        >
          <Image
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
            source={require('../../assets/back_button.png')}
          />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'GmarketBold', fontSize: 17, color: '#0F172A' }}>Post</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          onPress={() => { Haptics.selectionAsync(); navigation.navigate('Notifications'); }}
        >
          <NotificationsIcon />
        </TouchableOpacity>
      </View>

      <View style={[tailwind('flex pt-2 flex-1'), { backgroundColor: 'white' }]}>
        {currentPostLoading && !currentPost ? (
          <ActivityIndicator style={{ marginTop: 35 }} size="small" color="#020617" />
        ) : currentPost ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={currentPostLoading || repliesLoading} onRefresh={refreshAll} />}
          >
            <View style={{ marginTop: -10 }}>
              <Post post={currentPost} verticalDivider={true} fontSize={15} notTouchable={true} />

              <View style={tailwind('flex flex-col')}>
                {replies.map((reply) => (
                  <Post
                    post={reply}
                    key={reply.stream_id}
                    showParent={false}
                    verticalDivider={true}
                    style={{ marginTop: -20 }}
                    notTouchable={true}
                  />
                ))}
                {repliesLoading && replies.length === 0 ? (
                  <ActivityIndicator style={{ marginBottom: 30 }} size="small" color="#020617" />
                ) : null}
                {hasMore ? (
                  <TouchableOpacity disabled={loadingMore} onPress={loadMore} style={{ alignSelf: 'center', padding: 14 }}>
                    {loadingMore
                      ? <ActivityIndicator size="small" color="#020617" />
                      : <Text style={{ color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 12 }}>Load more replies</Text>}
                  </TouchableOpacity>
                ) : null}
                {repliesError && replies.length === 0 ? (
                  <TouchableOpacity onPress={refreshReplies} style={{ alignSelf: 'center', padding: 14 }}>
                    <Text style={{ color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 12 }}>Try replies again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableHighlight
                style={[tailwind('flex flex-row rounded-full mx-4 items-center'), { backgroundColor: '#F6F6F6', marginBottom: 25, padding: 5 }]}
                underlayColor="#EFEFEF"
                onPress={openReplyBox}
              >
                <>
                  <UserPfp details={user} height={35} />
                  <Text style={{ fontFamily: 'GmarketMedium', fontSize: 13, lineHeight: 18, color: '#959595', marginLeft: 6 }}>
                    Reply
                  </Text>
                </>
              </TouchableHighlight>
            </View>
          </ScrollView>
        ) : (
          <View style={tailwind('bg-slate-50 px-4 py-5 items-center mt-4 mx-6 rounded-md')}>
            <Text style={tailwind('text-secondary text-center')}>{emptyMessage}</Text>
            {currentPostError ? (
              <TouchableOpacity onPress={loadPost} style={{ padding: 12, marginTop: 4 }}>
                <Text style={{ color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 12 }}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};

export default PostDetails;
