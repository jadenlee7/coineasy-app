import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { createModerationAuth } from '../lib/moderation-auth.js';
import { resolveModerationActivationConfig } from '../lib/moderation-config.js';
import {
  getModerationDecisionPolicy,
  MODERATION_DECISIONS,
} from '../lib/moderation-decisions.js';
import { MODERATION_CAPABILITIES } from '../lib/moderation-principal.js';
import { createModerationService, ModerationError } from '../lib/moderation-service.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import { createModerationAuthorizer } from '../middleware/moderation-authorization.js';
import { requirePhase } from '../middleware/phase.js';

function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  return next();
}

class ModerationServiceConfigError extends Error {
  constructor(cause) {
    super('moderation service configuration is invalid', { cause });
    this.name = 'ModerationServiceConfigError';
  }
}

function safeErrorMetadata(error) {
  const errorType = typeof error?.name === 'string'
    && /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u.test(error.name)
    ? error.name
    : 'Error';
  const errorCode = typeof error?.code === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(error.code)
    ? error.code
    : undefined;
  return { errorType, errorCode };
}

function sendModerationError(req, res, error) {
  if (error instanceof ModerationServiceConfigError) {
    return res.status(503).json({ error: 'moderation_service_unconfigured' });
  }
  if (error instanceof ModerationError) {
    return res.status(error.status).json({ error: error.code });
  }
  req.log?.error?.(
    {
      requestId: req.id,
      ...safeErrorMetadata(error),
    },
    'moderation request failed',
  );
  return res.status(500).json({ error: 'internal_error', requestId: req.id });
}

export function createModerationRouter({
  db = prisma,
  env = process.env,
  phaseConfig,
  service: injectedService,
  authenticate = createModerationAuth({ env }),
  authorize = createModerationAuthorizer(),
} = {}) {
  const router = Router();
  const enabled = requirePhase('POST_MODERATION_ENABLED', phaseConfig);
  const requireQueueRead = authorize(MODERATION_CAPABILITIES.QUEUE_READ);
  const requireReportClaim = authorize(MODERATION_CAPABILITIES.REPORT_CLAIM);
  const requireReportDecision = authorize(MODERATION_CAPABILITIES.REPORT_DECIDE);
  const decisionAuthorizers = new Map(MODERATION_DECISIONS.map((decision) => {
    const policy = getModerationDecisionPolicy(decision);
    const routeOptions = policy.maxMfaAgeSeconds === null
      ? {}
      : { maxMfaAgeSeconds: policy.maxMfaAgeSeconds };
    return [decision, authorize(policy.requiredCapabilities, routeOptions)];
  }));
  let service = injectedService;

  function requireDecisionAuthorization(req, res, next) {
    const policy = getModerationDecisionPolicy(req.body?.decision);
    if (policy) {
      return decisionAuthorizers.get(req.body.decision)(req, res, next);
    }
    return requireReportDecision(req, res, () => (
      res.status(400).json({ error: 'bad_input' })
    ));
  }

  function resolveService() {
    if (service) return service;
    try {
      const activation = resolveModerationActivationConfig(env);
      service = createModerationService({
        prisma: db,
        responseSlaHours: activation.responseSlaHours,
        policyVersion: activation.policyVersion,
      });
      return service;
    } catch (error) {
      throw new ModerationServiceConfigError(error);
    }
  }

  router.get('/reports', noStore, enabled, authenticate, requireQueueRead, express4AsyncHandler(async (req, res) => {
    try {
      return res.json(await resolveService().list(req.moderator.actorId, req.query));
    } catch (error) {
      return sendModerationError(req, res, error);
    }
  }));

  router.post(
    '/reports/:reportId/claim',
    noStore,
    enabled,
    authenticate,
    requireReportClaim,
    express4AsyncHandler(async (req, res) => {
      try {
        return res.json(await resolveService().claim(
          req.moderator.actorId,
          req.params.reportId,
          req.body,
        ));
      } catch (error) {
        return sendModerationError(req, res, error);
      }
    }),
  );

  router.post(
    '/reports/:reportId/decision',
    noStore,
    enabled,
    authenticate,
    requireDecisionAuthorization,
    express4AsyncHandler(async (req, res) => {
      try {
        return res.json(await resolveService().decide(
          req.moderator.actorId,
          req.params.reportId,
          req.body,
        ));
      } catch (error) {
        return sendModerationError(req, res, error);
      }
    }),
  );

  return router;
}

export const moderationRouter = createModerationRouter();
