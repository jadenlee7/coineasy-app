import { createHash, timingSafeEqual } from 'node:crypto';
import { JustaName } from '@justaname.id/sdk';
import { getAddress, isAddressEqual } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { BASE_CHAIN_ID } from './siwe.js';

export const ENS_MAINNET_CHAIN_ID = 1;
export const ENS_SEPOLIA_CHAIN_ID = 11155111;
export const JUSTANAME_CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const SUBNAME_PENDING_TTL_MS = 5 * 60 * 1000;
export const BASE_COIN_TYPE = 0x80000000 + BASE_CHAIN_ID;

const RESERVED_LABELS = new Set([
  'admin',
  'api',
  'coineasy',
  'easygo',
  'help',
  'mail',
  'root',
  'security',
  'support',
  'www',
]);

export class JustaNameIntegrationError extends Error {
  constructor(code, cause) {
    super(code, cause ? { cause } : undefined);
    this.name = 'JustaNameIntegrationError';
    this.code = code;
  }
}

export function getJustaNameConfig(env = process.env) {
  const apiKey = env.JUSTANAME_API_KEY?.trim();
  const ensDomain = env.JUSTANAME_ENS_DOMAIN?.trim().toLowerCase();
  const domain = env.JUSTANAME_DOMAIN?.trim();
  const originValue = env.JUSTANAME_ORIGIN?.trim();
  const chainId = Number(env.JUSTANAME_CHAIN_ID || ENS_MAINNET_CHAIN_ID);

  if (!apiKey || !ensDomain || !domain || !originValue) {
    throw new Error(
      'JUSTANAME_API_KEY, JUSTANAME_ENS_DOMAIN, JUSTANAME_DOMAIN, and JUSTANAME_ORIGIN are required',
    );
  }
  if (![ENS_MAINNET_CHAIN_ID, ENS_SEPOLIA_CHAIN_ID].includes(chainId)) {
    throw new Error('JUSTANAME_CHAIN_ID must be 1 or 11155111');
  }
  if (env.NODE_ENV === 'production' && chainId !== ENS_MAINNET_CHAIN_ID) {
    throw new Error('production subnames must use Ethereum mainnet');
  }
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(domain)) {
    throw new Error('JUSTANAME_DOMAIN must be an RFC 3986 authority');
  }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(ensDomain)) {
    throw new Error('JUSTANAME_ENS_DOMAIN is invalid');
  }

  const origin = new URL(originValue);
  if (!['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('JUSTANAME_ORIGIN must use http or https');
  }
  if (env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('JUSTANAME_ORIGIN must use https in production');
  }

  return {
    apiKey,
    ensDomain,
    domain,
    origin: origin.toString(),
    chainId,
  };
}

let cachedClient = null;
let cachedClientKey = null;

export function getJustaNameClient(config = getJustaNameConfig()) {
  const key = JSON.stringify(config);
  if (cachedClient && cachedClientKey === key) return cachedClient;

  cachedClient = JustaName.init({
    config: {
      domain: config.domain,
      origin: config.origin,
      subnameChallengeTtl: JUSTANAME_CHALLENGE_TTL_MS,
    },
    defaultChainId: config.chainId,
    ensDomains: [{
      chainId: config.chainId,
      ensDomain: config.ensDomain,
      apiKey: config.apiKey,
    }],
    // The production API is used in every Node environment. Staging must be
    // enabled deliberately in a separate future integration.
    dev: false,
  });
  cachedClientKey = key;
  return cachedClient;
}

export function normalizeSubnameLabel(username) {
  const label = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9]{3,20}$/.test(label)) {
    throw new JustaNameIntegrationError('username_not_ens_compatible');
  }
  if (RESERVED_LABELS.has(label)) {
    throw new JustaNameIntegrationError('reserved_subname');
  }
  return label;
}

export function fullSubname(label, config = getJustaNameConfig()) {
  return `${normalizeSubnameLabel(label)}.${config.ensDomain}`;
}

export function hashJustaNameChallenge(message) {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

function challengeHashMatches(message, expectedHash) {
  if (!message || !expectedHash) return false;
  const actual = Buffer.from(hashJustaNameChallenge(message), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseAndValidateJustaNameChallenge({
  message,
  expectedAddress,
  expectedHash,
  expectedExpiresAt,
  config = getJustaNameConfig(),
  now = new Date(),
}) {
  let parsed;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    throw new JustaNameIntegrationError('invalid_justaname_challenge');
  }

  if (!parsed.address || !parsed.nonce || !parsed.issuedAt || !parsed.expirationTime) {
    throw new JustaNameIntegrationError('invalid_justaname_challenge');
  }
  if (parsed.version !== '1' || parsed.chainId !== config.chainId) {
    throw new JustaNameIntegrationError('invalid_justaname_chain');
  }
  let parsedUri;
  try {
    parsedUri = new URL(parsed.uri).toString();
  } catch {
    throw new JustaNameIntegrationError('invalid_justaname_origin');
  }
  if (parsed.domain !== config.domain || parsedUri !== config.origin) {
    throw new JustaNameIntegrationError('invalid_justaname_origin');
  }
  if (!isAddressEqual(parsed.address, expectedAddress)) {
    throw new JustaNameIntegrationError('invalid_justaname_address');
  }
  if (expectedHash && !challengeHashMatches(message, expectedHash)) {
    throw new JustaNameIntegrationError('invalid_justaname_challenge');
  }

  const issuedAt = new Date(parsed.issuedAt);
  const expiresAt = new Date(parsed.expirationTime);
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime())) {
    throw new JustaNameIntegrationError('invalid_justaname_expiration');
  }
  if (expiresAt <= now || issuedAt > new Date(now.getTime() + 30_000)) {
    throw new JustaNameIntegrationError('justaname_challenge_expired');
  }
  if (expiresAt.getTime() - issuedAt.getTime() > JUSTANAME_CHALLENGE_TTL_MS + 5_000) {
    throw new JustaNameIntegrationError('invalid_justaname_expiration');
  }
  if (expectedExpiresAt
      && Math.abs(expiresAt.getTime() - new Date(expectedExpiresAt).getTime()) > 1_000) {
    throw new JustaNameIntegrationError('invalid_justaname_expiration');
  }

  return {
    ...parsed,
    address: getAddress(parsed.address),
    issuedAt,
    expirationTime: expiresAt,
  };
}

export async function requestJustaNameChallenge({ client, address, config }) {
  try {
    const response = await client.siwe.requestChallenge({
      domain: config.domain,
      origin: config.origin,
      address: getAddress(address),
      chainId: config.chainId,
      ttl: JUSTANAME_CHALLENGE_TTL_MS,
    });
    if (!response?.challenge) throw new Error('challenge missing');
    return response.challenge;
  } catch (error) {
    throw new JustaNameIntegrationError('justaname_unavailable', error);
  }
}

export async function isJustaNameAvailable({ client, subname, config }) {
  try {
    const response = await client.subnames.isSubnameAvailable({
      subname,
      chainId: config.chainId,
    });
    return response?.isAvailable === true;
  } catch (error) {
    throw new JustaNameIntegrationError('justaname_unavailable', error);
  }
}

export async function getJustaNameSubname({ client, subname, config }) {
  try {
    return await client.subnames.getSubname({ subname, chainId: config.chainId });
  } catch (error) {
    throw new JustaNameIntegrationError('justaname_unavailable', error);
  }
}

export function subnameResolvesToAddress(subnameRecord, address) {
  if (!subnameRecord?.ens || !Array.isArray(subnameRecord?.records?.coins)) return false;
  return subnameRecord.records.coins.some((coin) => {
    if (![60, BASE_COIN_TYPE].includes(Number(coin.id))) return false;
    try {
      return isAddressEqual(coin.value, address);
    } catch {
      return false;
    }
  });
}

export async function addJustaNameSubname({
  client,
  username,
  address,
  message,
  signature,
  config,
}) {
  try {
    return await client.subnames.addSubname({
      username,
      ensDomain: config.ensDomain,
      chainId: config.chainId,
      addresses: [
        { address: getAddress(address), coinType: 60 },
        { address: getAddress(address), coinType: BASE_COIN_TYPE },
      ],
    }, {
      xApiKey: config.apiKey,
      xAddress: getAddress(address),
      xMessage: message,
      xSignature: signature,
    });
  } catch (error) {
    throw new JustaNameIntegrationError('justaname_issue_failed', error);
  }
}
