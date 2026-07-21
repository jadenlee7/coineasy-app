import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { createQuestService } from '../lib/quest-service.js';
import { QuestError } from '../lib/quest-verifier.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePhase } from '../middleware/phase.js';

function sendQuestError(req, res, error) {
  if (error instanceof QuestError) {
    return res.status(error.status).json({
      error: error.code,
      ...(error.retryable ? { retryable: true } : {}),
    });
  }
  req.log?.error({ err: error }, 'quest request failed');
  return res.status(500).json({ error: 'internal_error' });
}

export function createQuestsRouter({ service = createQuestService({ prisma }) } = {}) {
  const router = Router();
  const questsEnabled = requirePhase('QUESTS_ENABLED');

  router.get('/', questsEnabled, requireAuth, async (req, res) => {
    try {
      res.json({ quests: await service.list(req.user.privyDid) });
    } catch (error) {
      sendQuestError(req, res, error);
    }
  });

  router.post('/:questId/start', questsEnabled, requireAuth, async (req, res) => {
    try {
      res.json(await service.start(req.user.privyDid, req.params.questId, req.body));
    } catch (error) {
      sendQuestError(req, res, error);
    }
  });

  router.post('/:questId/complete', questsEnabled, requireAuth, async (req, res) => {
    try {
      res.json(await service.complete(req.user.privyDid, req.params.questId, req.body));
    } catch (error) {
      sendQuestError(req, res, error);
    }
  });

  return router;
}

export const questsRouter = createQuestsRouter();
