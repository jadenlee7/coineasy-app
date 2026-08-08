import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL;

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

test('recent-auth timestamps, transition guard, and consume rollback hold in PostgreSQL', {
  skip: !databaseUrl,
}, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID();
  const challengeId = `reauth_db_${suffix}`;
  const keyVersion = 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
  const fingerprint = digest(`fingerprint:${suffix}`);
  const providerIdentityHash = digest(`provider:${suffix}`);
  const proofHash = digest(`proof:${suffix}`);

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Dubai'");
      const [{ now }] = await tx.$queryRawUnsafe('SELECT CURRENT_TIMESTAMP AS "now"');
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1_000);
      await tx.$executeRawUnsafe(
        `INSERT INTO "AccountDeletionKeyRegistry"
          ("keyVersion", "fingerprint", "createdAt")
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        keyVersion,
        fingerprint,
      );
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO "AccountDeletionReauthChallenge" (
          "id", "subjectHash", "subjectHashKeyVersion",
          "subjectHashKeyFingerprint", "sessionHash", "clientRequestHash",
          "nonceHash", "stateHash", "status", "expiresAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'ISSUED'::"AccountDeletionReauthStatus", $9, CURRENT_TIMESTAMP
        ) RETURNING "createdAt", "expiresAt"`,
        challengeId,
        digest(`subject:${suffix}`),
        keyVersion,
        fingerprint,
        digest(`session:${suffix}`),
        digest(`request:${suffix}`),
        digest(`nonce:${suffix}`),
        digest(`state:${suffix}`),
        expiresAt,
      );
      return { now, ...rows[0] };
    });

    // TIMESTAMPTZ must represent one instant even when the DB session is not
    // UTC; timestamp-without-time-zone previously returned a +4h skew here.
    assert.ok(Math.abs(created.createdAt.getTime() - created.now.getTime()) < 2_000);
    assert.ok(Math.abs(
      created.expiresAt.getTime() - created.now.getTime() - 5 * 60 * 1_000,
    ) < 2_000);

    await prisma.$queryRawUnsafe(
      `UPDATE "AccountDeletionReauthChallenge"
          SET "status" = 'ATTESTED'::"AccountDeletionReauthStatus",
              "providerIdentityHash" = $2,
              "proofHash" = $3,
              "attestedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
        RETURNING "id"`,
      challengeId,
      providerIdentityHash,
      proofHash,
    );

    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "AccountDeletionReauthChallenge"
              SET "status" = 'CONSUMED'::"AccountDeletionReauthStatus",
                  "consumedAt" = CURRENT_TIMESTAMP,
                  "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1
              AND "status" = 'ATTESTED'::"AccountDeletionReauthStatus"
            RETURNING "id"`,
          challengeId,
        );
        assert.equal(rows.length, 1);
        throw new Error('force deletion transaction rollback');
      }),
      /force deletion transaction rollback/,
    );

    const [afterRollback] = await prisma.$queryRawUnsafe(
      `SELECT "status", "consumedAt"
         FROM "AccountDeletionReauthChallenge"
        WHERE "id" = $1`,
      challengeId,
    );
    assert.equal(afterRollback.status, 'ATTESTED');
    assert.equal(afterRollback.consumedAt, null);

    await assert.rejects(
      prisma.$executeRawUnsafe(
        `UPDATE "AccountDeletionReauthChallenge"
            SET "status" = 'ISSUED'::"AccountDeletionReauthStatus",
                "providerIdentityHash" = NULL,
                "proofHash" = NULL,
                "attestedAt" = NULL,
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        challengeId,
      ),
      /invalid account deletion reauth status transition|account deletion reauth proof is immutable/u,
    );
  } finally {
    await prisma.$executeRawUnsafe(
      'DELETE FROM "AccountDeletionReauthChallenge" WHERE "id" = $1',
      challengeId,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      'DELETE FROM "AccountDeletionKeyRegistry" WHERE "keyVersion" = $1',
      keyVersion,
    ).catch(() => {});
    await prisma.$disconnect();
  }
});
