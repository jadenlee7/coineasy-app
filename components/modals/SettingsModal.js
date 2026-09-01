import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { usePrivy } from '@privy-io/expo';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from '../../contexts/GlobalContext';
import { useDeviceAccountData } from '../../contexts/DeviceAccountDataContext';
import useConsent from '../../hooks/useConsent';
import { api, ApiError } from '../../utils/api';
import {
  localBlockedAccountEntries,
  removeLocalBlockedAccountEntries,
  removeServerBlockedAccountId,
} from '../../utils/blockedAccounts.mjs';
import { unregisterPushTokenBeforeLogout } from '../../utils/pushTokenRegistration.mjs';
import {
  canConfirmAccountDeletion,
  reconcileAccountDeletionStatus,
  submitAccountDeletionRequest,
} from '../../utils/accountDeletionFlow.mjs';
import {
  ACCOUNT_DELETION_REAUTH_ERROR,
  AccountDeletionReauthError,
  createAccountDeletionReauthCoordinator,
} from '../../utils/accountDeletionReauth.mjs';
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
import { EASYGO_SUPPORT_CONTACT } from '../../utils/supportContact.mjs';
import Button from '../Button';

const LEGAL_LINKS = [
  { label: 'Privacy policy', document: EASYGO_LEGAL_DOCUMENTS.privacy },
  { label: 'Terms of service', document: EASYGO_LEGAL_DOCUMENTS.terms },
];

function showSupportOpenError() {
  Alert.alert(
    'Could not open support',
    `Contact EasyGo at ${EASYGO_SUPPORT_CONTACT.email}.`,
  );
}

function openSupportCenter() {
  if (!EASYGO_SUPPORT_CONTACT.url) {
    showSupportOpenError();
    return;
  }
  WebBrowser.openBrowserAsync(EASYGO_SUPPORT_CONTACT.url).catch(showSupportOpenError);
}

function emailSupport() {
  Linking.openURL(EASYGO_SUPPORT_CONTACT.mailtoUrl).catch(showSupportOpenError);
}

function openLegalDocument(document, label) {
  if (!document?.url) {
    Alert.alert(
      'Policy document pending',
      `The approved EasyGo ${label.toLowerCase()} has not been configured yet.`,
    );
    return;
  }
  WebBrowser.openBrowserAsync(document.url);
}

function accountDeletionAvailabilityMessage(error) {
  if (error instanceof ApiError) {
    const code = error.body?.error;
    if (code === 'stable_provider_identity_required'
      || code === 'stable_provider_identity_unavailable') {
      return '현재 로그인 제공자는 이 빌드의 안전한 계정 삭제 재인증을 지원하지 않습니다. 삭제 요청은 전송되지 않았고 데이터는 변경되지 않았습니다.';
    }
    if (code === 'account_deletion_disabled'
      || code === 'account_deletion_reauth_disabled'
      || code === 'account_deletion_not_configured') {
      return '제공자 계정 정리와 최근 로그인 확인이 아직 릴리스 승인되지 않아 새 삭제 요청이 잠겨 있습니다. 데이터는 변경되지 않았습니다.';
    }
    if (code === 'privy_not_configured' || code === 'privy_unavailable') {
      return '로그인 제공자 상태를 확인할 수 없어 안전하게 중단했습니다. 삭제 요청은 전송되지 않았습니다.';
    }
  }
  return '계정이나 데이터를 변경하지 않았습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}

const EXPORTS = {
  full: {
    scope: EXPORT_SCOPE.full,
    title: 'Export full EasyGo data?',
    description: 'This JSON includes account-linked identifiers, wallet addresses, consent history, Orange activity, swaps, and social data. Share or save it only somewhere you trust.',
    request: (signal, expectedAuthUserId) => api.exportMyData({
      signal,
      expectedAuthUserId,
    }),
  },
  social: {
    scope: EXPORT_SCOPE.social,
    title: 'Export EasyGo social data?',
    description: 'This privacy-minimized JSON includes your public profile, posts, likes, followers, and following list. It excludes your wallet and Privy identity.',
    request: (signal, expectedAuthUserId) => api.exportMySocialData({
      signal,
      expectedAuthUserId,
    }),
  },
};

export default function SettingsModal() {
  const {
    user,
    setUser,
    setSettingsVis,
    setPushNotifsVis,
    modalSettingsRef,
  } = useContext(GlobalContext);
  const {
    accountLease: deviceAccountLease,
    blockedAccounts: listBlockedUser,
    clearExpoPushToken,
    clearHiddenPosts,
    clearMutedAccounts,
    hiddenPosts: listHiddenPost,
    expoPushToken,
    mutedAccounts: listMutedUsers,
    ownerUserId: deviceOwnerUserId,
    isCurrentAccountLease,
    saveBlockedAccounts,
    sealOwnerData,
    sessionEpoch: deviceSessionEpoch,
  } = useDeviceAccountData();
  const privy = usePrivy();
  const { logout } = privy;
  const tailwind = useTailwind();
  const [loadingAction, setLoadingAction] = useState(null);
  const [deletionStage, setDeletionStage] = useState('idle');
  const [deletionCapability, setDeletionCapability] = useState(null);
  const [walletRiskAcknowledged, setWalletRiskAcknowledged] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [blockedAccountsOpen, setBlockedAccountsOpen] = useState(false);
  const [serverBlockedAccounts, setServerBlockedAccounts] = useState([]);
  const [blockedAccountsCursor, setBlockedAccountsCursor] = useState(null);
  const [blockedAccountsError, setBlockedAccountsError] = useState(null);
  const [blockedAccountsLoading, setBlockedAccountsLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState(null);
  const blockedAccountsRequestRef = useRef(0);
  const deletionRequestRef = useRef(false);
  const deletionActionRef = useRef(null);
  const currentPrivyUserId = privy?.user?.id || null;
  const currentPrivyUserIdRef = useRef(currentPrivyUserId);
  currentPrivyUserIdRef.current = currentPrivyUserId;
  const deviceAccountLeaseRef = useRef(deviceAccountLease);
  deviceAccountLeaseRef.current = deviceAccountLease;
  const deletionReauthRef = useRef(null);
  if (!deletionReauthRef.current) {
    deletionReauthRef.current = createAccountDeletionReauthCoordinator({
      getCurrentOwnerUserId: () => (
        isCurrentAccountLease(deviceAccountLeaseRef.current)
          ? currentPrivyUserIdRef.current
          : null
      ),
    });
  }
  const syncedAccountKey = user?.profile?.data?.easygoUserId || null;
  const accountOperationRef = useRef(null);
  const currentAccountOperation = accountOperationRef.current;
  if (
    !currentAccountOperation
    || currentAccountOperation.ownerUserId !== currentPrivyUserId
    || currentAccountOperation.accountKey !== syncedAccountKey
    || currentAccountOperation.accountLease !== deviceAccountLease
    || currentAccountOperation.deviceOwnerUserId !== deviceOwnerUserId
    || currentAccountOperation.sessionEpoch !== deviceSessionEpoch
  ) {
    accountOperationRef.current = Object.freeze({
      ownerUserId: currentPrivyUserId,
      accountKey: syncedAccountKey,
      accountLease: deviceAccountLease,
      deviceOwnerUserId,
      sessionEpoch: deviceSessionEpoch,
    });
  }
  const settingsMountedRef = useRef(false);
  const exportRequestRef = useRef({ controller: null, generation: 0, ownerKey: null });
  const isCurrentAccountOperation = (expectedOperation) => Boolean(
    settingsMountedRef.current
    && expectedOperation
    && accountOperationRef.current === expectedOperation
    && isCurrentAccountLease(expectedOperation.accountLease)
    && expectedOperation.ownerUserId
    && expectedOperation.ownerUserId === expectedOperation.deviceOwnerUserId
    && expectedOperation.ownerUserId === currentPrivyUserIdRef.current
    && expectedOperation.accountKey
    && Number.isSafeInteger(expectedOperation.sessionEpoch)
  );
  const isCurrentDeletionOwner = (operation) => Boolean(
    operation
    && operation.ownerUserId
    && operation.ownerUserId === currentPrivyUserIdRef.current
    && isCurrentAccountLease(operation.accountLease)
  );
  const isCurrentDeletionAction = (operation) => Boolean(
    deletionActionRef.current === operation
    && isCurrentDeletionOwner(operation)
  );
  const consentState = useConsent({
    accountKey: syncedAccountKey,
    authOwnerUserId: currentPrivyUserId,
    enabled: Boolean(syncedAccountKey && currentPrivyUserId),
  });
  const consentReadiness = getConsentDocumentReadiness(
    consentState.consent?.currentVersion,
  );
  const consentEditingReady = consentReadiness.ready
    && consentState.consent?.grantsEnabled === true;
  const hasStoredConsent = Boolean(
    consentState.consent?.termsAccepted
    || consentState.consent?.privacyAccepted
    || consentState.consent?.segmentingOptIn
    || consentState.consent?.marketingOptIn,
  );
  const localBlockedDids = localBlockedAccountEntries(listBlockedUser);

  useEffect(() => {
    settingsMountedRef.current = true;
    return () => { settingsMountedRef.current = false; };
  }, []);

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
  }, [currentPrivyUserId, deviceOwnerUserId, deviceSessionEpoch, syncedAccountKey]);

  useEffect(() => {
    blockedAccountsRequestRef.current += 1;
    setBlockedAccountsOpen(false);
    setServerBlockedAccounts([]);
    setBlockedAccountsCursor(null);
    setBlockedAccountsError(null);
    setBlockedAccountsLoading(false);
    setUnblockingUserId(null);
  }, [currentPrivyUserId, deviceOwnerUserId, deviceSessionEpoch]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !FileSystem.cacheDirectory) return;
    cleanupStaleExportFiles({
      directory: FileSystem.cacheDirectory,
      list: FileSystem.readDirectoryAsync,
      remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    deletionReauthRef.current?.cancel();
    deletionActionRef.current = null;
    deletionRequestRef.current = false;
    setLoadingAction((current) => (
      current === 'deletion-status' || current === 'account-deletion' ? null : current
    ));
    setDeletionStage('idle');
    setDeletionCapability(null);
    setWalletRiskAcknowledged(false);
    setDeletionConfirmation('');
  }, [privy?.user?.id]);

  useEffect(() => () => {
    deletionReauthRef.current?.cancel();
    deletionActionRef.current = null;
    deletionRequestRef.current = false;
  }, []);

  const close = () => {
    modalSettingsRef.current?.close();
    setSettingsVis?.(false);
  };

  const clearLocalList = (label, clear) => {
    Haptics.selectionAsync();
    Alert.alert(`Clear ${label}?`, 'This only resets the list stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clear();
        },
      },
    ]);
  };

  const clearDeviceOnlyBlocks = () => {
    const expectedOperation = accountOperationRef.current;
    if (!isCurrentAccountOperation(expectedOperation)) return;
    Haptics.selectionAsync();
    Alert.alert(
      'Remove on-device blocks?',
      'Accounts filtered by older app versions may appear again on this device. Account-wide blocks and following are unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!isCurrentAccountOperation(expectedOperation)) return;
            const saved = await saveBlockedAccounts(removeLocalBlockedAccountEntries);
            if (!saved && isCurrentAccountOperation(expectedOperation)) {
              Alert.alert('Could not remove on-device blocks', 'Please reopen EasyGo and try again.');
            }
          },
        },
      ],
    );
  };

  const loadBlockedAccounts = async ({ append = false } = {}) => {
    const expectedOperation = accountOperationRef.current;
    if (!isCurrentAccountOperation(expectedOperation) || blockedAccountsLoading) return;
    const cursor = append ? blockedAccountsCursor : null;
    const requestId = ++blockedAccountsRequestRef.current;
    const isCurrentRequest = () => (
      requestId === blockedAccountsRequestRef.current
      && isCurrentAccountOperation(expectedOperation)
    );
    setBlockedAccountsLoading(true);
    setBlockedAccountsError(null);
    try {
      const result = await api.blocks.list({
        cursor,
        limit: 100,
        expectedAuthUserId: expectedOperation.ownerUserId,
      });
      if (!isCurrentRequest()) return;
      const nextRows = Array.isArray(result?.rows) ? result.rows : [];
      setServerBlockedAccounts((current) => {
        if (!append) return nextRows;
        const byId = new Map(current.map((item) => [item.id, item]));
        nextRows.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setBlockedAccountsCursor(result?.nextCursor || null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setBlockedAccountsError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (isCurrentRequest()) setBlockedAccountsLoading(false);
    }
  };

  const toggleBlockedAccounts = () => {
    Haptics.selectionAsync();
    if (blockedAccountsOpen) {
      blockedAccountsRequestRef.current += 1;
      setBlockedAccountsOpen(false);
      setBlockedAccountsLoading(false);
      return;
    }
    setBlockedAccountsOpen(true);
    loadBlockedAccounts();
  };

  const requestUnblock = (blockedAccount) => {
    const expectedOperation = accountOperationRef.current;
    if (!blockedAccount?.id || !isCurrentAccountOperation(expectedOperation)) return;
    Haptics.selectionAsync();
    Alert.alert(
      `Unblock ${blockedAccount.username ? `@${blockedAccount.username}` : 'this account'}?`,
      'Their public EasyGo profile and posts can appear again while you are signed in. Following is not restored automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!isCurrentAccountOperation(expectedOperation)) return;
            setUnblockingUserId(blockedAccount.id);
            let serverUnblocked = false;
            try {
              const result = await api.blocks.unblock(blockedAccount.id, {
                expectedAuthUserId: expectedOperation.ownerUserId,
              });
              if (!isCurrentAccountOperation(expectedOperation)) return;
              if (result?.blocked !== false) throw new Error('unblock_not_persisted');
              serverUnblocked = true;
              setServerBlockedAccounts((current) => (
                current.filter((item) => item.id !== blockedAccount.id)
              ));
              // Remove only this EasyGo account. Other server blocks and
              // historical DID entries must keep filtering already-rendered UI.
              try {
                await saveBlockedAccounts((entries) => removeServerBlockedAccountId(
                  entries,
                  blockedAccount.id,
                ));
              } catch {
                // The server unblock is authoritative. A later complete block
                // list synchronization repairs this owner-scoped cache.
              }
            } catch (error) {
              if (!isCurrentAccountOperation(expectedOperation)) return;
              if (serverUnblocked) return;
              Alert.alert(
                'Could not unblock account',
                error instanceof ApiError && error.status === 401
                  ? 'Your login expired. Sign in again and retry.'
                  : 'EasyGo did not confirm the change. Check the connection and try again.',
              );
            } finally {
              if (isCurrentAccountOperation(expectedOperation)) setUnblockingUserId(null);
            }
          },
        },
      ],
    );
  };

  const signOut = async () => {
    const expectedOperation = accountOperationRef.current;
    if (
      deletionRequestRef.current
      || !isCurrentAccountOperation(expectedOperation)
    ) return;
    Haptics.selectionAsync();
    setLoadingAction('logout');
    try {
      await unregisterPushTokenBeforeLogout({
        token: expoPushToken,
        ownerUserId: expectedOperation.ownerUserId,
        unregister: api.unregisterPushToken,
        clearLocal: clearExpoPushToken,
        isCurrent: () => isCurrentAccountOperation(expectedOperation),
      });
      if (!isCurrentAccountOperation(expectedOperation)) return;
      await logout();
      if (!isCurrentAccountOperation(expectedOperation)) return;
      setUser(null);
      close();
    } catch {
      if (!isCurrentAccountOperation(expectedOperation)) return;
      Alert.alert('Could not sign out', 'Please try again.');
    } finally {
      if (isCurrentAccountOperation(expectedOperation)) {
        setLoadingAction(null);
      }
    }
  };

  const prepareAccountDeletion = async () => {
    const accountOperation = accountOperationRef.current;
    const ownerUserId = accountOperation?.ownerUserId;
    if (
      !isCurrentAccountOperation(accountOperation)
      || !ownerUserId
      || loadingAction
      || deletionRequestRef.current
    ) return;

    const operation = {
      kind: 'status',
      ownerUserId,
      accountLease: accountOperation.accountLease,
    };
    deletionActionRef.current = operation;
    deletionRequestRef.current = true;
    Haptics.selectionAsync();
    setLoadingAction('deletion-status');
    try {
      const status = await api.accountDeletionStatus({
        expectedAuthUserId: ownerUserId,
      });
      if (!isCurrentDeletionOwner(operation)) {
        throw new Error('account_session_changed');
      }

      if (status?.state) {
        const clientRequestId = createAccountDeletionClientRequestId();
        await reconcileAccountDeletionStatus({
          markerStore: accountDeletionMarkerStore,
          userId: ownerUserId,
          clientRequestId,
          status,
          // Writing the marker immediately replaces this modal with the
          // always-mounted pending screen. That screen, not this stale
          // closure, owns account-bound device cleanup and logout.
          isCurrentOwner: () => false,
        });
        if (
          !isCurrentDeletionAction(operation)
        ) return;
        close();
        return;
      }

      if (status?.available !== true) {
        setDeletionCapability(null);
        setDeletionStage('idle');
        Alert.alert(
          '계정 삭제 준비 중',
          '제공자 계정 정리와 최근 로그인 확인이 릴리스 승인될 때까지 새 삭제 요청은 잠겨 있습니다. 계정과 데이터는 변경되지 않았으며, 데이터 내보내기는 위 메뉴에서 계속 사용할 수 있습니다.',
        );
        return;
      }

      setDeletionCapability({ available: true, ownerUserId });
      setWalletRiskAcknowledged(false);
      setDeletionConfirmation('');
      setDeletionStage('confirm');
    } catch (error) {
      if (
        !isCurrentDeletionAction(operation)
      ) return;
      Alert.alert(
        '삭제 가능 여부를 확인하지 못했습니다',
        accountDeletionAvailabilityMessage(error),
      );
    } finally {
      if (
        isCurrentDeletionAction(operation)
      ) {
        deletionActionRef.current = null;
        deletionRequestRef.current = false;
        setLoadingAction(null);
      }
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
    const accountOperation = accountOperationRef.current;
    const ownerUserId = deletionCapability?.ownerUserId;
    if (
      !isCurrentAccountOperation(accountOperation)
      || accountOperation.ownerUserId !== ownerUserId
      || !deletionReady
      || !ownerUserId
      || loadingAction
      || deletionRequestRef.current
    ) return;

    const operation = {
      kind: 'delete',
      ownerUserId,
      accountLease: accountOperation.accountLease,
    };
    deletionActionRef.current = operation;
    deletionRequestRef.current = true;
    setLoadingAction('account-deletion');
    const clientRequestId = createAccountDeletionClientRequestId();
    let reauthCompleted = false;
    let challengeId = null;
    let reauthProof = null;
    try {
      const verified = await deletionReauthRef.current.run({
        ownerUserId,
        clientRequestId,
        isAppleAuthenticationAvailable: () => (
          Platform.OS === 'ios'
            ? AppleAuthentication.isAvailableAsync()
            : Promise.resolve(false)
        ),
        requestChallenge: (params) => api.accountDeletionReauthChallenge(params),
        signInWithApple: (options) => AppleAuthentication.signInAsync(options),
        verifyChallenge: (params) => api.accountDeletionReauthVerify(params),
      });
      if (!isCurrentDeletionOwner(operation)) {
        throw new AccountDeletionReauthError(
          ACCOUNT_DELETION_REAUTH_ERROR.sessionChanged,
        );
      }
      reauthCompleted = true;
      challengeId = verified.challengeId;
      reauthProof = verified.reauthProof;

      const outcome = await submitAccountDeletionRequest({
        markerStore: accountDeletionMarkerStore,
        userId: ownerUserId,
        clientRequestId,
        walletRiskAcknowledged: true,
        sealLocalData: () => sealOwnerData(ownerUserId),
        // markerStore.begin unmounts Settings before the server responds.
        // Defer cleanup to AccountDeletionPending, whose owner reader remains
        // live while it reconciles the accepted marker.
        isCurrentOwner: () => false,
        request: (authoritativeClientRequestId) => {
          if (
            authoritativeClientRequestId !== clientRequestId
            || !isCurrentDeletionOwner(operation)
          ) {
            throw new Error('account_deletion_reauth_binding_changed');
          }
          return api.requestAccountDeletion({
            challengeId,
            clientRequestId: authoritativeClientRequestId,
            reauthProof,
            walletRiskAcknowledged: true,
            expectedAuthUserId: ownerUserId,
          });
        },
      });

      if (
        !isCurrentDeletionAction(operation)
      ) return;

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
    } catch (error) {
      if (
        !isCurrentDeletionAction(operation)
      ) return;
      deletionRequestRef.current = false;
      if (!reauthCompleted) {
        if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.cancelled) {
          Alert.alert(
            '최근 로그인 확인이 취소되었습니다',
            '계정 삭제 요청은 전송하지 않았습니다.',
          );
        } else if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.unavailable) {
          Alert.alert(
            '안전한 재인증을 사용할 수 없습니다',
            '이 로그인 제공자 또는 기기에서는 계정 삭제를 진행할 수 없습니다. 삭제 요청은 전송되지 않았고 계정과 데이터는 변경되지 않았습니다.',
          );
        } else if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.sessionChanged) {
          Alert.alert(
            '로그인 계정이 변경되었습니다',
            '계정 삭제 요청은 전송하지 않았습니다. 현재 계정에서 다시 시작해 주세요.',
          );
        } else {
          Alert.alert(
            '최근 로그인 확인을 완료하지 못했습니다',
            '계정 삭제 요청은 전송하지 않았습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
      } else {
        Alert.alert(
          '안전 잠금을 저장하지 못했습니다',
          '삭제 요청은 전송하지 않았습니다. 기기의 보안 저장소를 확인한 뒤 다시 시도해 주세요.',
        );
      }
    } finally {
      challengeId = null;
      reauthProof = null;
      if (
        isCurrentDeletionAction(operation)
      ) {
        deletionActionRef.current = null;
        setLoadingAction(null);
      }
    }
  };

  const performExport = async (kind, expectedOperation) => {
    if (loadingAction || !isCurrentAccountOperation(expectedOperation)) return;
    const descriptor = EXPORTS[kind];
    const controller = new AbortController();
    const generation = exportRequestRef.current.generation + 1;
    const ownerKey = expectedOperation.accountKey;
    exportRequestRef.current.controller?.abort();
    exportRequestRef.current = { controller, generation, ownerKey };
    const isCurrentExport = () => (
      exportRequestRef.current.generation === generation
      && exportRequestRef.current.ownerKey === ownerKey
      && !controller.signal.aborted
      && isCurrentAccountOperation(expectedOperation)
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
      const payload = await descriptor.request(
        controller.signal,
        expectedOperation.ownerUserId,
      );
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
      if (androidCleanupFailed) {
        Alert.alert(
          'Check the selected folder',
          'The export did not finish and a partial JSON file may remain. Delete it before sharing the folder.',
        );
        return;
      }
      if (!isCurrentExport()) return;
      if (exportError?.name === 'AbortError') return;
      if (['cleanup_failed', 'operation_cleanup_failed'].includes(exportError?.code)) {
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
    const expectedOperation = accountOperationRef.current;
    if (!isCurrentAccountOperation(expectedOperation)) return;
    Haptics.selectionAsync();
    const descriptor = EXPORTS[kind];
    Alert.alert(descriptor.title, descriptor.description, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: Platform.OS === 'android' ? 'Choose folder' : 'Continue',
        onPress: () => performExport(kind, expectedOperation),
      },
    ]);
  };

  const requestConsentRevocation = () => {
    const expectedOperation = accountOperationRef.current;
    if (!isCurrentAccountOperation(expectedOperation)) return;
    const revokeAll = consentState.revokeAll;
    Haptics.selectionAsync();
    Alert.alert(
      'Revoke all stored consent?',
      'Required and optional consent choices for the current server version will be set to off. You can review published documents and consent again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => (
            isCurrentAccountOperation(expectedOperation) ? revokeAll() : null
          ),
        },
      ],
    );
  };

  const row = (label, value, onPress, danger = false, accessibilityHint) => (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
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
        ACCOUNT SAFETY
      </Text>
      {row(
        'Account-wide blocks',
        blockedAccountsOpen ? 'Hide' : 'Manage',
        toggleBlockedAccounts,
      )}
      {blockedAccountsOpen && (
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 }}>
          <Text style={{ color: '#64748B', fontSize: 11, lineHeight: 16 }}>
            Blocks follow your EasyGo account. Signed-in social views and new follows, likes and replies are separated in both directions. Public signed-out views may still show public content.
          </Text>
          {serverBlockedAccounts.map((blockedAccount) => (
            <View
              key={blockedAccount.id}
              style={tailwind('flex flex-row items-center justify-between border-b border-slate-200 py-3')}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#0F172A', fontFamily: 'GmarketMedium', fontSize: 13 }}>
                  {blockedAccount.displayName || blockedAccount.username || 'EasyGo user'}
                </Text>
                {blockedAccount.username ? (
                  <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                    @{blockedAccount.username}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                disabled={unblockingUserId === blockedAccount.id}
                onPress={() => requestUnblock(blockedAccount)}
                style={{ paddingHorizontal: 10, paddingVertical: 7 }}
              >
                {unblockingUserId === blockedAccount.id ? (
                  <ActivityIndicator size="small" color="#C2410C" />
                ) : (
                  <Text style={{ color: '#C2410C', fontFamily: 'GmarketBold', fontSize: 11 }}>
                    Unblock
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
          {!blockedAccountsLoading && !blockedAccountsError && serverBlockedAccounts.length === 0 ? (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 10 }}>
              No account-wide blocks.
            </Text>
          ) : null}
          {blockedAccountsError ? (
            <TouchableOpacity onPress={() => loadBlockedAccounts()} style={{ marginTop: 10 }}>
              <Text style={{ color: '#B42318', fontFamily: 'GmarketBold', fontSize: 11 }}>
                Could not load the server list. Tap to retry.
              </Text>
            </TouchableOpacity>
          ) : null}
          {blockedAccountsLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#FF6813" />
          ) : null}
          {!blockedAccountsLoading && blockedAccountsCursor ? (
            <TouchableOpacity onPress={() => loadBlockedAccounts({ append: true })} style={{ marginTop: 12 }}>
              <Text style={{ color: '#C2410C', fontFamily: 'GmarketBold', fontSize: 11 }}>
                Load more
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 24 }}>
        ON-DEVICE FILTERS
      </Text>
      {localBlockedDids.length > 0 ? (
        <>
          {row('Clear on-device blocks', localBlockedDids.length, clearDeviceOnlyBlocks)}
          <Text style={{ color: '#64748B', fontSize: 11, lineHeight: 16 }}>
            Blocks from older app versions remain on this device. They are not automatically added to your account-wide list.
          </Text>
        </>
      ) : null}
      {row('Muted accounts', listMutedUsers.length, () => clearLocalList('muted accounts', clearMutedAccounts))}
      {row('Hidden posts', listHiddenPost.length, () => clearLocalList('hidden posts', clearHiddenPosts))}

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
            {consentReadiness.ready && !consentEditingReady && (
              <Text style={{ color: '#B45309', fontSize: 11, lineHeight: 17, marginTop: 8 }}>
                버전이 일치하는 staging 문서 후보를 불러왔습니다. 운영자·법률 검토가 끝날 때까지 새 동의 저장과 선택형 처리는 계속 잠겨 있습니다.
              </Text>
            )}
            {consentEditingReady && consentState.draft && (
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
        SUPPORT
      </Text>
      {row(
        'Support center',
        EASYGO_SUPPORT_CONTACT.configured ? undefined : 'Pending',
        openSupportCenter,
        false,
        'Opens the official EasyGo support page.',
      )}
      {row(
        'Email support',
        EASYGO_SUPPORT_CONTACT.email,
        emailSupport,
        false,
        `Opens an email to ${EASYGO_SUPPORT_CONTACT.email}.`,
      )}

      <Text style={{ fontFamily: 'GmarketBold', fontSize: 12, color: '#64748B', marginTop: 24 }}>
        LEGAL
      </Text>
      {LEGAL_LINKS.map((item) => row(
        item.label,
        item.document.configured ? undefined : 'Pending',
        () => openLegalDocument(item.document, item.label),
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
              이 메뉴에서 삭제를 시작할 수 있습니다. 단, 서버·지갑·최근 로그인·제공자 계정 정리 조건이 모두 통과한 경우에만 최종 확인 화면이 열립니다.
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
              로그인 제공자·Privy 연결 정리는 추가 시간이 걸릴 수 있으며, 사용자가 내보낸 JSON 파일은 EasyGo가 회수할 수 없습니다.
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
              editable={!loadingAction}
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
              disabled={!deletionReady || Boolean(loadingAction)}
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
                {loadingAction === 'account-deletion' ? '최근 로그인 확인 및 삭제 보호 중…' : 'Permanently delete account'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={Boolean(loadingAction)}
              onPress={() => {
                deletionReauthRef.current?.cancel();
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
