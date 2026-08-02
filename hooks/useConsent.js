import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../utils/api';
import {
  buildConsentPayload,
  createConsentDraft,
  parseConsentEnvelope,
  safeConsentError,
  updateConsentDraft,
} from '../utils/consentState.mjs';

export default function useConsent({ accountKey, enabled = true } = {}) {
  const [consent, setConsent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ownerKey, setOwnerKey] = useState(null);
  const requestRef = useRef({ controller: null, generation: 0, kind: null });
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;

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
    if (!enabled || !accountKey) return null;
    const request = beginRequest('load');
    if (!request) return null;
    const { controller, generation, kind } = request;
    const requestedAccountKey = accountKey;
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const response = await api.consent({ signal: controller.signal });
      const nextConsent = parseConsentEnvelope(response);
      if (!isCurrent(generation, kind)
        || accountKeyRef.current !== requestedAccountKey) return null;
      setConsent(nextConsent);
      setDraft(createConsentDraft(nextConsent));
      setOwnerKey(accountKey);
      return nextConsent;
    } catch (requestError) {
      if (!isCurrent(generation, kind)) return null;
      const safeError = safeConsentError(requestError);
      if (safeError) setError(safeError);
      return null;
    } finally {
      if (isCurrent(generation, kind)) {
        requestRef.current.kind = null;
        setLoading(false);
      }
    }
  }, [accountKey, beginRequest, enabled, isCurrent]);

  useEffect(() => {
    if (!enabled || !accountKey) {
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
      return undefined;
    }

    setConsent(null);
    setDraft(null);
    setError(null);
    setSaving(false);
    setOwnerKey(null);
    load();
    return () => {
      requestRef.current.controller?.abort();
      requestRef.current = {
        controller: null,
        generation: requestRef.current.generation + 1,
        kind: null,
      };
    };
  }, [accountKey, enabled, load]);

  const setChoice = useCallback((field, value) => {
    setDraft((current) => updateConsentDraft(current, field, value));
  }, []);

  const submit = useCallback(async (payload) => {
    if (!enabled || !accountKey || ownerKey !== accountKey) return null;
    const request = beginRequest('save');
    if (!request) return null;
    const { controller, generation, kind } = request;
    setLoading(false);
    setSaving(true);
    setError(null);
    try {
      const response = await api.updateConsent(payload, { signal: controller.signal });
      const nextConsent = parseConsentEnvelope(response);
      if (!isCurrent(generation, kind)) return null;
      setConsent(nextConsent);
      setDraft(createConsentDraft(nextConsent));
      setOwnerKey(accountKey);
      return nextConsent;
    } catch (requestError) {
      if (!isCurrent(generation, kind)) return null;
      const safeError = safeConsentError(requestError);
      if (safeError) setError(safeError);
      if (requestError?.status === 409) {
        const expectedAccountKey = accountKey;
        requestRef.current.kind = null;
        setSaving(false);
        setConsent(null);
        setDraft(null);
        setOwnerKey(null);
        if (accountKeyRef.current === expectedAccountKey) {
          await load({ preserveError: true });
        }
        if (accountKeyRef.current === expectedAccountKey && safeError) {
          setError(safeError);
        }
      }
      return null;
    } finally {
      if (isCurrent(generation, kind)) {
        requestRef.current.kind = null;
        setSaving(false);
      }
    }
  }, [accountKey, beginRequest, enabled, isCurrent, load, ownerKey]);

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

  const ownsState = Boolean(accountKey) && ownerKey === accountKey;

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
