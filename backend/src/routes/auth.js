/**
 * /auth routes.
 *
 * POST /auth/sync   - upsert User row from a verified Privy session.
 *                     Ensures the one-time 100 🍊 Orange welcome bonus.
 * GET  /auth/me     - return profile for the bearer token holder.
 * DELETE /auth/me   - retired unconfirmed deletion alias (always 410).
 */

import { Router } from 'express';
import { z } from 'zod';
import { isAddress, isAddressEqual } from 'viem';
import { requireAuth } from '../middleware/auth.js';
import { requirePhase } from '../middleware/phase.js';
import {
  getUser,
  extractProfile,
  PrivyConfigurationError,
} from '../lib/privy.js';
import { prisma } from '../lib/db.js';
import { awardWelcomeBonusOnce, getOrangeBalance } from '../lib/auth-sync.js';
import { express4AsyncHandler } from '../lib/express-async.js';
import {
  AccountDeletionBlockedError,
  findAccountDeletionRequest,
  runWithAccountDeletionGuard,
} from '../lib/account-deletion.js';
import {
  createSiweChallenge,
  getSiweConfig,
  hashSiweNonce,
  parseAndValidateSiweMessage,
  SiweValidationError,
  verifySiweSignature,
} from '../lib/siwe.js';

export const authRouter = Router();

const requireSiwe = requirePhase('SIWE_AUTH_ENABLED');

const nonceSchema = z.object({
  address: z.string().refine((value) => isAddress(value, { strict: false }), 'invalid address'),
});

const verifySiweSchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().min(3).max(20000).regex(/^0x[0-9a-f]+$/i),
});

async function authenticatedUser(req) {
  return prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
}

async function addressLinkedToAnotherUser(address, userId) {
  return prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [
        { verifiedAddress: { equals: address, mode: 'insensitive' } },
        { walletAddress: { equals: address, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
}

function isPrivyConfigurationFailure(error) {
  const upstreamStatus = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status,
  );
  return error instanceof PrivyConfigurationError
    || upstreamStatus === 401
    || upstreamStatus === 403;
}

export function createAuthSyncHandler({
  db = prisma,
  fetchPrivyUser = getUser,
  env = process.env,
} = {}) {
  return async function authSync(req, res) {
    try {
      const deletionRequest = await findAccountDeletionRequest(
        db,
        req.user.privyDid,
        env,
      );
      if (deletionRequest) {
        return res.status(410).json({ error: 'account_deletion_in_progress' });
      }
    } catch (error) {
      req.log?.error?.(
        { errorType: error?.name || 'Error' },
        'account deletion guard unavailable during auth sync',
      );
      return res.status(503).json({ error: 'account_deletion_guard_unavailable' });
    }

    let privyUser;
    try {
      privyUser = await fetchPrivyUser(req.user.privyDid);
    } catch (error) {
      // Privy's server API reports an invalid app secret as 401/403. That is a
      // server configuration outage (503), while network/rate-limit/provider
      // failures are an upstream gateway failure (502).
      const configurationFailure = isPrivyConfigurationFailure(error);
      req.log?.warn(
        { errorType: error?.name || 'Error' },
        'Privy user lookup unavailable during auth sync',
      );
      return res.status(configurationFailure ? 503 : 502).json({
        error: configurationFailure ? 'privy_not_configured' : 'privy_unavailable',
      });
    }

    const profile = extractProfile(privyUser);
    if (!profile.privyDid || profile.privyDid !== req.user.privyDid) {
      req.log?.warn(
        { errorType: 'PrivyIdentityMismatch' },
        'Privy user lookup returned an invalid identity during auth sync',
      );
      return res.status(502).json({ error: 'privy_unavailable' });
    }

    try {
      const result = await runWithAccountDeletionGuard({
        prisma: db,
        privyDid: profile.privyDid,
        env,
        operation: async (tx) => {
          const existing = await tx.user.findUnique({
            where: { privyDid: profile.privyDid },
            select: { id: true },
          });

          const user = await tx.user.upsert({
            where: { privyDid: profile.privyDid },
            update: {
              telegramId: profile.telegramId,
              telegramUsername: profile.telegramUsername,
              kakaoId: profile.kakaoId,
              walletAddress: profile.walletAddress,
            },
            create: { ...profile },
          });

          // This runs for every sync, not only first creation. A retry after a
          // partial failure can therefore repair a missing welcome ledger row,
          // while the unique key prevents duplicate awards.
          await awardWelcomeBonusOnce(tx, { userId: user.id });
          const orangeBalance = await getOrangeBalance(tx, user.id);
          return { user, isNew: !existing, orangeBalance };
        },
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof AccountDeletionBlockedError) {
        return res.status(410).json({ error: error.code });
      }
      req.log?.error?.(
        { errorType: error?.name || 'Error' },
        'account deletion guard unavailable during auth sync transaction',
      );
      return res.status(503).json({ error: 'account_deletion_guard_unavailable' });
    }
  };
}

authRouter.post('/sync', requireAuth, express4AsyncHandler(createAuthSyncHandler()));

authRouter.post('/siwe/nonce', requireSiwe, requireAuth, async (req, res) => {
  const body = nonceSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'bad_input', details: body.error.issues });

  let config;
  try {
    config = getSiweConfig();
  } catch (error) {
    req.log?.error({ err: error }, 'SIWE configuration invalid');
    return res.status(503).json({ error: 'siwe_not_configured' });
  }

  const user = await authenticatedUser(req);
  if (!user) return res.status(409).json({ error: 'sync_profile_first' });
  if (user.subnameAddress
      && !isAddressEqual(user.subnameAddress, body.data.address)) {
    return res.status(409).json({ error: 'subname_address_locked' });
  }

  let challenge;
  try {
    challenge = createSiweChallenge({ address: body.data.address, config });
  } catch {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (await addressLinkedToAnotherUser(challenge.address, user.id)) {
    return res.status(409).json({ error: 'address_already_linked' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      siweNonceHash: hashSiweNonce(challenge.nonce),
      siweNonceAddress: challenge.address,
      siweNonceExpiresAt: new Date(challenge.expirationTime),
    },
  });

  return res.json(challenge);
});

authRouter.post('/siwe/verify', requireSiwe, requireAuth, async (req, res) => {
  const body = verifySiweSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'bad_input', details: body.error.issues });

  let config;
  try {
    config = getSiweConfig();
  } catch (error) {
    req.log?.error({ err: error }, 'SIWE configuration invalid');
    return res.status(503).json({ error: 'siwe_not_configured' });
  }

  const user = await authenticatedUser(req);
  if (!user) return res.status(409).json({ error: 'sync_profile_first' });
  if (!user.siweNonceHash || !user.siweNonceAddress || !user.siweNonceExpiresAt) {
    return res.status(409).json({ error: 'siwe_nonce_required' });
  }

  let parsed;
  try {
    parsed = parseAndValidateSiweMessage({
      message: body.data.message,
      expectedAddress: user.siweNonceAddress,
      expectedNonceHash: user.siweNonceHash,
      expectedExpiresAt: user.siweNonceExpiresAt,
      config,
    });
  } catch (error) {
    if (error instanceof SiweValidationError) {
      if (error.code === 'nonce_expired') {
        await prisma.user.update({
          where: { id: user.id },
          data: { siweNonceHash: null, siweNonceAddress: null, siweNonceExpiresAt: null },
        });
        return res.status(410).json({ error: error.code });
      }
      return res.status(400).json({ error: error.code });
    }
    return res.status(400).json({ error: 'invalid_message' });
  }

  let signatureValid = false;
  try {
    signatureValid = await verifySiweSignature({
      message: body.data.message,
      signature: body.data.signature,
      address: parsed.address,
      nonce: parsed.nonce,
      config,
    });
  } catch (error) {
    req.log?.warn({ err: error }, 'SIWE signature verification failed');
  }
  if (!signatureValid) return res.status(401).json({ error: 'invalid_signature' });
  if (await addressLinkedToAnotherUser(parsed.address, user.id)) {
    return res.status(409).json({ error: 'address_already_linked' });
  }

  const verifiedAt = new Date();
  try {
    const consumed = await prisma.user.updateMany({
      where: { id: user.id, siweNonceHash: user.siweNonceHash },
      data: {
        verifiedAddress: parsed.address,
        siweChainId: parsed.chainId,
        siweVerifiedAt: verifiedAt,
        siweNonceHash: null,
        siweNonceAddress: null,
        siweNonceExpiresAt: null,
      },
    });
    if (consumed.count !== 1) return res.status(409).json({ error: 'siwe_nonce_used' });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'address_already_linked' });
    throw error;
  }

  return res.json({
    verified: true,
    address: parsed.address,
    chainId: parsed.chainId,
    verifiedAt: verifiedAt.toISOString(),
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user });
});

authRouter.delete('/me', requireAuth, async (req, res) => {
  res.status(410).json({
    error: 'confirmed_deletion_required',
    path: '/me/account-deletion',
  });
});
