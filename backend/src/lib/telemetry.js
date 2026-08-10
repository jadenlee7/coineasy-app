/** Optional, privacy-minimized Sentry error reporting. */
import * as Sentry from '@sentry/node';

function clean(value) {
  const result = String(value || '').trim();
  return result || undefined;
}

function sampleRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 0.2));
}

function stripQuery(value) {
  if (!value) return value;
  return String(value).split(/[?#]/, 1)[0];
}

export function sanitizeSentryEvent(event) {
  if (!event || typeof event !== 'object') return event;

  delete event.user;

  if (event.request) {
    event.request.url = stripQuery(event.request.url);
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      if (!breadcrumb?.data) return breadcrumb;
      const data = { ...breadcrumb.data };
      if (data.url) data.url = stripQuery(data.url);
      delete data.headers;
      delete data.request_body;
      delete data.response_body;
      return { ...breadcrumb, data };
    });
  }

  return event;
}

export function createNoopTelemetry() {
  return {
    enabled: false,
    captureException() {},
    setupErrorHandler() {},
    async close() { return true; },
  };
}

export function createTelemetry({ env = process.env, appLogger } = {}) {
  const dsn = clean(env.SENTRY_DSN);
  if (!dsn) return createNoopTelemetry();

  try {
    Sentry.init({
      dsn,
      environment: clean(env.SENTRY_ENVIRONMENT) || clean(env.NODE_ENV) || 'development',
      release: clean(env.SENTRY_RELEASE) || clean(env.RELEASE_SHA),
      sendDefaultPii: false,
      includeLocalVariables: false,
      tracesSampleRate: sampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
      beforeSend: sanitizeSentryEvent,
    });
  } catch (error) {
    appLogger?.warn(
      { errorType: error?.name || 'Error' },
      'sentry initialization failed; continuing without remote telemetry',
    );
    return createNoopTelemetry();
  }

  return {
    enabled: true,
    captureException(error, { tags } = {}) {
      Sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(tags || {})) {
          if (value !== undefined && value !== null) scope.setTag(key, String(value));
        }
        Sentry.captureException(error);
      });
    },
    setupErrorHandler(app) {
      Sentry.setupExpressErrorHandler(app);
    },
    async close(timeoutMs = 2_000) {
      return Sentry.close(timeoutMs);
    },
  };
}
