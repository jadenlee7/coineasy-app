import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { usePrivy } from '@privy-io/expo';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from '../../contexts/GlobalContext';
import useConsent from '../../hooks/useConsent';
import { api } from '../../utils/api';
import {
  EXPORT_SCOPE,
  buildExportFilename,
  cleanupStaleExportFiles,
  serializeExportEnvelope,
  withTemporaryJsonFile,
} from '../../utils/dataExport.mjs';
import {
  EASYGO_LEGAL_DOCUMENTS,
  getConsentDocumentReadiness,
} from '../../utils/legalDocuments.mjs';
import Button from '../Button';

const LEGAL_LINKS = [
  { label: 'Help', document: EASYGO_LEGAL_DOCUMENTS.help },
  { label: 'Privacy policy', document: EASYGO_LEGAL_DOCUMENTS.privacy },
  { label: 'Terms of service', document: EASYGO_LEGAL_DOCUMENTS.terms },
];

const EXPORTS = {
  full: {
    scope: EXPORT_SCOPE.full,
    title: 'Export full EasyGo data?',
    description: 'This JSON includes account-linked identifiers, wallet addresses, consent history, Orange activity, swaps, and social data. Share or save it only somewhere you trust.',
    request: (signal) => api.exportMyData({ signal }),
  },
  social: {
    scope: EXPORT_SCOPE.social,
    title: 'Export EasyGo social data?',
    description: 'This privacy-minimized JSON includes your public profile, posts, likes, followers, and following list. It excludes your wallet and Privy identity.',
    request: (signal) => api.exportMySocialData({ signal }),
  },
};

export default function SettingsModal() {
  const {
    user,
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
  const exportRequestRef = useRef({ controller: null, generation: 0, ownerKey: null });
  const syncedAccountKey = user?.profile?.data?.easygoUserId || null;
  const consentState = useConsent({
    accountKey: syncedAccountKey,
    enabled: Boolean(syncedAccountKey),
  });
  const consentReadiness = getConsentDocumentReadiness(
    consentState.consent?.currentVersion,
  );
  const hasStoredConsent = Boolean(
    consentState.consent?.termsAccepted
    || consentState.consent?.privacyAccepted
    || consentState.consent?.segmentingOptIn
    || consentState.consent?.marketingOptIn,
  );

  useEffect(() => {
    exportRequestRef.current.controller?.abort();
    exportRequestRef.current = {
      controller: null,
      generation: exportRequestRef.current.generation + 1,
      ownerKey: syncedAccountKey,
    };
    setLoadingAction((current) => (
      current?.startsWith('export-') ? null : current
    ));
    return () => {
      exportRequestRef.current.controller?.abort();
      exportRequestRef.current = {
        controller: null,
        generation: exportRequestRef.current.generation + 1,
        ownerKey: null,
      };
    };
  }, [syncedAccountKey]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !FileSystem.cacheDirectory) return;
    cleanupStaleExportFiles({
      directory: FileSystem.cacheDirectory,
      list: FileSystem.readDirectoryAsync,
      remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    }).catch(() => {});
  }, []);

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

  const performExport = async (kind) => {
    if (loadingAction || !syncedAccountKey) return;
    const descriptor = EXPORTS[kind];
    const controller = new AbortController();
    const generation = exportRequestRef.current.generation + 1;
    const ownerKey = syncedAccountKey;
    exportRequestRef.current.controller?.abort();
    exportRequestRef.current = { controller, generation, ownerKey };
    const isCurrentExport = () => (
      exportRequestRef.current.generation === generation
      && exportRequestRef.current.ownerKey === ownerKey
      && !controller.signal.aborted
    );
    const requireCurrentExport = () => {
      if (isCurrentExport()) return;
      const error = new Error('export_cancelled');
      error.name = 'AbortError';
      throw error;
    };
    let androidDestination = null;
    let androidCleanupFailed = false;
    setLoadingAction(`export-${kind}`);
    try {
      const payload = await descriptor.request(controller.signal);
      requireCurrentExport();
      if (Platform.OS === 'android') {
        const permission = await FileSystem.StorageAccessFramework
          .requestDirectoryPermissionsAsync();
        if (!permission.granted) return;
        requireCurrentExport();
        const filename = buildExportFilename(descriptor.scope, payload?.exportedAt);
        const contents = serializeExportEnvelope(payload, descriptor.scope);
        androidDestination = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          filename,
          'application/json',
        );
        requireCurrentExport();
        await FileSystem.writeAsStringAsync(androidDestination, contents, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (!isCurrentExport()) {
          await FileSystem.deleteAsync(androidDestination, { idempotent: true });
          androidDestination = null;
          return;
        }
        androidDestination = null;
        Alert.alert('Export saved', 'The JSON file was saved to the folder you selected.');
      } else {
        await withTemporaryJsonFile({
          directory: FileSystem.cacheDirectory,
          payload,
          expectedScope: descriptor.scope,
          write: (uri, contents) => {
            requireCurrentExport();
            return FileSystem.writeAsStringAsync(uri, contents, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          },
          share: (uri, filename) => {
            requireCurrentExport();
            return Share.share({ title: filename, url: uri });
          },
          remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
        });
      }
    } catch (exportError) {
      if (androidDestination) {
        try {
          await FileSystem.deleteAsync(androidDestination, { idempotent: true });
          androidDestination = null;
        } catch {
          androidCleanupFailed = true;
        }
      }
      if (exportError?.name === 'AbortError') return;
      if (androidCleanupFailed) {
        Alert.alert(
          'Check the selected folder',
          'The export did not finish and a partial JSON file may remain. Delete it before sharing the folder.',
        );
      } else if (['cleanup_failed', 'operation_cleanup_failed'].includes(exportError?.code)) {
        Alert.alert(
          'Temporary cleanup needs attention',
          'The share action may have created a copy, but EasyGo could not verify cache cleanup. Close EasyGo before another person uses this device; cleanup is retried on the next profile load.',
        );
      } else {
        Alert.alert(
          'Could not finish data export',
          'Check the connection and try again. EasyGo did not copy the JSON to the clipboard or log its contents.',
        );
      }
    } finally {
      if (exportRequestRef.current.generation === generation) {
        exportRequestRef.current.controller = null;
        setLoadingAction(null);
      }
    }
  };

  const requestExport = (kind) => {
    Haptics.selectionAsync();
    const descriptor = EXPORTS[kind];
    Alert.alert(descriptor.title, descriptor.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: Platform.OS === 'android' ? 'Choose folder' : 'Continue', onPress: () => performExport(kind) },
    ]);
  };

  const requestConsentRevocation = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Revoke all stored consent?',
      'Required and optional consent choices for the current server version will be set to off. You can review published documents and consent again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: consentState.revokeAll },
      ],
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

  const consentToggle = (label, description, field) => (
    <View
      key={field}
      style={tailwind('flex flex-row items-center justify-between border-b border-slate-100 py-3')}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ fontFamily: 'GmarketMedium', fontSize: 13, color: '#0F172A' }}>
          {label}
        </Text>
        <Text style={{ color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3 }}>
          {description}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={consentState.loading || consentState.saving}
        onValueChange={(value) => consentState.setChoice(field, value)}
        trackColor={{ false: '#CBD5E1', true: '#FFB27B' }}
        thumbColor={consentState.draft?.[field] ? '#FF6813' : '#F8FAFC'}
        value={Boolean(consentState.draft?.[field])}
      />
    </View>
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
        PRIVACY & DATA
      </Text>
      <View style={{ backgroundColor: '#FFF8F0', borderRadius: 16, marginTop: 10, padding: 14 }}>
        <Text style={{ color: '#0F172A', fontFamily: 'GmarketBold', fontSize: 14 }}>
          Policy consent
        </Text>
        {!syncedAccountKey && (
          <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 8 }}>
            EasyGo 계정 동기화가 끝나면 동의 상태를 확인할 수 있습니다.
          </Text>
        )}
        {consentState.loading && (
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>Loading…</Text>
        )}
        {consentState.consent && (
          <>
            <Text style={{ color: '#475569', fontSize: 12, lineHeight: 18, marginTop: 8 }}>
              Server version: {consentState.consent.currentVersion}{'\n'}
              Status: {consentState.consent.requiresReconsent ? 'Re-consent required' : 'Current'}{'\n'}
              Personalization: {consentState.consent.segmentingOptIn ? 'On' : 'Off'} · Marketing: {consentState.consent.marketingOptIn ? 'On' : 'Off'}
            </Text>
            {!consentReadiness.ready && (
              <Text style={{ color: '#B45309', fontSize: 11, lineHeight: 17, marginTop: 8 }}>
                EasyGo 전용 약관·개인정보 문서와 서버 버전이 정확히 일치할 때까지 새 동의 저장과 선택형 처리는 잠겨 있습니다.
              </Text>
            )}
            {consentReadiness.ready && consentState.draft && (
              <View style={{ marginTop: 8 }}>
                {consentToggle('Terms of service', 'Required for versioned consent.', 'termsAccepted')}
                {consentToggle('Privacy policy', 'Required for versioned consent.', 'privacyAccepted')}
                {consentToggle('Personalized experiences', 'Optional analysis for segmentation.', 'segmentingOptIn')}
                {consentToggle('Marketing analysis', 'Optional aggregate campaign measurement.', 'marketingOptIn')}
                <TouchableOpacity
                  disabled={consentState.loading || consentState.saving}
                  onPress={consentState.save}
                  style={{
                    alignItems: 'center',
                    backgroundColor: consentState.saving ? '#FDBA8C' : '#FF6813',
                    borderRadius: 22,
                    marginTop: 12,
                    paddingVertical: 11,
                  }}
                >
                  <Text style={{ color: '#FFF', fontFamily: 'GmarketBold', fontSize: 12 }}>
                    {consentState.saving ? 'Saving…' : 'Save consent choices'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {hasStoredConsent && (
              <TouchableOpacity
                disabled={consentState.loading || consentState.saving}
                onPress={requestConsentRevocation}
                style={{ marginTop: 12 }}
              >
                <Text style={{ color: '#B42318', fontFamily: 'GmarketBold', fontSize: 11 }}>
                  Revoke all stored consent
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {consentState.error && (
          <Text style={{ color: '#B42318', fontSize: 11, lineHeight: 17, marginTop: 8 }}>
            {consentState.error.message}
          </Text>
        )}
        {syncedAccountKey && !consentState.loading && !consentState.saving && (
          <TouchableOpacity onPress={() => consentState.load()} style={{ marginTop: 10 }}>
            <Text style={{ color: '#C2410C', fontFamily: 'GmarketBold', fontSize: 11 }}>
              Refresh consent status
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {row(
        'Export full EasyGo data',
        loadingAction === 'export-full' ? 'Preparing…' : 'JSON',
        () => requestExport('full'),
      )}
      {row(
        'Export social data',
        loadingAction === 'export-social' ? 'Preparing…' : 'JSON',
        () => requestExport('social'),
      )}

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 24 }}>
        ABOUT
      </Text>
      {LEGAL_LINKS.map((item) => row(
        item.label,
        item.document.configured || item.label === 'Help' ? undefined : 'Legacy',
        () => WebBrowser.openBrowserAsync(item.document.url),
      ))}

      <View style={{ marginTop: 28 }}>
        <Button
          color="rounded-gray"
          title="Sign out"
          loading={loadingAction === 'logout'}
          onPress={signOut}
          style={{ marginBottom: 10 }}
        />
        <Button
          color="disabled"
          title="Account deletion safety review"
          onPress={() => {}}
          style={{ marginBottom: 12 }}
        />
        <Text style={{ color: '#64748B', fontSize: 10, lineHeight: 15, textAlign: 'center' }}>
          Deletion is temporarily paused while EasyGo finalizes thread ownership and prevents automatic account recreation after Privy sign-out failures. Data export remains available above.
        </Text>
      </View>
    </ScrollView>
  );
}
