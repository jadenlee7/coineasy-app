import { createHash } from 'node:crypto';

const PREPARED_QUESTIONS = Object.freeze([
  {
    position: 1,
    topic: 'Product',
    questionKo: 'Squid를 처음 접하는 분들을 위해, Squid가 어떤 문제를 해결하는 제품인지 소개해 주세요.',
    questionEn: 'For someone new to Squid, what problem does the product solve?',
  },
  {
    position: 2,
    topic: '$QUID',
    questionKo: '$QUID 토큰은 왜 필요하며 Squid 생태계에서 어떤 역할을 하나요?',
    questionEn: 'Why does $QUID exist, and what role does it play in the Squid ecosystem?',
  },
  {
    position: 3,
    topic: 'Staking',
    questionKo: '현재 공유 가능한 범위에서 $QUID 스테이킹의 목적을 간단히 설명해 주세요.',
    questionEn: 'At a high level, what is the purpose of $QUID staking?',
  },
  {
    position: 4,
    topic: 'What comes next',
    questionKo: 'TGE 이후 Squid 제품과 앱에서 기대할 수 있는 다음 단계는 무엇인가요?',
    questionEn: 'What can the community expect next from the Squid product and app after TGE?',
  },
  {
    position: 5,
    topic: 'Partnerships',
    questionKo: '앞으로 Squid 생태계를 확장하는 데 파트너십은 어떤 역할을 하게 되나요?',
    questionEn: 'What role will partnerships play in expanding the Squid ecosystem?',
  },
]);

const RESTRICTED_QUESTION_PATTERNS = Object.freeze([
  /\b(price prediction|target price|financial advice|guaranteed return|exchange listing|when binance|roi|apy)\b/i,
  /(가격\s*전망|목표가|투자\s*조언|재정\s*조언|수익\s*보장|거래소\s*상장|바이낸스\s*상장|예상\s*수익률)/i,
]);

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function displayName(from) {
  return [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim() || undefined;
}

export function normalizeQuestionText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

export function questionHash(value) {
  return createHash('sha256').update(normalizeQuestionText(value)).digest('hex');
}

export function restrictedQuestionReason(value) {
  return RESTRICTED_QUESTION_PATTERNS.some((pattern) => pattern.test(value))
    ? 'price_or_financial_advice'
    : undefined;
}

function eventKey(parts) {
  const digest = createHash('sha256').update(parts.join(':')).digest('hex');
  return `ama:${digest}`;
}

export function referralCodeFor(campaignId, telegramId) {
  return createHash('sha256')
    .update(`${campaignId}:${telegramId}`)
    .digest('hex')
    .slice(0, 12);
}

export function createAmaService({ prisma, config, now = () => new Date() }) {
  if (!prisma) throw new TypeError('prisma is required');
  if (!config?.campaignId) throw new TypeError('AMA config is required');

  async function ensureParticipant(from) {
    const telegramId = String(from?.id ?? '');
    if (!telegramId) throw new TypeError('Telegram user ID is required');
    const referralCode = referralCodeFor(config.campaignId, telegramId);

    return prisma.telegramCampaignParticipant.upsert({
      where: {
        campaignId_telegramId: {
          campaignId: config.campaignId,
          telegramId,
        },
      },
      create: {
        campaignId: config.campaignId,
        telegramId,
        telegramUsername: from?.username || undefined,
        displayName: displayName(from),
        referralCode,
        lastSeenAt: now(),
      },
      update: {
        telegramUsername: from?.username || undefined,
        displayName: displayName(from),
        referralCode,
        lastSeenAt: now(),
      },
    });
  }

  async function recordEvent({
    participantId,
    eventType,
    dedupeKey,
    source,
    payload,
    xpDelta = 0,
  }) {
    const data = {
      campaignId: config.campaignId,
      participantId,
      eventType,
      eventKey: dedupeKey,
      source,
      payload,
      xpDelta,
    };

    if (dedupeKey) {
      const result = await prisma.telegramCampaignEvent.createMany({
        data: [data],
        skipDuplicates: true,
      });
      return result.count === 1;
    }

    await prisma.telegramCampaignEvent.create({ data });
    return true;
  }

  async function recordSystemEvent(eventType, { source = 'telegram', payload, dedupeRef } = {}) {
    return recordEvent({
      eventType,
      source,
      payload,
      dedupeKey: dedupeRef
        ? eventKey([config.campaignId, eventType, String(dedupeRef)])
        : undefined,
    });
  }

  async function awardXp(participantId, { reason, refId, amount }) {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { awarded: false, amount: 0 };
    }

    return prisma.$transaction(async (tx) => {
      const inserted = await tx.telegramCampaignReward.createMany({
        data: [{
          campaignId: config.campaignId,
          participantId,
          reason,
          refId,
          amount,
        }],
        skipDuplicates: true,
      });

      if (inserted.count === 0) {
        const participant = await tx.telegramCampaignParticipant.findUnique({
          where: { id: participantId },
          select: { xp: true },
        });
        return { awarded: false, amount: 0, xp: participant?.xp ?? 0 };
      }

      const participant = await tx.telegramCampaignParticipant.update({
        where: { id: participantId },
        data: { xp: { increment: amount } },
        select: { xp: true },
      });

      await tx.telegramCampaignEvent.create({
        data: {
          campaignId: config.campaignId,
          participantId,
          eventType: 'ama_xp_awarded',
          eventKey: eventKey([config.campaignId, reason, refId]),
          source: 'telegram',
          payload: { reason, refId },
          xpDelta: amount,
        },
      });

      return { awarded: true, amount, xp: participant.xp };
    });
  }

  async function attachReferral(from, rawCode, source = 'telegram_start') {
    const participant = await ensureParticipant(from);
    const referralCode = String(rawCode || '').trim().toLowerCase();
    const referrer = referralCode
      ? await prisma.telegramCampaignParticipant.findFirst({
        where: {
          campaignId: config.campaignId,
          referralCode,
        },
      })
      : null;

    if (!referrer) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_referral_rejected',
        source,
        payload: { reason: 'invalid_code' },
      });
      return { status: 'INVALID', participant };
    }
    if (referrer.id === participant.id) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_referral_rejected',
        source,
        payload: { reason: 'self_referral' },
      });
      return { status: 'SELF', participant };
    }
    if (participant.referredByParticipantId) {
      return {
        status: participant.referredByParticipantId === referrer.id ? 'EXISTS' : 'LOCKED',
        participant,
      };
    }

    const attached = await prisma.telegramCampaignParticipant.updateMany({
      where: {
        id: participant.id,
        referredByParticipantId: null,
      },
      data: { referredByParticipantId: referrer.id },
    });
    if (attached.count === 1) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_referral_start',
        dedupeKey: eventKey([config.campaignId, 'ama_referral_start', participant.id]),
        source,
        payload: { referrerParticipantId: referrer.id },
      });
    }
    return { status: attached.count === 1 ? 'ATTACHED' : 'EXISTS', participant, referrer };
  }

  async function qualifyReferral(participantId, source) {
    return prisma.$transaction(async (tx) => {
      const participant = await tx.telegramCampaignParticipant.findUnique({
        where: { id: participantId },
      });
      if (!participant?.referredByParticipantId || participant.referralQualifiedAt) {
        return { qualified: false, reason: 'not_pending' };
      }

      // Lock the referrer row so simultaneous joins cannot exceed the per-referrer cap.
      await tx.$queryRaw`
        SELECT "id"
        FROM "TelegramCampaignParticipant"
        WHERE "id" = ${participant.referredByParticipantId}
        FOR UPDATE
      `;
      const referrer = await tx.telegramCampaignParticipant.findUnique({
        where: { id: participant.referredByParticipantId },
        select: { communityJoinedAt: true },
      });
      if (!referrer?.communityJoinedAt) {
        await tx.telegramCampaignEvent.create({
          data: {
            campaignId: config.campaignId,
            participantId,
            eventType: 'ama_referral_rejected',
            source,
            payload: { reason: 'referrer_not_verified' },
          },
        });
        return { qualified: false, reason: 'referrer_not_verified' };
      }
      const qualifiedCount = await tx.telegramCampaignParticipant.count({
        where: {
          campaignId: config.campaignId,
          referredByParticipantId: participant.referredByParticipantId,
          referralQualifiedAt: { not: null },
        },
      });
      if (qualifiedCount >= config.qualifiedReferralLimit) {
        await tx.telegramCampaignEvent.create({
          data: {
            campaignId: config.campaignId,
            participantId,
            eventType: 'ama_referral_rejected',
            source,
            payload: { reason: 'referrer_limit' },
          },
        });
        return { qualified: false, reason: 'referrer_limit' };
      }

      const qualifiedAt = now();
      const updated = await tx.telegramCampaignParticipant.updateMany({
        where: {
          id: participantId,
          referralQualifiedAt: null,
        },
        data: { referralQualifiedAt: qualifiedAt },
      });
      if (updated.count === 0) return { qualified: false, reason: 'already_qualified' };

      const reward = await tx.telegramCampaignReward.createMany({
        data: [{
          campaignId: config.campaignId,
          participantId: participant.referredByParticipantId,
          reason: 'ama_qualified_referral',
          refId: participantId,
          amount: config.qualifiedReferralXp,
        }],
        skipDuplicates: true,
      });
      if (reward.count === 1 && config.qualifiedReferralXp > 0) {
        await tx.telegramCampaignParticipant.update({
          where: { id: participant.referredByParticipantId },
          data: {
            xp: { increment: config.qualifiedReferralXp },
            raffleEntries: { increment: 1 },
          },
        });
      }
      await tx.telegramCampaignEvent.create({
        data: {
          campaignId: config.campaignId,
          participantId: participant.referredByParticipantId,
          eventType: 'ama_referral_qualified',
          eventKey: eventKey([config.campaignId, 'ama_referral_qualified', participantId]),
          source,
          payload: { referredParticipantId: participantId },
          xpDelta: reward.count === 1 ? config.qualifiedReferralXp : 0,
        },
      });
      return {
        qualified: true,
        awarded: reward.count === 1,
        amount: reward.count === 1 ? config.qualifiedReferralXp : 0,
      };
    });
  }

  async function markCommunityJoined(from, source = 'verify_button') {
    const participant = await ensureParticipant(from);
    const joinedAt = now();
    await prisma.telegramCampaignParticipant.update({
      where: { id: participant.id },
      data: { communityJoinedAt: participant.communityJoinedAt || joinedAt },
    });
    await recordEvent({
      participantId: participant.id,
      eventType: 'tg_join_verified',
      dedupeKey: eventKey([config.campaignId, 'tg_join_verified', participant.id]),
      source,
    });
    const referral = await qualifyReferral(participant.id, source);
    return { participant, referral };
  }

  async function submitQuestion(from, rawQuestion, source = 'ama_command') {
    const participant = await ensureParticipant(from);
    const questionText = String(rawQuestion || '').replace(/\s+/g, ' ').trim();

    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_question_submit',
      source,
      payload: { length: questionText.length },
    });

    if (questionText.length < 5 || questionText.length > 1000) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_question_filtered',
        source,
        payload: { reason: 'invalid_length' },
      });
      return { status: 'FILTERED', reason: 'invalid_length', participant };
    }

    const submittedCount = await prisma.amaQuestion.count({
      where: {
        campaignId: config.campaignId,
        participantId: participant.id,
        status: { in: ['SUBMITTED', 'ACCEPTED', 'ANSWERED_LIVE', 'ANSWERED_FOLLOWUP'] },
      },
    });
    if (submittedCount >= config.questionLimit) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_question_filtered',
        source,
        payload: { reason: 'question_limit' },
      });
      return { status: 'FILTERED', reason: 'question_limit', participant };
    }

    const filterReason = restrictedQuestionReason(questionText);
    const status = filterReason ? 'FILTERED' : 'ACCEPTED';

    let question;
    try {
      question = await prisma.amaQuestion.create({
        data: {
          campaignId: config.campaignId,
          participantId: participant.id,
          questionText,
          normalizedHash: questionHash(questionText),
          status,
          filterReason,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_question_duplicate',
        source,
      });
      return { status: 'DUPLICATE', participant };
    }

    if (filterReason) {
      await recordEvent({
        participantId: participant.id,
        eventType: 'ama_question_filtered',
        source,
        payload: { questionId: question.id, reason: filterReason },
      });
      return { status, reason: filterReason, participant, question };
    }

    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_question_accepted',
      dedupeKey: eventKey([config.campaignId, 'ama_question_accepted', question.id]),
      source,
      payload: { questionId: question.id },
    });
    const reward = await awardXp(participant.id, {
      reason: 'ama_valid_question',
      refId: question.id,
      amount: config.questionXp,
    });
    return { status, participant, question, reward };
  }

  async function liveCheckin(from, source = 'live_button') {
    const participant = await ensureParticipant(from);
    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_live_checkin',
      dedupeKey: eventKey([config.campaignId, 'ama_live_checkin', participant.id]),
      source,
    });
    const reward = await awardXp(participant.id, {
      reason: 'ama_live_checkin',
      refId: participant.id,
      amount: config.liveCheckinXp,
    });
    return { participant, reward };
  }

  async function participantStatus(from) {
    const participant = await ensureParticipant(from);
    const [questions, rankAhead, qualifiedReferrals] = await Promise.all([
      prisma.amaQuestion.count({
        where: {
          campaignId: config.campaignId,
          participantId: participant.id,
          status: { in: ['SUBMITTED', 'ACCEPTED', 'ANSWERED_LIVE', 'ANSWERED_FOLLOWUP'] },
        },
      }),
      prisma.telegramCampaignParticipant.count({
        where: {
          campaignId: config.campaignId,
          xp: { gt: participant.xp },
        },
      }),
      prisma.telegramCampaignParticipant.count({
        where: {
          campaignId: config.campaignId,
          referredByParticipantId: participant.id,
          referralQualifiedAt: { not: null },
        },
      }),
    ]);
    return {
      ...participant,
      questions,
      rank: rankAhead + 1,
      qualifiedReferrals,
    };
  }

  async function dmAudience(stage) {
    const users = await prisma.user.findMany({
      where: { telegramId: { not: null } },
      select: {
        telegramId: true,
        telegramUsername: true,
      },
    });
    const excluded = new Set([
      ...config.dmExcludedTelegramIds,
      ...config.operatorTelegramIds,
      config.speakerTelegramId,
    ].filter(Boolean).map(String));
    const eligibleUsers = users.filter(
      (user) => user.telegramId && !excluded.has(String(user.telegramId)),
    );
    if (eligibleUsers.length === 0) return [];

    const existingParticipants = await prisma.telegramCampaignParticipant.findMany({
      where: {
        campaignId: config.campaignId,
        telegramId: { in: eligibleUsers.map((user) => String(user.telegramId)) },
      },
    });
    const participantByTelegramId = new Map(
      existingParticipants.map((participant) => [participant.telegramId, participant]),
    );
    const successKeyByParticipantId = new Map(
      existingParticipants.map((participant) => [
        participant.id,
        eventKey([config.campaignId, 'ama_dm_send_success', stage, participant.id]),
      ]),
    );
    const successfulEvents = successKeyByParticipantId.size
      ? await prisma.telegramCampaignEvent.findMany({
        where: {
          eventKey: { in: [...successKeyByParticipantId.values()] },
        },
        select: { eventKey: true },
      })
      : [];
    const successfulKeys = new Set(successfulEvents.map((event) => event.eventKey));

    return eligibleUsers
      .map((user) => {
        const telegramId = String(user.telegramId);
        const participant = participantByTelegramId.get(telegramId);
        return {
          telegramId,
          telegramUsername: user.telegramUsername,
          participant,
        };
      })
      .filter(({ participant }) => (
        !participant?.dmOptOutAt
        && !(participant && successfulKeys.has(successKeyByParticipantId.get(participant.id)))
      ));
  }

  async function beginDm(recipient, stage) {
    const participant = recipient.participant || await ensureParticipant({
      id: recipient.telegramId,
      username: recipient.telegramUsername,
    });
    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_dm_send_attempt',
      source: `quizbot_dm_${stage}`,
      payload: { stage },
    });
    return participant;
  }

  async function markDmSuccess(participant, stage) {
    const sentAt = now();
    await prisma.telegramCampaignParticipant.update({
      where: { id: participant.id },
      data: {
        lastDmAt: sentAt,
        dmFailureCount: 0,
      },
    });
    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_dm_send_success',
      dedupeKey: eventKey([
        config.campaignId,
        'ama_dm_send_success',
        stage,
        participant.id,
      ]),
      source: `quizbot_dm_${stage}`,
      payload: { stage },
    });
  }

  async function markDmFailure(participant, stage, reason = 'telegram_send_error') {
    await prisma.telegramCampaignParticipant.update({
      where: { id: participant.id },
      data: { dmFailureCount: { increment: 1 } },
    });
    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_dm_failed',
      source: `quizbot_dm_${stage}`,
      payload: { stage, reason },
    });
  }

  async function unsubscribeDm(from) {
    const participant = await ensureParticipant(from);
    await prisma.telegramCampaignParticipant.update({
      where: { id: participant.id },
      data: { dmOptOutAt: now() },
    });
    await recordEvent({
      participantId: participant.id,
      eventType: 'ama_dm_unsubscribed',
      dedupeKey: eventKey([config.campaignId, 'ama_dm_unsubscribed', participant.id]),
      source: 'telegram_button',
    });
    return participant;
  }

  async function ensurePreparedQuestionShells() {
    await prisma.amaPreparedQuestion.createMany({
      data: PREPARED_QUESTIONS.slice(0, config.preparedQuestionCount).map((question) => ({
        campaignId: config.campaignId,
        ...question,
      })),
      skipDuplicates: true,
    });
  }

  async function setApprovedAnswer(position, approvedAnswerEn) {
    const answer = String(approvedAnswerEn || '').trim();
    if (!answer) throw new TypeError('Approved English answer is required');
    return prisma.amaPreparedQuestion.update({
      where: {
        campaignId_position: {
          campaignId: config.campaignId,
          position,
        },
      },
      data: {
        approvedAnswerEn: answer,
        status: 'APPROVED',
        approvedAt: now(),
      },
    });
  }

  async function preparedStatus() {
    await ensurePreparedQuestionShells();
    const questions = await prisma.amaPreparedQuestion.findMany({
      where: { campaignId: config.campaignId },
      orderBy: { position: 'asc' },
    });
    const coreQuestions = questions.filter(
      (question) => question.position <= config.preparedQuestionCount,
    );
    const lightningQuestions = questions.filter(
      (question) => question.position > config.preparedQuestionCount,
    );
    return {
      questions,
      coreQuestions,
      lightningQuestions,
      ready: coreQuestions.length === config.preparedQuestionCount
        && coreQuestions.every((question) => Boolean(question.approvedAnswerEn)),
    };
  }

  async function shortlistQuestions(limit = 10) {
    const candidates = await prisma.amaQuestion.findMany({
      where: {
        campaignId: config.campaignId,
        status: 'ACCEPTED',
      },
      include: { livePreparedQuestion: true },
      orderBy: { createdAt: 'asc' },
      take: Math.max(limit * 2, limit),
    });
    return candidates
      .filter((question) => !question.livePreparedQuestion)
      .slice(0, limit);
  }

  async function questionPackCandidates(limit = 100) {
    return prisma.amaQuestion.findMany({
      where: {
        campaignId: config.campaignId,
        status: { in: ['ACCEPTED', 'ANSWERED_LIVE', 'ANSWERED_FOLLOWUP'] },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async function saveQuestionPack(contentEn, questions) {
    const content = String(contentEn || '').trim();
    if (!content) throw new TypeError('Question pack content is required');
    const sourceQuestionIds = questions.map((question) => question.id);
    const latest = await prisma.amaQuestionPack.findFirst({
      where: { campaignId: config.campaignId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const pack = await prisma.amaQuestionPack.create({
      data: {
        campaignId: config.campaignId,
        version: (latest?.version || 0) + 1,
        questionCount: questions.length,
        sourceQuestionIds,
        contentEn: content,
      },
    });
    await recordSystemEvent('ama_question_pack_generated', {
      dedupeRef: pack.id,
      payload: {
        packId: pack.id,
        version: pack.version,
        questionCount: pack.questionCount,
      },
    });
    return pack;
  }

  async function latestQuestionPack() {
    return prisma.amaQuestionPack.findFirst({
      where: { campaignId: config.campaignId },
      orderBy: { version: 'desc' },
    });
  }

  async function selectLightningQuestion(questionId, questionEn) {
    const translatedQuestion = String(questionEn || '').replace(/\s+/g, ' ').trim();
    if (!translatedQuestion) throw new TypeError('English question translation is required');

    const sourceQuestion = await prisma.amaQuestion.findFirst({
      where: {
        id: questionId,
        campaignId: config.campaignId,
        status: 'ACCEPTED',
      },
    });
    if (!sourceQuestion) throw new Error('Accepted AMA question not found');

    const existing = await prisma.amaPreparedQuestion.findUnique({
      where: { sourceQuestionId: sourceQuestion.id },
    });
    if (existing) return { selected: false, question: existing };

    const selectedCount = await prisma.amaPreparedQuestion.count({
      where: {
        campaignId: config.campaignId,
        position: { gt: config.preparedQuestionCount },
      },
    });
    if (selectedCount >= config.lightningQuestionCount) {
      throw new Error('Lightning question limit reached');
    }

    const question = await prisma.amaPreparedQuestion.create({
      data: {
        campaignId: config.campaignId,
        position: config.preparedQuestionCount + selectedCount + 1,
        topic: 'Community',
        questionKo: sourceQuestion.questionText,
        questionEn: translatedQuestion,
        sourceQuestionId: sourceQuestion.id,
        answerMode: 'LIVE_FREEFORM',
        status: 'APPROVED',
        approvedAt: now(),
      },
    });
    await recordSystemEvent('ama_lightning_question_selected', {
      dedupeRef: sourceQuestion.id,
      payload: { position: question.position, questionId: sourceQuestion.id },
    });
    return { selected: true, question };
  }

  async function ensureSession() {
    return prisma.amaSession.upsert({
      where: { campaignId: config.campaignId },
      create: {
        campaignId: config.campaignId,
        chatId: config.chatId,
        speakerTelegramId: config.speakerTelegramId,
      },
      update: {
        chatId: config.chatId,
        speakerTelegramId: config.speakerTelegramId,
      },
    });
  }

  async function markFrozen(savedPermissions) {
    const session = await prisma.amaSession.upsert({
      where: { campaignId: config.campaignId },
      create: {
        campaignId: config.campaignId,
        chatId: config.chatId,
        speakerTelegramId: config.speakerTelegramId,
        status: 'FROZEN',
        savedPermissions,
        frozenAt: now(),
      },
      update: {
        status: 'FROZEN',
        savedPermissions,
        frozenAt: now(),
        restoredAt: null,
      },
    });
    await recordSystemEvent('ama_room_frozen', { dedupeRef: session.frozenAt.toISOString() });
    return session;
  }

  async function markLive(pinnedMessageId) {
    const session = await prisma.amaSession.update({
      where: { campaignId: config.campaignId },
      data: {
        status: 'LIVE',
        pinnedMessageId: pinnedMessageId ? String(pinnedMessageId) : undefined,
        startedAt: now(),
      },
    });
    return session;
  }

  async function markOpenFloor() {
    const openedAt = now();
    const sessionRecord = await prisma.amaSession.update({
      where: { campaignId: config.campaignId },
      data: {
        status: 'OPEN_FLOOR',
        openFloorStartedAt: openedAt,
        openFloorEndedAt: null,
        openFloorQuestionCount: 0,
      },
    });
    await recordSystemEvent('ama_open_floor_started', {
      dedupeRef: openedAt.toISOString(),
    });
    return sessionRecord;
  }

  async function recordOpenFloorQuestion(question, participantId) {
    await prisma.amaSession.update({
      where: { campaignId: config.campaignId },
      data: { openFloorQuestionCount: { increment: 1 } },
    });
    await recordEvent({
      participantId,
      eventType: 'ama_open_floor_question',
      dedupeKey: eventKey([config.campaignId, 'ama_open_floor_question', question.id]),
      source: 'ama_room_open_floor',
      payload: { questionId: question.id },
    });
  }

  async function markOpenFloorClosed() {
    const endedAt = now();
    const sessionRecord = await prisma.amaSession.update({
      where: { campaignId: config.campaignId },
      data: {
        status: 'LIVE',
        openFloorEndedAt: endedAt,
      },
    });
    await recordSystemEvent('ama_open_floor_ended', {
      dedupeRef: endedAt.toISOString(),
      payload: { questionCount: sessionRecord.openFloorQuestionCount },
    });
    return sessionRecord;
  }

  async function nextPreparedQuestion() {
    const session = await ensureSession();
    const nextPosition = session.currentPosition + 1;
    return prisma.amaPreparedQuestion.findUnique({
      where: {
        campaignId_position: {
          campaignId: config.campaignId,
          position: nextPosition,
        },
      },
    });
  }

  async function markQuestionPosted(question, messageId) {
    const postedMessageId = String(messageId);
    await prisma.$transaction([
      prisma.amaPreparedQuestion.update({
        where: { id: question.id },
        data: {
          status: 'POSTED',
          postedMessageId,
        },
      }),
      prisma.amaSession.update({
        where: { campaignId: config.campaignId },
        data: {
          currentPosition: question.position,
          currentQuestionMessageId: postedMessageId,
        },
      }),
    ]);
    await recordSystemEvent('ama_question_posted', {
      dedupeRef: question.id,
      payload: { position: question.position },
    });
  }

  async function preparedQuestionForReply(replyMessageId) {
    return prisma.amaPreparedQuestion.findFirst({
      where: {
        campaignId: config.campaignId,
        postedMessageId: String(replyMessageId),
      },
    });
  }

  async function preparedQuestionForAnswer(answerMessageId) {
    return prisma.amaPreparedQuestion.findFirst({
      where: {
        campaignId: config.campaignId,
        answerMessageId: String(answerMessageId),
      },
    });
  }

  async function markAnswerReceived(question, answerMessageId) {
    const receivedAt = now();
    const updated = await prisma.amaPreparedQuestion.update({
      where: { id: question.id },
      data: {
        status: 'ANSWERED',
        answerMessageId: String(answerMessageId),
        answerReceivedAt: receivedAt,
      },
    });
    await recordSystemEvent('ama_answer_received_en', {
      dedupeRef: question.id,
      payload: { position: question.position },
    });
    return updated;
  }

  async function markTranslated(question, translationMessageId) {
    const translatedAt = now();
    const translationLatencyMs = question.answerReceivedAt
      ? Math.max(0, translatedAt.getTime() - question.answerReceivedAt.getTime())
      : null;
    const updates = [
      prisma.amaPreparedQuestion.update({
        where: { id: question.id },
        data: {
          status: 'TRANSLATED',
          translationMessageId: String(translationMessageId),
          translatedAt,
          translationLatencyMs,
        },
      }),
    ];
    if (question.sourceQuestionId) {
      updates.push(prisma.amaQuestion.update({
        where: { id: question.sourceQuestionId },
        data: {
          status: 'ANSWERED_LIVE',
          answeredAt: now(),
        },
      }));
    }
    const [updated] = await prisma.$transaction(updates);
    await recordSystemEvent('ama_answer_translated_ko', {
      dedupeRef: question.id,
      payload: { position: question.position, translationLatencyMs },
    });
    if (question.sourceQuestionId) {
      await recordSystemEvent('ama_question_answered_live', {
        dedupeRef: question.sourceQuestionId,
        payload: { questionId: question.sourceQuestionId },
      });
    }
    return updated;
  }

  async function markTranslationFailed(question, reason = 'translation_error') {
    await prisma.amaPreparedQuestion.update({
      where: { id: question.id },
      data: { status: 'FAILED' },
    });
    await recordSystemEvent('ama_translation_failed', {
      payload: { position: question.position, reason },
    });
  }

  async function session() {
    return ensureSession();
  }

  async function markRestored() {
    const sessionRecord = await prisma.amaSession.update({
      where: { campaignId: config.campaignId },
      data: {
        status: 'RESTORED',
        restoredAt: now(),
      },
    });
    await recordSystemEvent('ama_room_restored', {
      dedupeRef: sessionRecord.restoredAt.toISOString(),
    });
    return sessionRecord;
  }

  return {
    ensureParticipant,
    recordEvent,
    recordSystemEvent,
    attachReferral,
    markCommunityJoined,
    submitQuestion,
    liveCheckin,
    participantStatus,
    dmAudience,
    beginDm,
    markDmSuccess,
    markDmFailure,
    unsubscribeDm,
    ensurePreparedQuestionShells,
    setApprovedAnswer,
    preparedStatus,
    shortlistQuestions,
    questionPackCandidates,
    saveQuestionPack,
    latestQuestionPack,
    selectLightningQuestion,
    ensureSession,
    markFrozen,
    markLive,
    markOpenFloor,
    recordOpenFloorQuestion,
    markOpenFloorClosed,
    nextPreparedQuestion,
    markQuestionPosted,
    preparedQuestionForReply,
    preparedQuestionForAnswer,
    markAnswerReceived,
    markTranslated,
    markTranslationFailed,
    session,
    markRestored,
  };
}

export const AMA_PREPARED_QUESTIONS = PREPARED_QUESTIONS;
