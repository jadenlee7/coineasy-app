/**
 * ENS identity routes (Path C v2 S4).
 *
 * JustaName issues coineasy.eth subnames on Ethereum mainnet. The issued name
 * stores both the Ethereum coin type and the verified Base ENSIP-19 coin type.
 * Every route is invisible until JUSTANAME_ENABLED=true.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePhase } from '../middleware/phase.js';
import { BASE_CHAIN_ID, verifySiweSignature } from '../lib/siwe.js';
import {
  addJustaNameSubname,
  fullSubname,
  getJustaNameSubname,
  getJustaNameClient,
  getJustaNameConfig,
  hashJustaNameChallenge,
  isJustaNameAvailable,
  JustaNameIntegrationError,
  normalizeSubnameLabel,
  parseAndValidateJustaNameChallenge,
  requestJustaNameChallenge,
  subnameResolvesToAddress,
  SUBNAME_PENDING_TTL_MS,
} from '../lib/justaname.js';

export const identityRouter = Router();
const requireJustaName = requirePhase('JUSTANAME_ENABLED');

const issueSchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().min(3).max(20000).regex(/^0x[0-9a-f]+$/i),
}).strict();

function publicState(user) {
  return {
    subname: user.subnameStatus === 'ISSUED' ? user.subname : null,
    status: user.subnameStatus,
    address: user.subnameAddress,
    issuedAt: user.subnameIssuedAt,
  };
}

function integrationOr503(req, res) {
  try {
    const config = getJustaNameConfig();
    return { config, client: getJustaNameClient(config) };
  } catch (error) {
    req.log?.error({ err: error }, 'JustaName configuration invalid');
    res.status(503).json({ error: 'justaname_not_configured' });
    return null;
  }
}

function eligibleIdentity(user) {
  if (!user.verifiedAddress || user.siweChainId !== BASE_CHAIN_ID || !user.siweVerifiedAt) {
    const error = new Error('Base SIWE verification is required');
    error.code = 'siwe_verification_required';
    throw error;
  }
  return normalizeSubnameLabel(user.username);
}

async function recoverStalePending(user, now = new Date()) {
  if (user.subnameStatus !== 'PENDING') return user;
  const requestedAt = user.subnameRequestedAt && new Date(user.subnameRequestedAt);
  if (requestedAt && now.getTime() - requestedAt.getTime() < SUBNAME_PENDING_TTL_MS) return user;

  const recovered = await prisma.user.updateMany({
    where: { id: user.id, subnameStatus: 'PENDING' },
    data: { subnameStatus: 'FAILED' },
  });
  return recovered.count === 1 ? { ...user, subnameStatus: 'FAILED' } : user;
}

function respondIntegrationError(error, res) {
  if (error?.code === 'siwe_verification_required') {
    return res.status(409).json({ error: error.code });
  }
  if (error?.code === 'username_not_ens_compatible') {
    return res.status(409).json({ error: error.code });
  }
  if (error?.code === 'reserved_subname') {
    return res.status(403).json({ error: error.code });
  }
  if (error?.code === 'justaname_challenge_expired') {
    return res.status(410).json({ error: error.code });
  }
  if (error instanceof JustaNameIntegrationError) {
    return res.status(400).json({ error: error.code });
  }
  throw error;
}

identityRouter.get('/subname', requireJustaName, requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  return res.json(publicState(user));
});

identityRouter.post('/subname/challenge', requireJustaName, requireAuth, async (req, res) => {
  const integration = integrationOr503(req, res);
  if (!integration) return;

  let user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.subnameStatus === 'ISSUED') return res.json({ ...publicState(user), issued: true });

  user = await recoverStalePending(user);
  if (user.subnameStatus === 'PENDING') {
    return res.status(409).json({ error: 'subname_issue_in_progress' });
  }

  try {
    const label = eligibleIdentity(user);
    const message = await requestJustaNameChallenge({
      client: integration.client,
      address: user.verifiedAddress,
      config: integration.config,
    });
    const parsed = parseAndValidateJustaNameChallenge({
      message,
      expectedAddress: user.verifiedAddress,
      config: integration.config,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subnameChallengeHash: hashJustaNameChallenge(message),
        subnameChallengeExpiresAt: parsed.expirationTime,
      },
    });
    return res.json({
      message,
      subname: fullSubname(label, integration.config),
      address: parsed.address,
      chainId: integration.config.chainId,
      expirationTime: parsed.expirationTime.toISOString(),
    });
  } catch (error) {
    if (error?.code === 'justaname_unavailable') {
      req.log?.warn({ code: error.code }, 'JustaName challenge request failed');
      return res.status(502).json({ error: error.code });
    }
    return respondIntegrationError(error, res);
  }
});

identityRouter.post('/issue-subname', requireJustaName, requireAuth, async (req, res) => {
  const parsedBody = issueSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'bad_input', details: parsedBody.error.issues });
  }
  const integration = integrationOr503(req, res);
  if (!integration) return;

  let user = await prisma.user.findUnique({ where: { privyDid: req.user.privyDid } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.subnameStatus === 'ISSUED') return res.json({ ...publicState(user), issued: true });

  user = await recoverStalePending(user);
  if (user.subnameStatus === 'PENDING') {
    return res.status(409).json({ error: 'subname_issue_in_progress' });
  }

  let locked = false;
  let desiredSubname;
  try {
    const label = eligibleIdentity(user);
    desiredSubname = fullSubname(label, integration.config);
    if (!user.subnameChallengeHash || !user.subnameChallengeExpiresAt) {
      return res.status(409).json({ error: 'justaname_challenge_required' });
    }

    const challenge = parseAndValidateJustaNameChallenge({
      message: parsedBody.data.message,
      expectedAddress: user.verifiedAddress,
      expectedHash: user.subnameChallengeHash,
      expectedExpiresAt: user.subnameChallengeExpiresAt,
      config: integration.config,
    });
    let signatureValid = false;
    try {
      signatureValid = await verifySiweSignature({
        message: parsedBody.data.message,
        signature: parsedBody.data.signature,
        address: challenge.address,
        nonce: challenge.nonce,
        config: {
          domain: integration.config.domain,
          scheme: challenge.scheme || new URL(integration.config.origin).protocol.slice(0, -1),
        },
      });
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return res.status(401).json({ error: 'invalid_signature' });

    const available = await isJustaNameAvailable({
      client: integration.client,
      subname: desiredSubname,
      config: integration.config,
    });
    if (!available) {
      const existing = await getJustaNameSubname({
        client: integration.client,
        subname: desiredSubname,
        config: integration.config,
      });
      if (existing?.isClaimed === true
          && existing?.ens?.toLowerCase() === desiredSubname
          && subnameResolvesToAddress(existing, challenge.address)) {
        const providerIssuedAt = existing.claimedAt ? new Date(existing.claimedAt) : null;
        const issuedAt = providerIssuedAt && Number.isFinite(providerIssuedAt.getTime())
          ? providerIssuedAt
          : new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subname: desiredSubname,
            subnameStatus: 'ISSUED',
            subnameAddress: challenge.address,
            subnameChainId: integration.config.chainId,
            subnameIssuedAt: issuedAt,
            subnameChallengeHash: null,
            subnameChallengeExpiresAt: null,
          },
        });
        return res.json({
          subname: desiredSubname,
          status: 'ISSUED',
          address: challenge.address,
          issuedAt: issuedAt.toISOString(),
          reconciled: true,
        });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subname: desiredSubname,
          subnameStatus: 'FAILED',
          subnameChallengeHash: null,
          subnameChallengeExpiresAt: null,
        },
      });
      return res.status(409).json({ error: 'subname_unavailable' });
    }

    const requestedAt = new Date();
    const lock = await prisma.user.updateMany({
      where: {
        id: user.id,
        subnameStatus: { in: ['NOT_REQUESTED', 'FAILED'] },
        subnameChallengeHash: user.subnameChallengeHash,
      },
      data: {
        subname: desiredSubname,
        subnameStatus: 'PENDING',
        subnameAddress: challenge.address,
        subnameChainId: integration.config.chainId,
        subnameRequestedAt: requestedAt,
        subnameChallengeHash: null,
        subnameChallengeExpiresAt: null,
      },
    });
    if (lock.count !== 1) {
      return res.status(409).json({ error: 'subname_issue_in_progress' });
    }
    locked = true;

    const issued = await addJustaNameSubname({
      client: integration.client,
      username: label,
      address: challenge.address,
      message: parsedBody.data.message,
      signature: parsedBody.data.signature,
      config: integration.config,
    });
    if (!issued?.ens || issued.ens.toLowerCase() !== desiredSubname) {
      throw new JustaNameIntegrationError('justaname_issue_mismatch');
    }

    const providerIssuedAt = issued.claimedAt ? new Date(issued.claimedAt) : null;
    const issuedAt = providerIssuedAt && Number.isFinite(providerIssuedAt.getTime())
      ? providerIssuedAt
      : new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { subnameStatus: 'ISSUED', subnameIssuedAt: issuedAt },
    });
    return res.status(201).json({
      subname: desiredSubname,
      status: 'ISSUED',
      address: challenge.address,
      issuedAt: issuedAt.toISOString(),
    });
  } catch (error) {
    if (locked) {
      await prisma.user.updateMany({
        where: { id: user.id, subname: desiredSubname, subnameStatus: 'PENDING' },
        data: { subnameStatus: 'FAILED' },
      });
    }
    if (['justaname_unavailable', 'justaname_issue_failed', 'justaname_issue_mismatch']
      .includes(error?.code)) {
      req.log?.warn({ code: error.code }, 'JustaName subname issuance failed');
      return res.status(502).json({ error: error.code });
    }
    return respondIntegrationError(error, res);
  }
});
