import { prisma } from './db.js';
import { verifyAccessToken } from './privy.js';
import { resolveOptionalSocialViewerWith } from './social-viewer-policy.js';

export { SocialViewerAuthorizationError } from './social-viewer-policy.js';

/**
 * Resolve a viewer only when a valid bearer maps to a local account.
 *
 * Social read routes intentionally remain public only when Authorization is
 * absent. Once a caller supplies a bearer, invalid, expired, malformed, or
 * unsynced identity must fail closed instead of bypassing account block rules.
 */
export async function resolveOptionalSocialViewer(req, {
  db = prisma,
  verify = verifyAccessToken,
} = {}) {
  return resolveOptionalSocialViewerWith(req, { db, verify });
}
