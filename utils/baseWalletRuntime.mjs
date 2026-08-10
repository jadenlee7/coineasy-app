export const EASYGO_BASE_CHAIN_ID = 8453;
export const EASYGO_BASE_CHAIN_HEX = '0x2105';
export const EASYGO_BASE_EXPLORER_URL = 'https://basescan.org';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function normalizeEvmAddress(value) {
  return typeof value === 'string' && EVM_ADDRESS_RE.test(value)
    ? value.toLowerCase()
    : null;
}

export function parseEvmChainId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.trim().toLowerCase();
  const radix = normalized.startsWith('0x') ? 16 : 10;
  if (
    (radix === 16 && !/^0x[0-9a-f]+$/.test(normalized))
    || (radix === 10 && !/^\d+$/.test(normalized))
  ) {
    return null;
  }

  const chainId = Number.parseInt(normalized, radix);
  return Number.isSafeInteger(chainId) ? chainId : null;
}

export function attestBaseWalletRuntime({
  chainId,
  accounts,
  walletAddress,
  expectedAddress,
}) {
  const parsedChainId = parseEvmChainId(chainId);
  if (parsedChainId !== EASYGO_BASE_CHAIN_ID) {
    return {
      status: parsedChainId === null ? 'error' : 'wrong-chain',
      chainId: parsedChainId,
    };
  }

  const normalizedWallet = normalizeEvmAddress(walletAddress);
  const normalizedExpected = normalizeEvmAddress(expectedAddress);
  const normalizedAccounts = Array.isArray(accounts)
    ? accounts.map(normalizeEvmAddress).filter(Boolean)
    : [];

  if (
    !normalizedWallet
    || !normalizedExpected
    || normalizedWallet !== normalizedExpected
    || !normalizedAccounts.includes(normalizedWallet)
  ) {
    return { status: 'account-mismatch', chainId: parsedChainId };
  }

  return { status: 'ready', chainId: parsedChainId };
}

export function createBaseScanAddressUrl(address) {
  const normalized = normalizeEvmAddress(address);
  return normalized ? `${EASYGO_BASE_EXPLORER_URL}/address/${normalized}` : null;
}
