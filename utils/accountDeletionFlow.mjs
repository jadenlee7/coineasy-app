import { ACCOUNT_DELETION_MARKER_PHASE } from './accountDeletionMarker.mjs';

function isDefinitiveNoRequest(error) {
  return Number(error?.status) === 400
    && error?.body?.error === 'confirmation_required';
}

function acceptedDeletionResponse(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.state === 'string'
    && value.state.length > 0
    && typeof value.requestId === 'string'
    && value.requestId.length > 0
    && value.localDataDeleted === true,
  );
}

function recoverableDeletionResponse(error) {
  const body = error?.body;
  return Boolean(
    Number(error?.status) === 409
    && body
    && typeof body === 'object'
    && !Array.isArray(body)
    && typeof body.state === 'string'
    && body.state.length > 0
    && body.localDataDeleted === false,
  );
}

async function settleCleanup(operation) {
  if (typeof operation !== 'function') return true;
  try {
    await operation();
    return true;
  } catch {
    return false;
  }
}

export function canConfirmAccountDeletion({
  available,
  walletRiskAcknowledged,
  confirmationText,
  expectedUserId,
  currentUserId,
} = {}) {
  return available === true
    && walletRiskAcknowledged === true
    && confirmationText === 'DELETE'
    && typeof expectedUserId === 'string'
    && expectedUserId.length > 0
    && expectedUserId === currentUserId;
}

/**
 * Reconcile an authenticated GET /me/account-deletion response with the
 * durable device marker. A server state alone is not proof of local deletion:
 * only localDataDeleted === true may promote, purge, and optionally log out.
 */
export async function reconcileAccountDeletionStatus({
  markerStore,
  userId,
  clientRequestId,
  status,
  purgeLocalData,
  logout,
} = {}) {
  if (
    !markerStore
    || typeof markerStore.begin !== 'function'
    || typeof markerStore.accept !== 'function'
    || typeof markerStore.recover !== 'function'
  ) {
    throw new Error('account_deletion_status_recovery_invalid');
  }
  const hasState = Boolean(
    status
    && typeof status === 'object'
    && !Array.isArray(status)
    && typeof status.state === 'string'
    && status.state.length > 0,
  );
  if (!hasState) {
    return Object.freeze({ status: 'unknown', code: 'account_deletion_status_unknown' });
  }

  // Establish the durable lock before interpreting any server state. This also
  // makes the marker's original client request id authoritative during a
  // recovery race instead of replacing it with a newly generated id.
  const markerResult = await markerStore.begin({
    userId,
    clientRequestId,
    phase: ACCOUNT_DELETION_MARKER_PHASE.requesting,
  });
  const marker = markerResult?.marker;
  if (!marker) throw new Error('account_deletion_marker_unavailable');

  if (!acceptedDeletionResponse(status)) {
    await markerStore.recover({
      userId,
      clientRequestId: marker.clientRequestId,
      requestId: typeof status.requestId === 'string' ? status.requestId : null,
    });
    return Object.freeze({
      status: status.localDataDeleted === false ? 'recovery' : 'uncertain',
      code: status.state === 'MANUAL_REVIEW'
        ? 'account_deletion_manual_review'
        : 'account_deletion_status_unknown',
      requestId: status.requestId || null,
      state: status.state,
      localDataPurged: false,
      loggedOut: false,
    });
  }

  await markerStore.accept({
    userId,
    clientRequestId: marker.clientRequestId,
    requestId: status.requestId,
  });
  const localDataPurged = await settleCleanup(purgeLocalData);
  const loggedOut = localDataPurged ? await settleCleanup(logout) : false;
  return Object.freeze({
    status: 'accepted',
    requestId: status.requestId,
    state: status.state,
    localDataPurged,
    loggedOut,
  });
}

export async function submitAccountDeletionRequest({
  markerStore,
  userId,
  clientRequestId,
  walletRiskAcknowledged,
  request,
  purgeLocalData,
  logout,
} = {}) {
  if (
    !markerStore
    || typeof markerStore.begin !== 'function'
    || typeof markerStore.accept !== 'function'
    || typeof markerStore.recover !== 'function'
    || typeof markerStore.releaseRequesting !== 'function'
    || typeof request !== 'function'
    || walletRiskAcknowledged !== true
  ) {
    throw new Error('account_deletion_request_invalid');
  }

  // This durable write is intentionally the first side effect. If it fails,
  // no destructive network request is allowed to leave the device.
  const markerResult = await markerStore.begin({
    userId,
    clientRequestId,
    phase: ACCOUNT_DELETION_MARKER_PHASE.requesting,
  });
  const marker = markerResult?.marker;
  const markerCreated = markerResult?.created === true;
  if (!marker) throw new Error('account_deletion_marker_unavailable');

  let response;
  try {
    response = await request(marker.clientRequestId);
  } catch (error) {
    if (recoverableDeletionResponse(error)) {
      try {
        await markerStore.recover({
          userId,
          clientRequestId: marker.clientRequestId,
          requestId: error.body.requestId || marker.requestId,
        });
      } catch {
        return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
      }
      return Object.freeze({
        status: 'recovery',
        code: error.body.error || 'account_deletion_recovery_required',
        requestId: error.body.requestId || marker.requestId,
        state: error.body.state,
        localDataPurged: false,
        loggedOut: false,
      });
    }
    if (
      isDefinitiveNoRequest(error)
      && markerCreated
      && marker.phase === ACCOUNT_DELETION_MARKER_PHASE.requesting
      && marker.clientRequestId === clientRequestId
    ) {
      try {
        await markerStore.releaseRequesting({ userId, clientRequestId });
        return Object.freeze({ status: 'rejected', code: 'confirmation_required' });
      } catch {
        return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
      }
    }

    // Keep the authenticated bearer available for status/retry recovery when
    // the server outcome is unknown. The root session gate hides the main UI.
    return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
  }

  if (!acceptedDeletionResponse(response)) {
    return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
  }

  try {
    await markerStore.accept({
      userId,
      clientRequestId: marker.clientRequestId,
      requestId: response.requestId,
    });
  } catch {
    await settleCleanup(purgeLocalData);
    return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
  }

  const localDataPurged = await settleCleanup(purgeLocalData);
  const loggedOut = localDataPurged ? await settleCleanup(logout) : false;
  return Object.freeze({
    status: 'accepted',
    requestId: response.requestId,
    state: response.state,
    localDataPurged,
    loggedOut,
  });
}
