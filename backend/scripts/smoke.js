#!/usr/bin/env node
import 'dotenv/config';
import { fileURLToPath } from 'node:url';

function clean(value) {
  return String(value || '').trim();
}

export function validateSmokeBaseUrl(value) {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!local && url.protocol !== 'https:') throw new Error('remote smoke targets must use HTTPS');
    url.pathname = url.pathname.replace(/\/$/, '');
    url.search = '';
    url.hash = '';
    return url;
  } catch (error) {
    throw new Error(`EASYGO_BASE_URL is invalid: ${error.message}`);
  }
}

export function validateProbe({ path, status, body, requestId, expectedRelease }) {
  if (status !== 200) throw new Error(`${path} returned HTTP ${status}`);
  if (!requestId) throw new Error(`${path} did not return X-Request-Id`);
  if (path === '/health' && body?.status !== 'alive') throw new Error('/health is not alive');
  if (path === '/ready' && body?.status !== 'ready') throw new Error('/ready is not ready');
  if (path === '/social/status' && body?.mode !== 'active') {
    throw new Error(`/social/status is ${body?.mode || 'unknown'}, expected active`);
  }
  if (expectedRelease && body?.release && body.release !== expectedRelease) {
    throw new Error(`${path} release does not match EXPECTED_RELEASE`);
  }
}

export async function runSmoke({
  baseUrl = process.env.EASYGO_BASE_URL,
  expectedRelease = clean(process.env.EXPECTED_RELEASE),
  fetchImpl = fetch,
} = {}) {
  const base = validateSmokeBaseUrl(baseUrl);
  const results = [];

  for (const path of ['/health', '/ready', '/social/status']) {
    const response = await fetchImpl(new URL(path, `${base.href}/`), {
      headers: { 'X-Request-Id': `smoke-${Date.now()}` },
      signal: AbortSignal.timeout(10_000),
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${path} did not return JSON`);
    }
    validateProbe({
      path,
      status: response.status,
      body,
      requestId: response.headers.get('x-request-id'),
      expectedRelease,
    });
    results.push({ path, status: response.status });
  }

  return { origin: base.origin, results };
}

async function run() {
  try {
    const result = await runSmoke();
    console.log(`EasyGo read-only smoke passed: ${result.origin}`);
    for (const probe of result.results) console.log(`[PASS] ${probe.path} — HTTP ${probe.status}`);
  } catch (error) {
    console.error(`EasyGo read-only smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();
