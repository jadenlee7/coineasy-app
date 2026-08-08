import React, { useContext, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { usePrivy } from '@privy-io/expo';

import { GlobalContext } from '../contexts/GlobalContext';
import { api } from '../utils/api';
import {
  reconcileAccountDeletionStatus,
  submitAccountDeletionRequest,
} from '../utils/accountDeletionFlow.mjs';
import { purgeAccountDeletionLocalData } from '../utils/accountDeletionLocalData.mjs';
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
  const actionRef = useRef(false);
  const currentUserId = privy?.user?.id || null;
  const copy = copyFor(guard);

  const purgeLocalData = async () => {
    let purgeError = null;
    try {
      await purgeAccountDeletionLocalData({
        courseProgressOwner: currentUserId,
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

    actionRef.current = true;
    setAction('retry');
    setMessage(null);
    try {
      if (guard.marker.phase === 'accepted') {
        const status = await api.accountDeletionStatus({
          expectedAuthUserId: currentUserId,
        });
        const outcome = await reconcileAccountDeletionStatus({
          markerStore: accountDeletionMarkerStore,
          userId: currentUserId,
          clientRequestId: guard.marker.clientRequestId,
          status,
          purgeLocalData,
        });
        if (outcome.status === 'accepted') {
          setMessage(status.completed
            ? 'EasyGo 데이터 삭제가 완료되었습니다. 이제 안전하게 로그아웃할 수 있습니다.'
            : '삭제 요청이 서버에 보존되어 있습니다. 처리가 계속 진행됩니다.');
        } else if (outcome.status === 'recovery') {
          setMessage(status.state === 'MANUAL_REVIEW'
            ? '삭제 요청이 안전 검토 중입니다. 로그인 세션과 기기 데이터는 유지됩니다.'
            : '서버 삭제는 아직 완료되지 않았습니다. 로그인 세션과 잠금은 유지됩니다.');
        } else {
          setMessage('삭제 요청 기록을 확정할 수 없습니다. 잠금은 유지됩니다. 잠시 후 다시 확인해 주세요.');
        }
        return;
      }

      const outcome = await submitAccountDeletionRequest({
        markerStore: accountDeletionMarkerStore,
        userId: currentUserId,
        clientRequestId: guard.marker.clientRequestId,
        walletRiskAcknowledged: true,
        request: (clientRequestId) => api.requestAccountDeletion({
          clientRequestId,
          walletRiskAcknowledged: true,
          expectedAuthUserId: currentUserId,
        }),
        purgeLocalData,
        logout: () => privy.logout(),
      });
      if (outcome.status === 'uncertain') {
        setMessage('서버 응답을 확정하지 못했습니다. 로그인 세션과 잠금을 유지했으니 다시 확인할 수 있습니다.');
      } else if (outcome.status === 'recovery') {
        setMessage(outcome.state === 'MANUAL_REVIEW'
          ? '삭제 요청이 안전 검토 중입니다. 로그인 세션과 기기 데이터는 유지됩니다.'
          : '삭제 요청 복구가 필요합니다. 로그인 세션과 잠금은 유지됩니다.');
      } else if (outcome.status === 'rejected') {
        setMessage('요청 형식을 확인하지 못했습니다. 앱을 업데이트한 뒤 다시 시도해 주세요.');
      }
    } catch {
      setMessage('삭제 상태를 안전하게 확인하지 못했습니다. 잠금은 그대로 유지됩니다.');
    } finally {
      actionRef.current = false;
      setAction(null);
    }
  };

  const signOut = async () => {
    if (actionRef.current) return;
    actionRef.current = true;
    setAction('logout');
    setMessage(null);
    try {
      await purgeLocalData();
      await privy.logout();
      setUser?.(null);
      setUserData?.(null);
    } catch {
      setMessage('기기 데이터 정리 또는 로그아웃을 완료하지 못했습니다. 계정 화면은 계속 잠겨 있으니 다시 시도해 주세요.');
    } finally {
      actionRef.current = false;
      setAction(null);
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
