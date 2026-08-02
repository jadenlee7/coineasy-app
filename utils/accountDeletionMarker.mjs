export const ACCOUNT_DELETION_MARKER_SCHEMA_VERSION = 1;
export const ACCOUNT_DELETION_MARKER_STORAGE_PREFIX = 'easygo.account-deletion.v1.';

export const ACCOUNT_DELETION_MARKER_PHASE = Object.freeze({
  requesting: 'requesting',
  accepted: 'accepted',
});

const SUBJECT_KEY_PATTERN = /^[a-f0-9]{64}$/u;
const CLIENT_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SERVER_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const MAX_SERIALIZED_LENGTH = 1_024;

export class AccountDeletionMarkerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AccountDeletionMarkerError';
    this.code = code;
  }
}

function markerError(code) {
  return new AccountDeletionMarkerError(code);
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) {
    throw markerError('account_deletion_marker_invalid');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw markerError('account_deletion_marker_invalid');
  }
  return value;
}

function normalizedSubjectKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SUBJECT_KEY_PATTERN.test(key)) {
    throw markerError('account_deletion_subject_key_invalid');
  }
  return key;
}

function normalizedClientRequestId(value) {
  const requestId = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!CLIENT_REQUEST_ID_PATTERN.test(requestId)) {
    throw markerError('account_deletion_client_request_id_invalid');
  }
  return requestId;
}

function normalizedServerRequestId(value) {
  if (value === null || value === undefined) return null;
  const requestId = typeof value === 'string' ? value.trim() : '';
  if (!SERVER_REQUEST_ID_PATTERN.test(requestId)) {
    throw markerError('account_deletion_server_request_id_invalid');
  }
  return requestId;
}

function normalizedPhase(value) {
  if (!Object.values(ACCOUNT_DELETION_MARKER_PHASE).includes(value)) {
    throw markerError('account_deletion_marker_invalid');
  }
  return value;
}

function normalizedNow(now) {
  const value = typeof now === 'function' ? now() : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw markerError('account_deletion_marker_clock_invalid');
  }
  return value.toISOString();
}

export function accountDeletionMarkerStorageKey(subjectKey) {
  return `${ACCOUNT_DELETION_MARKER_STORAGE_PREFIX}${normalizedSubjectKey(subjectKey)}`;
}

export function normalizeAccountDeletionMarker(value, { expectedSubjectKey } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw markerError('account_deletion_marker_invalid');
  }
  if (value.version !== ACCOUNT_DELETION_MARKER_SCHEMA_VERSION) {
    throw markerError('account_deletion_marker_invalid');
  }

  const subjectKey = normalizedSubjectKey(value.subjectKey);
  if (expectedSubjectKey && subjectKey !== normalizedSubjectKey(expectedSubjectKey)) {
    throw markerError('account_deletion_marker_subject_mismatch');
  }
  const createdAt = canonicalTimestamp(value.createdAt);
  const updatedAt = canonicalTimestamp(value.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw markerError('account_deletion_marker_invalid');
  }

  return Object.freeze({
    version: ACCOUNT_DELETION_MARKER_SCHEMA_VERSION,
    subjectKey,
    clientRequestId: normalizedClientRequestId(value.clientRequestId),
    phase: normalizedPhase(value.phase),
    requestId: normalizedServerRequestId(value.requestId),
    createdAt,
    updatedAt,
  });
}

export function parseAccountDeletionMarker(raw, { expectedSubjectKey } = {}) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string' || raw.length > MAX_SERIALIZED_LENGTH) {
    throw markerError('account_deletion_marker_invalid');
  }
  try {
    return normalizeAccountDeletionMarker(JSON.parse(raw), { expectedSubjectKey });
  } catch (error) {
    if (error instanceof AccountDeletionMarkerError) throw error;
    throw markerError('account_deletion_marker_invalid');
  }
}

export function serializeAccountDeletionMarker(marker) {
  const serialized = JSON.stringify(normalizeAccountDeletionMarker(marker));
  if (serialized.length > MAX_SERIALIZED_LENGTH) {
    throw markerError('account_deletion_marker_invalid');
  }
  return serialized;
}

export function createAccountDeletionMarkerStore({
  storage,
  hashSubject,
  now = () => new Date(),
} = {}) {
  if (
    !storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function'
    || typeof hashSubject !== 'function'
  ) {
    throw markerError('account_deletion_marker_store_invalid');
  }

  let mutationTail = Promise.resolve();
  const listeners = new Set();

  const subjectKeyFor = async (userId) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedUserId) throw markerError('account_deletion_user_id_invalid');
    let subjectKey;
    try {
      subjectKey = await hashSubject(normalizedUserId);
    } catch {
      throw markerError('account_deletion_subject_key_unavailable');
    }
    return normalizedSubjectKey(subjectKey);
  };

  const readMarker = async (subjectKey) => {
    try {
      const raw = await storage.getItem(accountDeletionMarkerStorageKey(subjectKey));
      return parseAccountDeletionMarker(raw, { expectedSubjectKey: subjectKey });
    } catch (error) {
      if (error instanceof AccountDeletionMarkerError) throw error;
      throw markerError('account_deletion_marker_storage_unavailable');
    }
  };

  const writeMarker = async (marker) => {
    try {
      await storage.setItem(
        accountDeletionMarkerStorageKey(marker.subjectKey),
        serializeAccountDeletionMarker(marker),
      );
    } catch (error) {
      if (error instanceof AccountDeletionMarkerError) throw error;
      throw markerError('account_deletion_marker_storage_unavailable');
    }
    listeners.forEach((listener) => {
      try { listener({ type: 'changed', subjectKey: marker.subjectKey }); } catch {}
    });
  };

  const serializeMutation = (operation) => {
    const run = mutationTail.catch(() => {}).then(operation);
    mutationTail = run.catch(() => {});
    return run;
  };

  const load = async (userId = null) => {
    if (userId === null || userId === undefined || String(userId).trim() === '') {
      return Object.freeze({ status: 'clear', marker: null, subjectKey: null });
    }
    const subjectKey = await subjectKeyFor(userId);
    await mutationTail.catch(() => {});
    const marker = await readMarker(subjectKey);
    return Object.freeze({ status: marker ? 'blocked' : 'clear', marker, subjectKey });
  };

  const begin = async ({
    userId,
    clientRequestId,
    phase = ACCOUNT_DELETION_MARKER_PHASE.requesting,
    requestId = null,
  } = {}) => {
    const subjectKey = await subjectKeyFor(userId);
    const normalizedRequestId = normalizedClientRequestId(clientRequestId);
    const normalizedMarkerPhase = normalizedPhase(phase);
    const normalizedProviderRequestId = normalizedServerRequestId(requestId);

    listeners.forEach((listener) => {
      try { listener({ type: 'blocking', subjectKey }); } catch {}
    });
    try {
      return await serializeMutation(async () => {
        const existing = await readMarker(subjectKey);
        if (existing) return Object.freeze({ marker: existing, created: false });

        const timestamp = normalizedNow(now);
        const marker = normalizeAccountDeletionMarker({
          version: ACCOUNT_DELETION_MARKER_SCHEMA_VERSION,
          subjectKey,
          clientRequestId: normalizedRequestId,
          phase: normalizedMarkerPhase,
          requestId: normalizedProviderRequestId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await writeMarker(marker);
        return Object.freeze({ marker, created: true });
      });
    } finally {
      listeners.forEach((listener) => {
        try { listener({ type: 'changed', subjectKey }); } catch {}
      });
    }
  };

  const accept = async ({ userId, clientRequestId, requestId = null } = {}) => {
    const subjectKey = await subjectKeyFor(userId);
    const normalizedRequestId = normalizedClientRequestId(clientRequestId);
    const normalizedProviderRequestId = normalizedServerRequestId(requestId);

    return serializeMutation(async () => {
      const existing = await readMarker(subjectKey);
      if (!existing || existing.clientRequestId !== normalizedRequestId) {
        throw markerError('account_deletion_marker_request_mismatch');
      }
      if (
        existing.phase === ACCOUNT_DELETION_MARKER_PHASE.accepted
        && (!normalizedProviderRequestId || existing.requestId === normalizedProviderRequestId)
      ) {
        return existing;
      }

      const marker = normalizeAccountDeletionMarker({
        ...existing,
        phase: ACCOUNT_DELETION_MARKER_PHASE.accepted,
        requestId: normalizedProviderRequestId || existing.requestId,
        updatedAt: normalizedNow(now),
      });
      await writeMarker(marker);
      return marker;
    });
  };

  const releaseRequesting = async ({ userId, clientRequestId } = {}) => {
    const subjectKey = await subjectKeyFor(userId);
    const normalizedRequestId = normalizedClientRequestId(clientRequestId);

    return serializeMutation(async () => {
      const existing = await readMarker(subjectKey);
      if (!existing) return false;
      if (
        existing.phase !== ACCOUNT_DELETION_MARKER_PHASE.requesting
        || existing.clientRequestId !== normalizedRequestId
      ) {
        throw markerError('account_deletion_marker_release_blocked');
      }
      try {
        await storage.removeItem(accountDeletionMarkerStorageKey(subjectKey));
      } catch {
        throw markerError('account_deletion_marker_storage_unavailable');
      }
      listeners.forEach((listener) => {
        try { listener({ type: 'changed', subjectKey }); } catch {}
      });
      return true;
    });
  };

  return Object.freeze({
    load,
    begin,
    accept,
    releaseRequesting,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
