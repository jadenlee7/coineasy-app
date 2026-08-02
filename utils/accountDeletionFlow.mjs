import { ACCOUNT_DELETION_MARKER_PHASE } from './accountDeletionMarker.mjs';

function isDefinitiveNoRequest(error) {
  return Number(error?.status) === 400
    && error?.body?.error === 'confirmation_required';
}

function isConfirmedDeletionTombstone(error) {
  return Number(error?.status) === 410
    && error?.body?.error === 'account_deletion_in_progress';
}

function acceptedDeletionResponse(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.state === 'string'
    && value.state.length > 0
    && typeof value.requestId === 'string'
    && value.requestId.length > 0,
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
    if (isConfirmedDeletionTombstone(error)) {
      try {
        await markerStore.accept({
          userId,
          clientRequestId: marker.clientRequestId,
          requestId: marker.requestId,
        });
      } catch {
        await settleCleanup(purgeLocalData);
        return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
      }
      const localDataPurged = await settleCleanup(purgeLocalData);
      const loggedOut = localDataPurged ? await settleCleanup(logout) : false;
      return Object.freeze({
        status: 'accepted',
        requestId: marker.requestId,
        state: 'IN_PROGRESS',
        localDataPurged,
        loggedOut,
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

    await settleCleanup(purgeLocalData);
    // Keep the authenticated bearer available for status/retry recovery when
    // the server outcome is unknown. The root session gate hides the main UI.
    return Object.freeze({ status: 'uncertain', code: 'account_deletion_status_unknown' });
  }

  if (!acceptedDeletionResponse(response)) {
    await settleCleanup(purgeLocalData);
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
