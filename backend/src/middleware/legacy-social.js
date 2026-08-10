const SOCIAL_MODES = new Set(['active', 'read_only', 'retired']);
const SOCIAL_EXPORT = Object.freeze({ method: 'GET', path: '/me/social-export' });

export function legacySocialConfig(env = process.env) {
  const configuredMode = String(env.LEGACY_SOCIAL_MODE || 'active').toLowerCase();
  const mode = SOCIAL_MODES.has(configuredMode) ? configuredMode : 'active';
  let sunsetAt = null;
  if (env.LEGACY_SOCIAL_SUNSET_AT) {
    const parsed = new Date(env.LEGACY_SOCIAL_SUNSET_AT);
    if (!Number.isNaN(parsed.getTime())) sunsetAt = parsed.toISOString();
  }
  return { mode, sunsetAt };
}

export function legacySocialStatus(env = process.env) {
  const { mode, sunsetAt } = legacySocialConfig(env);
  return {
    mode,
    readsAvailable: mode !== 'retired',
    writesAvailable: mode === 'active',
    sunsetAt,
    export: SOCIAL_EXPORT,
  };
}

export function createLegacySocialGate({ env = process.env } = {}) {
  return function legacySocialGate(req, res, next) {
    const status = legacySocialStatus(env);
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') return next();
    if (status.mode === 'active') return next();
    if (status.mode === 'read_only' && ['GET', 'HEAD'].includes(method)) return next();

    res.set('Cache-Control', 'no-store');
    return res.status(410).json({
      error: status.mode === 'retired'
        ? 'legacy_social_retired'
        : 'legacy_social_writes_retired',
      ...status,
    });
  };
}
