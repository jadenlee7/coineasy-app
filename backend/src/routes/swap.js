/**
 * /swap routes — Squid SDK proxy.
 *
 * Phase 1 (Path C):
 *   - Source/destination chain default = Base (chainId 8453).
 *   - GET /swap/quote returns route + unsigned tx for client to sign.
 *   - POST /swap/log records a successful swap (client posts tx hash);
 *     awards 🍊 Orange via internal earn() call.
 *
 * Phase 2 (PHASE.EASYCHAIN_ENABLED): chainIds become configurable.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getQuote, buildExecuteTx, PHASE_1_CHAIN_ID } from '../lib/squid.js';
import { prisma } from '../lib/db.js';

export const swapRouter = Router();

const quoteSchema = z.object({
  fromAddress: z.string().min(10),
  fromToken: z.string(),
  fromAmount: z.string(),
  toToken: z.string(),
  fromChain: z.string().optional(),
  toChain: z.string().optional(),
  toAddress: z.string().optional(),
  slippage: z.number().optional(),
});

swapRouter.post('/quote', requireAuth, async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  try {
    const route = await getQuote(parsed.data);
    res.json({
      route,
      tx: buildExecuteTx(route),
      defaultChain: PHASE_1_CHAIN_ID,
    });
  } catch (err) {
    req.log?.error({ err }, 'squid quote failed');
    res.status(502).json({ error: 'squid_failed', message: err.message });
  }
});

const logSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  fromToken: z.string(),
  toToken: z.string(),
  fromAmount: z.string(),
  toAmount: z.string().optional(),
  chainId: z.string().optional(),
});

const SWAP_REWARD_ORANGE = 10;

swapRouter.post('/log', requireAuth, async (req, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const swap = await prisma.swapLog.create({
    data: {
      userId: user.id,
      txHash: parsed.data.txHash,
      fromToken: parsed.data.fromToken,
      toToken: parsed.data.toToken,
      fromAmount: parsed.data.fromAmount,
      toAmount: parsed.data.toAmount,
      chainId: parsed.data.chainId || PHASE_1_CHAIN_ID,
    },
  });

  // Reward 🍊 Orange (idempotency: unique on txHash via prisma schema)
  await prisma.orangeLedger.create({
    data: {
      userId: user.id,
      delta: SWAP_REWARD_ORANGE,
      reason: 'SWAP_REWARD',
      refId: parsed.data.txHash,
    },
  });

  res.json({ swap, awarded: SWAP_REWARD_ORANGE });
});
