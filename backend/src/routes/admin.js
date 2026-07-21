import { Router } from 'express';
import { createAdminService, AdminError } from '../lib/admin-service.js';
import { createAdvertiserAuth } from '../lib/advertiser-auth.js';
import { prisma } from '../lib/db.js';
import { requirePhase } from '../middleware/phase.js';

function aggregateMinimum(env) {
  if (!env.ADVERTISER_AGGREGATE_MINIMUM) return 10;
  const value = Number(env.ADVERTISER_AGGREGATE_MINIMUM);
  return Number.isInteger(value) && value >= 10 && value <= 10_000 ? value : 10;
}

function sendAdminError(req, res, error) {
  if (error instanceof AdminError) {
    return res.status(error.status).json({ error: error.code });
  }
  req.log?.error({ err: error }, 'advertiser admin request failed');
  return res.status(500).json({ error: 'internal_error' });
}

export function createAdminRouter({
  db = prisma,
  env = process.env,
  phaseConfig,
  service = createAdminService({
    prisma: db,
    consentVersion: env.EASYGO_CONSENT_VERSION,
    minimumCohortSize: aggregateMinimum(env),
  }),
  authenticate = createAdvertiserAuth({ db, env }),
} = {}) {
  const router = Router();
  const enabled = requirePhase('ADVERTISER_ADMIN_ENABLED', phaseConfig);

  router.get('/me', enabled, authenticate, async (req, res) => {
    res.json({ advertiser: req.advertiser });
  });

  router.get('/campaigns', enabled, authenticate, async (req, res) => {
    try {
      res.json({ campaigns: await service.list(req.advertiser.id) });
    } catch (error) {
      sendAdminError(req, res, error);
    }
  });

  router.post('/campaigns', enabled, authenticate, async (req, res) => {
    try {
      const campaign = await service.create(req.advertiser.id, req.body);
      res.status(201).json({ campaign });
    } catch (error) {
      sendAdminError(req, res, error);
    }
  });

  router.get('/campaigns/:campaignId', enabled, authenticate, async (req, res) => {
    try {
      res.json({ campaign: await service.get(req.advertiser.id, req.params.campaignId) });
    } catch (error) {
      sendAdminError(req, res, error);
    }
  });

  router.patch('/campaigns/:campaignId', enabled, authenticate, async (req, res) => {
    try {
      const campaign = await service.update(
        req.advertiser.id,
        req.params.campaignId,
        req.body,
      );
      res.json({ campaign });
    } catch (error) {
      sendAdminError(req, res, error);
    }
  });

  router.get('/campaigns/:campaignId/report', enabled, authenticate, async (req, res) => {
    try {
      res.json(await service.report(req.advertiser.id, req.params.campaignId));
    } catch (error) {
      sendAdminError(req, res, error);
    }
  });

  return router;
}

export const adminRouter = createAdminRouter();
