import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useContext } from "react";
import { StyleSheet, View, Keyboard, Platform, Animated, Image, Dimensions, Text, SafeAreaView } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { TailwindProvider } from 'tailwind-rn';
import * as SplashScreen from 'expo-splash-screen';
import { useSharedValue } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNavigationContainerRef } from '@react-navigation/native';

import Login from "./screens/Login";
import AccountDeletionPending from './screens/AccountDeletionPending';
import utilities from './tailwind.json';
import QR from "./components/modals/QR.js";
import AppNavigator from './navigation/AppNavigator';
import { GlobalContext } from "./contexts/GlobalContext";
import {
  DeviceAccountDataProvider,
  useDeviceAccountData,
} from './contexts/DeviceAccountDataContext';
import RepostModal from "./components/modals/RepostModal";
import PostboxModal from "./components/modals/PostboxModal";
import PostSettingsModal from "./components/modals/PostSettingsModal";
import UpdateProfileModal from "./components/modals/UpdateProfileModal";
import PushNotificationsModal from "./components/modals/PushNotificationsModal";
import NicknameModal from "./components/modals/NicknameModal";
import StartupErrorBoundary from './components/StartupErrorBoundary';
import { SOCIAL_CATEGORIES } from './data/socialCategories';

// Privy integration (Phase 1: Base chain only; EasyChain is Phase 2-gated).
// Required polyfills load before this module from entrypoint.js.
import { PrivyProvider, usePrivy } from '@privy-io/expo';
import useAuthSync from './hooks/useAuthSync';
import useAccountDeletionSessionGate from './hooks/useAccountDeletionSessionGate';
import { api } from './utils/api';
import { synchronizeServerBlockCache } from './utils/serverBlockCacheSync.mjs';
import {
  fallbackPresentationData,
  profilePresentationData,
} from './hooks/authPresentation.mjs';
import {
  EASYGO_BASE_CHAIN,
  EASYGO_PRIVY_CONFIG,
  getEasyGoPrivyClient,
} from './utils/privyClient';
import { easyGoPrivyStorage } from './utils/privyStorage';
import {
  accountDeletionMarkerStore,
  createAccountDeletionClientRequestId,
} from './utils/accountDeletionStorage';
import {
  navigationIntentFromNotificationData,
  navigationIntentFromParsedUrl,
  routeForEasyGoNavigationIntent,
} from './utils/navigationIntent.mjs';

// Phase 1 chain: Base mainnet (chainId 8453). EasyChain is gated by
// PHASE.EASYCHAIN_ENABLED in EASYGO_BUILD_PLAN.md and added in Phase 2.
const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
const STARTUP_CONFIG_CODE = 'STARTUP-CONFIG-01';
const isSet = (value) => typeof value === 'string' && value.trim().length > 0;
const collectMissingPrivyEnvVars = () => {
  const missing = [];

  if (!isSet(PRIVY_APP_ID)) {
    missing.push('EXPO_PUBLIC_PRIVY_APP_ID');
  }

  if (!isSet(PRIVY_CLIENT_ID)) {
    missing.push('EXPO_PUBLIC_PRIVY_CLIENT_ID');
  }

  return missing;
};

/** Expo */
import { useFonts } from 'expo-font';
// import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';


import moment from 'moment';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import { Asset } from 'expo-asset';

/**
 * AuthBridge — runs inside <PrivyProvider> so usePrivy() is available.
 * Watches Privy auth state, syncs to backend via useAuthSync, and writes
 * the resulting profile into the shared presentation state.
 */
function AccountDeletionSessionGate({ children }) {
  const privy = usePrivy();
  const privyUserId = privy?.user?.id || null;
  const markerGuard = useAccountDeletionSessionGate(privyUserId);
  const [serverBlock, setServerBlock] = useState(null);

  useEffect(() => {
    setServerBlock((current) => (
      current?.ownerUserId === privyUserId ? current : null
    ));
  }, [privyUserId]);

  const reportDeletionBlock = useCallback((code) => {
    if (!privyUserId || ![
      'account_deletion_in_progress',
      'account_deletion_guard_unavailable',
    ].includes(code)) return;

    setServerBlock({ ownerUserId: privyUserId, code });
    if (code === 'account_deletion_in_progress') {
      void accountDeletionMarkerStore.begin({
        userId: privyUserId,
        clientRequestId: createAccountDeletionClientRequestId(),
        // A 410 tombstone can still be MANUAL_REVIEW with local data intact.
        // Keep a recovery marker until an authenticated status response proves
        // localDataDeleted === true.
        phase: 'requesting',
      }).catch(() => {
        // The in-memory server block remains fail-closed if SecureStore fails.
      });
    }
  }, [privyUserId]);

  const activeServerBlock = serverBlock?.ownerUserId === privyUserId
    ? serverBlock
    : null;
  const retryDeletionGuard = useCallback(() => {
    markerGuard.retry?.();
    if (!activeServerBlock) return;

    if (activeServerBlock.code === 'account_deletion_in_progress' && privyUserId) {
      void accountDeletionMarkerStore.begin({
        userId: privyUserId,
        clientRequestId: createAccountDeletionClientRequestId(),
        phase: 'requesting',
      }).catch(() => {
        // Keep the in-memory tombstone block until SecureStore recovers.
      });
      return;
    }

    setServerBlock((current) => (
      current?.ownerUserId === privyUserId ? null : current
    ));
  }, [activeServerBlock, markerGuard.retry, privyUserId]);
  const effectiveGuard = markerGuard.status === 'clear' && activeServerBlock
    ? {
        ...markerGuard,
        status: activeServerBlock.code === 'account_deletion_in_progress'
          ? 'server-blocked'
          : 'server-error',
        errorCode: activeServerBlock.code,
        retry: retryDeletionGuard,
      }
    : markerGuard;

  return children(effectiveGuard, reportDeletionBlock);
}

function AuthBridge({ accountDeletionGuard, onDeletionBlocked }) {
  const privy = usePrivy();
  const privyUserId = privy?.user?.id ?? null;
  const markerBlocked = Boolean(
    privyUserId && accountDeletionGuard?.status !== 'clear',
  );
  const {
    profile,
    canUseFallback,
    deletionBlocked,
    error,
  } = useAuthSync(privy, { enabled: !markerBlocked });
  const { setUser, setUserData } = useContext(GlobalContext);
  const deviceAccountData = useDeviceAccountData();
  const privyReady = Boolean(privy?.isReady);
  const blockSyncGenerationRef = useRef(0);

  useEffect(() => {
    if (deletionBlocked && error?.code) onDeletionBlocked?.(error.code);
  }, [deletionBlocked, error?.code, onDeletionBlocked]);

  useEffect(() => {
    const generation = ++blockSyncGenerationRef.current;
    const expectedLease = deviceAccountData.accountLease;
    const expectedOwnerUserId = privyUserId;
    const expectedRevision = deviceAccountData.blockCacheRevision;
    const isCurrent = () => Boolean(
      generation === blockSyncGenerationRef.current
      && expectedOwnerUserId
      && deviceAccountData.isCurrentAccountLease(expectedLease)
      && deviceAccountData.isCurrentBlockCacheRevision(expectedLease, expectedRevision)
    );
    if (
      !profile?.id
      || !expectedOwnerUserId
      || deviceAccountData.status !== 'ready'
      || deviceAccountData.ownerUserId !== expectedOwnerUserId
      || !isCurrent()
    ) return undefined;

    void synchronizeServerBlockCache({
      currentEntries: deviceAccountData.blockedAccounts,
      isCurrent,
      listPage: ({ cursor, limit }) => api.blocks.list({
        cursor,
        limit,
        expectedAuthUserId: expectedOwnerUserId,
      }),
      saveEntries: (entries) => deviceAccountData.saveServerBlockSnapshot(entries, {
        expectedLease,
        expectedRevision,
      }),
    }).then((synchronized) => {
      if (synchronized && isCurrent()) {
        deviceAccountData.confirmServerBlockSync(expectedLease, expectedRevision);
      }
    }).catch(() => {
      // Preserve the last account-scoped cache when the server cannot confirm a
      // complete list. Signed-in server reads still enforce the relationship.
    });
    return () => { blockSyncGenerationRef.current += 1; };
  }, [
    deviceAccountData.accountLease,
    deviceAccountData.blockCacheRevision,
    deviceAccountData.confirmServerBlockSync,
    deviceAccountData.isCurrentBlockCacheRevision,
    deviceAccountData.isCurrentAccountLease,
    deviceAccountData.ownerUserId,
    deviceAccountData.saveServerBlockSnapshot,
    deviceAccountData.status,
    privyUserId,
    profile?.id,
  ]);

  useEffect(() => {
    const profileMatchesPrivy = !profile?.privyDid
      || !privyUserId
      || profile.privyDid === privyUserId;
    const activeProfile = profileMatchesPrivy ? profile : null;
    const courseProgressOwner = privyUserId;
    const localCourses = deviceAccountData.status === 'ready'
      && deviceAccountData.ownerUserId === privyUserId
      ? deviceAccountData.courseProgress
      : [];

    if (markerBlocked || (privyReady && (!privyUserId || deletionBlocked))) {
      setUser(null);
      setUserData(null);
      return;
    }

    if (activeProfile) {
      const profileData = profilePresentationData(activeProfile, {
        courseProgressOwner,
        localCourses,
      });
      setUser({
        id: activeProfile.id,
        did: activeProfile.privyDid || `privy:${activeProfile.id}`,
        profile: {
          username: activeProfile.displayName || activeProfile.username || null,
          pfp: activeProfile.pfp || null,
          description: activeProfile.bio || activeProfile.description || null,
          data: profileData,
        },
      });
      setUserData(profileData);
    } else if (privyReady && privyUserId && canUseFallback) {
      // Keep the app usable while a bounded backend retry is in progress. Never
      // retain another account's fallback presentation state.
      const fallbackData = fallbackPresentationData({
        courseProgressOwner,
        localCourses,
      });
      const fallbackUser = {
        id: privyUserId,
        did: `privy:${privyUserId}`,
        profile: { username: null, pfp: null, description: null, data: fallbackData },
      };
      setUser((current) => (
        current?.profile?.data?.courseProgressOwner === courseProgressOwner
          ? current
          : fallbackUser
      ));
      setUserData((current) => (
        current?.courseProgressOwner === courseProgressOwner ? current : fallbackData
      ));
    } else if (privyReady && privyUserId) {
      // Do not publish authenticated fallback UI until the first backend sync
      // resolves. In particular, a tombstoned account must never flash open
      // before its 410 deletion guard response arrives.
      setUser(null);
      setUserData(null);
    }
  }, [
    canUseFallback,
    deletionBlocked,
    deviceAccountData.courseProgress,
    deviceAccountData.ownerUserId,
    deviceAccountData.status,
    markerBlocked,
    profile,
    privyReady,
    privyUserId,
    setUser,
    setUserData,
  ]);

  return null;
}

function DeviceAccountDataRender({ children }) {
  return children(useDeviceAccountData());
}

function AccountTransitionResetSignal({ onTransition }) {
  const { ownerUserId, sessionEpoch } = useDeviceAccountData();
  useLayoutEffect(() => {
    onTransition?.({ ownerUserId, sessionEpoch });
  }, [onTransition, ownerUserId, sessionEpoch]);
  return null;
}

function AccountNavigationReplaySignal({ ready, ownerUserId, sessionEpoch, onReplay }) {
  useLayoutEffect(() => {
    if (ready) onReplay?.();
  }, [onReplay, ownerUserId, ready, sessionEpoch]);
  return null;
}

function sameAccountTransition(left, right) {
  return Boolean(
    left
    && right
    && left.ownerUserId === right.ownerUserId
    && left.sessionEpoch === right.sessionEpoch,
  );
}

function DeviceAccountDataUnavailable({ retry }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.configContainer}>
        <Text style={styles.brand}>EasyGo</Text>
        <Text style={styles.configCode}>LOCAL-DATA-01</Text>
        <Text style={styles.configTitle}>기기 데이터 보호를 준비하지 못했습니다.</Text>
        <Text style={styles.configText}>
          계정별 로컬 저장소를 확인할 때까지 앱을 열지 않았습니다. 계정 데이터는 다른 사용자에게 표시되지 않습니다.
        </Text>
        <Text style={styles.retryText} onPress={retry}>다시 시도</Text>
      </View>
    </SafeAreaView>
  );
}

function FullStartupSignal({ onStartupStatus }) {
  const privy = usePrivy();
  const readyRef = useRef(Boolean(privy?.isReady));
  readyRef.current = Boolean(privy?.isReady);

  useEffect(() => {
    let active = true;
    void (async () => {
      await onStartupStatus?.({ step: 'full-provider-child', status: 'passed' });
      if (active) {
        await onStartupStatus?.({
          step: 'full-provider-ready',
          status: readyRef.current ? 'passed' : 'pending',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [onStartupStatus]);

  useEffect(() => {
    if (privy?.isReady) {
      onStartupStatus?.({ step: 'full-provider-ready', status: 'passed' });
    }
  }, [onStartupStatus, privy?.isReady]);

  return null;
}

function EasyGoPrivyBoundary({ alreadyMounted, children }) {
  if (alreadyMounted) return children;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      client={getEasyGoPrivyClient()}
      clientId={PRIVY_CLIENT_ID}
      config={EASYGO_PRIVY_CONFIG}
      storage={easyGoPrivyStorage}
      supportedChains={[EASYGO_BASE_CHAIN]}
    >
      {children}
    </PrivyProvider>
  );
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[startup] unable to retain splash screen', error);
});

let callbackPostShared;
let page = 0;
export default function App({
  linkingManagedExternally = false,
  navigationUrlEvent = null,
  onStartupStatus,
  privyAlreadyMounted = false,
}) {
  return (
    <StartupErrorBoundary>
      <EasyGoApp
        linkingManagedExternally={linkingManagedExternally}
        navigationUrlEvent={navigationUrlEvent}
        onStartupStatus={onStartupStatus}
        privyAlreadyMounted={privyAlreadyMounted}
      />
    </StartupErrorBoundary>
  );
}

function EasyGoApp({
  linkingManagedExternally,
  navigationUrlEvent,
  onStartupStatus,
  privyAlreadyMounted,
}) {
  const missingPrivyEnv = collectMissingPrivyEnvVars();
  const [user, setUser] = useState();
  const [userData, setUserData] = useState();
  const [userConnecting, setUserConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [screen, setScreen] = useState("home");
  const [previousScreen, setPreviousScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [repost, setRepost] = useState(false);
  const [postDetailsVis, setPostDetailsVis] = useState();
  const [updateProfileVis, setUpdateProfileVis] = useState(false);
  const [pushNotifsVis, setPushNotifsVis] = useState(false);
  const [newFeatureVis, setNewFeatureVis] = useState(false);
  const [newFeatureAlertVis, setNewFeatureAlertVis] = useState(false);
  const [settingsVis, setSettingsVis] = useState(false);
  const [switchAccountVis, setSwitchAccountVis] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false)



  const [switchLoading, setSwitchLoading] = useState(false)
  const [loading, setLoading] = useState(false);

  const [postSettingsModalVis, setPostSettingsModalVis] = useState(false);
  const [postboxVis, setPostboxVis] = useState(false);
  const [replyTo, setReplyTo] = useState();
  const [editedPost, setEditedPost] = useState(null);
  const [shareProfileVis, setShareProfileVis] = useState(false);
  const [showImageSender, setShowImageSender] = useState(null);
  const [listMessages, setListMessages] = useState([])
  const [nicknameVis, setNicknameVis] = useState(false)
  const [connectType, setConnectType] = useState('')
  const [connectModalVis, setConnectModalVis] = useState(false);

  const [listAccount, setListAccount] = useState([])

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState(SOCIAL_CATEGORIES);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBottom, setRefreshingBottom] = useState(false);
  const [profileSelected, setProfileSelected] = useState();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const translateY = useSharedValue(0);

  const confetti = useRef();
  const responseListener = useRef();
  const homeFeedRef = useRef();
  const categoryFeedRef = useRef();
  const newsFeedRef = useRef();
  const modalSwitchRef = useRef(null); 
  const modalSettingsRef = useRef(null); 
  const modalPostSettingsRef = useRef(null); 
  const modalProfileRef = useRef(null); 
  const modalPostBoxRef = useRef(null); 
  const modalNicknameRef = useRef(null); 
  const accountTransitionRef = useRef(null);
  const accountUiReadyRef = useRef(false);
  const navigationRef = useMemo(() => createNavigationContainerRef(), []);
  const pendingNavigationIntentRef = useRef(null);
  const processedNotificationResponseIdsRef = useRef(new Set());

  const snapPoints = useMemo(() => ['50%', '50%'], []);
  const snapPointsLarge = useMemo(() => [Platform.OS == 'ios' ? '87%' : '95%', Platform.OS == 'ios' ? '87%' : '95%'], []);
  const handleModalPostBoxPress = useCallback(() => modalPostBoxRef.current?.present(), []);
  const handleModalNicknamePress = useCallback(() => modalNicknameRef.current?.present(), []);
  
  const [categoriesVis, setCategoriesVis] = useState(false);
  const [showReportBack, setShowReportBack] = useState(false)
  const [activityClaim, setActivityClaim] = useState(false)

  const [categoryPosts, setCategoryPosts] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [newsPosts, setNewsPosts] = useState(null)
  const [selectedNews, setSelectedNews] = useState(null)
  const [currentRoute, setCurrentRoute] = useState(null)

  const [tabViewHeight, setTabViewHeight] = useState(500)
  const [newGiftsCount, setNewGiftsCount] = useState(false)

  const [scrollAnim, setScrollAnim] = useState(new Animated.Value(0));
  const [offsetAnim, setOffsetAnim] = useState(new Animated.Value(0));
  const [clampedScroll, setClampedScroll] = useState(Animated.diffClamp(
    Animated.add(
      scrollAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolateLeft: 'clamp'
      }),
      offsetAnim
    ), 0, 1
  ));
  const navbarTranslate = clampedScroll.interpolate({
    inputRange: [50, Platform.OS == 'ios' ? 170 : 120],
    outputRange: [0, Platform.OS == 'ios' ? -170 : -150],
    extrapolate: 'clamp'
  });
  
  /** Load fonts */
  const [fontsLoaded] = useFonts({
    'GmarketMedium': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansMedium_ios.ttf') : require('./assets/fonts/GmarketSansMedium.ttf'),
    'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium_ios.ttf'),
    'GmarketBold': Platform.OS == 'ios' ? require('./assets/fonts/GmarketSansBold_ios.ttf') : require('./assets/fonts/GmarketSansBold.ttf'),
  });

  const resetAccountTransientUi = useCallback((nextTransition) => {
    const normalizedNextTransition = nextTransition?.ownerUserId
      ? Object.freeze({
          ownerUserId: nextTransition.ownerUserId,
          sessionEpoch: nextTransition.sessionEpoch,
        })
      : null;
    const pendingNavigation = pendingNavigationIntentRef.current;
    if (pendingNavigation) {
      if (!pendingNavigation.accountTransition && normalizedNextTransition) {
        pendingNavigationIntentRef.current = Object.freeze({
          ...pendingNavigation,
          accountTransition: normalizedNextTransition,
        });
      } else if (
        pendingNavigation.accountTransition
        && !sameAccountTransition(
          pendingNavigation.accountTransition,
          normalizedNextTransition,
        )
      ) {
        pendingNavigationIntentRef.current = null;
      }
    }
    accountTransitionRef.current = normalizedNextTransition;
    accountUiReadyRef.current = false;
    callbackPostShared = undefined;
    page = 0;
    translateY.value = 0;
    setScreen('home');
    setPreviousScreen('home');
    setCategory(null);
    setRepost(false);
    setPostDetailsVis(null);
    setUpdateProfileVis(false);
    setPushNotifsVis(false);
    setNewFeatureVis(false);
    setNewFeatureAlertVis(false);
    setSwitchLoading(false);
    setLoading(false);
    setSettingsVis(false);
    setSwitchAccountVis(false);
    setAddressCopied(false);
    setPostSettingsModalVis(false);
    setPostboxVis(false);
    setReplyTo(null);
    setEditedPost(null);
    setShareProfileVis(false);
    setShowImageSender(null);
    setListMessages([]);
    setNicknameVis(false);
    setConnectType('');
    setConnectModalVis(false);
    setListAccount([]);
    setPosts([]);
    setProfileSelected(null);
    setCategoriesVis(false);
    setShowReportBack(false);
    setActivityClaim(false);
    setCategoryPosts(null);
    setSelectedCategory(null);
    setNewsPosts(null);
    setSelectedNews(null);
    setCurrentRoute(null);
    setNewGiftsCount(false);
    setUserConnecting(false);
    modalSwitchRef.current?.close();
    modalSettingsRef.current?.close();
    modalPostSettingsRef.current?.close();
    modalProfileRef.current?.close();
    modalPostBoxRef.current?.close();
    modalNicknameRef.current?.close();
  }, [translateY]);

  const dismissNavigationOverlays = useCallback(() => {
    translateY.value = 0;
    setShareProfileVis(false);
    setPostDetailsVis(null);
    setProfileSelected(null);
    modalPostSettingsRef.current?.close();
    modalProfileRef.current?.close();
    modalPostBoxRef.current?.close();
  }, [translateY]);

  const tryNavigatePendingIntent = useCallback(() => {
    const pendingNavigation = pendingNavigationIntentRef.current;
    const currentTransition = accountTransitionRef.current;
    if (!pendingNavigation || !pendingNavigation.accountTransition) return false;
    if (!sameAccountTransition(pendingNavigation.accountTransition, currentTransition)) {
      pendingNavigationIntentRef.current = null;
      return false;
    }
    if (!accountUiReadyRef.current || !navigationRef.isReady()) return false;

    const route = routeForEasyGoNavigationIntent(pendingNavigation.intent);
    if (!route) {
      pendingNavigationIntentRef.current = null;
      return false;
    }

    try {
      dismissNavigationOverlays();
      navigationRef.navigate(route.name, route.params);
      if (pendingNavigationIntentRef.current === pendingNavigation) {
        pendingNavigationIntentRef.current = null;
      }
      return true;
    } catch (error) {
      console.warn('[navigation] deferred intent is still waiting for the navigator', error);
      return false;
    }
  }, [dismissNavigationOverlays, navigationRef]);

  const queueNavigationIntent = useCallback((intent) => {
    if (!routeForEasyGoNavigationIntent(intent)) return false;
    pendingNavigationIntentRef.current = Object.freeze({
      intent,
      accountTransition: accountTransitionRef.current,
    });
    return tryNavigatePendingIntent();
  }, [tryNavigatePendingIntent]);

  const handleNavigationReady = useCallback(() => {
    tryNavigatePendingIntent();
  }, [tryNavigatePendingIntent]);

  const handleNotificationResponse = useCallback((response) => {
    const responseId = response?.notification?.request?.identifier;
    if (typeof responseId === 'string' && responseId) {
      const processed = processedNotificationResponseIdsRef.current;
      if (processed.has(responseId)) return;
      if (processed.size >= 64) processed.clear();
      processed.add(responseId);
    }

    const data = response?.notification?.request?.content?.data;
    const intent = navigationIntentFromNotificationData(data);
    if (intent) queueNavigationIntent(intent);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [queueNavigationIntent]);

  const handleURL = useCallback(async (incomingUrl) => {
    const parsed = Linking.parse(incomingUrl);
    const intent = navigationIntentFromParsedUrl(parsed);
    if (intent) {
      queueNavigationIntent(intent);
      return;
    }

    // Legacy OAuth callback URLs are never authentication inputs. Privy owns
    // OAuth state and token exchange inside screens/Login.js.
    if (parsed.path === 'google-auth' || incomingUrl.includes('google-auth')) {
      if (Platform.OS === 'ios') await WebBrowser.dismissBrowser();
      console.warn('[auth] ignored legacy google-auth callback; use Privy login instead');
      setLoading(false);
    }
  }, [queueNavigationIntent]);


    const onLayoutRootView = useCallback(async () => {
        if (isLayoutReady) {
            try {
                await SplashScreen.hideAsync();
            } catch (error) {
                console.warn('[startup] unable to hide splash screen', error);
            }
        }
    }, [isLayoutReady]);
    

  useEffect(() => {
    setCategories(SOCIAL_CATEGORIES);
    setIsLayoutReady(true);
  }, []);

    useEffect(() => {
        page = 0;
        loadPosts();
    }, [category]);

    /** The bootstrap owns URL delivery so cold-launch links survive staged startup. */
    useEffect(() => {
        if (!linkingManagedExternally || !navigationUrlEvent?.url) return;
        void handleURL(navigationUrlEvent.url);
    }, [
        handleURL,
        linkingManagedExternally,
        navigationUrlEvent?.id,
        navigationUrlEvent?.url,
    ]);

    /** Retain direct App mounting as a safe development/test fallback. */
    useEffect(() => {
        if (linkingManagedExternally) return undefined;
        let active = true;
        let receivedLiveUrl = false;
        const subscription = Linking.addEventListener('url', ({ url: incomingUrl }) => {
            receivedLiveUrl = true;
            void handleURL(incomingUrl);
        });
        void Linking.getInitialURL()
            .then((initialUrl) => {
                if (active && !receivedLiveUrl && initialUrl) void handleURL(initialUrl);
            })
            .catch((error) => {
                console.warn('[navigation] unable to read initial URL', error);
            });
        return () => {
            active = false;
            subscription.remove();
        };
    }, [handleURL, linkingManagedExternally]);

    /** Handle notifications received, will open right screen or pane based on the notification received */
    useEffect(() => {
        let active = true;
        responseListener.current = Notifications.addNotificationResponseReceivedListener(
          handleNotificationResponse,
        );
        void Notifications.getLastNotificationResponseAsync()
          .then((response) => {
            if (active && response) handleNotificationResponse(response);
          })
          .catch(() => {});

        return () => {
            active = false;
            Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, [handleNotificationResponse]);

    /** Will retrieve all posts shared in the global context */
    async function loadPosts() {
        // Screen feeds own their server state through useFeed/usePosts.
        setRefreshing(false);
    }

    /** This will load more posts and add those to the current list */
    async function loadMorePosts() {
        setRefreshingBottom(false);
    }

    /** Load all categories / contexts under the global context */
    async function loadContexts() {
        setCategories(SOCIAL_CATEGORIES);
    }

    const onRefresh = useCallback(async () => {
        setRefreshing(false);
    }, []);

    async function callbackConnect(detailUser) {
        const expectedTransition = accountTransitionRef.current;
        const isCurrentTransition = () => sameAccountTransition(
            accountTransitionRef.current,
            expectedTransition,
        );
        if (!expectedTransition || !isCurrentTransition()) return;
        
        if(connectType == "signup"){
            handleModalNicknamePress()
            setLoading(false);
        }else{
            // These two dates are intentionally device-wide modal-dismissal
            // preferences. They contain no account identifier or user data.
            const [showNotificationDate, showNewFeatureDate] = await Promise.all([
                AsyncStorage.getItem("showNotificationDate"),
                AsyncStorage.getItem("showNewFeatureDate"),
            ]);
            if (!isCurrentTransition()) return;

            if(moment().format('YYYY-MM-DD') >= showNotificationDate || !showNotificationDate){
                setPushNotifsVis(true);
            }else if(moment().format('YYYY-MM-DD') >= showNewFeatureDate || !showNewFeatureDate){
                setNewFeatureVis(true);
            }

            setLoading(false);
            setConnectModalVis(false)
        }
        
        modalSwitchRef.current?.close()
    }

    /** Show postbox while saving the callback function */
    function showPostbox(callback) {
        callbackPostShared = callback ?? defaultCallbackPostShared;

        handleModalPostBoxPress()
        Haptics.selectionAsync();
    }

    function hidePostbox() {
        modalPostBoxRef.current?.close()

        setRepost(false);
        setReplyTo(null);
        setEditedPost(null);

        Keyboard.dismiss()
        Haptics.selectionAsync();
    }

    /** Will be called when a new post is being shared */
    async function defaultCallbackPostShared(_post) {
        console.log("Enter defaultCallbackPostShared:", _post);
        let _posts = [_post, ...posts];
        setPosts(_posts);
        hidePostbox()
    }

    // TEMP BACKUP
    /** Will be called when a new post is being shared */
    // async function defaultCallbackPostShared(_post) {
    //     console.log("Enter defaultCallbackPostShared:", _post);
    //     let _posts = [_post, ...posts];
    //     setPosts(_posts);

    //     // Orange Reward
    //     const tempData = userData ?? {}
    //     if(replyTo){
    //         if(tempData.listClaimedOranges){
    //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
    //             if(index != -1){
    //                 tempData.listClaimedOranges[index].listOranges.push({
    //                     numberOranges: 3,
    //                     type: 'Comment'
    //                 })
    //                 if(tempData.comment?.number == 19){
    //                     tempData.listClaimedOranges[index].listOranges.push({
    //                         numberOranges: 50,
    //                         type: 'Comments Milestone achieved'
    //                     })
    //                 }
    //             }else{
    //                 const listReward = [{
    //                     numberOranges: 3,
    //                     type: 'Comment'
    //                 }]
    //                 tempData.comment?.number == 19 && listReward.push({
    //                     numberOranges: 50,
    //                     type: 'Comments Milestone achieved'
    //                 })
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
    //             }
    //         }else{
    //             tempData.listClaimedOranges = [{
    //                 date: moment().format('YYYY-MM-DD'),
    //                 listOranges: [
    //                     {
    //                         numberOranges: 3,
    //                         type: 'Comment'
    //                     },
    //                 ]
    //             }]
    //         }

    //         if(tempData.comment){
    //             tempData.comment.number += 1
    //             tempData.comment.gained += 3
    //         }else{
    //             tempData.comment = {
    //                 number: 1,
    //                 gained: 3,
    //                 lastComment: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 3 : tempData.activityUnclaimed = {number: 3}
    //         tempData.comment.number == 20 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.comment.number == 20 ? tempData.activityUnclaimed = {number: 53} : null
    //         tempData.comment.number == 20 ? tempData.comment.number = 0 : null


    //     }else if(repost){

    //         if(tempData.listClaimedOranges){
    //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
    //             if(index != -1){
    //                 tempData.listClaimedOranges[index].listOranges.push({
    //                     numberOranges: 5,
    //                     type: 'Repost'
    //                 })
    //                 if(tempData.reaction?.number == 29){
    //                     tempData.listClaimedOranges[index].listOranges.push({
    //                         numberOranges: 50,
    //                         type: 'Reactions Milestone achieved'
    //                     })
    //                 }
    //             }else{
    //                 const listReward = [{
    //                     numberOranges: 5,
    //                     type: 'Repost'
    //                 }]
    //                 tempData.reaction?.number == 29 && listReward.push({
    //                     numberOranges: 50,
    //                     type: 'Reactions Milestone achieved'
    //                 })
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
    //             }
    //         }else{
    //             tempData.listClaimedOranges = [{
    //                 date: moment().format('YYYY-MM-DD'),
    //                 listOranges: [
    //                     {
    //                         numberOranges: 5,
    //                         type: 'Repost'
    //                     },
    //                 ]
    //             }]
    //         }

    //         if(tempData.reaction){
    //             tempData.reaction.number += 1
    //             tempData.reaction.gained += 5
    //         }else{
    //             tempData.reaction = {
    //                 number: 1,
    //                 gained: 5,
    //                 lastReaction: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 5 : tempData.activityUnclaimed = {number: 5}
    //         tempData.reaction.number == 30 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.reaction.number == 30 ? tempData.activityUnclaimed = {number: 55} : null
    //         tempData.reaction.number == 30 ? tempData.reaction.number = 0 : null
    
    //     }else{

    //         if(tempData.listClaimedOranges){
    //             const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
    //             if(index != -1){
    //                 tempData.listClaimedOranges[index].listOranges.push({
    //                     numberOranges: 15,
    //                     type: 'Post'
    //                 })
    //                 if(tempData.post?.number == 9){
    //                     tempData.listClaimedOranges[index].listOranges.push({
    //                         numberOranges: 50,
    //                         type: 'Posting Milestone achieved'
    //                     })
    //                 }
    //             }else{
    //                 const listReward = [{
    //                     numberOranges: 15,
    //                     type: 'Post'
    //                 }]
    //                 if(tempData.post?.number == 9){
    //                     listReward.push({
    //                         numberOranges: 50,
    //                         type: 'Posting Milestone achieved'
    //                     })
    //                 }
    //                 tempData.listClaimedOranges.push({
    //                     date: moment().format('YYYY-MM-DD'),
    //                     listOranges: listReward
    //                 })
    //             }
    //         }else{
    //             tempData.listClaimedOranges = [{
    //                 date: moment().format('YYYY-MM-DD'),
    //                 listOranges: [
    //                     {
    //                         numberOranges: 15,
    //                         type: 'Post'
    //                     },
    //                 ]
    //             }]
    //         }

    //         if(tempData.post){
    //             tempData.post.number += 1
    //             tempData.post.gained += 15
    //         }else{
    //             tempData.post = {
    //                 number: 1,
    //                 gained: 15,
    //                 lastPost: moment().format('YYYY-MM-DD HH:mm')
    //             }
    //         }
    //         tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 15 : tempData.activityUnclaimed = {number: 15}
    //         tempData.post.number == 10 && tempData.activityUnclaimed ? tempData.activityUnclaimed.number += 50 : tempData.post.number == 10 ? tempData.activityUnclaimed = {number: 65} : null
    //         tempData.post.number == 10 ? tempData.post.number = 0 : null
    //     }
        
    //     setUserData({...tempData})
        
    //     hidePostbox()
    // }


    function scrollToTop() {
        if(homeFeedRef?.current) {
            homeFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        } else if(categoryFeedRef?.current){
            categoryFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        } else if(newsFeedRef?.current){
            newsFeedRef.current.scrollToOffset({ animated: true, offset: 0 });
        }
    }

    /** Wait for fonts to be loaded before rendering the app */
    // const loadFonts = async () => {
    //     await Font.loadAsync({
    //         'GmarketMedium': require('./assets/fonts/GmarketSansMedium.ttf'),
    //         'GmarketMedium_ios': require('./assets/fonts/GmarketSansMedium.ttf'),
    //         'GmarketBold': require('./assets/fonts/GmarketSansBold.ttf'),
    //     });
    // };

    // if(!loadFonts) {
    //     return null
    // }

    if(!fontsLoaded) {
        return null
    }

    if (missingPrivyEnv.length > 0) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.configContainer}>
                    <Text style={styles.brand}>EasyGo</Text>
                    <Text style={styles.configCode}>{STARTUP_CONFIG_CODE}</Text>
                    <Text style={styles.configTitle}>필수 환경변수가 설정되지 않았습니다.</Text>
                    <Text style={styles.configText}>
                        앱이 즉시 종료되지 않도록 부팅을 중단했습니다. 아래 값이 현재 EAS 빌드 환경과 앱 번들에 포함되어야 합니다.
                    </Text>
                    <Text style={styles.configBullets}>- {missingPrivyEnv.join('\n- ')}</Text>
                </View>
            </SafeAreaView>
        );
    }


    /** Wait for app to be ready before rendering it */
    if (!isLayoutReady) {
        return null;
    }

    return (
        <EasyGoPrivyBoundary alreadyMounted={privyAlreadyMounted}>
        <DeviceAccountDataProvider>
        <AccountDeletionSessionGate>
        {(accountDeletionGuard, reportDeletionBlock) => (
        <DeviceAccountDataRender>
        {(deviceAccountData) => {
        const presentedOwner = user?.profile?.data?.courseProgressOwner || null;
        const accountUiReady = Boolean(
          presentedOwner
          && presentedOwner === deviceAccountData.ownerUserId
          && deviceAccountData.status === 'ready',
        );
        accountUiReadyRef.current = accountUiReady;
        return (
        <>
            <StatusBar translucent={true} backgroundColor="#00000000" style="black"/>
            <GestureHandlerRootView onLayout={onLayoutRootView} style={{width: "100%", height: "100%"}}>
                <GlobalContext.Provider value={{ 
                        confetti,
                        refreshing,
                        categories,
                        postboxVis,
                        refreshingBottom,
                        callbackPostShared,
                        
                        onRefresh,
                        loadPosts,
                        showPostbox,
                        hidePostbox,
                        loadContexts,
                        loadMorePosts,
                        callbackConnect,
                        defaultCallbackPostShared,

                        homeFeedRef,
                        newsFeedRef,
                        categoryFeedRef,
                        modalSwitchRef,
                        modalProfileRef,
                        modalPostBoxRef,
                        modalNicknameRef,
                        modalSettingsRef,
                        modalPostSettingsRef,

                        user, setUser,
                        userData, setUserData,
                        posts, setPosts,
                        screen, setScreen,
                        repost, setRepost,
                        replyTo, setReplyTo,

                        setSettingsVis,
                        setShareProfileVis,
                        setSwitchAccountVis,
                        setPostSettingsModalVis,

                        category, setCategory,
                        scrolled, setScrolled,
                        editedPost, setEditedPost,
                        pushNotifsVis, setPushNotifsVis,
                        newFeatureVis, setNewFeatureVis,
                        previousScreen, setPreviousScreen,
                        postDetailsVis, setPostDetailsVis,
                        userConnecting, setUserConnecting,
                        profileSelected, setProfileSelected,
                        updateProfileVis, setUpdateProfileVis,
                        showConnectModal, setShowConnectModal,
                        newFeatureAlertVis, setNewFeatureAlertVis,

                        scrollToTop,
                        translateY,
                        scrollAnim,
                        offsetAnim,
                        navbarTranslate,
                        setClampedScroll,
                        setOffsetAnim,
                        setScrollAnim,
                        setRefreshing,

                        loading, setLoading,
                        newsPosts, setNewsPosts,
                        connectType, setConnectType,
                        listAccount, setListAccount,
                        nicknameVis, setNicknameVis,
                        listMessages, setListMessages,
                        currentRoute, setCurrentRoute,
                        selectedNews, setSelectedNews,
                        addressCopied, setAddressCopied,
                        switchLoading, setSwitchLoading,
                        tabViewHeight, setTabViewHeight,
                        categoryPosts, setCategoryPosts,
                        categoriesVis, setCategoriesVis,
                        activityClaim, setActivityClaim,
                        newGiftsCount, setNewGiftsCount,
                        showReportBack, setShowReportBack,
                        showImageSender, setShowImageSender,
                        connectModalVis, setConnectModalVis,
                        selectedCategory, setSelectedCategory,
                    }}
                >
                    <AccountTransitionResetSignal onTransition={resetAccountTransientUi} />
                    <AccountNavigationReplaySignal
                      ready={accountUiReady}
                      ownerUserId={deviceAccountData.ownerUserId}
                      sessionEpoch={deviceAccountData.sessionEpoch}
                      onReplay={tryNavigatePendingIntent}
                    />
                    <FullStartupSignal onStartupStatus={onStartupStatus} />
                    <AuthBridge
                      accountDeletionGuard={accountDeletionGuard}
                      onDeletionBlocked={reportDeletionBlock}
                    />

                    <TailwindProvider utilities={utilities}>
                        {accountDeletionGuard.status !== 'clear' ? (
                            <AccountDeletionPending guard={accountDeletionGuard} />
                        ) : deviceAccountData.status === 'storage-error' ? (
                            <DeviceAccountDataUnavailable retry={deviceAccountData.retry} />
                        ) : user && accountUiReady ? (
                            <>
                                <AppNavigator
                                  navigationRef={navigationRef}
                                  onNavigationReady={handleNavigationReady}
                                />

                                {/** Display the edit profile details modal */}
                                <UpdateProfileModal />

                                {/** Display push notifications pane */}
                                {pushNotifsVis &&
                                    <PushNotificationsModal />
                                }

                                {/** Display nickname pane */}
                                <NicknameModal />

                                {/** Render repost modal */}
                                {repost !== false &&
                                    <RepostModal />
                                }

                                {/** Share post container */}
                                <PostboxModal />

                                {/** Show post settings modal */}
                                <BottomSheetModalProvider>
                                    <BottomSheetModal
                                        ref={modalPostSettingsRef}
                                        index={1}
                                        snapPoints={showReportBack ? snapPointsLarge : snapPoints}
                                        handleIndicatorStyle={{backgroundColor: 'black',}}
                                        handleStyle={{height: 40,justifyContent: 'center',}}
                                        backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                                    >
                                        <PostSettingsModal />
                                    </BottomSheetModal>
                                </BottomSheetModalProvider>

                                {/** QR modal container */}
                                {shareProfileVis &&
                                    <QR hide={() => setShareProfileVis(false)} />
                                }

                                {addressCopied && (
                                    <View style={{backgroundColor: 'rgba(0,0,0,0.5)',width: '100%', height: '100%',position: 'absolute',justifyContent:'center',alignItems:'center',}}>
                                        <Image
                                            style={{width: 150, height: 150,alignSelf:'center',}}
                                            resizeMode='contain'
                                            source={require('./assets/link_copied.png')}
                                        />
                                    </View>
                                )}
                            </>
                        ) : !deviceAccountData.ownerUserId ? (
                            <Login />
                        ) : null}

                        {/* <Confetti confetti={confetti}/> */}
                    </TailwindProvider>
                </GlobalContext.Provider>
            </GestureHandlerRootView>
        </>
        );
        }}
        </DeviceAccountDataRender>
        )}
        </AccountDeletionSessionGate>
        </DeviceAccountDataProvider>
      </EasyGoPrivyBoundary>
    );
}

const Confetti = ({confetti}) => {
    return(
        <ConfettiCannon fadeOut={true} fallSpeed={2500} count={150} origin={{x: -400, y: 0}} autoStart={false} ref={confetti} />
    )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  configContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  brand: {
    color: '#FF6813',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 12,
  },
  configCode: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  configTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  configText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryText: {
    color: '#C2410C',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  configBullets: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'left',
  },
});
