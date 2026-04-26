/**
 * Express middleware: requireAuth.
 *
 * Expects `Authorization: Bearer <privy-access-token>`.
 * On success, attaches req.user = { privyDid, claims }.
 */

import { verifyAccessToken } from '../lib/privy.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'missing_bearer' });
    const { userId, claims } = await verifyAccessToken(m[1]);
    req.user = { privyDid: userId, claims };
    next();
  } catch (err) {
    req.log?.warn({ err }, 'auth failed');
    return res.status(401).json({ error: 'invalid_token' });
  }
}
