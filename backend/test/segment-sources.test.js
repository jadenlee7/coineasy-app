import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSegmentSources,
  getSegmentSourceConfig,
  normalizeBaseActivity,
} from '../src/lib/segment-sources.js';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

test('segment source URLs fail closed in production and activity keys stay server-side', () => {
  const config = getSegmentSourceConfig({
    NODE_ENV: 'production',
    BASE_RPC_URL: 'https://base.example',
    EFP_API_URL: 'https://efp.example/v1',
    ETHERSCAN_API_URL: 'https://scan.example/v2/api',
    ETHERSCAN_API_KEY: 'server-secret',
  });
  assert.equal(config.etherscanApiKey, 'server-secret');
  assert.throws(() => getSegmentSourceConfig({
    NODE_ENV: 'production',
    BASE_RPC_URL: 'http://base.example',
  }), /HTTPS/);
});

test('Base activity deduplicates normal and token rows and counts UTC active days', () => {
  const history = {
    normal: [
      { hash: '0xaaa', timeStamp: '1784635200' },
      { hash: '0xfailed', timeStamp: '1784635200', isError: '1' },
    ],
    erc20: [
      { hash: '0xAAA', timeStamp: '1784635200' },
      { hash: '0xbbb', timeStamp: '1784721600' },
      { hash: '0xold', timeStamp: '1700000000' },
    ],
  };
  assert.deepEqual(
    normalizeBaseActivity(history, new Date('2026-07-20T00:00:00.000Z')),
    { activityCount: 2, activeDays: 2, historyTruncated: false },
  );
});

test('source adapters use Base reads, EFP stats, Etherscan V2, and local swaps', async () => {
  const requests = [];
  const publicClient = {
    getBalance: async () => 5n,
    readContract: async () => 100_000_000n,
    getTransactionCount: async () => 7,
  };
  const db = {
    swapLog: {
      count: async (query) => {
        assert.equal(query.where.chainId, '8453');
        return 3;
      },
    },
  };
  const fetchImpl = async (url) => {
    requests.push(url.toString());
    if (url.pathname.endsWith('/stats')) {
      return jsonResponse({ followers_count: 12, following_count: 4 });
    }
    const action = url.searchParams.get('action');
    return jsonResponse({
      status: '1',
      message: 'OK',
      result: [{ hash: action === 'txlist' ? '0xnormal' : '0xtoken', timeStamp: '1784635200' }],
    });
  };
  const sources = createSegmentSources({
    db,
    publicClient,
    fetchImpl,
    env: {
      BASE_RPC_URL: 'https://base.example',
      EFP_API_URL: 'https://efp.example/api/v1',
      ETHERSCAN_API_URL: 'https://scan.example/v2/api',
      ETHERSCAN_API_KEY: 'test-key',
    },
  });

  assert.equal(await sources.nativeBalance(ADDRESS), 5n);
  assert.equal(await sources.erc20Balance(ADDRESS, TOKEN), 100_000_000n);
  assert.equal(await sources.transactionCount(ADDRESS), 7);
  assert.deepEqual(await sources.efpStats(ADDRESS), { followers: 12, following: 4 });
  const history = await sources.baseHistory(ADDRESS);
  assert.equal(history.normal[0].hash, '0xnormal');
  assert.equal(history.erc20[0].hash, '0xtoken');
  assert.equal(await sources.swapCount('user_1', new Date()), 3);

  assert.equal(requests.filter((url) => url.includes('apikey=test-key')).length, 2);
  assert.equal(requests.some((url) => url.includes('/users/0x0000000000000000000000000000000000000001/stats')), true);
});

test('time-windowed Base activity rules require an Etherscan key', async () => {
  const sources = createSegmentSources({
    db: { swapLog: { count: async () => 0 } },
    publicClient: {},
    fetchImpl: async () => jsonResponse({}),
    env: { BASE_RPC_URL: 'https://base.example' },
  });
  await assert.rejects(() => sources.baseHistory(ADDRESS), (error) => (
    error.code === 'etherscan_not_configured'
  ));
});
