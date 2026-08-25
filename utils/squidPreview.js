// Display-only Squid preview client.
//
// This module intentionally has no route execution, wallet signer, transaction
// payload, or reward-log API. The backend returns a sanitized Base estimate
// that cannot be signed or broadcast by the mobile app.

import { api } from './api';
import { createSquidRouteLeaseRegistry } from './squidRouteLease.mjs';

const previewLeases = createSquidRouteLeaseRegistry();

export async function getSquidQuotePreview({
  fromToken,
  fromAmount,
  toToken,
  lease,
  isCurrentLease,
  signal,
}) {
  const operationLease = previewLeases.requireCurrent(lease, isCurrentLease);
  try {
    const result = await api.swapQuotePreview(
      { fromToken, fromAmount, toToken },
      {
        signal,
        expectedAuthUserId: operationLease.ownerUserId,
      },
    );
    previewLeases.requireCurrent(operationLease, isCurrentLease);
    return result?.preview ? result : null;
  } catch (error) {
    previewLeases.requireCurrent(operationLease, isCurrentLease);
    throw error;
  }
}
