import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';

import HeaderImage from '../../components/HeaderImage';
import { FilterIcon, InterpunctIcon } from '../../components/Icons';
import TimeAgo from '../../components/TimeAgo';
import { UserPfp, Username } from '../../components/User';
import { GlobalContext } from '../../contexts/GlobalContext';
import useNotifications from '../../hooks/useNotifications';

const FILTERS = [
  { label: 'Follows', family: 'follow' },
  { label: 'Likes', family: 'reaction' },
  { label: 'Replies', family: 'reply_to' },
];

const ACTION_LABELS = {
  reaction: 'Liked your post',
  reply_to: 'Replied to your post',
  follow: 'Followed you',
};

const Notifications = ({ navigation }) => {
  const { setPostDetailsVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [checkedFamilies, setCheckedFamilies] = useState([]);
  const modalRef = useRef(null);
  const snapPoints = useMemo(
    () => [Platform.OS === 'ios' ? '42%' : '50%'],
    []
  );
  const {
    notifications,
    loading,
    refreshing,
    error,
    backendConfigured,
    refresh,
  } = useNotifications();

  const visibleNotifications = checkedFamilies.length === 0
    ? notifications
    : notifications.filter((item) => checkedFamilies.includes(item.family));

  const openFilters = useCallback(() => modalRef.current?.present(), []);

  const toggleFilter = (family) => {
    Haptics.selectionAsync();
    setCheckedFamilies((current) => current.includes(family)
      ? current.filter((item) => item !== family)
      : [...current, family]);
  };

  const selectNotification = (notification) => {
    Haptics.selectionAsync();
    const postId = notification.post_details?.stream_id;
    if (postId) {
      setPostDetailsVis(postId);
      navigation.navigate('PostDetails', { postId });
      return;
    }

    const did = notification.user_notifiying_details?.did;
    if (did) navigation.navigate('ProfileSelected', { did, back: 'notifications' });
  };

  const emptyMessage = !backendConfigured
    ? 'Connect the EasyGo backend to load notifications.'
    : error
      ? "Notifications couldn't load. Pull down or try again."
      : checkedFamilies.length > 0 && notifications.length > 0
        ? 'No notifications match these filters.'
        : "You don't have any notifications yet.";

  return (
    <BottomSheetModalProvider>
      <View style={[tailwind('flex flex-1 flex-col'), { backgroundColor: 'white' }]}>
        <HeaderImage />

        <View style={{
          backgroundColor: 'white',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingLeft: 5,
          paddingRight: 20,
          paddingTop: 4,
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

          <Text style={{ fontFamily: 'GmarketBold', fontSize: 17, color: '#0F172A' }}>
            Activity
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Filter notifications"
            activeOpacity={0.7}
            onPress={() => { Haptics.selectionAsync(); openFilters(); }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <FilterIcon />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 50 }} size="small" color="#020617" />
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            contentContainerStyle={visibleNotifications.length === 0 ? { flexGrow: 1 } : undefined}
          >
            {visibleNotifications.map((notification) => (
              <TouchableHighlight
                key={notification.id}
                style={tailwind('items-center flex flex-row border-b border-secondary py-3 px-6')}
                underlayColor="#f1f5f9"
                onPress={() => selectNotification(notification)}
              >
                <>
                  <UserPfp details={notification.user_notifiying_details} />
                  <View style={{ marginLeft: 13, flex: 1 }}>
                    <View style={tailwind('flex flex-row items-center mb-1')}>
                      <Username details={notification.user_notifiying_details} />
                      <View style={tailwind('ml-2 mr-2')}><InterpunctIcon /></View>
                      <TimeAgo
                        timestamp={notification.notification_timestamp}
                        style={{ color: '#64748B' }}
                      />
                    </View>
                    <Text style={tailwind('text-secondary')}>
                      {ACTION_LABELS[notification.family] || 'New activity'}
                    </Text>
                    {notification.postPreview ? (
                      <Text numberOfLines={1} style={{ color: '#94A3B8', fontSize: 11, marginTop: 3 }}>
                        {notification.postPreview}
                      </Text>
                    ) : null}
                  </View>
                </>
              </TouchableHighlight>
            ))}

            {visibleNotifications.length === 0 ? (
              <View style={tailwind('bg-slate-50 px-4 py-5 items-center mt-4 mx-6 rounded-md')}>
                <Text style={tailwind('text-secondary text-center')}>{emptyMessage}</Text>
                {error ? (
                  <TouchableOpacity onPress={refresh} style={{ padding: 12, marginTop: 4 }}>
                    <Text style={{ color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 12 }}>
                      Try again
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        )}

        <BottomSheetModal
          ref={modalRef}
          index={0}
          snapPoints={snapPoints}
          handleIndicatorStyle={{ backgroundColor: 'black' }}
          handleStyle={{ height: 40, justifyContent: 'center' }}
          backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        >
          <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
            <Text style={{ fontFamily: 'GmarketBold', fontSize: 17, marginBottom: 5 }}>
              Notification filters
            </Text>
            {FILTERS.map((filter) => {
              const active = checkedFamilies.includes(filter.family);
              return (
                <TouchableOpacity
                  key={filter.family}
                  style={{
                    backgroundColor: '#F6F6F6',
                    borderRadius: 25,
                    height: 50,
                    marginTop: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => toggleFilter(filter.family)}
                >
                  <Text style={{ fontFamily: 'GmarketBold', fontSize: 15, paddingLeft: 20 }}>
                    {filter.label}
                  </Text>
                  <View style={{
                    backgroundColor: active ? '#FF6E31' : 'white',
                    width: 26,
                    height: 26,
                    borderWidth: 1,
                    borderColor: active ? '#FF6E31' : '#999',
                    borderRadius: 13,
                    marginRight: 15,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    {active ? <View style={{ backgroundColor: 'white', width: 10, height: 10, borderRadius: 5 }} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BottomSheetModal>
      </View>
    </BottomSheetModalProvider>
  );
};

export default Notifications;
