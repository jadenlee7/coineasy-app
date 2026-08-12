import { isAmaOperator, isWithinAmaWindow } from './ama-config.js';

export const AMA_FROZEN_PERMISSIONS = Object.freeze({
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false,
});

export const AMA_OPEN_FLOOR_PERMISSIONS = Object.freeze({
  can_send_messages: true,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false,
});

function memberIsPresent(member) {
  if (!member) return false;
  if (['creator', 'administrator', 'member'].includes(member.status)) return true;
  return member.status === 'restricted' && member.is_member !== false;
}

export function memberIsAdmin(member) {
  return Boolean(member && ['creator', 'administrator'].includes(member.status));
}

export function botHasAdminRight(member, right) {
  if (member?.status === 'creator') return true;
  return member?.status === 'administrator' && member[right] === true;
}

export function normalizeApprovedScript(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function telegramTextChunks(value, maximum = 3500) {
  const remaining = [];
  let text = String(value || '').trim();
  while (text.length > maximum) {
    let boundary = text.lastIndexOf('\n', maximum);
    if (boundary < maximum * 0.6) boundary = text.lastIndexOf(' ', maximum);
    if (boundary < maximum * 0.6) boundary = maximum;
    remaining.push(text.slice(0, boundary).trim());
    text = text.slice(boundary).trim();
  }
  if (text) remaining.push(text);
  return remaining;
}

function questionPrompt(config, botUsername) {
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=ama_question` : undefined;
  return {
    text: [
      'AMA 질문을 보내주세요.',
      `한 사람당 최대 ${config.questionLimit}개까지 등록할 수 있습니다.`,
      '가격 전망·수익 보장·투자 조언 질문은 제외됩니다.',
      '',
      '예시: /ama Squid 앱에서 다음으로 준비 중인 기능은 무엇인가요?',
    ].join('\n'),
    deepLink,
  };
}

function welcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '✅ 1. 입장 확인', callback_data: 'ama:verify' }],
      [
        { text: '💬 2. 질문 남기기', callback_data: 'ama:question' },
        { text: '👥 3. 친구 초대', callback_data: 'ama:invite' },
      ],
      [
        { text: '⭐ 내 XP', callback_data: 'ama:status' },
        { text: '📣 AMA 방', callback_data: 'ama:room' },
      ],
      [{ text: 'AMA DM 알림 중지', callback_data: 'ama:unsubscribe' }],
    ],
  };
}

function liveKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '✅ 라이브 체크인', callback_data: 'ama:checkin' }],
      [{ text: '⭐ 내 XP 확인', callback_data: 'ama:status' }],
    ],
  };
}

const AMA_DM_STAGES = new Set(['announcement', 'postlaunch', 'day', 't60', 'recap']);

export function amaDmMessage(stage) {
  const messages = {
    announcement: [
      '[Squid Korea LIVE AMA]',
      '',
      '8월 5일(수) 저녁 8시, Squid의 Fig에게 직접 질문해 보세요.',
      '',
      '1. AMA 방 입장',
      '2. 질문 남기기',
      '3. 친구 초대하기',
      '',
      '유효 질문은 +20 XP, 라이브 중에는 3분간 직접 질문할 수 있습니다.',
    ],
    postlaunch: [
      '$QUID가 공식 라이브되었습니다.',
      '',
      '내일 저녁 8시 Squid Korea AMA에서 Fig에게 제품과 토큰의 다음 단계에 대해 질문해 보세요.',
      '질문: /ama 질문내용',
    ],
    day: [
      '오늘 저녁 8시, Squid Korea AMA가 시작됩니다.',
      '',
      'Fig의 영어 답변은 Quiz Bot이 자연스러운 한국어로 바로 전달합니다.',
      '미리 질문을 남기거나 AMA 소통방에 입장해 주세요.',
    ],
    t60: [
      'Squid Korea AMA가 1시간 뒤 시작됩니다.',
      '',
      '오늘 저녁 8시, Telegram에서 만나요.',
    ],
    recap: [
      'Squid Korea AMA가 종료되었습니다.',
      '',
      '참여해 주셔서 감사합니다. 커뮤니티에서 한국어 리캡과 후속 답변을 확인해 주세요.',
    ],
  };
  return messages[stage]?.join('\n');
}

function dmKeyboard(stage) {
  const rows = [[{ text: 'AMA 소통방', callback_data: 'ama:room' }]];
  if (!['recap'].includes(stage)) {
    rows.push([
      { text: '질문 남기기', callback_data: 'ama:question' },
      { text: '친구 초대', callback_data: 'ama:invite' },
    ]);
    rows.push([{ text: '내 XP', callback_data: 'ama:status' }]);
  }
  rows.push([{ text: 'AMA DM 알림 중지', callback_data: 'ama:unsubscribe' }]);
  return { inline_keyboard: rows };
}

function formatStatus(status, config) {
  const joined = status.communityJoinedAt ? '확인 완료' : '확인 필요';
  return [
    'Squid Korea AMA 참여 현황',
    '',
    `커뮤니티 입장: ${joined}`,
    `등록 질문: ${status.questions} / ${config.questionLimit}`,
    `확인된 친구 초대: ${status.qualifiedReferrals}`,
    `AMA XP: ${status.xp}`,
    `래플 엔트리: ${status.raffleEntries}`,
    `현재 순위: #${status.rank}`,
  ].join('\n');
}

function formatQuestionResult(result, config) {
  if (result.status === 'ACCEPTED') {
    const xp = result.reward?.awarded ? `+${config.questionXp} XP` : '이미 XP 반영 완료';
    return `질문이 등록되었습니다. (${xp})`;
  }
  if (result.status === 'DUPLICATE') {
    return '이미 등록된 질문과 같습니다. 다른 질문을 보내주세요.';
  }
  if (result.reason === 'question_limit') {
    return `질문은 한 사람당 최대 ${config.questionLimit}개까지 등록할 수 있습니다.`;
  }
  if (result.reason === 'price_or_financial_advice') {
    return '가격 전망·수익 보장·투자 조언 질문은 받을 수 없습니다. 제품과 생태계 중심으로 다시 작성해 주세요.';
  }
  return '질문은 5자 이상 1,000자 이하로 작성해 주세요.';
}

function formatPreparedStatus(status, expectedCount) {
  const coreQuestions = status.coreQuestions
    || status.questions.filter((question) => question.position <= expectedCount);
  const lightningQuestions = status.lightningQuestions
    || status.questions.filter((question) => question.position > expectedCount);
  const lines = coreQuestions.map((question) => (
    `Q${question.position} · ${question.approvedAnswerEn ? '승인 완료' : '영문 답변 필요'}`
  ));
  return [
    `승인 스크립트: ${coreQuestions.filter((item) => item.approvedAnswerEn).length}/${expectedCount}`,
    ...lines,
    `라이트닝 질문 선택: ${lightningQuestions.length}`,
  ].join('\n');
}

function preflightText(checks) {
  const marker = (ready) => (ready ? '✅' : '⛔');
  return [
    'Squid Korea AMA preflight',
    '',
    `${marker(checks.figAdmin)} Fig: @squid_kor 입장 + 관리자`,
    `${marker(checks.restrict)} Quiz Bot: restrict 권한`,
    `${marker(checks.promote)} Quiz Bot: promote 권한`,
    `${marker(checks.pin)} Quiz Bot: pin 권한`,
    `${marker(checks.permissionsRestorable)} 현재 방 권한 저장 가능`,
    `${marker(checks.scriptsReady)} 승인된 영문 답변: ${checks.approvedScripts}/${checks.expectedScripts}`,
    `${marker(checks.translationReady)} 영→한 자동 번역`,
    `${marker(checks.scheduleReady)} AMA 시작·종료 시간`,
    '',
    checks.ready ? 'GO · AMA 운영 준비 완료' : 'HOLD · ⛔ 항목을 먼저 해결해 주세요.',
    '',
    'Fig는 사전 관리자로 유지됩니다. Bot은 Fig 권한을 변경하거나 회수하지 않습니다.',
  ].join('\n');
}

function operatorOnly(config, msg) {
  return isAmaOperator(config, msg?.from?.id);
}

export function createTelegramAmaController({
  bot,
  service,
  translator,
  config,
  appLogger,
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let botUsername = config.botUsername;
  let restoreTimer;
  let restoreInFlight;
  const runningDmStages = new Set();

  function logError(error, message) {
    appLogger?.error?.({ errorType: error?.name || 'Error' }, message);
  }

  async function notifyOperators(text) {
    await Promise.allSettled(
      config.operatorTelegramIds.map((operatorId) => bot.sendMessage(operatorId, text)),
    );
  }

  async function sendKoreanTranslation(answerMessageId, translation) {
    const chunks = telegramTextChunks(`🇰🇷 한국어 번역\n\n${translation}`);
    let firstMessage;
    for (const [index, chunk] of chunks.entries()) {
      const sent = await bot.sendMessage(
        config.chatId,
        chunk,
        index === 0 ? { reply_to_message_id: answerMessageId } : undefined,
      );
      if (!firstMessage) firstMessage = sent;
    }
    return firstMessage;
  }

  async function answerCallback(query, text) {
    try {
      await bot.answerCallbackQuery(query.id, text ? { text } : undefined);
    } catch (error) {
      logError(error, 'AMA callback acknowledgement failed');
    }
  }

  async function membership(userId) {
    const member = await bot.getChatMember(config.chatId, userId);
    return { member, present: memberIsPresent(member) };
  }

  async function runPreflight() {
    const [me, chat, botMember, figMember, prepared] = await Promise.all([
      bot.getMe(),
      bot.getChat(config.chatId),
      bot.getMe().then((self) => bot.getChatMember(config.chatId, self.id)),
      bot.getChatMember(config.chatId, config.speakerTelegramId),
      service.preparedStatus(),
    ]);

    if (!botUsername && me?.username) botUsername = me.username;
    const checks = {
      figAdmin: memberIsAdmin(figMember),
      restrict: botHasAdminRight(botMember, 'can_restrict_members'),
      promote: botHasAdminRight(botMember, 'can_promote_members'),
      pin: botHasAdminRight(botMember, 'can_pin_messages'),
      permissionsRestorable: Boolean(chat?.permissions),
      approvedScripts: (prepared.coreQuestions || prepared.questions)
        .filter((item) => item.approvedAnswerEn).length,
      expectedScripts: config.preparedQuestionCount,
      scriptsReady: prepared.ready,
      translationReady: translator.configured(),
      scheduleReady: Boolean(config.startAt && config.endAt && config.startAt < config.endAt),
    };
    checks.ready = Object.entries(checks)
      .filter(([key]) => !['approvedScripts', 'expectedScripts'].includes(key))
      .every(([, value]) => value === true);

    if (checks.figAdmin) {
      await service.recordSystemEvent('ama_speaker_registered', {
        dedupeRef: config.speakerTelegramId,
        payload: { preExistingAdmin: true },
      });
    }
    return { checks, chat };
  }

  async function restoreRoom(source = 'operator') {
    if (restoreInFlight) return restoreInFlight;
    restoreInFlight = (async () => {
      const session = await service.session();
      if (!['FROZEN', 'LIVE', 'OPEN_FLOOR', 'FAILED'].includes(session.status)) return false;
      if (!session.savedPermissions) {
        await notifyOperators('⛔ AMA 방 복구 실패: 저장된 이전 권한이 없습니다. Telegram에서 수동 확인이 필요합니다.');
        return false;
      }
      await bot.setChatPermissions(
        config.chatId,
        session.savedPermissions,
        { use_independent_chat_permissions: true },
      );
      await service.markRestored();
      await service.recordSystemEvent('ama_room_restore_triggered', { source });
      return true;
    })();

    try {
      return await restoreInFlight;
    } finally {
      restoreInFlight = undefined;
    }
  }

  function scheduleFailsafeRestore() {
    if (restoreTimer) clearTimer(restoreTimer);
    if (!config.restoreAt) return;
    const delay = config.restoreAt.getTime() - now().getTime();
    if (delay <= 0) {
      restoreRoom('failsafe_overdue').catch((error) => {
        logError(error, 'AMA overdue room restore failed');
      });
      return;
    }
    restoreTimer = setTimer(() => {
      restoreRoom('failsafe_timer').catch((error) => {
        logError(error, 'AMA failsafe room restore failed');
      });
    }, delay);
    restoreTimer?.unref?.();
  }

  async function initialize() {
    await service.ensurePreparedQuestionShells();
    const [session, me] = await Promise.all([service.ensureSession(), bot.getMe()]);
    if (!botUsername && me?.username) botUsername = me.username;
    if (['FROZEN', 'LIVE', 'OPEN_FLOOR', 'FAILED'].includes(session.status)) {
      scheduleFailsafeRestore();
    }
  }

  async function handleStart(msg, payload) {
    const referralMatch = String(payload || '').match(/^ref_([a-f0-9]{12})$/i);
    const referral = referralMatch
      ? await service.attachReferral(msg.from, referralMatch[1], 'telegram_referral_link')
      : undefined;
    const participant = referral?.participant || await service.ensureParticipant(msg.from);
    await service.recordEvent({
      participantId: participant.id,
      eventType: 'ama_cta_click',
      source: payload || 'telegram_start',
    });
    await bot.sendMessage(
      msg.chat.id,
      [
        'Squid Korea AMA에 오신 것을 환영합니다.',
        '',
        '아래 3단계만 완료하면 됩니다.',
        '1. 커뮤니티 입장 확인',
        '2. 궁금한 질문 남기기',
        '3. 친구 초대하기',
        '',
        '라이브 체크인과 유효 질문에는 AMA XP가 반영됩니다.',
      ].join('\n'),
      { reply_markup: welcomeKeyboard() },
    );
    return true;
  }

  async function handleQuestionCommand(msg, questionText) {
    if (msg.chat.type !== 'private') {
      const prompt = questionPrompt(config, botUsername);
      await bot.sendMessage(
        msg.chat.id,
        prompt.deepLink
          ? `질문은 개인정보 보호를 위해 Bot DM으로 받습니다.\n${prompt.deepLink}`
          : '질문은 개인정보 보호를 위해 Bot DM에서 /ama 명령으로 보내주세요.',
      );
      return;
    }

    const status = await service.participantStatus(msg.from);
    if (!status.communityJoinedAt) {
      await bot.sendMessage(
        msg.chat.id,
        '먼저 Squid Korea 커뮤니티 입장을 확인해 주세요.',
        { reply_markup: { inline_keyboard: [[{ text: '✅ 입장 확인', callback_data: 'ama:verify' }]] } },
      );
      return;
    }

    if (!String(questionText || '').trim()) {
      await bot.sendMessage(msg.chat.id, questionPrompt(config, botUsername).text);
      return;
    }

    const result = await service.submitQuestion(msg.from, questionText);
    await bot.sendMessage(msg.chat.id, formatQuestionResult(result, config));
  }

  async function handleCallback(query) {
    const action = query.data;
    if (!action?.startsWith('ama:')) return;
    await answerCallback(query);
    const chatId = query.message?.chat?.id || query.from.id;
    const responseChatId = query.message?.chat?.type === 'private'
      ? chatId
      : query.from.id;

    try {
      if (action === 'ama:room') {
        const participant = await service.ensureParticipant(query.from);
        await service.recordEvent({
          participantId: participant.id,
          eventType: 'ama_room_click',
          source: 'telegram_button',
        });
        await bot.sendMessage(responseChatId, 'Squid Korea 커뮤니티에서 AMA에 참여하세요.', {
          reply_markup: {
            inline_keyboard: [[{ text: 'Squid Korea 열기', url: config.roomUrl }]],
          },
        });
        return;
      }

      if (action === 'ama:verify') {
        const result = await membership(query.from.id);
        if (!result.present) {
          await bot.sendMessage(responseChatId, '아직 입장이 확인되지 않았습니다. 커뮤니티에 입장한 뒤 다시 눌러주세요.', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Squid Korea 입장', url: config.roomUrl }],
                [{ text: '✅ 다시 확인', callback_data: 'ama:verify' }],
              ],
            },
          });
          return;
        }
        await service.markCommunityJoined(query.from);
        await bot.sendMessage(responseChatId, '커뮤니티 입장이 확인되었습니다. 이제 AMA 질문을 등록할 수 있습니다.', {
          reply_markup: {
            inline_keyboard: [[
              { text: '💬 질문 제출', callback_data: 'ama:question' },
              { text: '👥 친구 초대', callback_data: 'ama:invite' },
            ]],
          },
        });
        return;
      }

      if (action === 'ama:invite') {
        const participant = await service.ensureParticipant(query.from);
        if (!participant.communityJoinedAt) {
          await bot.sendMessage(responseChatId, '친구 초대 전에 Squid Korea 입장을 먼저 확인해 주세요.', {
            reply_markup: {
              inline_keyboard: [[{ text: '✅ 입장 확인', callback_data: 'ama:verify' }]],
            },
          });
          return;
        }
        const inviteLink = botUsername && participant.referralCode
          ? `https://t.me/${botUsername}?start=ref_${participant.referralCode}`
          : undefined;
        if (!inviteLink) {
          await bot.sendMessage(responseChatId, '초대 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
          return;
        }
        const shareText = 'Squid Korea AMA에 함께 참여하고 Fig에게 궁금한 점을 남겨보세요.';
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
        await service.recordEvent({
          participantId: participant.id,
          eventType: 'ama_referral_link_created',
          source: 'telegram_button',
        });
        await bot.sendMessage(
          responseChatId,
          [
            '친구가 아래 링크로 Bot을 시작하고 Squid Korea 입장을 확인하면 초대가 완료됩니다.',
            `확인된 친구 1명당 +${config.qualifiedReferralXp} XP · 최대 ${config.qualifiedReferralLimit}명`,
            '',
            inviteLink,
          ].join('\n'),
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Telegram으로 공유', url: shareUrl }]],
            },
          },
        );
        return;
      }

      if (action === 'ama:unsubscribe') {
        await service.unsubscribeDm(query.from);
        await bot.sendMessage(responseChatId, 'AMA 관련 Quiz Bot DM 알림을 중지했습니다.');
        return;
      }

      if (action === 'ama:question') {
        const prompt = questionPrompt(config, botUsername);
        if (query.message?.chat?.type === 'private') {
          await bot.sendMessage(responseChatId, prompt.text);
        } else if (prompt.deepLink) {
          await bot.sendMessage(responseChatId, `Bot DM에서 질문을 등록해 주세요.\n${prompt.deepLink}`);
        }
        return;
      }

      if (action === 'ama:status') {
        await bot.sendMessage(responseChatId, formatStatus(
          await service.participantStatus(query.from),
          config,
        ));
        return;
      }

      if (action === 'ama:checkin') {
        const session = await service.session();
        if (!['LIVE', 'OPEN_FLOOR'].includes(session.status) || !isWithinAmaWindow(config, now())) {
          await bot.sendMessage(responseChatId, '라이브 체크인은 AMA 진행 시간에만 열립니다.');
          return;
        }
        const result = await membership(query.from.id);
        if (!result.present) {
          await bot.sendMessage(responseChatId, 'Squid Korea 커뮤니티 입장을 먼저 확인해 주세요.');
          return;
        }
        await service.markCommunityJoined(query.from, 'live_checkin');
        const checkin = await service.liveCheckin(query.from);
        const message = checkin.reward.awarded
          ? `라이브 체크인 완료 · +${config.liveCheckinXp} XP`
          : '라이브 체크인은 이미 반영되었습니다.';
        await bot.sendMessage(responseChatId, message);
      }
    } catch (error) {
      logError(error, 'AMA callback failed');
      await bot.sendMessage(responseChatId, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function requireOperator(msg) {
    if (operatorOnly(config, msg)) return true;
    await bot.sendMessage(msg.chat.id, '이 명령은 등록된 AMA 운영자만 사용할 수 있습니다.');
    return false;
  }

  async function handlePreflight(msg) {
    if (!await requireOperator(msg)) return;
    try {
      const { checks } = await runPreflight();
      await bot.sendMessage(msg.chat.id, preflightText(checks));
    } catch (error) {
      logError(error, 'AMA preflight failed');
      await bot.sendMessage(msg.chat.id, '⛔ Preflight 실행 실패. Bot 토큰, chat ID, Fig user ID와 관리자 설정을 확인해 주세요.');
    }
  }

  async function handleScriptSet(msg, positionText, inlineAnswer) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, '승인 스크립트는 공개 전 정보이므로 Bot 개인 DM에서 등록해 주세요.');
      return;
    }
    const position = Number.parseInt(positionText, 10);
    if (!Number.isInteger(position) || position < 1 || position > config.preparedQuestionCount) {
      await bot.sendMessage(msg.chat.id, `질문 번호는 1–${config.preparedQuestionCount} 사이여야 합니다.`);
      return;
    }
    const answer = String(inlineAnswer || msg.reply_to_message?.text || '').trim();
    if (!answer) {
      await bot.sendMessage(msg.chat.id, `사용법: 승인된 영문 답변 메시지에 답장하며 /ama_script_set ${position}`);
      return;
    }
    if (answer.length > 3000) {
      await bot.sendMessage(msg.chat.id, '영문 답변은 라이브 게시를 위해 3,000자 이하로 정리해 주세요.');
      return;
    }
    await service.setApprovedAnswer(position, answer);
    await bot.sendMessage(msg.chat.id, `Q${position} 승인 영문 답변이 저장되었습니다.`);
  }

  async function handleScriptStatus(msg) {
    if (!await requireOperator(msg)) return;
    const status = await service.preparedStatus();
    await bot.sendMessage(msg.chat.id, formatPreparedStatus(status, config.preparedQuestionCount));
  }

  async function handleDmPreview(msg, stage) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, 'DM 대상 확인은 Bot 개인 DM에서 실행해 주세요.');
      return;
    }
    if (!AMA_DM_STAGES.has(stage)) {
      await bot.sendMessage(msg.chat.id, `단계: ${[...AMA_DM_STAGES].join(', ')}`);
      return;
    }
    const audience = await service.dmAudience(stage);
    await bot.sendMessage(
      msg.chat.id,
      [
        `AMA DM preview · ${stage}`,
        `발송 가능 대상: ${audience.length}`,
        '',
        `실행: /ama_dm_send ${stage} CONFIRM`,
        '같은 단계의 발송 성공 대상은 자동 제외됩니다.',
      ].join('\n'),
    );
  }

  function dmFailureReason(error) {
    const code = error?.response?.body?.error_code;
    if (code === 403) return 'blocked_or_unavailable';
    if (code === 400) return 'invalid_or_inactive_chat';
    if (code === 429) return 'telegram_rate_limit';
    return 'telegram_send_error';
  }

  async function runDmBroadcast(stage, operatorChatId, audience) {
    let success = 0;
    let failed = 0;
    for (const recipient of audience) {
      const participant = await service.beginDm(recipient, stage);
      try {
        await bot.sendMessage(recipient.telegramId, amaDmMessage(stage), {
          reply_markup: dmKeyboard(stage),
        });
        await service.markDmSuccess(participant, stage);
        success += 1;
      } catch (error) {
        await service.markDmFailure(participant, stage, dmFailureReason(error));
        failed += 1;
      }
      await new Promise((resolve) => {
        const timer = setTimer(resolve, config.dmDelayMs);
        timer?.unref?.();
      });
    }
    await bot.sendMessage(
      operatorChatId,
      [
        `AMA DM 완료 · ${stage}`,
        `성공: ${success}`,
        `실패: ${failed}`,
        '실패 원인은 이벤트 로그에 비식별 분류로 기록되었습니다.',
      ].join('\n'),
    );
  }

  async function handleDmSend(msg, stage, confirmation) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, 'DM 발송은 Bot 개인 DM에서만 실행해 주세요.');
      return;
    }
    if (!AMA_DM_STAGES.has(stage) || confirmation !== 'CONFIRM') {
      await bot.sendMessage(
        msg.chat.id,
        '먼저 /ama_dm_preview <stage>로 확인한 뒤 /ama_dm_send <stage> CONFIRM을 실행해 주세요.',
      );
      return;
    }
    if (runningDmStages.has(stage)) {
      await bot.sendMessage(msg.chat.id, '같은 단계의 DM 발송이 이미 진행 중입니다.');
      return;
    }
    const audience = await service.dmAudience(stage);
    runningDmStages.add(stage);
    await bot.sendMessage(msg.chat.id, `AMA DM ${stage} 발송을 시작합니다. 대상 ${audience.length}명.`);
    runDmBroadcast(stage, msg.chat.id, audience)
      .catch(async (error) => {
        logError(error, 'AMA DM broadcast failed');
        await bot.sendMessage(msg.chat.id, `AMA DM ${stage} 발송이 중단되었습니다. 이벤트 로그를 확인해 주세요.`);
      })
      .finally(() => runningDmStages.delete(stage));
  }

  async function handleShortlist(msg) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, '커뮤니티 질문 shortlist는 Bot 개인 DM에서만 확인해 주세요.');
      return;
    }
    const questions = await service.shortlistQuestions(10);
    if (questions.length === 0) {
      await bot.sendMessage(msg.chat.id, '현재 선택 가능한 커뮤니티 질문이 없습니다.');
      return;
    }
    const text = [
      `라이트닝 후보 ${questions.length}개`,
      '',
      ...questions.flatMap((question, index) => [
        `${index + 1}. ${question.questionText.slice(0, 240)}`,
        `ID: ${question.id}`,
        '',
      ]),
      '선택: /ama_lightning_select <question ID>',
    ].join('\n');
    for (const chunk of telegramTextChunks(text)) {
      await bot.sendMessage(msg.chat.id, chunk);
    }
  }

  async function handleQuestionPack(msg, latestOnly = false) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, 'Squid 검토용 질문팩은 Bot 개인 DM에서만 확인해 주세요.');
      return;
    }
    let pack = latestOnly ? await service.latestQuestionPack() : null;
    if (!pack) {
      const questions = await service.questionPackCandidates();
      if (questions.length === 0) {
        await bot.sendMessage(msg.chat.id, '질문팩으로 정리할 유효 질문이 없습니다.');
        return;
      }
      const contentEn = await translator.composeQuestionPack(questions);
      pack = await service.saveQuestionPack(contentEn, questions);
    }
    for (const [index, chunk] of telegramTextChunks(
      `Squid review · AMA question pack v${pack.version}\n\n${pack.contentEn}`,
    ).entries()) {
      await bot.sendMessage(msg.chat.id, chunk);
      if (index === 0) {
        await service.recordSystemEvent('ama_question_pack_shared', {
          source: 'operator_dm',
          dedupeRef: pack.id,
          payload: { packId: pack.id, version: pack.version },
        });
      }
    }
  }

  async function handleLightningSelect(msg, questionId) {
    if (!await requireOperator(msg)) return;
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(msg.chat.id, '라이트닝 질문 선택은 Bot 개인 DM에서 실행해 주세요.');
      return;
    }
    const candidates = await service.shortlistQuestions(50);
    const source = candidates.find((question) => question.id === questionId);
    if (!source) {
      await bot.sendMessage(msg.chat.id, '선택 가능한 질문 ID를 찾지 못했습니다. /ama_shortlist를 다시 확인해 주세요.');
      return;
    }
    const questionEn = await translator.translateQuestionToEnglish(source.questionText);
    const result = await service.selectLightningQuestion(source.id, questionEn);
    await bot.sendMessage(
      msg.chat.id,
      result.selected
        ? [
          `Q${result.question.position} 라이트닝 질문 선택 완료`,
          '',
          `KR: ${result.question.questionKo}`,
          `EN: ${result.question.questionEn}`,
        ].join('\n')
        : `이 질문은 이미 Q${result.question.position}에 선택되어 있습니다.`,
    );
  }

  async function handleFreeze(msg) {
    if (!await requireOperator(msg)) return;
    const session = await service.session();
    if (['FROZEN', 'LIVE', 'OPEN_FLOOR'].includes(session.status)) {
      await bot.sendMessage(msg.chat.id, 'AMA 방은 이미 잠금 상태입니다.');
      return;
    }

    const { checks, chat } = await runPreflight();
    if (!checks.ready) {
      await bot.sendMessage(msg.chat.id, preflightText(checks));
      return;
    }

    await bot.setChatPermissions(
      config.chatId,
      AMA_FROZEN_PERMISSIONS,
      { use_independent_chat_permissions: true },
    );
    try {
      await service.markFrozen(chat.permissions);
      scheduleFailsafeRestore();
      await bot.sendMessage(msg.chat.id, 'AMA 방 잠금 완료. Fig와 관리자는 계속 답변할 수 있습니다.');
    } catch (error) {
      await bot.setChatPermissions(
        config.chatId,
        chat.permissions,
        { use_independent_chat_permissions: true },
      );
      throw error;
    }
  }

  async function handleLive(msg) {
    if (!await requireOperator(msg)) return;
    const session = await service.session();
    if (session.status !== 'FROZEN') {
      await bot.sendMessage(msg.chat.id, '먼저 /ama_freeze로 방을 잠가 주세요.');
      return;
    }
    const announcement = await bot.sendMessage(
      config.chatId,
      [
        'Squid Korea AMA를 시작합니다.',
        '',
        'CoinEasy가 한국어와 영어로 질문을 전달하고, Fig가 영어로 답변합니다.',
        '각 답변 뒤에는 자연스러운 한국어 번역이 바로 이어집니다.',
        '',
        '아래 버튼으로 라이브 체크인해 주세요.',
      ].join('\n'),
      { reply_markup: liveKeyboard() },
    );
    await bot.pinChatMessage(config.chatId, announcement.message_id, { disable_notification: false });
    await service.markLive(announcement.message_id);
    await bot.sendMessage(msg.chat.id, 'AMA GO-LIVE 및 상단 고정 완료.');
  }

  async function handleNext(msg) {
    if (!await requireOperator(msg)) return;
    const session = await service.session();
    if (session.status !== 'LIVE') {
      await bot.sendMessage(msg.chat.id, 'AMA가 LIVE 상태가 아닙니다.');
      return;
    }
    const prepared = await service.preparedStatus();
    if (!prepared.ready) {
      await bot.sendMessage(msg.chat.id, formatPreparedStatus(prepared, config.preparedQuestionCount));
      return;
    }
    if (session.currentPosition > 0) {
      const previous = prepared.questions.find((item) => item.position === session.currentPosition);
      if (previous && previous.status !== 'TRANSLATED') {
        await bot.sendMessage(msg.chat.id, `Q${previous.position} 한국어 번역이 완료된 뒤 다음 질문을 게시해 주세요.`);
        return;
      }
    }
    const question = await service.nextPreparedQuestion();
    if (!question) {
      await bot.sendMessage(msg.chat.id, '준비된 핵심 질문 5개가 모두 게시되었습니다.');
      return;
    }
    const posted = await bot.sendMessage(
      config.chatId,
      [
        `Q${question.position} · ${question.topic || 'AMA'}`,
        '',
        `🇰🇷 ${question.questionKo}`,
        '',
        `🇬🇧 ${question.questionEn}`,
        '',
        question.answerMode === 'LIVE_FREEFORM'
          ? 'Fig는 이 메시지에 답장으로 40–80단어의 영문 답변을 남겨 주세요.'
          : 'Fig는 이 메시지에 답장으로 승인된 영문 스크립트를 붙여 주세요.',
      ].join('\n'),
    );
    await service.markQuestionPosted(question, posted.message_id);
    await bot.sendMessage(msg.chat.id, `Q${question.position} 게시 완료.`);
  }

  async function handleOpenFloor(msg) {
    if (!await requireOperator(msg)) return;
    const session = await service.session();
    if (session.status !== 'LIVE') {
      await bot.sendMessage(msg.chat.id, '라이브 질문 창은 AMA LIVE 상태에서만 열 수 있습니다.');
      return;
    }
    await bot.setChatPermissions(
      config.chatId,
      AMA_OPEN_FLOOR_PERMISSIONS,
      { use_independent_chat_permissions: true },
    );
    try {
      await service.markOpenFloor();
      await bot.sendMessage(
        config.chatId,
        [
          '💬 지금부터 3분간 라이브 질문을 받습니다.',
          '',
          '한 메시지에 질문 하나만 보내주세요.',
          '가격·수익·상장 추측 질문은 제외됩니다.',
          '접수된 질문은 중복을 정리해 Fig와 Squid 팀에 전달합니다.',
        ].join('\n'),
      );
      await bot.sendMessage(msg.chat.id, '라이브 질문 창을 열었습니다. 일반 유저는 텍스트만 보낼 수 있습니다.');
    } catch (error) {
      await bot.setChatPermissions(
        config.chatId,
        AMA_FROZEN_PERMISSIONS,
        { use_independent_chat_permissions: true },
      );
      throw error;
    }
  }

  async function handleCloseFloor(msg) {
    if (!await requireOperator(msg)) return;
    const session = await service.session();
    if (session.status !== 'OPEN_FLOOR') {
      await bot.sendMessage(msg.chat.id, '현재 열려 있는 라이브 질문 창이 없습니다.');
      return;
    }
    await bot.setChatPermissions(
      config.chatId,
      AMA_FROZEN_PERMISSIONS,
      { use_independent_chat_permissions: true },
    );
    const closed = await service.markOpenFloorClosed();
    await bot.sendMessage(
      config.chatId,
      `라이브 질문 접수가 종료되었습니다. 총 ${closed.openFloorQuestionCount}개의 유효 질문이 기록되었습니다.`,
    );
    await bot.sendMessage(msg.chat.id, '일반 유저 발언을 다시 잠갔습니다. Fig와 관리자는 계속 답변할 수 있습니다.');
  }

  async function handleOpenFloorMessage(msg) {
    if (
      String(msg.chat?.id) !== String(config.chatId)
      || !msg.text
      || msg.from?.is_bot
      || msg.text.startsWith('/')
      || String(msg.from?.id) === String(config.speakerTelegramId)
      || isAmaOperator(config, msg.from?.id)
    ) return;
    const session = await service.session();
    if (session.status !== 'OPEN_FLOOR') return;
    const member = await bot.getChatMember(config.chatId, msg.from.id);
    if (memberIsAdmin(member)) return;

    await service.markCommunityJoined(msg.from, 'ama_room_open_floor');
    const result = await service.submitQuestion(msg.from, msg.text, 'ama_room_open_floor');
    if (result.status === 'ACCEPTED') {
      await service.recordOpenFloorQuestion(result.question, result.participant.id);
    }
    await bot.sendMessage(
      config.chatId,
      formatQuestionResult(result, config),
      { reply_to_message_id: msg.message_id },
    );
  }

  async function handleSpeakerReply(msg) {
    if (
      String(msg.chat?.id) !== String(config.chatId)
      || String(msg.from?.id) !== String(config.speakerTelegramId)
      || !msg.reply_to_message?.message_id
      || !msg.text
    ) return;

    const question = await service.preparedQuestionForReply(msg.reply_to_message.message_id);
    if (!question || question.status !== 'POSTED') return;

    if (
      question.answerMode !== 'LIVE_FREEFORM'
      && normalizeApprovedScript(msg.text) !== normalizeApprovedScript(question.approvedAnswerEn)
    ) {
      await service.recordSystemEvent('ama_answer_script_mismatch', {
        payload: { position: question.position },
      });
      await notifyOperators(
        `⛔ Q${question.position} Fig 답변이 승인 스크립트와 일치하지 않아 자동 번역을 보류했습니다. Fig가 승인 스크립트 그대로 다시 답장하도록 안내해 주세요.`,
      );
      return;
    }

    const answeredQuestion = await service.markAnswerReceived(question, msg.message_id);
    try {
      const translation = await translator.translateToKorean(msg.text);
      const translated = await sendKoreanTranslation(msg.message_id, translation);
      await service.markTranslated(answeredQuestion, translated.message_id);
    } catch (error) {
      logError(error, 'AMA answer translation failed');
      await service.markTranslationFailed(question);
      await notifyOperators(
        `⛔ Q${question.position} 자동 번역에 실패했습니다. 원인을 확인한 뒤 Fig의 영문 답변에 답장하여 /ama_retranslate를 실행해 주세요.`,
      );
    }
  }

  async function handleRetranslate(msg) {
    if (!await requireOperator(msg)) return;
    const answerMessageId = msg.reply_to_message?.message_id;
    if (!answerMessageId) {
      await bot.sendMessage(msg.chat.id, 'Fig의 영문 답변에 답장하며 /ama_retranslate를 실행해 주세요.');
      return;
    }
    const question = await service.preparedQuestionForAnswer(answerMessageId);
    if (!question || !msg.reply_to_message?.text) {
      await bot.sendMessage(msg.chat.id, '등록된 Fig 영문 답변을 찾지 못했습니다.');
      return;
    }
    try {
      const translation = await translator.translateToKorean(msg.reply_to_message.text);
      const translated = await sendKoreanTranslation(answerMessageId, translation);
      await service.markTranslated(question, translated.message_id);
      await bot.sendMessage(msg.chat.id, `Q${question.position} 재번역 완료.`);
    } catch (error) {
      logError(error, 'AMA answer retranslation failed');
      await bot.sendMessage(msg.chat.id, '재번역에 실패했습니다. 번역 설정과 API 상태를 확인해 주세요.');
    }
  }

  async function handleRestore(msg) {
    if (!await requireOperator(msg)) return;
    const restored = await restoreRoom('operator');
    await bot.sendMessage(
      msg.chat.id,
      restored ? 'AMA 방 권한을 이전 상태로 복구했습니다.' : '복구할 AMA 잠금 상태가 없습니다.',
    );
  }

  function register() {
    const safeCommand = (label, handler) => (msg, match) => (
      Promise.resolve(handler(msg, match)).catch(async (error) => {
        logError(error, `AMA ${label} command failed`);
        await bot.sendMessage(msg.chat.id, '명령을 처리하지 못했습니다. 운영 설정과 Bot 권한을 확인해 주세요.');
      })
    );
    bot.onText(/^\/ama(?:@\w+)?(?:\s+([\s\S]+))?$/i, (msg, match) => (
      handleQuestionCommand(msg, match?.[1]).catch((error) => {
        logError(error, 'AMA question command failed');
        return bot.sendMessage(msg.chat.id, '질문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      })
    ));
    bot.onText(/^\/ama_status(?:@\w+)?$/i, (msg) => (
      service.participantStatus(msg.from)
        .then((status) => bot.sendMessage(msg.chat.id, formatStatus(status, config)))
        .catch((error) => logError(error, 'AMA status command failed'))
    ));
    bot.onText(/^\/ama_preflight(?:@\w+)?$/i, safeCommand('preflight', handlePreflight));
    bot.onText(
      /^\/ama_script_set(?:@\w+)?\s+(\d+)(?:\s+([\s\S]+))?$/i,
      safeCommand('script set', (msg, match) => (
        handleScriptSet(msg, match?.[1], match?.[2])
      )),
    );
    bot.onText(/^\/ama_script_status(?:@\w+)?$/i, safeCommand('script status', handleScriptStatus));
    bot.onText(
      /^\/ama_dm_preview(?:@\w+)?\s+([a-z]+)$/i,
      safeCommand('DM preview', (msg, match) => handleDmPreview(msg, match?.[1]?.toLowerCase())),
    );
    bot.onText(
      /^\/ama_dm_send(?:@\w+)?\s+([a-z]+)\s+(CONFIRM)$/i,
      safeCommand('DM send', (msg, match) => (
        handleDmSend(msg, match?.[1]?.toLowerCase(), match?.[2]?.toUpperCase())
      )),
    );
    bot.onText(/^\/ama_shortlist(?:@\w+)?$/i, safeCommand('shortlist', handleShortlist));
    bot.onText(/^\/ama_question_pack(?:@\w+)?$/i, safeCommand('question pack', handleQuestionPack));
    bot.onText(
      /^\/ama_question_pack_latest(?:@\w+)?$/i,
      safeCommand('latest question pack', (msg) => handleQuestionPack(msg, true)),
    );
    bot.onText(
      /^\/ama_lightning_select(?:@\w+)?\s+([A-Za-z0-9_-]+)$/i,
      safeCommand('lightning select', (msg, match) => handleLightningSelect(msg, match?.[1])),
    );
    bot.onText(/^\/ama_freeze(?:@\w+)?$/i, safeCommand('freeze', handleFreeze));
    bot.onText(/^\/ama_live(?:@\w+)?$/i, safeCommand('live', handleLive));
    bot.onText(/^\/ama_next(?:@\w+)?$/i, safeCommand('next', handleNext));
    bot.onText(/^\/ama_open_floor(?:@\w+)?$/i, safeCommand('open floor', handleOpenFloor));
    bot.onText(/^\/ama_close_floor(?:@\w+)?$/i, safeCommand('close floor', handleCloseFloor));
    bot.onText(/^\/ama_retranslate(?:@\w+)?$/i, safeCommand('retranslate', handleRetranslate));
    bot.onText(/^\/ama_restore(?:@\w+)?$/i, safeCommand('restore', handleRestore));
    bot.onText(/^\/ama_unsubscribe(?:@\w+)?$/i, safeCommand('unsubscribe', async (msg) => {
      await service.unsubscribeDm(msg.from);
      await bot.sendMessage(msg.chat.id, 'AMA 관련 Quiz Bot DM 알림을 중지했습니다.');
    }));
    bot.on('callback_query', handleCallback);
    bot.on('message', (msg) => {
      Promise.all([
        handleSpeakerReply(msg),
        handleOpenFloorMessage(msg),
      ]).catch((error) => logError(error, 'AMA live message handler failed'));
    });
  }

  return {
    initialize,
    register,
    handleStart,
    runPreflight,
    restoreRoom,
    scheduleFailsafeRestore,
    dispose() {
      if (restoreTimer) clearTimer(restoreTimer);
      restoreTimer = undefined;
    },
  };
}
