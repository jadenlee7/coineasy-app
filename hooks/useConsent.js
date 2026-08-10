import { useCallback, useEffect, useRef, useState } from 'react';

import { useDeviceAccountOperationLease } from '../contexts/DeviceAccountDataContext';
import { api } from '../utils/api';
import {
  buildConsentPayload,
  createConsentDraft,
  parseConsentEnvelope,
  safeConsentError,
  updateConsentDraft,
} from '../utils/consentState.mjs';

export default function useConsent({ accountKey, authOwnerUserId, enabled = true } = {}) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [consent, setConsent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ownerKey, setOwnerKey] = useState(null);
  const [ownerAuthUserId, setOwnerAuthUserId] = useState(null);
  const requestRef = useRef({ controller: null, generation: 0, kind: null });
  const accountKeyRef = useRef(accountKey);
  const authOwnerUserIdRef = useRef(authOwnerUserId);
  const mountedRef = useRef(false);
  accountKeyRef.current = accountKey;
  authOwnerUserIdRef.current = authOwnerUserId;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const beginRequest = useCallback((kind) => {
    if (requestRef.current.kind === 'save') return null;
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const generation = requestRef.current.generation + 1;
    requestRef.current = { controller, generation, kind };
    return { controller, generation, kind };
  }, []);

  const isCurrent = useCallback((generation, kind) => (
    requestRef.current.generation === generation
    && requestRef.current.kind === kind
  ), []);

  const load = useCallback(async ({ preserveError = false } = {}) => {
    const operationLease = lease;
    if (
      !mountedRef.current
      || !enabled
      || !accountKey
      || !authOwnerUserId
      || operationLease?.ownerUserId !== authOwnerUserId
      || !isCurrentLease(operationLease)
    ) return null;
    const request = beginRequest('load');
    if (!request) return null;
    const { controller, generation, kind } = request;
    const requestedAccountKey = accountKey;
    const requestedAuthOwnerUserId = authOwnerUserId;
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const response = await api.consent({
        signal: controller.signal,
        expectedAuthUserId: requestedAuthOwnerUserId,
      });
      const nextConsent = parseConsentEnvelope(response);
      if (
        !mountedRef.current
        || !isCurrentLease(operationLease)
        || !isCurrent(generation, kind)
        || accountKeyRef.current !== requestedAccountKey
        || authOwnerUserIdRef.current !== requestedAuthOwnerUserId
      ) return null;
      setConsent(nextConsent);
      setDraft(createConsentDraft(nextConsent));
      setOwnerKey(requestedAccountKey);
      setOwnerAuthUserId(requestedAuthOwnerUserId);
      return nextConsent;
    } catch (requestError) {
      if (
        !mountedRef.current
        || !isCurrentLease(operationLease)
        || !isCurrent(generation, kind)
        || accountKeyRef.current !== requestedAccountKey
        || authOwnerUserIdRef.current !== requestedAuthOwnerUserId
      ) return null;
      const safeError = safeConsentError(requestError);
      if (safeError) setError(safeError);
      return null;
    } finally {
      if (
        mountedRef.current
        && isCurrentLease(operationLease)
        && isCurrent(generation, kind)
        && accountKeyRef.current === requestedAccountKey
        && authOwnerUserIdRef.current === requestedAuthOwnerUserId
      ) {
        requestRef.current.kind = null;
        setLoading(false);
      }
    }
  }, [accountKey, authOwnerUserId, beginRequest, enabled, isCurrent, isCurrentLease, lease]);

  useEffect(() => {
    if (!enabled || !accountKey || !authOwnerUserId) {
      requestRef.current.controller?.abort();
      requestRef.current = {
        controller: null,
        generation: requestRef.current.generation + 1,
        kind: null,
      };
      setConsent(null);
      setDraft(null);
      setError(null);
      setLoading(false);
      setSaving(false);
      setOwnerKey(null);
      setOwnerAuthUserId(null);
      return undefined;
    }

    setConsent(null);
    setDraft(null);
    setError(null);
    setSaving(false);
    setOwnerKey(null);
    setOwnerAuthUserId(null);
    load();
    return () => {
      requestRef.current.controller?.abort();
      requestRef.current = {
        controller: null,
        generation: requestRef.current.generation + 1,
        kind: null,
      };
    };
  }, [accountKey, authOwnerUserId, enabled, load]);

  const setChoice = useCallback((field, value) => {
    setDraft((current) => updateConsentDraft(current, field, value));
  }, []);

  const submit = useCallback(async (payload) => {
    const operationLease = lease;
    if (
      !mountedRef.current
      || !enabled
      || !accountKey
      || !authOwnerUserId
      || accountKeyRef.current !== accountKey
      || authOwnerUserIdRef.current !== authOwnerUserId
      || ownerKey !== accountKey
      || ownerAuthUserId !== authOwnerUserId
      || operationLease?.ownerUserId !== authOwnerUserId
      || !isCurrentLease(operationLease)
    ) return null;
    const request = beginRequest('save');
    if (!request) return null;
    const { controller, generation, kind } = request;
    setLoading(false);
    setSaving(true);
    setError(null);
    try {
      const response = await api.updateConsent(payload, {
        signal: controller.signal,
        expectedAuthUserId: authOwnerUserId,
      });
      const nextConsent = parseConsentEnvelope(response);
      if (
        !mountedRef.current
        || !isCurrentLease(operationLease)
        || !isCurrent(generation, kind)
        || accountKeyRef.current !== accountKey
        || authOwnerUserIdRef.current !== authOwnerUserId
      ) return null;
      setConsent(nextConsent);
      setDraft(createConsentDraft(nextConsent));
      setOwnerKey(accountKey);
      setOwnerAuthUserId(authOwnerUserId);
      return nextConsent;
    } catch (requestError) {
      if (
        !mountedRef.current
        || !isCurrentLease(operationLease)
        || !isCurrent(generation, kind)
        || accountKeyRef.current !== accountKey
        || authOwnerUserIdRef.current !== authOwnerUserId
      ) return null;
      const safeError = safeConsentError(requestError);
      if (safeError) setError(safeError);
      if (requestError?.status === 409) {
        const expectedAccountKey = accountKey;
        requestRef.current.kind = null;
        setSaving(false);
        setConsent(null);
        setDraft(null);
        setOwnerKey(null);
        setOwnerAuthUserId(null);
        if (
          accountKeyRef.current === expectedAccountKey
          && authOwnerUserIdRef.current === authOwnerUserId
        ) {
          await load({ preserveError: true });
        }
        if (
          mountedRef.current
          && isCurrentLease(operationLease)
          && accountKeyRef.current === expectedAccountKey
          && authOwnerUserIdRef.current === authOwnerUserId
          && safeError
        ) {
          setError(safeError);
        }
      }
      return null;
    } finally {
      if (
        mountedRef.current
        && isCurrentLease(operationLease)
        && isCurrent(generation, kind)
        && accountKeyRef.current === accountKey
        && authOwnerUserIdRef.current === authOwnerUserId
      ) {
        requestRef.current.kind = null;
        setSaving(false);
      }
    }
  }, [
    accountKey,
    authOwnerUserId,
    beginRequest,
    enabled,
    isCurrent,
    isCurrentLease,
    lease,
    load,
    ownerAuthUserId,
    ownerKey,
  ]);

  const save = useCallback(async () => {
    if (!consent || !draft) return null;
    try {
      return await submit(buildConsentPayload({ consent, draft }));
    } catch (buildError) {
      setError(safeConsentError(buildError));
      return null;
    }
  }, [consent, draft, submit]);

  const revokeAll = useCallback(() => {
    if (!consent?.currentVersion) return Promise.resolve(null);
    return submit({
      consentVersion: consent.currentVersion,
      termsAccepted: false,
      privacyAccepted: false,
      segmentingOptIn: false,
      marketingOptIn: false,
    });
  }, [consent, submit]);

  const ownsState = Boolean(accountKey)
    && Boolean(authOwnerUserId)
    && lease?.ownerUserId === authOwnerUserId
    && isCurrentLease(lease)
    && ownerKey === accountKey
    && ownerAuthUserId === authOwnerUserId;

  return {
    consent: ownsState ? consent : null,
    draft: ownsState ? draft : null,
    error,
    loading,
    saving,
    ownsState,
    load,
    revokeAll,
    save,
    setChoice,
  };
}
