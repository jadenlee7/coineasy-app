/**
 * /swap routes — Squid SDK proxy.
 *
 * Phase 1 (Path C):
 *   - Source/destination chain default = Base (chainId 8453).
 *   - POST /swap/quote-preview returns a read-only, account-bound estimate.
 *   - POST /swap/quote and POST /swap/log are dormant behind independent
 *     compile-time and runtime execution gates.
 *
 * Phase 2 (PHASE.EASYCHAIN_ENABLED): chainIds become configurable.
 */

import { Router } from 'express';
import { z } from 'zod';
import { isAddress } from 'viem';
import { requireAuth } from '../middleware/auth.js';
import {
  buildExecuteTx,
  getQuote,
  getQuotePreview,
  PHASE_1_CHAIN_ID,
  QUOTE_PREVIEW_TOKEN_ADDRESSES,
} from '../lib/squid.js';
import { prisma } from '../lib/db.js';
import { requireSwapExecution } from '../lib/swap-execution-gates.js';

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

const MAX_UINT256 = (1n << 256n) - 1n;
const quotePreviewTokenSchema = z.string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => QUOTE_PREVIEW_TOKEN_ADDRESSES.includes(value), 'unsupported token');
const quotePreviewAmountSchema = z.string()
  .max(78)
  .regex(/^[1-9][0-9]*$/u, 'must be a positive integer string')
  .refine((value) => {
    try {
      return BigInt(value) <= MAX_UINT256;
    } catch {
      return false;
    }
  }, 'amount exceeds uint256');
const quotePreviewSchema = z.object({
  fromToken: quotePreviewTokenSchema,
  toToken: quotePreviewTokenSchema,
  fromAmount: quotePreviewAmountSchema,
}).strict().refine((value) => value.fromToken !== value.toToken, {
  message: 'token pair must be distinct',
  path: ['toToken'],
});

export function createQuotePreviewHandler({ db = prisma, fetchPreview = getQuotePreview } = {}) {
  return async function quotePreview(req, res) {
    res.set('Cache-Control', 'no-store');
    const parsed = quotePreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_input', details: parsed.error.issues });
    }

    try {
      const user = await db.user.findUnique({
        where: { privyDid: req.user.privyDid },
        select: { walletAddress: true },
      });
      if (!user) return res.status(404).json({ error: 'user_not_found' });
      if (!user.walletAddress || !isAddress(user.walletAddress, { strict: false })) {
        return res.status(409).json({ error: 'wallet_not_ready' });
      }

      const preview = await fetchPreview({
        walletAddress: user.walletAddress,
        fromToken: parsed.data.fromToken,
        toToken: parsed.data.toToken,
        fromAmount: parsed.data.fromAmount,
      });
      return res.json({ preview, defaultChain: PHASE_1_CHAIN_ID });
    } catch (err) {
      req.log?.error({
        errorType: err?.name || 'Error',
        upstreamStatus: Number.isInteger(err?.response?.status) ? err.response.status : undefined,
      }, 'squid quote preview failed');
      return res.status(502).json({ error: 'squid_failed' });
    }
  };
}

swapRouter.post('/quote-preview', requireAuth, createQuotePreviewHandler());

swapRouter.post('/quote', requireSwapExecution, requireAuth, async (req, res) => {
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

swapRouter.post('/log', requireSwapExecution, requireAuth, async (req, res) => {
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
