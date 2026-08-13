const INTERRUPTED_STARTUP_STATUSES = new Set(['failed', 'pending']);

const RECOVERABLE_STARTUP_STEPS = new Set([
  'polyfill-text',
  'polyfill-random',
  'polyfill-ethers',
  'gesture-handler',
  'reanimated',
  'privy-probe-module',
  'privy-storage-roundtrip',
  'privy-client-create',
  'privy-client-initialize',
  'privy-raw-webview',
  'privy-provider-mount',
  'privy-provider-child',
  'privy-provider-ready',
  'full-app-module',
  'full-app-render',
  'full-provider-child',
  'full-provider-ready',
]);

export function startupRecoveryRequired(marker, buildNumber) {
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
  const expectedBuild = String(buildNumber ?? '').trim();
  const markerBuild = String(marker.build ?? '').trim();
  return Boolean(
    expectedBuild
    && markerBuild === expectedBuild
    && INTERRUPTED_STARTUP_STATUSES.has(marker.status)
    && RECOVERABLE_STARTUP_STEPS.has(marker.step)
  );
}
