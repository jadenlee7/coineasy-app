/**
 * Authenticated privacy controls (Path C v2 S3).
 *
 * GET    /me/consent  — effective consent state for the current policy version
 * PUT    /me/consent  — full consent replacement + immutable audit snapshot
 * GET    /me/data     — export the user's EasyGo-local database records
 * GET    /me/social-export — privacy-minimized legacy social export
 * GET    /me/account-deletion  — server-authoritative deletion capability/state
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
  accountDeletionEnabled,
  AccountDeletionConfigurationError,
  DELETE_ACCOUNT_CONFIRMATION,
  findAccountDeletionRequest,
  requestAccountDeletion,
} from '../lib/account-deletion.js';

export const meRouter = Router();
export const DELETE_DATA_CONFIRMATION = 'DELETE_MY_EASYGO_DATA';

const deleteDataSchema = z.object({
  confirmation: z.literal(DELETE_DATA_CONFIRMATION),
}).strict();

const accountDeletionSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
  clientRequestId: z.string().uuid(),
  walletRiskAcknowledged: z.literal(true),
}).strict();

function currentVersionOr503(req, res) {
  try {
    return getCurrentConsentVersion();
  } catch (error) {
    req.log?.error({ err: error }, 'consent configuration invalid');
    res.status(503).json({ error: 'consent_not_configured' });
    return null;
  }
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

  return res.json({ consent: consentView(user.consent, currentVersion) });
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
    return res.json({ consent: consentView(consent, currentVersion) });
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

meRouter.get('/account-deletion', requireAuth, express4AsyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!accountDeletionEnabled()) {
    return res.json({ available: false, state: null });
  }

  try {
    const request = await findAccountDeletionRequest(prisma, req.user.privyDid);
    return res.json({
      available: !request,
      state: request?.state || null,
      requestId: request?.id || null,
      localDataDeleted: Boolean(request?.localPurgedAt),
      completed: request?.state === 'COMPLETED',
    });
  } catch (error) {
    if (error instanceof AccountDeletionConfigurationError) {
      req.log?.error?.({ errorType: error.name }, 'account deletion guard is not configured');
      return res.status(503).json({ error: 'account_deletion_not_configured' });
    }
    throw error;
  }
}));

meRouter.post('/account-deletion', requireAuth, express4AsyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const parsed = accountDeletionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'confirmation_required',
      confirmation: DELETE_ACCOUNT_CONFIRMATION,
    });
  }
  if (!accountDeletionEnabled()) {
    return res.status(503).json({ error: 'account_deletion_disabled' });
  }

  try {
    const result = await requestAccountDeletion({
      prisma,
      privyDid: req.user.privyDid,
      clientRequestId: parsed.data.clientRequestId,
    });
    return res.status(202).json(result);
  } catch (error) {
    if (error instanceof AccountDeletionConfigurationError) {
      req.log?.error?.({ errorType: error.name }, 'account deletion request is not configured');
      return res.status(503).json({ error: 'account_deletion_not_configured' });
    }
    if (error?.code === 'account_deletion_disabled') {
      return res.status(503).json({ error: error.code });
    }
    throw error;
  }
}));

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
