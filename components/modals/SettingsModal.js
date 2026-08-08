import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
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
  canConfirmAccountDeletion,
  reconcileAccountDeletionStatus,
  submitAccountDeletionRequest,
} from '../../utils/accountDeletionFlow.mjs';
import { purgeAccountDeletionLocalData } from '../../utils/accountDeletionLocalData.mjs';
import {
  accountDeletionMarkerStore,
  createAccountDeletionClientRequestId,
} from '../../utils/accountDeletionStorage';
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
    setUserData,
    setPosts,
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
  const privy = usePrivy();
  const { logout } = privy;
  const tailwind = useTailwind();
  const [loadingAction, setLoadingAction] = useState(null);
  const [deletionStage, setDeletionStage] = useState('idle');
  const [deletionCapability, setDeletionCapability] = useState(null);
  const [walletRiskAcknowledged, setWalletRiskAcknowledged] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const deletionRequestRef = useRef(false);
  const currentPrivyUserIdRef = useRef(privy?.user?.id || null);
  currentPrivyUserIdRef.current = privy?.user?.id || null;
  const exportRequestRef = useRef({ controller: null, generation: 0, ownerKey: null });
  const syncedAccountKey = user?.profile?.data?.easygoUserId || null;
  const courseProgressOwner = user?.profile?.data?.courseProgressOwner
    || privy?.user?.id
    || null;
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

  useEffect(() => {
    deletionRequestRef.current = false;
    setDeletionStage('idle');
    setDeletionCapability(null);
    setWalletRiskAcknowledged(false);
    setDeletionConfirmation('');
  }, [privy?.user?.id]);

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
    if (deletionRequestRef.current) return;
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

  const purgeDeletedAccountFromDevice = async () => {
    let purgeError = null;
    try {
      await purgeAccountDeletionLocalData({
        courseProgressOwner,
        removeMany: (keys) => AsyncStorage.multiRemove(keys),
      });
      if (FileSystem.cacheDirectory) {
        const cleanup = await cleanupStaleExportFiles({
          directory: FileSystem.cacheDirectory,
          list: FileSystem.readDirectoryAsync,
          remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
        });
        if (cleanup.failed > 0) throw new Error('account_deletion_export_cleanup_failed');
      }
    } catch (error) {
      purgeError = error;
    }
    setUser(null);
    setUserData?.(null);
    setPosts?.([]);
    setListBlockedUser?.([]);
    setListMutedUsers?.([]);
    setListHiddenPost?.([]);
    if (purgeError) throw purgeError;
  };

  const prepareAccountDeletion = async () => {
    const ownerUserId = currentPrivyUserIdRef.current;
    if (!ownerUserId || loadingAction || deletionRequestRef.current) return;

    deletionRequestRef.current = true;
    Haptics.selectionAsync();
    setLoadingAction('deletion-status');
    try {
      const status = await api.accountDeletionStatus({
        expectedAuthUserId: ownerUserId,
      });
      if (currentPrivyUserIdRef.current !== ownerUserId) {
        throw new Error('account_session_changed');
      }

      if (status?.state) {
        const clientRequestId = createAccountDeletionClientRequestId();
        await reconcileAccountDeletionStatus({
          markerStore: accountDeletionMarkerStore,
          userId: ownerUserId,
          clientRequestId,
          status,
          purgeLocalData: purgeDeletedAccountFromDevice,
          logout,
        });
        close();
        return;
      }

      if (status?.available !== true) {
        setDeletionCapability(null);
        setDeletionStage('idle');
        Alert.alert(
          '계정 삭제 준비 중',
          '현재 내부 안전 검토가 진행 중입니다. 데이터 내보내기는 위 메뉴에서 계속 사용할 수 있습니다.',
        );
        return;
      }

      setDeletionCapability({ available: true, ownerUserId });
      setWalletRiskAcknowledged(false);
      setDeletionConfirmation('');
      setDeletionStage('confirm');
    } catch {
      Alert.alert(
        '삭제 가능 여부를 확인하지 못했습니다',
        '계정이나 데이터를 변경하지 않았습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
      );
    } finally {
      deletionRequestRef.current = false;
      setLoadingAction(null);
    }
  };

  const deletionReady = canConfirmAccountDeletion({
    available: deletionCapability?.available,
    walletRiskAcknowledged,
    confirmationText: deletionConfirmation,
    expectedUserId: deletionCapability?.ownerUserId,
    currentUserId: currentPrivyUserIdRef.current,
  });

  const confirmAccountDeletion = async () => {
    const ownerUserId = deletionCapability?.ownerUserId;
    if (!deletionReady || !ownerUserId || deletionRequestRef.current) return;

    deletionRequestRef.current = true;
    setLoadingAction('account-deletion');
    try {
      const outcome = await submitAccountDeletionRequest({
        markerStore: accountDeletionMarkerStore,
        userId: ownerUserId,
        clientRequestId: createAccountDeletionClientRequestId(),
        walletRiskAcknowledged: true,
        request: (clientRequestId) => api.requestAccountDeletion({
          clientRequestId,
          walletRiskAcknowledged: true,
          expectedAuthUserId: ownerUserId,
        }),
        purgeLocalData: purgeDeletedAccountFromDevice,
        logout,
      });

      if (outcome.status === 'rejected') {
        deletionRequestRef.current = false;
        setDeletionStage('idle');
        setDeletionCapability(null);
        Alert.alert(
          '앱 업데이트가 필요합니다',
          '삭제 확인 형식을 서버가 받아들이지 않았습니다. 계정과 데이터는 변경되지 않았습니다.',
        );
      } else {
        close();
      }
    } catch {
      deletionRequestRef.current = false;
      Alert.alert(
        '안전 잠금을 저장하지 못했습니다',
        '삭제 요청은 전송하지 않았습니다. 기기의 보안 저장소를 확인한 뒤 다시 시도해 주세요.',
      );
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

        {deletionStage !== 'confirm' ? (
          <>
            <TouchableOpacity
              accessibilityHint="서버 안전 상태를 확인한 뒤 계정 삭제 안내를 엽니다."
              accessibilityLabel="EasyGo 계정 삭제"
              accessibilityRole="button"
              disabled={Boolean(loadingAction)}
              onPress={prepareAccountDeletion}
              style={{
                alignItems: 'center',
                backgroundColor: '#F1F5F9',
                borderRadius: 28,
                marginBottom: 12,
                opacity: loadingAction ? 0.55 : 1,
                paddingHorizontal: 28,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: '#B42318', fontFamily: 'GmarketBold', fontSize: 14 }}>
                {loadingAction === 'deletion-status' ? '안전 상태 확인 중…' : 'Delete EasyGo account'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#64748B', fontSize: 10, lineHeight: 15, textAlign: 'center' }}>
              신규 삭제 요청은 서버·지갑·재로그인 안전 조건이 모두 통과한 경우에만 열립니다. 데이터 내보내기는 위 메뉴에서 계속 사용할 수 있습니다.
            </Text>
          </>
        ) : (
          <View style={{ backgroundColor: '#FFF1F2', borderRadius: 18, padding: 16 }}>
            <Text style={{ color: '#881337', fontFamily: 'GmarketBold', fontSize: 16 }}>
              EasyGo 계정을 영구 삭제할까요?
            </Text>
            <Text style={{ color: '#4C0519', fontSize: 11, lineHeight: 18, marginTop: 10 }}>
              EasyGo 프로필·활동·게시물 내용은 제거됩니다. 다른 사용자의 답글은 유지되며 “Deleted account” 표시가 남을 수 있습니다.{"\n\n"}
              Base 체인의 거래 기록은 블록체인에서 삭제할 수 없습니다. Embedded wallet 접근과 복구가 영구적으로 불가능해질 수 있으므로 먼저 자산을 다른 지갑으로 옮기세요.{"\n\n"}
              Apple·Privy 연결 정리는 추가 시간이 걸릴 수 있으며, 사용자가 내보낸 JSON 파일은 EasyGo가 회수할 수 없습니다.
            </Text>

            <View style={{ alignItems: 'center', flexDirection: 'row', marginTop: 16 }}>
              <Switch
                accessibilityLabel="지갑 자산 이전 또는 영구 손실 위험 동의"
                onValueChange={setWalletRiskAcknowledged}
                trackColor={{ false: '#CBD5E1', true: '#FDA4AF' }}
                thumbColor={walletRiskAcknowledged ? '#BE123C' : '#F8FAFC'}
                value={walletRiskAcknowledged}
              />
              <Text style={{ color: '#4C0519', flex: 1, fontSize: 11, lineHeight: 17, marginLeft: 10 }}>
                지갑 자산을 이전했거나, 접근 권한을 영구적으로 잃을 수 있음을 이해합니다.
              </Text>
            </View>

            <Text style={{ color: '#881337', fontFamily: 'GmarketBold', fontSize: 11, marginTop: 16 }}>
              계속하려면 DELETE를 정확히 입력하세요.
            </Text>
            <TextInput
              accessibilityLabel="계정 삭제 확인 문구"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={loadingAction !== 'account-deletion'}
              onChangeText={setDeletionConfirmation}
              placeholder="DELETE"
              style={{
                backgroundColor: '#FFF',
                borderColor: '#FDA4AF',
                borderRadius: 12,
                borderWidth: 1,
                color: '#0F172A',
                fontSize: 14,
                marginTop: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              value={deletionConfirmation}
            />

            <TouchableOpacity
              accessibilityLabel="EasyGo 계정 영구 삭제 확인"
              accessibilityRole="button"
              disabled={!deletionReady || loadingAction === 'account-deletion'}
              onPress={confirmAccountDeletion}
              style={{
                alignItems: 'center',
                backgroundColor: deletionReady ? '#BE123C' : '#CBD5E1',
                borderRadius: 24,
                marginTop: 14,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: '#FFF', fontFamily: 'GmarketBold', fontSize: 13 }}>
                {loadingAction === 'account-deletion' ? '삭제 요청 보호 중…' : 'Permanently delete account'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={loadingAction === 'account-deletion'}
              onPress={() => {
                setDeletionStage('idle');
                setDeletionCapability(null);
                setWalletRiskAcknowledged(false);
                setDeletionConfirmation('');
              }}
              style={{ alignItems: 'center', marginTop: 14 }}
            >
              <Text style={{ color: '#475569', fontFamily: 'GmarketBold', fontSize: 12 }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
