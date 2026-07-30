import { createPrivyClient } from '@privy-io/expo';
import { easyGoPrivyStorage } from './privyStorage';

export const EASYGO_BASE_CHAIN = {
  id: 8453,
  name: 'Base',
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
};

let easyGoPrivyClient = null;

export function getEasyGoPrivyClient() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId || !clientId) {
    throw new Error('Privy public identifiers are missing from the release bundle');
  }

  if (!easyGoPrivyClient) {
    easyGoPrivyClient = createPrivyClient({
      appId,
      clientId,
      storage: easyGoPrivyStorage,
      supportedChains: [EASYGO_BASE_CHAIN],
    });
  }

  return easyGoPrivyClient;
}

// Kept separate from initialize so build 95 can prove whether constructing the
// JS client alone is safe before any network, Provider, or WebView work begins.
export function createEasyGoPrivyClient() {
  return getEasyGoPrivyClient();
}

export async function initializeEasyGoPrivyClient() {
  const client = createEasyGoPrivyClient();
  await client.initialize();
  return client;
}

// Use the URL assembled by Privy's own client after initialize() has applied
// any server-provided base URL. The diagnostic UI never renders or persists it.
export function getEasyGoPrivyWebViewUrl() {
  const url = getEasyGoPrivyClient().embeddedWallet?.getURL?.();
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Privy client did not provide a secure embedded-wallet URL');
  }
  return url;
}
