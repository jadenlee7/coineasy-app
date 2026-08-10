import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
} from 'viem';
import { base } from 'viem/chains';
import { z } from 'zod';

const DEFAULT_EFP_API_URL = 'https://api.ethfollow.xyz/api/v1';
const DEFAULT_ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const ETHERSCAN_PAGE_LIMIT = 1_000;

const efpStatsSchema = z.object({
  followers_count: z.coerce.number().int().nonnegative(),
  following_count: z.coerce.number().int().nonnegative(),
}).passthrough();

const etherscanActivityRowSchema = z.object({
  hash: z.string().min(1),
  timeStamp: z.string().regex(/^\d+$/),
  isError: z.string().optional(),
}).passthrough();

function positiveInteger(value, fallback, { min = 1, max = 120_000 } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`expected an integer between ${min} and ${max}`);
  }
  return parsed;
}

function configuredUrl(name, value, fallback, env) {
  const raw = String(value || fallback).trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production`);
  }
  return url.toString().replace(/\/$/, '');
}

export function getSegmentSourceConfig(env = process.env) {
  return {
    baseRpcUrl: configuredUrl(
      'BASE_RPC_URL',
      env.BASE_RPC_URL,
      'https://mainnet.base.org',
      env,
    ),
    efpApiUrl: configuredUrl('EFP_API_URL', env.EFP_API_URL, DEFAULT_EFP_API_URL, env),
    etherscanApiUrl: configuredUrl(
      'ETHERSCAN_API_URL',
      env.ETHERSCAN_API_URL,
      DEFAULT_ETHERSCAN_API_URL,
      env,
    ),
    etherscanApiKey: String(env.ETHERSCAN_API_KEY || '').trim(),
    requestTimeoutMs: positiveInteger(
      env.SEGMENT_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      { min: 1_000, max: 60_000 },
    ),
  };
}

async function requestJson(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`source request failed with HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function etherscanRows(payload, action) {
  if (payload?.status === '0' && /no transactions found/i.test(String(payload?.message))) {
    return [];
  }
  if (payload?.status !== '1' || !Array.isArray(payload?.result)) {
    throw new Error(`Etherscan ${action} failed`);
  }
  return z.array(etherscanActivityRowSchema).parse(payload.result);
}

function etherscanUrl(config, { action, address }) {
  if (!config.etherscanApiKey) {
    const error = new Error('ETHERSCAN_API_KEY is required by Base activity rules');
    error.code = 'etherscan_not_configured';
    throw error;
  }
  const url = new URL(config.etherscanApiUrl);
  url.searchParams.set('apikey', config.etherscanApiKey);
  url.searchParams.set('chainid', String(base.id));
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', action);
  url.searchParams.set('address', getAddress(address));
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '999999999');
  url.searchParams.set('page', '1');
  url.searchParams.set('offset', String(ETHERSCAN_PAGE_LIMIT));
  url.searchParams.set('sort', 'desc');
  return url;
}

export function normalizeBaseActivity(history, since) {
  const cutoffSeconds = Math.floor(since.getTime() / 1000);
  const byHash = new Map();
  const historyTruncated = [history.normal, history.erc20].some((rows) => (
    rows.length >= ETHERSCAN_PAGE_LIMIT
    && Number(rows.at(-1)?.timeStamp) >= cutoffSeconds
  ));

  for (const row of [...history.normal, ...history.erc20]) {
    const timestamp = Number(row.timeStamp);
    if (!Number.isSafeInteger(timestamp) || timestamp < cutoffSeconds || row.isError === '1') {
      continue;
    }
    const key = row.hash.toLowerCase();
    const existing = byHash.get(key);
    if (!existing || timestamp < existing) byHash.set(key, timestamp);
  }

  const activeDays = new Set(
    [...byHash.values()].map((timestamp) => new Date(timestamp * 1000).toISOString().slice(0, 10)),
  );

  return {
    activityCount: byHash.size,
    activeDays: activeDays.size,
    historyTruncated,
  };
}

export function createSegmentSources({
  db,
  env = process.env,
  fetchImpl = globalThis.fetch,
  publicClient,
} = {}) {
  if (!db) throw new Error('segment sources require a database client');
  if (typeof fetchImpl !== 'function') throw new Error('segment sources require fetch');

  const config = getSegmentSourceConfig(env);
  const baseClient = publicClient || createPublicClient({
    chain: base,
    transport: http(config.baseRpcUrl, { timeout: config.requestTimeoutMs }),
  });

  return {
    async nativeBalance(address) {
      return baseClient.getBalance({ address: getAddress(address), blockTag: 'safe' });
    },

    async erc20Balance(address, contractAddress) {
      return baseClient.readContract({
        address: getAddress(contractAddress),
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [getAddress(address)],
        blockTag: 'safe',
      });
    },

    async transactionCount(address) {
      return baseClient.getTransactionCount({ address: getAddress(address), blockTag: 'safe' });
    },

    async baseHistory(address) {
      const normalUrl = etherscanUrl(config, { action: 'txlist', address });
      const tokenUrl = etherscanUrl(config, { action: 'tokentx', address });
      const normalPayload = await requestJson(normalUrl, {
        fetchImpl,
        timeoutMs: config.requestTimeoutMs,
      });
      const tokenPayload = await requestJson(tokenUrl, {
        fetchImpl,
        timeoutMs: config.requestTimeoutMs,
      });
      return {
        normal: etherscanRows(normalPayload, 'txlist'),
        erc20: etherscanRows(tokenPayload, 'tokentx'),
      };
    },

    async efpStats(address) {
      const url = new URL(
        `${config.efpApiUrl}/users/${encodeURIComponent(getAddress(address))}/stats`,
      );
      const payload = await requestJson(url, {
        fetchImpl,
        timeoutMs: config.requestTimeoutMs,
      });
      const stats = efpStatsSchema.parse(payload);
      return {
        followers: stats.followers_count,
        following: stats.following_count,
      };
    },

    async swapCount(userId, since) {
      return db.swapLog.count({
        where: {
          userId,
          chainId: String(base.id),
          createdAt: { gte: since },
        },
      });
    },
  };
}
