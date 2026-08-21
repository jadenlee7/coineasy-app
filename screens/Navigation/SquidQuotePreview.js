import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';
import { useDeviceAccountOperationLease } from '../../contexts/DeviceAccountDataContext';
import useEasyGoWalletRuntime from '../../hooks/useEasyGoWalletRuntime';
import { ApiError } from '../../utils/api';
import { getSquidQuotePreview } from '../../utils/squid';
import {
  SQUID_QUOTE_PREVIEW_DIRECTIONS,
  buildSquidQuotePreviewRequest,
  parseSquidQuotePreviewAmount,
  presentSquidQuotePreview,
} from '../../utils/squidQuotePreview.mjs';

const PREVIEW_TTL_MS = 20_000;

const WALLET_STATUS = Object.freeze({
  idle: 'Waiting for wallet',
  checking: 'Checking Base wallet',
  ready: 'Base wallet connected',
  'wrong-chain': 'Base network required',
  'account-mismatch': 'Signed-in wallet mismatch',
  'wallet-missing': 'Embedded wallet unavailable',
  error: 'Wallet check unavailable',
});

function shortAddress(address) {
  if (typeof address !== 'string' || address.length < 12) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function previewErrorMessage(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your login expired. Sign in again and retry.';
    if (error.status === 400 || error.status === 409) {
      return 'The amount or wallet could not be used for this preview.';
    }
    if (error.status === 429) return 'Too many requests. Wait a moment and retry.';
    if (error.status === 502) return 'Squid could not find a Base route right now.';
  }
  return 'Quote preview is temporarily unavailable. Please retry.';
}

const SquidQuotePreview = ({ navigation }) => {
  const { user } = useContext(GlobalContext);
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const expectedWalletAddress = user?.profile?.data?.walletAddress || null;
  const walletRuntime = useEasyGoWalletRuntime({ expectedAddress: expectedWalletAddress });
  const [direction, setDirection] = useState('ETH_TO_USDC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [quotedAt, setQuotedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const liveWalletRef = useRef(walletRuntime.walletAddress);
  liveWalletRef.current = walletRuntime.walletAddress;

  const pair = SQUID_QUOTE_PREVIEW_DIRECTIONS[direction];
  const amountState = parseSquidQuotePreviewAmount(amount, pair.fromToken);
  const presentedQuote = presentSquidQuotePreview(quote, pair);
  const leaseKey = `${lease?.ownerUserId || 'none'}:${lease?.sessionEpoch || 'none'}`;

  const clearPreview = useCallback(({ message = null, abort = true } = {}) => {
    requestIdRef.current += 1;
    if (abort) abortRef.current?.abort?.();
    abortRef.current = null;
    setQuote(null);
    setQuotedAt(null);
    setLoading(false);
    setErrorMessage(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    clearPreview();
  }, [clearPreview, leaseKey, walletRuntime.walletAddress, walletRuntime.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') clearPreview();
    });
    return () => subscription.remove();
  }, [clearPreview]);

  useEffect(() => {
    if (!quotedAt) return undefined;
    const timer = setTimeout(() => {
      clearPreview({ message: 'This preview expired. Request a fresh quote.' });
    }, PREVIEW_TTL_MS);
    return () => clearTimeout(timer);
  }, [clearPreview, quotedAt]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    abortRef.current?.abort?.();
  }, []);

  const chooseDirection = (nextDirection) => {
    if (nextDirection === direction) return;
    Haptics.selectionAsync();
    clearPreview();
    setDirection(nextDirection);
    setAmount('');
  };

  const updateAmount = (nextAmount) => {
    clearPreview();
    setAmount(nextAmount);
  };

  const requestPreview = async () => {
    const operationLease = lease;
    const operationWallet = walletRuntime.walletAddress;
    const request = buildSquidQuotePreviewRequest({
      amount,
      direction,
      walletAddress: operationWallet,
    });
    if (walletRuntime.status !== 'ready' || !operationLease || !isCurrentLease(operationLease)) {
      setErrorMessage('Connect the signed-in Base wallet before requesting a quote.');
      return;
    }
    if (!request.ok) {
      setErrorMessage(request.message);
      return;
    }

    Haptics.selectionAsync();
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const normalizedWallet = operationWallet.toLowerCase();
    const isCurrentRequest = () => (
      requestId === requestIdRef.current
      && isCurrentLease(operationLease)
      && liveWalletRef.current?.toLowerCase() === normalizedWallet
    );

    setLoading(true);
    setQuote(null);
    setQuotedAt(null);
    setErrorMessage(null);
    setNotice(null);
    try {
      const result = await getSquidQuotePreview({
        ...request.params,
        lease: operationLease,
        isCurrentLease,
        signal: controller.signal,
      });
      if (!isCurrentRequest()) return;
      const presentation = presentSquidQuotePreview(result, request.pair);
      if (!presentation) {
        setErrorMessage('Squid did not return a usable Base quote.');
        return;
      }
      setQuote(result);
      setQuotedAt(Date.now());
    } catch (error) {
      if (!isCurrentRequest() || error?.name === 'AbortError') return;
      setErrorMessage(previewErrorMessage(error));
    } finally {
      if (isCurrentRequest()) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const walletReady = walletRuntime.status === 'ready';
  const canRequest = walletReady && amountState.ok && !loading;
  const walletLabel = WALLET_STATUS[walletRuntime.status] || WALLET_STATUS.error;

  return (
    <View style={styles.screen}>
      <HeaderImage />

      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          onPress={() => {
            Haptics.selectionAsync();
            navigation.goBack();
          }}
        >
          <Image
            style={styles.backIcon}
            resizeMode="contain"
            source={require('../../assets/back_button.png')}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Squid Quote Preview</Text>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.safetyCard}>
              <Text style={styles.safetyTitle}>Preview only · No transaction</Text>
              <Text style={styles.safetyCopy}>
                This checks an estimated route on Base. EasyGo will not ask for a signature,
                broadcast a transaction, or award Orange from this screen. Your public wallet
                address is shared with Squid only to calculate the preview.
              </Text>
            </View>

            <View style={styles.walletRow}>
              <View style={[styles.statusDot, walletReady ? styles.statusReady : styles.statusBlocked]} />
              <View style={styles.walletTextWrap}>
                <Text style={styles.walletStatus}>{walletLabel}</Text>
                <Text style={styles.walletAddress}>
                  {shortAddress(walletRuntime.walletAddress) || 'No wallet address'}
                </Text>
              </View>
              {walletRuntime.status === 'error' ? (
                <TouchableOpacity style={styles.retryButton} onPress={walletRuntime.refresh}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.label}>Token pair</Text>
            <View style={styles.segmentedControl}>
              {Object.values(SQUID_QUOTE_PREVIEW_DIRECTIONS).map((option) => {
                const selected = direction === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
                    onPress={() => chooseDirection(option.id)}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {option.fromToken.symbol} → {option.toToken.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountRow}>
              <TextInput
                accessibilityLabel={`Amount in ${pair.fromToken.symbol}`}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                style={styles.amountInput}
                value={amount}
                onChangeText={updateAmount}
              />
              <Text style={styles.amountSymbol}>{pair.fromToken.symbol}</Text>
            </View>
            {amount && !amountState.ok ? (
              <Text style={styles.fieldError}>{amountState.message}</Text>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !canRequest }}
              disabled={!canRequest}
              style={[styles.previewButton, !canRequest && styles.previewButtonDisabled]}
              onPress={requestPreview}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.previewButtonText}>Get quote preview</Text>
              )}
            </TouchableOpacity>

            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
            {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

            {presentedQuote ? (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Estimated route</Text>
                  <Text style={styles.baseBadge}>{presentedQuote.chainLabel || 'Base'}</Text>
                </View>
                <Text style={styles.resultFrom}>{presentedQuote.fromLabel}</Text>
                <Text style={styles.resultArrow}>↓</Text>
                <Text style={styles.resultTo}>{presentedQuote.toLabel}</Text>

                <View style={styles.divider} />
                {presentedQuote.minimumLabel ? (
                  <ResultRow label="Minimum received" value={presentedQuote.minimumLabel} />
                ) : null}
                {presentedQuote.rateLabel ? (
                  <ResultRow
                    label={`1 ${pair.fromToken.symbol}`}
                    value={`${presentedQuote.rateLabel} ${pair.toToken.symbol}`}
                  />
                ) : null}
                {presentedQuote.feeUsdLabel ? (
                  <ResultRow label="Estimated gas + fees" value={presentedQuote.feeUsdLabel} />
                ) : null}
                {presentedQuote.durationLabel ? (
                  <ResultRow label="Estimated time" value={presentedQuote.durationLabel} />
                ) : null}
                {presentedQuote.slippageLabel ? (
                  <ResultRow label="Route slippage" value={`${presentedQuote.slippageLabel}%`} />
                ) : null}
                {presentedQuote.priceImpactLabel ? (
                  <ResultRow label="Price impact" value={`${presentedQuote.priceImpactLabel}%`} />
                ) : null}
                {presentedQuote.providersLabel ? (
                  <ResultRow label="Route" value={presentedQuote.providersLabel} stacked />
                ) : null}
                <Text style={styles.expiryCopy}>
                  Indicative only. This preview expires after 20 seconds and cannot be executed.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

function ResultRow({ label, value, stacked = false }) {
  return (
    <View style={[styles.resultRow, stacked && styles.resultRowStacked]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, stacked && styles.resultValueStacked]}>{value}</Text>
    </View>
  );
}

export default SquidQuotePreview;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
    paddingTop: 4,
  },
  backButton: { margin: 15 },
  backIcon: { width: 24, height: 24 },
  headerTitle: {
    color: '#111827',
    fontFamily: 'GmarketBold',
    fontSize: Platform.OS === 'ios' ? 18 : 16,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  safetyCard: {
    backgroundColor: '#FFF4EC',
    borderColor: '#FFD4BA',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  safetyTitle: {
    color: '#9A3412',
    fontFamily: 'GmarketBold',
    fontSize: Platform.OS === 'ios' ? 15 : 13,
  },
  safetyCopy: {
    color: '#7C2D12',
    fontFamily: 'GmarketMedium',
    fontSize: Platform.OS === 'ios' ? 12 : 11,
    lineHeight: 18,
    marginTop: 7,
  },
  walletRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 16,
    padding: 14,
  },
  statusDot: { borderRadius: 6, height: 12, marginRight: 10, width: 12 },
  statusReady: { backgroundColor: '#22C55E' },
  statusBlocked: { backgroundColor: '#F97316' },
  walletTextWrap: { flex: 1 },
  walletStatus: { color: '#1F2937', fontFamily: 'GmarketMedium', fontSize: 13 },
  walletAddress: { color: '#64748B', fontSize: 12, marginTop: 3 },
  retryButton: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  retryText: { color: '#C2410C', fontFamily: 'GmarketMedium', fontSize: 11 },
  label: {
    color: '#374151',
    fontFamily: 'GmarketBold',
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: 9,
    marginTop: 20,
  },
  segmentedControl: { backgroundColor: '#F1F5F9', borderRadius: 14, flexDirection: 'row', padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 11, flex: 1, paddingVertical: 11 },
  segmentButtonSelected: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#64748B', fontFamily: 'GmarketMedium', fontSize: 12 },
  segmentTextSelected: { color: '#C2410C', fontFamily: 'GmarketBold' },
  amountRow: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 15,
  },
  amountInput: { color: '#111827', flex: 1, fontSize: 24, minHeight: 58, paddingVertical: 10 },
  amountSymbol: { color: '#334155', fontFamily: 'GmarketBold', fontSize: 14 },
  fieldError: { color: '#B91C1C', fontSize: 12, marginTop: 7 },
  previewButton: {
    alignItems: 'center',
    backgroundColor: '#FF6B17',
    borderRadius: 24,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
  },
  previewButtonDisabled: { backgroundColor: '#CBD5E1' },
  previewButtonText: { color: '#FFFFFF', fontFamily: 'GmarketBold', fontSize: 14 },
  errorBanner: { color: '#B91C1C', fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  noticeBanner: { color: '#475569', fontFamily: 'GmarketMedium', fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  resultCard: { backgroundColor: '#F8FAFC', borderRadius: 18, marginTop: 22, padding: 18 },
  resultHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  resultTitle: { color: '#1F2937', fontFamily: 'GmarketBold', fontSize: 15 },
  baseBadge: { backgroundColor: '#E8F1FF', borderRadius: 14, color: '#155EEF', fontFamily: 'GmarketBold', fontSize: 11, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  resultFrom: { color: '#64748B', fontSize: 16, marginTop: 22 },
  resultArrow: { color: '#F97316', fontSize: 22, marginVertical: 4 },
  resultTo: { color: '#111827', fontFamily: 'GmarketBold', fontSize: 24 },
  divider: { backgroundColor: '#E2E8F0', height: 1, marginVertical: 18 },
  resultRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  resultRowStacked: { flexDirection: 'column' },
  resultLabel: { color: '#64748B', fontSize: 12 },
  resultValue: { color: '#1F2937', flexShrink: 1, fontFamily: 'GmarketMedium', fontSize: 12, marginLeft: 14, textAlign: 'right' },
  resultValueStacked: { marginLeft: 0, marginTop: 5, textAlign: 'left' },
  expiryCopy: { color: '#94A3B8', fontSize: 11, lineHeight: 16, marginTop: 5 },
});
