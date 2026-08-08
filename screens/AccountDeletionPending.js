import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as FileSystem from 'expo-file-system';
import { usePrivy } from '@privy-io/expo';

import { GlobalContext } from '../contexts/GlobalContext';
import { api } from '../utils/api';
import {
  reconcileAccountDeletionStatus,
  submitAccountDeletionRequest,
} from '../utils/accountDeletionFlow.mjs';
import { purgeAccountDeletionLocalData } from '../utils/accountDeletionLocalData.mjs';
import {
  ACCOUNT_DELETION_REAUTH_ERROR,
  AccountDeletionReauthError,
  createAccountDeletionReauthCoordinator,
} from '../utils/accountDeletionReauth.mjs';
import { accountDeletionMarkerStore } from '../utils/accountDeletionStorage';
import { cleanupStaleExportFiles } from '../utils/dataExport.mjs';

function copyFor(guard) {
  if (guard.status === 'loading' || guard.status === 'blocking') {
    return {
      title: '개인정보 보호 상태 확인 중',
      body: '삭제 잠금 상태를 안전하게 확인하고 있습니다.',
    };
  }
  if (guard.status === 'storage-error') {
    return {
      title: '보안 저장소를 확인할 수 없습니다',
      body: '삭제 중인 계정이 다시 열리지 않도록 앱 사용을 잠갔습니다. 잠시 후 다시 확인해 주세요.',
    };
  }
  if (guard.status === 'server-error') {
    return {
      title: '삭제 보호 상태를 확인할 수 없습니다',
      body: '서버의 삭제 보호 장치를 확인할 때까지 계정 화면을 열지 않습니다.',
    };
  }
  if (guard.marker?.phase === 'accepted') {
    return {
      title: '계정 삭제가 접수되었습니다',
      body: 'EasyGo 데이터 삭제가 시작되었습니다. Apple·Privy 연결 정리는 추가 시간이 걸릴 수 있습니다.',
    };
  }
  return {
    title: '계정 삭제 상태 확인이 필요합니다',
    body: '요청 결과가 확정되지 않아 계정 화면을 잠갔습니다. 같은 요청 번호로 안전하게 다시 확인할 수 있습니다.',
  };
}

export default function AccountDeletionPending({ guard }) {
  const privy = usePrivy();
  const {
    setUser,
    setUserData,
    setPosts,
    setListBlockedUser,
    setListMutedUsers,
    setListHiddenPost,
  } = useContext(GlobalContext);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState(null);
  const actionRef = useRef(null);
  const currentUserId = privy?.user?.id || null;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const reauthRef = useRef(null);
  if (!reauthRef.current) {
    reauthRef.current = createAccountDeletionReauthCoordinator({
      getCurrentOwnerUserId: () => currentUserIdRef.current,
    });
  }
  const copy = copyFor(guard);

  useEffect(() => {
    reauthRef.current?.cancel();
    actionRef.current = null;
    setAction(null);
    setMessage(null);
  }, [currentUserId]);

  useEffect(() => () => {
    reauthRef.current?.cancel();
    actionRef.current = null;
    currentUserIdRef.current = null;
  }, []);

  const purgeLocalData = async (expectedOwnerUserId) => {
    if (currentUserIdRef.current !== expectedOwnerUserId) {
      throw new Error('account_deletion_cleanup_owner_changed');
    }
    let purgeError = null;
    try {
      await purgeAccountDeletionLocalData({
        courseProgressOwner: expectedOwnerUserId,
        removeMany: (keys) => AsyncStorage.multiRemove(keys),
      });
      if (currentUserIdRef.current !== expectedOwnerUserId) {
        throw new Error('account_deletion_cleanup_owner_changed');
      }
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
    if (currentUserIdRef.current !== expectedOwnerUserId) {
      throw new Error('account_deletion_cleanup_owner_changed');
    }
    setUser?.(null);
    setUserData?.(null);
    setPosts?.([]);
    setListBlockedUser?.([]);
    setListMutedUsers?.([]);
    setListHiddenPost?.([]);
    if (purgeError) throw purgeError;
  };

  const retry = async () => {
    if (['storage-error', 'server-error', 'server-blocked'].includes(guard.status)) {
      guard.retry?.();
      return;
    }
    if (!currentUserId || !guard.marker || actionRef.current) return;

    const ownerUserId = currentUserId;
    const marker = guard.marker;
    const operation = { kind: 'retry', ownerUserId };
    const isCurrentOperation = () => (
      actionRef.current === operation
      && currentUserIdRef.current === ownerUserId
    );
    const requireCurrentOperation = () => {
      if (isCurrentOperation()) return;
      throw new AccountDeletionReauthError(
        ACCOUNT_DELETION_REAUTH_ERROR.sessionChanged,
      );
    };

    actionRef.current = operation;
    setAction('retry');
    setMessage(null);
    let challengeId = null;
    let reauthProof = null;
    try {
      // Always reconcile the server first. A prior final POST may have reached
      // the server even when the device never received its response.
      const status = await api.accountDeletionStatus({
        expectedAuthUserId: ownerUserId,
      });
      requireCurrentOperation();

      if (status?.state) {
        const outcome = await reconcileAccountDeletionStatus({
          markerStore: accountDeletionMarkerStore,
          userId: ownerUserId,
          clientRequestId: marker.clientRequestId,
          status,
          isCurrentOwner: isCurrentOperation,
          purgeLocalData: () => purgeLocalData(ownerUserId),
          logout: () => {
            requireCurrentOperation();
            return privy.logout();
          },
        });
        if (!isCurrentOperation()) return;
        if (outcome.status === 'accepted') {
          setMessage(outcome.localDataPurged
            ? (status.completed
              ? 'EasyGo 데이터와 이 기기의 계정 데이터가 안전하게 정리되었습니다.'
              : '삭제 요청이 서버에 보존되어 있고, 이 기기의 계정 데이터도 정리되었습니다.')
            : '서버 삭제는 확인했지만 이 기기 데이터 정리가 끝나지 않았습니다. 잠금을 유지한 채 다시 시도해 주세요.');
        } else if (outcome.status === 'recovery') {
          setMessage(status.state === 'MANUAL_REVIEW'
            ? '삭제 요청이 안전 검토 중입니다. 로그인 세션과 기기 데이터는 유지됩니다.'
            : '서버 삭제는 아직 완료되지 않았습니다. 로그인 세션과 잠금은 유지됩니다.');
        } else {
          setMessage('삭제 요청 기록을 확정할 수 없습니다. 잠금은 유지됩니다. 잠시 후 다시 확인해 주세요.');
        }
        return;
      }

      if (marker.phase === 'accepted') {
        setMessage('삭제 요청 기록을 확정할 수 없습니다. 잠금은 유지됩니다. 잠시 후 다시 확인해 주세요.');
        return;
      }

      if (status?.available !== true) {
        setMessage('새 삭제 요청은 현재 사용할 수 없습니다. 기존 잠금과 로그인 세션은 안전하게 유지됩니다.');
        return;
      }

      const verified = await reauthRef.current.run({
        ownerUserId,
        clientRequestId: marker.clientRequestId,
        isAppleAuthenticationAvailable: () => (
          Platform.OS === 'ios'
            ? AppleAuthentication.isAvailableAsync()
            : Promise.resolve(false)
        ),
        requestChallenge: (params) => api.accountDeletionReauthChallenge(params),
        signInWithApple: (options) => AppleAuthentication.signInAsync(options),
        verifyChallenge: (params) => api.accountDeletionReauthVerify(params),
      });
      requireCurrentOperation();
      challengeId = verified.challengeId;
      reauthProof = verified.reauthProof;

      const outcome = await submitAccountDeletionRequest({
        markerStore: accountDeletionMarkerStore,
        userId: ownerUserId,
        clientRequestId: marker.clientRequestId,
        walletRiskAcknowledged: true,
        isCurrentOwner: isCurrentOperation,
        request: (authoritativeClientRequestId) => {
          requireCurrentOperation();
          if (authoritativeClientRequestId !== marker.clientRequestId) {
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
        purgeLocalData: () => purgeLocalData(ownerUserId),
        logout: () => {
          requireCurrentOperation();
          return privy.logout();
        },
      });
      if (!isCurrentOperation()) return;
      if (outcome.status === 'uncertain') {
        setMessage('서버 응답을 확정하지 못했습니다. 로그인 세션과 잠금을 유지했으니 다시 확인할 수 있습니다.');
      } else if (outcome.status === 'recovery') {
        setMessage(outcome.state === 'MANUAL_REVIEW'
          ? '삭제 요청이 안전 검토 중입니다. 로그인 세션과 기기 데이터는 유지됩니다.'
          : '삭제 요청 복구가 필요합니다. 로그인 세션과 잠금은 유지됩니다.');
      } else if (outcome.status === 'rejected') {
        setMessage('요청 형식을 확인하지 못했습니다. 앱을 업데이트한 뒤 다시 시도해 주세요.');
      }
    } catch (error) {
      if (actionRef.current !== operation) return;
      if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.cancelled) {
        setMessage('Apple 재인증이 취소되었습니다. 삭제 잠금과 로그인 세션은 그대로 유지됩니다.');
      } else if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.unavailable) {
        setMessage('이 기기에서는 Apple 재인증을 사용할 수 없습니다. 삭제 잠금은 그대로 유지됩니다.');
      } else if (error?.code === ACCOUNT_DELETION_REAUTH_ERROR.sessionChanged) {
        setMessage('로그인 계정이 변경되어 작업을 중단했습니다. 다른 계정의 데이터는 변경하지 않았습니다.');
      } else {
        setMessage('삭제 상태를 안전하게 확인하지 못했습니다. 잠금은 그대로 유지됩니다.');
      }
    } finally {
      challengeId = null;
      reauthProof = null;
      if (actionRef.current === operation) {
        actionRef.current = null;
        setAction(null);
      }
    }
  };

  const signOut = async () => {
    if (actionRef.current) return;
    const ownerUserId = currentUserId;
    if (!ownerUserId) return;
    const operation = { kind: 'logout', ownerUserId };
    actionRef.current = operation;
    setAction('logout');
    setMessage(null);
    try {
      await purgeLocalData(ownerUserId);
      if (
        actionRef.current !== operation
        || currentUserIdRef.current !== ownerUserId
      ) return;
      await privy.logout();
      setUser?.(null);
      setUserData?.(null);
    } catch {
      if (actionRef.current === operation) {
        setMessage('기기 데이터 정리 또는 로그아웃을 완료하지 못했습니다. 계정 화면은 계속 잠겨 있으니 다시 시도해 주세요.');
      }
    } finally {
      if (actionRef.current === operation) {
        actionRef.current = null;
        setAction(null);
      }
    }
  };

  const checking = guard.status === 'loading' || guard.status === 'blocking';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.eyebrow}>PRIVACY SAFETY LOCK</Text>
        {checking ? <ActivityIndicator color="#FF6813" style={styles.spinner} /> : null}
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {guard.marker ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>현재 상태</Text>
            <Text style={styles.statusValue}>
              {guard.marker.phase === 'accepted' ? '삭제 접수됨' : '결과 확인 필요'}
            </Text>
          </View>
        ) : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}

        {!checking ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={Boolean(action)}
            onPress={retry}
            style={[styles.primaryButton, action && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {action === 'retry'
                ? '확인 중…'
                : guard.marker?.phase === 'accepted'
                  ? '삭제 상태 확인'
                  : '안전하게 다시 확인'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {currentUserId && !checking ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={Boolean(action)}
            onPress={signOut}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {action === 'logout' ? '로그아웃 중…' : '로그아웃하고 다른 계정 사용'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F0' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  brand: { color: '#FF6813', fontSize: 42, fontWeight: '800' },
  eyebrow: { color: '#C2410C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 },
  spinner: { alignSelf: 'flex-start', marginTop: 34 },
  title: { color: '#0F172A', fontSize: 25, fontWeight: '800', lineHeight: 34, marginTop: 28 },
  body: { color: '#475569', fontSize: 15, lineHeight: 24, marginTop: 12 },
  statusCard: { backgroundColor: '#FFECD3', borderRadius: 18, marginTop: 24, padding: 18 },
  statusLabel: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  statusValue: { color: '#7C2D12', fontSize: 16, fontWeight: '800', marginTop: 6 },
  message: { color: '#B42318', fontSize: 12, lineHeight: 18, marginTop: 18 },
  primaryButton: { alignItems: 'center', backgroundColor: '#FF6813', borderRadius: 28, marginTop: 28, paddingVertical: 16 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 28, borderWidth: 1, marginTop: 12, paddingVertical: 15 },
  secondaryButtonText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
});
