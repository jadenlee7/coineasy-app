/** Prevent viewer-relative social projections from crossing auth/cache scopes. */
export function socialReadCachePolicy(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
  }
  return next();
}
