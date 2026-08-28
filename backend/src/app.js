/** Express application assembly, kept separate from process startup. */
import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { createNoopTelemetry } from './lib/telemetry.js';
import { resolveModerationActivationConfig } from './lib/moderation-config.js';
import { POST_MODERATION_READY } from './lib/moderation-gates.js';
import {
  verifyModerationActivationDatabaseContracts,
} from './lib/moderation-readiness.js';
import {
  containsModerationCredential,
  sanitizeRequestUrl,
} from './lib/request-url.js';
import { authRouter } from './routes/auth.js';
import { orangeRouter } from './routes/orange.js';
import { swapRouter } from './routes/swap.js';
import { telegramRouter } from './routes/telegram.js';
import { profilesRouter } from './routes/profiles.js';
import { postsRouter } from './routes/posts.js';
import { followsRouter } from './routes/follows.js';
import { notificationsRouter } from './routes/notifications.js';
import { meRouter } from './routes/me.js';
import { pushTokensRouter } from './routes/push-tokens.js';
import { identityRouter } from './routes/identity.js';
import { segmentsRouter } from './routes/segments.js';
import { questsRouter } from './routes/quests.js';
import { adminRouter } from './routes/admin.js';
import { socialRouter } from './routes/social.js';
import { legalRouter } from './routes/legal.js';
import { moderationRouter } from './routes/moderation.js';
import { createLegacySocialGate } from './middleware/legacy-social.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function clean(value) {
  const result = String(value || '').trim();
  return result || undefined;
}

function boundedTimeout(value, fallback = 2_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(100, Math.min(parsed, 10_000));
}

export function resolveRequestId(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string'
    && REQUEST_ID_PATTERN.test(candidate)
    && !containsModerationCredential(candidate)
    ? candidate
    : randomUUID();
}

export function requestPath(value) {
  return sanitizeRequestUrl(value) || '/';
}

export function serviceMetadata(env = process.env) {
  return {
    service: clean(env.SERVICE_NAME) || 'easygo-backend',
    phase: 1,
    release: clean(env.SENTRY_RELEASE) || clean(env.RELEASE_SHA) || 'local',
  };
}

export function createLivenessHandler({ env = process.env } = {}) {
  return function liveness(_req, res) {
    res.set('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      status: 'alive',
      ...serviceMetadata(env),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  };
}

export function notFoundHandler(req, res) {
  return res.status(404).json({ error: 'not_found', requestId: req.id });
}

export function createReadinessHandler({
  db,
  env = process.env,
  appLogger = logger,
  moderationReady = POST_MODERATION_READY,
  verifyModerationContract = verifyModerationActivationDatabaseContracts,
} = {}) {
  const timeoutMs = boundedTimeout(env.READINESS_TIMEOUT_MS);

  return async function readiness(req, res) {
    let timer;
    try {
      const moderationEnabled = (
        moderationReady
        && clean(env.POST_MODERATION_ENABLED)?.toLowerCase() === 'true'
      );
      if (moderationEnabled) {
        resolveModerationActivationConfig(env);
      }
      await Promise.race([
        moderationEnabled
          ? verifyModerationContract(db)
          : db.$queryRawUnsafe('SELECT 1'),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), timeoutMs);
          timer.unref?.();
        }),
      ]);
      clearTimeout(timer);
      res.set('Cache-Control', 'no-store');
      return res.json({ ok: true, status: 'ready', ...serviceMetadata(env) });
    } catch (error) {
      clearTimeout(timer);
      appLogger.warn(
        { requestId: req.id, errorType: error?.name || 'Error' },
        'service readiness check failed',
      );
      res.set('Cache-Control', 'no-store');
      res.set('Retry-After', '5');
      return res.status(503).json({
        ok: false,
        status: 'not_ready',
        ...serviceMetadata(env),
        requestId: req.id,
      });
    }
  };
}

export function createApp({
  db = prisma,
  env = process.env,
  appLogger = logger,
  telemetry = createNoopTelemetry(),
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({
    logger: appLogger,
    genReqId(req, res) {
      const id = resolveRequestId(req.headers['x-request-id']);
      res.setHeader('X-Request-Id', id);
      return id;
    },
    wrapSerializers: false,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, path: requestPath(req.url) };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
      err: pino.stdSerializers.err,
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', createLivenessHandler({ env }));
  app.get('/ready', createReadinessHandler({ db, env, appLogger }));
  app.use('/legal', legalRouter);

  app.use('/auth', authRouter);
  app.use('/orange', orangeRouter);
  app.use('/swap', swapRouter);
  app.use('/telegram', telegramRouter);
  app.use('/social', socialRouter);

  const legacySocialGate = createLegacySocialGate({ env });
  app.use('/profiles', legacySocialGate);
  app.use('/posts', legacySocialGate);
  app.use('/follows', legacySocialGate);
  app.use('/notifications', legacySocialGate);
  app.use('/profiles', profilesRouter);
  app.use('/posts', postsRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/me/push-token', pushTokensRouter);
  app.use('/me', meRouter);
  app.use('/identity', identityRouter);
  app.use('/segments', segmentsRouter);
  app.use('/quests', questsRouter);
  app.use('/admin', adminRouter);
  app.use('/moderation', moderationRouter);
  app.use('/', followsRouter);

  app.use(notFoundHandler);

  telemetry.setupErrorHandler(app);
  app.use((error, req, res, next) => {
    appLogger.error(
      { requestId: req.id, errorType: error?.name || 'Error' },
      'unhandled request error',
    );
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'internal_error', requestId: req.id });
  });

  return app;
}
