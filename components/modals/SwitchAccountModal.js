import React, { useContext, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from '../../contexts/GlobalContext';
import {
  useDeviceAccountData,
  useDeviceAccountOperationLease,
} from '../../contexts/DeviceAccountDataContext';
import { api } from '../../utils/api';
import Button from '../Button';
import { UserPfp, Username } from '../User';

export default function SwitchAccountModal() {
  const { user, setUser, modalSwitchRef } = useContext(GlobalContext);
  const { logout } = usePrivy();
  const { clearExpoPushToken, expoPushToken } = useDeviceAccountData();
  const { lease: renderLease, isCurrentLease } = useDeviceAccountOperationLease();
  const tailwind = useTailwind();
  const [loading, setLoading] = useState(false);

  const useAnotherAccount = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Use another account?',
      'EasyGo uses Privy sessions. You will sign out, then choose another login on the welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          onPress: async () => {
            const expectedLease = renderLease;
            if (!isCurrentLease(expectedLease)) return;
            setLoading(true);
            try {
              if (expoPushToken) {
                try {
                  await api.unregisterPushToken({
                    token: expoPushToken,
                    expectedAuthUserId: expectedLease.ownerUserId,
                  });
                  if (isCurrentLease(expectedLease)) await clearExpoPushToken();
                } catch {
                  // Account switching must remain possible while offline.
                }
              }
              if (!isCurrentLease(expectedLease)) return;
              await logout();
              setUser(null);
              modalSwitchRef.current?.close();
            } catch {
              Alert.alert('Could not sign out', 'Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 }}>
      <Text style={{ fontFamily: 'GmarketBold', fontSize: 18, color: '#0F172A' }}>Account</Text>
      <View style={tailwind('flex flex-row items-center bg-slate-50 rounded-md p-4 mt-4')}>
        <UserPfp details={user} />
        <View style={{ marginLeft: 12 }}>
          <Username details={user} />
          <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>Current Privy session</Text>
        </View>
      </View>
      <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18, marginVertical: 18 }}>
        Multiple saved Orbis sessions are no longer used. Sign out to authenticate another EasyGo account securely.
      </Text>
      <Button color="rounded-gray" title="Use another account" loading={loading} onPress={useAnotherAccount} />
    </View>
  );
}
