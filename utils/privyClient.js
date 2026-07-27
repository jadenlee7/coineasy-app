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

export async function initializeEasyGoPrivyClient() {
  const client = getEasyGoPrivyClient();
  await client.initialize();
  return client;
}
