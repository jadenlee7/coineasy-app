import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Image, Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';

import { GlobalContext } from '../../contexts/GlobalContext';
import { useDeviceAccountOperationLease } from '../../contexts/DeviceAccountDataContext';
import useStatusBarHeight from '../../hooks/useStatusBarHeight';
import { api } from '../../utils/api';
import { adaptSocialProfile } from '../../utils/socialPostAdapter';
import { CloseIcon } from '../Icons';

export default function NicknameModal() {
  const { user, setUser, setUserData, setPushNotifsVis, modalNicknameRef } = useContext(GlobalContext);
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const tailwind = useTailwind();
  const statusBarHeight = useStatusBarHeight();
  const snapPoints = useMemo(() => ['62%'], []);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.profile?.data?.displayName || user?.profile?.username || '');
    setLoading(false);
  }, [lease, user?.did]);

  const close = () => {
    Haptics.selectionAsync();
    Keyboard.dismiss();
    modalNicknameRef.current?.close();
  };

  const save = async () => {
    const expectedLease = lease;
    if (!expectedLease || !isCurrentLease(expectedLease)) return;
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      Alert.alert('Choose a name', 'Enter the name people should see on EasyGo.');
      return;
    }
    if (normalizedName.length > 50) {
      Alert.alert('Name is too long', 'Use 50 characters or fewer.');
      return;
    }

    Haptics.selectionAsync();
    setLoading(true);
    try {
      const result = await api.profiles.updateMe(
        { displayName: normalizedName },
        { expectedAuthUserId: expectedLease.ownerUserId },
      );
      if (!isCurrentLease(expectedLease)) return;
      const adapted = adaptSocialProfile(result?.profile);
      if (!adapted) throw new Error('profile_update_failed');
      setUser((current) => (isCurrentLease(expectedLease) ? ({
        ...current,
        id: adapted.id || current?.id,
        did: adapted.did || current?.did,
        profile: {
          ...current?.profile,
          ...adapted.profile,
          data: {
            ...current?.profile?.data,
            ...adapted.profile?.data,
          },
        },
      }) : current));
      setUserData((current) => (
        isCurrentLease(expectedLease)
          ? { ...(current || {}), ...(adapted.profile.data || {}) }
          : current
      ));
      if (!isCurrentLease(expectedLease)) return;
      close();
      setPushNotifsVis(true);
    } catch {
      if (!isCurrentLease(expectedLease)) return;
      Alert.alert('Could not save profile', 'Connect the EasyGo backend and try again.');
    } finally {
      if (isCurrentLease(expectedLease)) setLoading(false);
    }
  };

  const showPhotoNotice = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Profile photo upload is coming next',
      'EasyGo needs its own media storage endpoint before a device photo can be published. Your current photo was not changed.'
    );
  };

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={modalNicknameRef}
        index={0}
        snapPoints={snapPoints}
        enableContentPanningGesture={false}
        handleIndicatorStyle={{ backgroundColor: 'black' }}
        backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        topInset={statusBarHeight + 20}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36 }}>
          <TouchableOpacity onPress={close} style={{ position: 'absolute', right: 20, top: 8, zIndex: 2 }}>
            <CloseIcon />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'GmarketBold', fontSize: 21, color: '#0F172A', textAlign: 'center' }}>
            Your EasyGo name
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }}>
            This is the name people will see on posts and profiles.
          </Text>

          <TouchableOpacity onPress={showPhotoNotice} style={{ alignSelf: 'center', marginTop: 24 }}>
            {user?.profile?.pfp ? (
              <Image source={{ uri: user.profile.pfp }} style={{ width: 78, height: 78, borderRadius: 39 }} />
            ) : (
              <Image source={require('../../assets/add_profile_picture.png')} style={{ width: 78, height: 78 }} />
            )}
            <Text style={{ color: '#FF6B17', fontFamily: 'GmarketBold', fontSize: 11, textAlign: 'center', marginTop: 7 }}>
              Photo
            </Text>
          </TouchableOpacity>

          <Text style={{ fontFamily: 'GmarketBold', color: '#334155', fontSize: 12, marginTop: 22, marginBottom: 8 }}>
            Display name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            maxLength={50}
            placeholder="EasyGo explorer"
            placeholderTextColor="#94A3B8"
            style={{ height: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 15, color: '#0F172A', fontSize: 15 }}
          />

          <TouchableOpacity
            disabled={loading}
            onPress={save}
            style={[tailwind('rounded-full items-center justify-center'), { height: 52, backgroundColor: '#FF6B17', marginTop: 24 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="white" />
              : <Text style={{ color: 'white', fontFamily: 'GmarketBold', fontSize: 14 }}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}
