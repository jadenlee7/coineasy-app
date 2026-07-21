import React, { useContext, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { usePrivy } from '@privy-io/expo';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from '../../contexts/GlobalContext';
import { api } from '../../utils/api';
import Button from '../Button';

const LEGAL_LINKS = [
  { label: 'Help', url: 'https://drive.google.com/file/d/1x8ZvprutJSuv96KVz3vLyXHWXwi8AaVS/view?usp=sharing' },
  { label: 'Privacy policy', url: 'https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing' },
  { label: 'Terms of service', url: 'https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing' },
];

export default function SettingsModal() {
  const {
    setUser,
    setSettingsVis,
    setPushNotifsVis,
    listBlockedUser,
    setListBlockedUser,
    listMutedUsers,
    setListMutedUsers,
    listHiddenPost,
    setListHiddenPost,
    modalSettingsRef,
  } = useContext(GlobalContext);
  const { logout } = usePrivy();
  const tailwind = useTailwind();
  const [loadingAction, setLoadingAction] = useState(null);

  const close = () => {
    modalSettingsRef.current?.close();
    setSettingsVis?.(false);
  };

  const clearLocalList = (label, key, setter) => {
    Haptics.selectionAsync();
    Alert.alert(`Clear ${label}?`, 'This only resets the list stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(key);
          setter([]);
        },
      },
    ]);
  };

  const signOut = async () => {
    Haptics.selectionAsync();
    setLoadingAction('logout');
    try {
      await logout();
      setUser(null);
      close();
    } catch {
      Alert.alert('Could not sign out', 'Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const deleteAccount = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Delete EasyGo account?',
      'This permanently removes your profile, posts, follows, likes, and Orange history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('delete');
            try {
              const result = await api.deleteAccount();
              if (!result?.ok) throw new Error('delete_failed');
              await logout();
              setUser(null);
              close();
            } catch {
              Alert.alert('Could not delete account', 'Check the backend connection and try again.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const row = (label, value, onPress, danger = false) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={tailwind('flex flex-row items-center justify-between border-b border-slate-100 py-4')}
    >
      <Text style={{ fontFamily: 'GmarketMedium', fontSize: 14, color: danger ? '#DC2626' : '#0F172A' }}>
        {label}
      </Text>
      {value !== undefined ? <Text style={{ color: '#94A3B8', fontSize: 12 }}>{value}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 45 }}>
      <Text style={{ fontFamily: 'GmarketBold', fontSize: 20, color: '#0F172A', marginBottom: 10 }}>
        Settings
      </Text>

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 12 }}>
        NOTIFICATIONS
      </Text>
      {row('Push notification permission', undefined, () => {
        Haptics.selectionAsync();
        close();
        setPushNotifsVis(true);
      })}

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 24 }}>
        ON-DEVICE SAFETY LISTS
      </Text>
      {row('Blocked accounts', (listBlockedUser || []).length, () => clearLocalList('blocked accounts', 'list_blocked_user', setListBlockedUser))}
      {row('Muted accounts', (listMutedUsers || []).length, () => clearLocalList('muted accounts', 'list_muted_users', setListMutedUsers))}
      {row('Hidden posts', (listHiddenPost || []).length, () => clearLocalList('hidden posts', 'list_hidden_post', setListHiddenPost))}

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 24 }}>
        ABOUT
      </Text>
      {LEGAL_LINKS.map((item) => row(item.label, undefined, () => WebBrowser.openBrowserAsync(item.url)))}

      <View style={{ marginTop: 28 }}>
        <Button
          color="rounded-gray"
          title="Sign out"
          loading={loadingAction === 'logout'}
          onPress={signOut}
          style={{ marginBottom: 10 }}
        />
        <Button
          color="rounded-red"
          title="Delete account"
          loading={loadingAction === 'delete'}
          onPress={deleteAccount}
          style={{ marginBottom: 12 }}
        />
      </View>
    </ScrollView>
  );
}
