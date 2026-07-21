import { Router } from 'express';
import { consentView, getCurrentConsentVersion } from '../lib/consent.js';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePhase } from '../middleware/phase.js';

export const segmentsRouter = Router();

segmentsRouter.get(
  '/',
  requirePhase('SEGMENTS_ENABLED'),
  requireAuth,
  async (req, res) => {
    let currentVersion;
    try {
      currentVersion = getCurrentConsentVersion();
    } catch (error) {
      req.log?.error({ err: error }, 'segment consent configuration invalid');
      return res.status(503).json({ error: 'consent_not_configured' });
    }

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { privyDid: req.user.privyDid },
      select: {
        verifiedAddress: true,
        siweChainId: true,
        consent: true,
        segments: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            segment: { status: 'ACTIVE' },
          },
          orderBy: [{ matchedAt: 'desc' }, { segmentId: 'asc' }],
          select: {
            source: true,
            ruleVersion: true,
            matchedAt: true,
            expiresAt: true,
            segment: {
              select: {
                slug: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'not_found' });

    const consent = consentView(user.consent, currentVersion);
    const walletVerifiedOnBase = Boolean(
      user.verifiedAddress && user.siweChainId === 8453,
    );
    const eligible = consent.segmentingOptIn && walletVerifiedOnBase;
    res.set('Cache-Control', 'no-store');
    return res.json({
      consentRequired: !consent.segmentingOptIn,
      walletVerificationRequired: consent.segmentingOptIn && !walletVerifiedOnBase,
      consentVersion: currentVersion,
      memberships: eligible
        ? user.segments.map(({ segment, ...membership }) => ({ ...segment, ...membership }))
        : [],
    });
  },
);
