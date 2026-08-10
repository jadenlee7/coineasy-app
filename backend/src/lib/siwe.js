import { createHash, timingSafeEqual } from 'node:crypto';
import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  verifyMessage,
} from 'viem';
import { base } from 'viem/chains';
import { createSiweMessage, generateSiweNonce, parseSiweMessage } from 'viem/siwe';

export const BASE_CHAIN_ID = 8453;
export const SIWE_NONCE_TTL_MS = 10 * 60 * 1000;

export class SiweValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SiweValidationError';
    this.code = code;
  }
}

export function getSiweConfig(env = process.env) {
  const domain = env.SIWE_DOMAIN?.trim();
  const uri = env.SIWE_URI?.trim();
  if (!domain || !uri) throw new Error('SIWE_DOMAIN and SIWE_URI are required');
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(domain)) {
    throw new Error('SIWE_DOMAIN must be an RFC 3986 authority without a scheme or path');
  }

  const parsedUri = new URL(uri);
  if (parsedUri.host !== domain) throw new Error('SIWE_URI authority must match SIWE_DOMAIN');
  if (!['https:', 'http:'].includes(parsedUri.protocol)) {
    throw new Error('SIWE_URI must use http or https');
  }
  if (env.NODE_ENV === 'production' && parsedUri.protocol !== 'https:') {
    throw new Error('SIWE_URI must use https in production');
  }

  return {
    domain,
    uri: parsedUri.toString(),
    scheme: parsedUri.protocol.slice(0, -1),
    statement: env.SIWE_STATEMENT?.trim()
      || 'Sign in to EasyGo and verify ownership of this wallet.',
  };
}

export function hashSiweNonce(nonce) {
  return createHash('sha256').update(nonce, 'utf8').digest('hex');
}

export function nonceHashMatches(nonce, expectedHash) {
  if (!nonce || !expectedHash) return false;
  const actual = Buffer.from(hashSiweNonce(nonce), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSiweChallenge({ address, config = getSiweConfig(), now = new Date(), nonce }) {
  const issuedAt = new Date(now);
  const expirationTime = new Date(issuedAt.getTime() + SIWE_NONCE_TTL_MS);
  const fields = {
    address: getAddress(address),
    chainId: BASE_CHAIN_ID,
    domain: config.domain,
    uri: config.uri,
    scheme: config.scheme,
    statement: config.statement,
    version: '1',
    nonce: nonce || generateSiweNonce(),
    issuedAt,
    expirationTime,
  };
  return {
    ...fields,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expirationTime.toISOString(),
    message: createSiweMessage(fields),
  };
}

export function parseAndValidateSiweMessage({
  message,
  expectedAddress,
  expectedNonceHash,
  expectedExpiresAt,
  config = getSiweConfig(),
  now = new Date(),
}) {
  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce || !parsed.issuedAt || !parsed.expirationTime) {
    throw new SiweValidationError('invalid_message');
  }
  if (parsed.version !== '1') throw new SiweValidationError('invalid_version');
  if (parsed.chainId !== BASE_CHAIN_ID) throw new SiweValidationError('invalid_chain');
  if (parsed.domain !== config.domain || parsed.uri !== config.uri || parsed.scheme !== config.scheme) {
    throw new SiweValidationError('invalid_origin');
  }
  if (!isAddressEqual(parsed.address, expectedAddress)) {
    throw new SiweValidationError('invalid_address');
  }
  if (!nonceHashMatches(parsed.nonce, expectedNonceHash)) {
    throw new SiweValidationError('invalid_nonce');
  }

  const expiresAt = new Date(expectedExpiresAt);
  const expectedIssuedAt = new Date(expiresAt.getTime() - SIWE_NONCE_TTL_MS);
  if (Math.abs(parsed.expirationTime.getTime() - expiresAt.getTime()) > 1_000) {
    throw new SiweValidationError('invalid_expiration');
  }
  if (Math.abs(parsed.issuedAt.getTime() - expectedIssuedAt.getTime()) > 1_000) {
    throw new SiweValidationError('invalid_issued_at');
  }
  if (now >= expiresAt || now >= parsed.expirationTime) {
    throw new SiweValidationError('nonce_expired');
  }

  return { ...parsed, address: getAddress(parsed.address) };
}

const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

export async function verifySiweSignature({
  message,
  signature,
  address,
  nonce,
  config = getSiweConfig(),
  client = baseClient,
}) {
  try {
    if (await verifyMessage({ address, message, signature })) return true;
  } catch {
    // Smart-account signatures are verified through the Base public client.
  }

  return client.verifySiweMessage({
    address,
    domain: config.domain,
    scheme: config.scheme,
    nonce,
    message,
    signature,
    time: new Date(),
  });
}
