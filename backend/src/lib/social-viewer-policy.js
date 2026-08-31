export class SocialViewerAuthorizationError extends Error {
  constructor() {
    super('authenticated social viewer could not be resolved');
    this.name = 'SocialViewerAuthorizationError';
    this.code = 'invalid_token';
    this.status = 401;
  }
}

export async function resolveOptionalSocialViewerWith(req, { db, verify }) {
  const header = req.headers?.authorization || '';
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new SocialViewerAuthorizationError();
  let privyDid;
  try {
    ({ userId: privyDid } = await verify(match[1]));
  } catch {
    throw new SocialViewerAuthorizationError();
  }
  if (typeof privyDid !== 'string' || !privyDid) {
    throw new SocialViewerAuthorizationError();
  }
  const viewer = await db.user.findUnique({
    where: { privyDid },
    select: { id: true },
  });
  if (!viewer) throw new SocialViewerAuthorizationError();
  return viewer;
}
