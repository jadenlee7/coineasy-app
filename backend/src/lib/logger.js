/**
 * Shared structured logger.
 *
 * Logs always go to stdout. Better Stack is an optional second destination
 * when a source token is configured. Sensitive request and identity fields
 * are redacted before any transport receives the event.
 */
import pino from 'pino';

export const LOGGER_REDACT_PATHS = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-admin-secret"]',
  'req.body.message',
  'req.body.signature',
  'req.body.answer',
  'req.body.correctAnswer',
  'email',
  'privyId',
  'privyDid',
  'walletAddress',
  'verifiedAddress',
  'subjectHash',
  'subjectHashKeyFingerprint',
  'privyDidCiphertext',
  'user.email',
  'user.privyId',
  'user.privyDid',
  'user.walletAddress',
  'user.verifiedAddress',
  'accountDeletion.subjectHash',
  'accountDeletion.subjectHashKeyFingerprint',
  'accountDeletion.privyDidCiphertext',
  '*.email',
  '*.privyId',
  '*.privyDid',
  '*.walletAddress',
  '*.verifiedAddress',
  '*.subjectHash',
  '*.subjectHashKeyFingerprint',
  '*.privyDidCiphertext',
]);

function clean(value) {
  const result = String(value || '').trim();
  return result || undefined;
}

function betterStackEndpoint(value) {
  const host = clean(value);
  if (!host) return undefined;
  return /^https:\/\//i.test(host) ? host : `https://${host}`;
}

function transportConfig(env) {
  const isProd = env.NODE_ENV === 'production';
  const targets = [];

  if (!isProd) {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    });
  }

  const sourceToken = clean(env.BETTER_STACK_SOURCE_TOKEN);
  const endpoint = betterStackEndpoint(env.BETTER_STACK_INGESTING_HOST);
  if (sourceToken && endpoint) {
    if (isProd) {
      targets.push({ target: 'pino/file', options: { destination: 1 } });
    }
    targets.push({
      target: '@logtail/pino',
      options: {
        sourceToken,
        options: { endpoint },
      },
    });
  }

  if (targets.length === 0) return undefined;
  return targets.length === 1 ? targets[0] : { targets };
}

export function createLogger({ env = process.env, destination } = {}) {
  const isProd = env.NODE_ENV === 'production';
  const options = {
    level: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    base: {
      service: clean(env.SERVICE_NAME) || 'easygo-backend',
      environment: clean(env.SENTRY_ENVIRONMENT) || clean(env.NODE_ENV) || 'development',
      release: clean(env.SENTRY_RELEASE) || clean(env.RELEASE_SHA) || 'local',
    },
    redact: {
      censor: '[REDACTED]',
      paths: [...LOGGER_REDACT_PATHS],
    },
  };

  if (destination) return pino(options, destination);
  const transport = transportConfig(env);
  return pino(transport ? { ...options, transport } : options);
}

export const logger = createLogger();
