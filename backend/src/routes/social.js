import { Router } from 'express';
import { legacySocialStatus } from '../middleware/legacy-social.js';

export function createSocialRouter({ env = process.env } = {}) {
  const router = Router();
  router.get('/status', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(legacySocialStatus(env));
  });
  return router;
}

export const socialRouter = createSocialRouter();
