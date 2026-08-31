/** Account-bound user-block management for authenticated EasyGo users. */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import {
  createUserBlock,
  deleteUserBlock,
  listUserBlocks,
} from '../lib/user-blocks.js';

export const blocksRouter = Router();

const PAGE_DEFAULT = 50;
const PAGE_MAX = 100;

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return PAGE_DEFAULT;
  return Math.min(Math.floor(parsed), PAGE_MAX);
}

export function createListBlocksHandler({ db = prisma } = {}) {
  return async function listBlocks(req, res) {
    res.set('Cache-Control', 'no-store');
    const me = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!me) return res.status(404).json({ error: 'user_not_found' });

    const result = await listUserBlocks(db, {
      blockerId: me.id,
      cursor: req.query.cursor ? String(req.query.cursor) : null,
      limit: parseLimit(req.query.limit),
    });
    return res.json(result);
  };
}

export function createBlockUserHandler({ db = prisma } = {}) {
  return async function blockUser(req, res) {
    res.set('Cache-Control', 'no-store');
    const me = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!me) return res.status(404).json({ error: 'user_not_found' });
    if (me.id === req.params.targetUserId) {
      return res.status(409).json({ error: 'cannot_block_self' });
    }
    const result = await createUserBlock(db, {
      blockerId: me.id,
      blockedId: req.params.targetUserId,
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  };
}

export function createUnblockUserHandler({ db = prisma } = {}) {
  return async function unblockUser(req, res) {
    res.set('Cache-Control', 'no-store');
    const me = await db.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: { id: true },
    });
    if (!me) return res.status(404).json({ error: 'user_not_found' });
    if (me.id === req.params.targetUserId) {
      return res.status(409).json({ error: 'cannot_block_self' });
    }

    const result = await deleteUserBlock(db, {
      blockerId: me.id,
      blockedId: req.params.targetUserId,
    });
    return res.json(result);
  };
}

blocksRouter.get('/', requireAuth, express4AsyncHandler(createListBlocksHandler()));
blocksRouter.post('/:targetUserId', requireAuth, express4AsyncHandler(createBlockUserHandler()));
blocksRouter.delete('/:targetUserId', requireAuth, express4AsyncHandler(createUnblockUserHandler()));
