import { PrismaClient } from '@prisma/client';
import { hashQuizAnswer } from '../src/lib/quest-requirements.js';

const prisma = new PrismaClient();

function assertSeedTargetIsSafe() {
  if (process.env.ALLOW_DEMO_SEED === 'true') return;

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL is required to seed EasyGo demo data.');

  try {
    const { hostname } = new URL(rawUrl);
    if (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]'
    ) return;
  } catch {
    throw new Error('DATABASE_URL is not a valid Postgres URL.');
  }

  throw new Error(
    'Demo seed blocked for a non-local database. Set ALLOW_DEMO_SEED=true only for an approved development database.',
  );
}

const DEMO_USERS = [
  {
    id: 'easygo_seed_guide',
    privyDid: 'did:privy:easygo-seed-guide',
    username: 'easygo',
    displayName: 'EasyGo Guide',
    bio: 'Web3를 가장 쉽게 시작하는 길을 안내합니다. 🍊',
  },
  {
    id: 'easygo_seed_builder',
    privyDid: 'did:privy:easygo-seed-builder',
    username: 'basebuilder',
    displayName: 'Base Builder',
    bio: 'Base 생태계와 온체인 제품을 만드는 빌더입니다.',
  },
  {
    id: 'easygo_seed_explorer',
    privyDid: 'did:privy:easygo-seed-explorer',
    username: 'orangeexplorer',
    displayName: 'Orange Explorer',
    bio: '퀴즈, 리워드, 새로운 프로젝트를 탐험합니다.',
  },
];

const ROOT_POSTS = [
  {
    id: 'easygo_seed_post_welcome',
    authorKey: 'guide',
    minutesAgo: 4,
    body: 'EasyGo에 오신 것을 환영합니다! 소셜 로그인 한 번으로 Web3를 배우고, 활동하고, Orange를 모아보세요. 🍊 #EASYGO #NEWS',
  },
  {
    id: 'easygo_seed_post_orange',
    authorKey: 'explorer',
    minutesAgo: 18,
    body: '오늘의 체크인과 퀴즈를 완료했어요. Orange가 서버 ledger에 기록되니 중복 수령 걱정도 없네요. #ORANGE',
  },
  {
    id: 'easygo_seed_post_base',
    authorKey: 'builder',
    minutesAgo: 42,
    body: 'EasyGo Phase 1은 Base에서 시작합니다. 작은 온체인 경험을 쉽고 안전하게 연결하는 게 목표예요. #BASE #BUILD',
  },
  {
    id: 'easygo_seed_post_learning',
    authorKey: 'guide',
    minutesAgo: 75,
    body: '오늘의 EasyEdu: 블록체인은 여러 참여자가 함께 검증하는 디지털 장부입니다. 첫 레슨부터 천천히 시작해보세요. #EDUCATION',
  },
  {
    id: 'easygo_seed_post_community',
    authorKey: 'explorer',
    minutesAgo: 130,
    body: '처음 온 분들은 관심 있는 태그를 검색해보세요. 사람과 글을 모두 찾을 수 있어요. #COMMUNITY',
  },
];

const REPLIES = [
  {
    id: 'easygo_seed_reply_welcome',
    authorKey: 'builder',
    parentPostId: 'easygo_seed_post_welcome',
    minutesAgo: 2,
    body: '반가워요! Base에서 만드는 여정도 함께 공유할게요.',
  },
  {
    id: 'easygo_seed_reply_learning',
    authorKey: 'explorer',
    parentPostId: 'easygo_seed_post_learning',
    minutesAgo: 60,
    body: '설명이 짧고 쉬워서 첫 퀴즈까지 바로 완료했습니다. 🍊',
  },
];

const DEMO_SEGMENTS = [
  {
    id: 'easygo_seed_segment_base_starter',
    slug: 'base-starter',
    name: 'Base Starter',
    description: 'Base에서 한 번 이상 트랜잭션을 실행한 사용자 예시 규칙입니다.',
    status: 'DRAFT',
    ruleVersion: 1,
    rule: {
      schemaVersion: 1,
      match: 'all',
      membershipTtlHours: 24,
      conditions: [{ metric: 'base.transaction_count', minimum: 1 }],
    },
  },
  {
    id: 'easygo_seed_segment_usdc_active',
    slug: 'stable-holder-100usdc-active-base-30d',
    name: 'Active Base USDC Holder',
    description: 'Base USDC 100개 이상과 최근 30일 활동을 조합한 예시 규칙입니다.',
    status: 'DRAFT',
    ruleVersion: 1,
    rule: {
      schemaVersion: 1,
      match: 'all',
      membershipTtlHours: 24,
      conditions: [
        {
          metric: 'base.erc20_balance',
          contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          minimumBaseUnits: '100000000',
        },
        { metric: 'base.active_days', minimum: 3, windowDays: 30 },
      ],
    },
  },
];

const COURSE_QUIZ_ANSWERS = {
  '1-1': 1,
  '1-2': 0,
  '1-3': 1,
  '1-4': 2,
  '1-5': 1,
  '1-6': 0,
  '1-7': 0,
  '1-8': 1,
  '1-9': 1,
  '1-10': 1,
  '1-11': 1,
  '2-1': 1,
  '2-2': 1,
  '2-3': 1,
  '2-4': 1,
  '3-1': 1,
  '3-2': 1,
  '3-3': 1,
  '3-4': 1,
  '4-1': 1,
  '5-1': 1,
  '6-1': 1,
  '7-1': 1,
  '8-1': 1,
  '9-1': 1,
  '10-1': 1,
};

const DEMO_QUESTS = [
  ...Object.entries(COURSE_QUIZ_ANSWERS).map(([sectionId, answer]) => {
    const slug = `course-${sectionId}`;
    return {
      id: `easygo_seed_quest_course_${sectionId.replace('-', '_')}`,
      slug,
      title: `EasyGo Course Quiz ${sectionId}`,
      description: 'EasyGo mobile course completion quiz. Review the app copy before activation.',
      type: 'QUIZ',
      status: 'DRAFT',
      rewardOrange: 60,
      requiresWalletSharing: false,
      requirements: {
        schemaVersion: 1,
        kind: 'quiz',
        question: `EasyGo course ${sectionId} completion`,
        options: Array.from({ length: 4 }, (_, index) => ({
          id: String(index),
          label: `Option ${index + 1}`,
        })),
        correctAnswerSha256: hashQuizAnswer(slug, answer),
      },
    };
  }),
  {
    id: 'easygo_seed_quest_base_usdc_transfer',
    slug: 'base-usdc-transfer-example',
    title: 'Transfer USDC on Base (review example)',
    description: 'Dormant verifier example. Review reward, copy, and safety before activation.',
    type: 'TRANSACTION',
    status: 'DRAFT',
    rewardOrange: 25,
    requiresWalletSharing: false,
    requirements: {
      schemaVersion: 1,
      kind: 'base_transaction',
      chainId: 8453,
      minimumConfirmations: 3,
      toAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      functionSelector: '0xa9059cbb',
      requiredEvent: {
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      },
    },
  },
];

const DEMO_ADVERTISER = {
  id: 'easygo_seed_advertiser_partner',
  slug: 'easygo-demo-partner',
  name: 'EasyGo Demo Partner',
  status: 'DRAFT',
};

const DEMO_CAMPAIGN = {
  id: 'easygo_seed_campaign_base_starter',
  advertiserId: DEMO_ADVERTISER.id,
  targetSegmentId: 'easygo_seed_segment_base_starter',
  slug: 'easygo-demo-base-starter',
  name: 'EasyGo Demo Base Starter Campaign',
  status: 'DRAFT',
};

function timestampMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function upsertUser(seedUser) {
  const { id, privyDid, ...profile } = seedUser;
  return prisma.user.upsert({
    where: { privyDid },
    update: profile,
    create: { id, privyDid, ...profile },
  });
}

async function upsertPost(seedPost, usersByKey) {
  const { id, authorKey, minutesAgo, parentPostId = null, body } = seedPost;
  const data = {
    authorId: usersByKey[authorKey].id,
    parentPostId,
    body,
    createdAt: timestampMinutesAgo(minutesAgo),
  };
  return prisma.post.upsert({ where: { id }, update: data, create: { id, ...data } });
}

async function main() {
  assertSeedTargetIsSafe();

  const [guide, builder, explorer] = await Promise.all(DEMO_USERS.map(upsertUser));
  const usersByKey = { guide, builder, explorer };

  for (const post of ROOT_POSTS) await upsertPost(post, usersByKey);
  for (const reply of REPLIES) await upsertPost(reply, usersByKey);

  await Promise.all([
    prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: builder.id, followeeId: guide.id } },
      update: {},
      create: { followerId: builder.id, followeeId: guide.id },
    }),
    prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: explorer.id, followeeId: guide.id } },
      update: {},
      create: { followerId: explorer.id, followeeId: guide.id },
    }),
    prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: guide.id, followeeId: builder.id } },
      update: {},
      create: { followerId: guide.id, followeeId: builder.id },
    }),
    prisma.like.upsert({
      where: { postId_userId: { postId: 'easygo_seed_post_welcome', userId: builder.id } },
      update: {},
      create: { postId: 'easygo_seed_post_welcome', userId: builder.id },
    }),
    prisma.like.upsert({
      where: { postId_userId: { postId: 'easygo_seed_post_welcome', userId: explorer.id } },
      update: {},
      create: { postId: 'easygo_seed_post_welcome', userId: explorer.id },
    }),
    prisma.like.upsert({
      where: { postId_userId: { postId: 'easygo_seed_post_base', userId: guide.id } },
      update: {},
      create: { postId: 'easygo_seed_post_base', userId: guide.id },
    }),
  ]);

  await Promise.all(Object.values(usersByKey).map((user) =>
    prisma.orangeLedger.upsert({
      where: { reason_refId: { reason: 'SEED_GRANT', refId: user.id } },
      update: {},
      create: { userId: user.id, delta: 120, reason: 'SEED_GRANT', refId: user.id },
    })
  ));

  await Promise.all(DEMO_SEGMENTS.map(({ id, slug, ...data }) =>
    prisma.segment.upsert({
      where: { slug },
      // Never demote or rewrite an operator-edited rule on a repeated seed.
      update: {},
      create: { id, slug, ...data },
    })
  ));

  await Promise.all(DEMO_QUESTS.map(({ id, slug, ...data }) =>
    prisma.quest.upsert({
      where: { slug },
      // Seeds are review samples only; never rewrite or activate operator edits.
      update: {},
      create: { id, slug, ...data },
    })
  ));

  const demoAdvertiser = await prisma.advertiser.upsert({
    where: { slug: DEMO_ADVERTISER.slug },
    update: {},
    create: DEMO_ADVERTISER,
  });
  const {
    advertiserId: _seedAdvertiserId,
    targetSegmentId: _seedTargetSegmentId,
    ...demoCampaign
  } = DEMO_CAMPAIGN;
  await prisma.campaign.upsert({
    where: { slug: DEMO_CAMPAIGN.slug },
    update: {},
    create: {
      ...demoCampaign,
      advertiser: { connect: { id: demoAdvertiser.id } },
      targetSegment: { connect: { slug: 'base-starter' } },
    },
  });

  console.log(
    `EasyGo demo seed ready: ${DEMO_USERS.length} users, ${ROOT_POSTS.length} posts, ${REPLIES.length} replies, ${DEMO_SEGMENTS.length} draft segments, ${DEMO_QUESTS.length} draft quests, 1 draft advertiser, 1 draft campaign.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
