import {
  createDeviceAccountLease,
  sameDeviceAccountLease,
} from './deviceAccountDataStore.mjs';

export const SQUID_ROUTE_LEASE_ERROR = 'squid_account_session_changed';

export class SquidRouteLeaseError extends Error {
  constructor() {
    super(SQUID_ROUTE_LEASE_ERROR);
    this.name = 'SquidRouteLeaseError';
    this.code = SQUID_ROUTE_LEASE_ERROR;
  }
}

function normalizedLease(candidate) {
  try {
    const lease = createDeviceAccountLease(
      candidate?.ownerUserId,
      candidate?.sessionEpoch,
    );
    return sameDeviceAccountLease(lease, candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function predicateAccepts(isCurrentLease, lease) {
  if (typeof isCurrentLease !== 'function') return false;
  try {
    return isCurrentLease(lease) === true;
  } catch {
    return false;
  }
}

/**
 * In-memory binding between a quote object and the exact authenticated device
 * session that requested it. A serialized or cloned quote intentionally loses
 * this capability and must be quoted again before signing.
 */
export function createSquidRouteLeaseRegistry() {
  const bindings = new WeakMap();

  function requireCurrent(lease, isCurrentLease) {
    const current = normalizedLease(lease);
    if (!current || !predicateAccepts(isCurrentLease, current)) {
      throw new SquidRouteLeaseError();
    }
    return current;
  }

  function bind(route, lease, isCurrentLease) {
    const current = requireCurrent(lease, isCurrentLease);
    if (!route || typeof route !== 'object') return null;
    bindings.set(route, Object.freeze({
      ownerUserId: current.ownerUserId,
      sessionEpoch: current.sessionEpoch,
    }));
    return route;
  }

  function requireBound(route, lease, isCurrentLease) {
    const current = requireCurrent(lease, isCurrentLease);
    const quotedFor = route && typeof route === 'object' ? bindings.get(route) : null;
    if (!sameDeviceAccountLease(quotedFor, current)) {
      throw new SquidRouteLeaseError();
    }
    return current;
  }

  return Object.freeze({ bind, requireBound, requireCurrent });
}
