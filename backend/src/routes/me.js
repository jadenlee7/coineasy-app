/**
 * Authenticated privacy controls (Path C v2 S3).
 *
 * GET    /me/consent  — effective consent state for the current policy version
 * PUT    /me/consent  — full consent replacement + immutable audit snapshot
 * GET    /me/data     — export the user's EasyGo-local database records
 * GET    /me/social-export — privacy-minimized legacy social export
 * GET    /me/account-deletion  — server-authoritative deletion capability/state
 * POST   /me/account-deletion/reauth/challenge — issue a session-bound Apple nonce
 * POST   /me/account-deletion/reauth/verify — verify the native Apple attestation
 * POST   /me/account-deletion  — idempotently request the deletion saga
 * DELETE /me/data     — retired unsafe local-only deletion endpoint
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  buildConsentMutation,
  consentGrantsEnabled,
  consentUpdateAddsPermission,
  consentUpdateSchema,
  consentView,
  getCurrentConsentVersion,
} from '../lib/consent.js';
import {
  exportLegacySocialData,
  exportLocalUserData,
} from '../lib/account-data.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import {
  extractAppleSubject,
  getUser,
  isPrivyConfigurationFailure,
  PrivyIdentityError,
} from '../lib/privy.js';
import {
  accountDeletionEnabled,
  AccountDeletionConfigurationError,
  AccountDeletionIdentityError,
  accountDeletionStableIdentityEnforced,
  accountDeletionSubjectHash,
  DELETE_ACCOUNT_CONFIRMATION,
  deriveAppleStableProviderIdentity,
  findAccountDeletionRequest,
  requestAccountDeletion,
} from '../lib/account-deletion.js';
import { accountDeletionRecentAuthEnabled } from '../lib/account-deletion-gates.js';
import {
  AccountDeletionReauthError,
  consumeAccountDeletionReauthChallenge,
  findBoundAppleStableProviderIdentity,
  issueAccountDeletionReauthChallenge,
  requirePrivySessionId,
  verifyAccountDeletionReauthChallenge,
} from '../lib/account-deletion-reauth.js';

export const meRouter = Router();
export const DELETE_DATA_CONFIRMATION = 'DELETE_MY_EASYGO_DATA';

const deleteDataSchema = z.object({
  confirmation: z.literal(DELETE_DATA_CONFIRMATION),
}).strict();

const accountDeletionSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
  // Recovery of an already-committed tombstone must not depend on a replayable
  // recent-auth credential. Validate these fields only after the tombstone
  // fast path proves that this is a brand-new destructive request.
  challengeId: z.unknown().optional(),
  clientRequestId: z.string().uuid(),
  expectedPrivyDid: z.string().trim().min(1).max(255),
  reauthProof: z.unknown().optional(),
  walletRiskAcknowledged: z.literal(true),
}).strict();

const accountDeletionRecentAuthSchema = accountDeletionSchema.extend({
  challengeId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
  reauthProof: z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/u),
});

const accountDeletionReauthChallengeSchema = z.object({
  clientRequestId: z.string().uuid(),
  expectedPrivyDid: z.string().trim().min(1).max(255),
}).strict();

const accountDeletionReauthVerifySchema = accountDeletionReauthChallengeSchema.extend({
  challengeId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
  identityToken: z.string().trim().min(32).max(16_384),
  nonce: z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/u),
  state: z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/u),
});

function accountDeletionStatusBody(request, available) {
  return {
    // Disabling new requests must never hide an existing tombstone. Mobile
    // recovery relies on this read path after a rollout brake is reapplied.
    available: Boolean(available && !request),
    state: request?.state || null,
    requestId: request?.id || null,
    localDataDeleted: Boolean(request?.localPurgedAt),
    completed: request?.state === 'COMPLETED',
  };
}

function privyLookupFailure(req, res, error, action) {
  const configurationFailure = isPrivyConfigurationFailure(error);
  req.log?.warn?.(
    { errorType: error?.name || 'Error' },
    `Privy user lookup unavailable during account deletion ${action}`,
  );
  return res.status(configurationFailure ? 503 : 502).json({
    error: configurationFailure ? 'privy_not_configured' : 'privy_unavailable',
  });
}

function accountDeletionReauthFailure(req, res, error, action) {
  if (error instanceof AccountDeletionReauthError) {
    req.log?.warn?.(
      { errorCode: error.code, errorType: error.name },
      `account deletion recent authentication ${action} rejected`,
    );
    const status = [400, 401, 409, 503].includes(error.status) ? error.status : 409;
    return res.status(status).json({ error: error.code });
  }
  if (error instanceof AccountDeletionConfigurationError) {
    req.log?.error?.(
      { errorType: error.name },
      `account deletion recent authentication ${action} is not configured`,
    );
    return res.status(503).json({ error: 'account_deletion_not_configured' });
  }
  if (error instanceof AccountDeletionIdentityError) {
    return res.status(409).json({ error: 'stable_provider_identity_unavailable' });
  }
  throw error;
}

function currentVersionOr503(req, res) {
  try {
    return getCurrentConsentVersion();
  } catch (error) {
    req.log?.error({ err: error }, 'consent configuration invalid');
    res.status(503).json({ error: 'consent_not_configured' });
    return null;
  }
}

function consentEnvelope(record, currentVersion) {
  return {
    consent: {
      ...consentView(record, currentVersion),
      grantsEnabled: consentGrantsEnabled(),
    },
  };
}

meRouter.get('/consent', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const currentVersion = currentVersionOr503(req, res);
  if (!currentVersion) return;

  const user = await prisma.user.findUnique({
    where: { privyDid: req.user.privyDid },
    select: { consent: true },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });

  return res.json(consentEnvelope(user.consent, currentVersion));
});

meRouter.put('/consent', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const parsed = consentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  }

  const currentVersion = currentVersionOr503(req, res);
  if (!currentVersion) return;

  try {
    const consent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { privyDid: req.user.privyDid },
        select: { id: true },
      });
      if (!user) return null;

      const existing = await tx.userConsent.findUnique({ where: { userId: user.id } });
      const mutation = buildConsentMutation({
        existing,
        input: parsed.data,
        currentVersion,
      });
      if (!consentGrantsEnabled()
        && consentUpdateAddsPermission({
          existing,
          input: parsed.data,
          currentVersion,
        })) {
        const error = new Error('consent grants are disabled');
        error.code = 'consent_grants_disabled';
        throw error;
      }

      const updated = await tx.userConsent.upsert({
        where: { userId: user.id },
        update: mutation.data,
        create: { userId: user.id, ...mutation.data },
      });
      await tx.userConsentAudit.create({
        data: {
          userId: user.id,
          action: mutation.action,
          consentVersion: updated.consentVersion,
          segmentingOptIn: updated.segmentingOptIn,
          marketingOptIn: updated.marketingOptIn,
          termsAcceptedAt: updated.termsAcceptedAt,
          privacyAcceptedAt: updated.privacyAcceptedAt,
        },
      });

      // A revocation takes effect in storage immediately; the background
      // worker is not relied on to enforce the privacy boundary.
      if (!consentView(updated, currentVersion).segmentingOptIn) {
        await tx.userSegment.deleteMany({
          where: { userId: user.id, source: 'INDEXER' },
        });
      }
      return updated;
    });

    if (!consent) return res.status(404).json({ error: 'not_found' });
    return res.json(consentEnvelope(consent, currentVersion));
  } catch (error) {
    if (error?.code === 'consent_version_mismatch') {
      return res.status(409).json({ error: error.code, currentVersion });
    }
    if (error?.code === 'base_consent_required') {
      return res.status(400).json({ error: error.code });
    }
    if (error?.code === 'consent_grants_disabled') {
      return res.status(503).json({ error: error.code });
    }
    throw error;
  }
});

meRouter.get('/data', requireAuth, async (req, res) => {
  const exported = await exportLocalUserData(prisma, req.user.privyDid);
  if (!exported) return res.status(404).json({ error: 'not_found' });

  res.set('Cache-Control', 'no-store');
  return res.json(exported);
});

meRouter.get('/social-export', requireAuth, async (req, res) => {
  const exported = await exportLegacySocialData(prisma, req.user.privyDid);
  if (!exported) return res.status(404).json({ error: 'not_found' });

  res.set('Cache-Control', 'no-store');
  res.set('Content-Disposition', 'attachment; filename="easygo-social-export.json"');
  return res.json(exported);
});

export function createAccountDeletionStatusHandler({
  db = prisma,
  fetchPrivyUser = getUser,
  env = process.env,
  deletionCapability = accountDeletionEnabled,
  stableIdentityEnforced = accountDeletionStableIdentityEnforced,
  findDeletionRequest = findAccountDeletionRequest,
} = {}) {
  return async function accountDeletionStatus(req, res) {
    res.set('Cache-Control', 'no-store');
    let request;
    try {
      // Fast path and post-provider-deletion recovery: the original Privy DID
      // tombstone never requires the upstream user to remain fetchable.
      request = await findDeletionRequest(db, req.user.privyDid, env);
      if (request) {
        return res.json(accountDeletionStatusBody(
          request,
          deletionCapability(env),
        ));
      }
    } catch (error) {
      if (error instanceof AccountDeletionConfigurationError) {
        req.log?.error?.({ errorType: error.name }, 'account deletion guard is not configured');
        return res.status(503).json({ error: 'account_deletion_not_configured' });
      }
      throw error;
    }

    // The foundation is intentionally behavior-neutral while the relevant
    // compile-time activation latches are down. Do not add a Privy dependency
    // to the existing settings probe for Google-only users in this release.
    if (!deletionCapability(env) && !stableIdentityEnforced(env)) {
      return res.json(accountDeletionStatusBody(null, false));
    }

    let privyUser;
    try {
      privyUser = await fetchPrivyUser(req.user.privyDid);
    } catch (error) {
      return privyLookupFailure(req, res, error, 'status recovery');
    }
    if (privyUser?.id !== req.user.privyDid) {
      return privyLookupFailure(
        req,
        res,
        new PrivyIdentityError('privy_identity_mismatch'),
        'status recovery',
      );
    }

    let appleSubject;
    try {
      appleSubject = extractAppleSubject(privyUser);
      if (!appleSubject) {
        return res.status(409).json({ error: 'stable_provider_identity_required' });
      }
      const appleIdentity = deriveAppleStableProviderIdentity(
        appleSubject,
        env,
        { required: true },
      );
      appleSubject = null;
      request = await findDeletionRequest(db, req.user.privyDid, env, {
        required: true,
        stableProviderIdentities: [appleIdentity],
      });
      const currentSubjectHash = accountDeletionSubjectHash(
        req.user.privyDid,
        env,
        { required: true },
      );
      if (request && request.subjectHash !== currentSubjectHash) {
        return res.status(409).json({
          error: 'stable_provider_identity_component_conflict',
          requestId: request.id,
          state: request.state,
          localDataDeleted: false,
        });
      }
      return res.json(accountDeletionStatusBody(
        request,
        deletionCapability(env),
      ));
    } catch (error) {
      appleSubject = null;
      if (error instanceof PrivyIdentityError) {
        return privyLookupFailure(req, res, error, 'status recovery');
      }
      if (error instanceof AccountDeletionConfigurationError) {
        req.log?.error?.({ errorType: error.name }, 'account deletion guard is not configured');
        return res.status(503).json({ error: 'account_deletion_not_configured' });
      }
      if (error instanceof AccountDeletionIdentityError) {
        return res.status(409).json({ error: 'stable_provider_identity_unavailable' });
      }
      throw error;
    }
  };
}

export function createAccountDeletionReauthChallengeHandler({
  db = prisma,
  env = process.env,
  findBoundIdentity = findBoundAppleStableProviderIdentity,
  recentAuthCapability = accountDeletionRecentAuthEnabled,
  issueChallenge = issueAccountDeletionReauthChallenge,
} = {}) {
  return async function accountDeletionReauthChallenge(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = accountDeletionReauthChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'account_deletion_reauth_request_invalid' });
    }
    if (parsed.data.expectedPrivyDid !== req.user.privyDid) {
      return res.status(409).json({ error: 'account_deletion_session_changed' });
    }
    if (!recentAuthCapability(env)) {
      return res.status(503).json({ error: 'account_deletion_reauth_disabled' });
    }

    try {
      const sessionId = requirePrivySessionId(req.user.claims);
      // Do not prompt unless this DID already owns an immutable local Apple
      // identity binding. Verification reloads it to close the TOCTOU window.
      await findBoundIdentity(db, req.user.privyDid);
      const challenge = await issueChallenge({
        prisma: db,
        privyDid: req.user.privyDid,
        sessionId,
        clientRequestId: parsed.data.clientRequestId,
        env,
      });
      return res.status(201).json(challenge);
    } catch (error) {
      return accountDeletionReauthFailure(req, res, error, 'challenge');
    }
  };
}

export function createAccountDeletionReauthVerifyHandler({
  db = prisma,
  env = process.env,
  findBoundIdentity = findBoundAppleStableProviderIdentity,
  recentAuthCapability = accountDeletionRecentAuthEnabled,
  verifyChallenge = verifyAccountDeletionReauthChallenge,
} = {}) {
  return async function accountDeletionReauthVerify(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = accountDeletionReauthVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'account_deletion_reauth_request_invalid' });
    }
    if (parsed.data.expectedPrivyDid !== req.user.privyDid) {
      return res.status(409).json({ error: 'account_deletion_session_changed' });
    }
    if (!recentAuthCapability(env)) {
      return res.status(503).json({ error: 'account_deletion_reauth_disabled' });
    }

    let sessionId;
    try {
      sessionId = requirePrivySessionId(req.user.claims);
    } catch (error) {
      return accountDeletionReauthFailure(req, res, error, 'verification');
    }

    try {
      const appleIdentity = await findBoundIdentity(db, req.user.privyDid);
      const proof = await verifyChallenge({
        prisma: db,
        privyDid: req.user.privyDid,
        sessionId,
        clientRequestId: parsed.data.clientRequestId,
        challengeId: parsed.data.challengeId,
        nonce: parsed.data.nonce,
        state: parsed.data.state,
        identityToken: parsed.data.identityToken,
        stableProviderIdentity: appleIdentity,
        env,
      });
      return res.json(proof);
    } catch (error) {
      return accountDeletionReauthFailure(req, res, error, 'verification');
    }
  };
}

export function createAccountDeletionRequestHandler({
  db = prisma,
  fetchPrivyUser = getUser,
  env = process.env,
  deletionCapability = accountDeletionEnabled,
  findDeletionRequest = findAccountDeletionRequest,
  requestDeletion = requestAccountDeletion,
  consumeRecentAuth = consumeAccountDeletionReauthChallenge,
} = {}) {
  return async function accountDeletionRequest(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = accountDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'confirmation_required',
        confirmation: DELETE_ACCOUNT_CONFIRMATION,
      });
    }
    if (parsed.data.expectedPrivyDid !== req.user.privyDid) {
      return res.status(409).json({ error: 'account_deletion_session_changed' });
    }

    try {
      const existingRequest = await findDeletionRequest(db, req.user.privyDid, env);
      if (existingRequest) {
        if (!existingRequest.localPurgedAt) {
          return res.status(409).json({
            error: 'account_deletion_recovery_required',
            requestId: existingRequest.id,
            state: existingRequest.state,
            localDataDeleted: false,
          });
        }
        return res.status(202).json({
          requestId: existingRequest.id,
          state: existingRequest.state,
          created: false,
          localDataDeleted: true,
          providerDeletionPending: existingRequest.state !== 'COMPLETED',
          redactedPosts: 0,
        });
      }
    } catch (error) {
      if (error instanceof AccountDeletionConfigurationError) {
        req.log?.error?.({ errorType: error.name }, 'account deletion guard is not configured');
        return res.status(503).json({ error: 'account_deletion_not_configured' });
      }
      throw error;
    }
    if (!deletionCapability(env)) {
      return res.status(503).json({ error: 'account_deletion_disabled' });
    }
    const recentAuth = accountDeletionRecentAuthSchema.safeParse(parsed.data);
    if (!recentAuth.success) {
      return res.status(400).json({ error: 'account_deletion_reauth_required' });
    }

    let sessionId;
    try {
      sessionId = requirePrivySessionId(req.user.claims);
    } catch (error) {
      return accountDeletionReauthFailure(req, res, error, 'consumption');
    }

    let privyUser;
    try {
      privyUser = await fetchPrivyUser(req.user.privyDid);
    } catch (error) {
      return privyLookupFailure(req, res, error, 'request');
    }
    if (privyUser?.id !== req.user.privyDid) {
      return privyLookupFailure(
        req,
        res,
        new PrivyIdentityError('privy_identity_mismatch'),
        'request',
      );
    }

    let appleSubject;
    try {
      appleSubject = extractAppleSubject(privyUser);
      if (!appleSubject) {
        return res.status(409).json({ error: 'stable_provider_identity_required' });
      }
      const appleIdentity = deriveAppleStableProviderIdentity(
        appleSubject,
        env,
        { required: true },
      );
      appleSubject = null;
      const result = await requestDeletion({
        prisma: db,
        privyDid: req.user.privyDid,
        stableProviderIdentities: [appleIdentity],
        clientRequestId: parsed.data.clientRequestId,
        recentAuth: {
          sessionId,
          challengeId: recentAuth.data.challengeId,
          reauthProof: recentAuth.data.reauthProof,
        },
        consumeRecentAuth,
        env,
      });
      if (!result.localDataDeleted || result.state === 'MANUAL_REVIEW') {
        return res.status(409).json({
          error: 'account_deletion_manual_review',
          requestId: result.requestId,
          state: result.state,
          localDataDeleted: false,
        });
      }
      return res.status(202).json(result);
    } catch (error) {
      appleSubject = null;
      if (error instanceof PrivyIdentityError) {
        return privyLookupFailure(req, res, error, 'request');
      }
      if (error instanceof AccountDeletionConfigurationError) {
        req.log?.error?.({ errorType: error.name }, 'account deletion request is not configured');
        return res.status(503).json({ error: 'account_deletion_not_configured' });
      }
      if (error instanceof AccountDeletionIdentityError) {
        return res.status(409).json({ error: 'stable_provider_identity_unavailable' });
      }
      if (error instanceof AccountDeletionReauthError) {
        return accountDeletionReauthFailure(req, res, error, 'consumption');
      }
      if (error?.code === 'account_deletion_disabled') {
        return res.status(503).json({ error: error.code });
      }
      throw error;
    }
  };
}

meRouter.get(
  '/account-deletion',
  requireAuth,
  express4AsyncHandler(createAccountDeletionStatusHandler()),
);

meRouter.post(
  '/account-deletion/reauth/challenge',
  requireAuth,
  express4AsyncHandler(createAccountDeletionReauthChallengeHandler()),
);

meRouter.post(
  '/account-deletion/reauth/verify',
  requireAuth,
  express4AsyncHandler(createAccountDeletionReauthVerifyHandler()),
);

meRouter.post(
  '/account-deletion',
  requireAuth,
  express4AsyncHandler(createAccountDeletionRequestHandler()),
);

meRouter.delete('/data', requireAuth, async (req, res) => {
  const parsed = deleteDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'confirmation_required',
      confirmation: DELETE_DATA_CONFIRMATION,
    });
  }
  return res.status(410).json({
    error: 'account_deletion_endpoint_moved',
    path: '/me/account-deletion',
  });
});
