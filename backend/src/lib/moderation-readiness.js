import { verifyModerationDatabaseContract } from './moderation-database.js';
import {
  verifyModerationRateLimitDatabaseContract,
} from './moderation-rate-limit-database.js';

export class ModerationActivationDatabaseContractsError extends Error {
  constructor() {
    super('moderation activation database contracts are unavailable');
    this.name = 'ModerationActivationDatabaseContractsError';
  }
}

export async function verifyModerationActivationDatabaseContracts(
  db,
  {
    verifyQueueContract = verifyModerationDatabaseContract,
    verifyRateLimitContract = verifyModerationRateLimitDatabaseContract,
  } = {},
) {
  try {
    if (
      typeof verifyQueueContract !== 'function'
      || typeof verifyRateLimitContract !== 'function'
    ) {
      throw new ModerationActivationDatabaseContractsError();
    }

    const [queueReady, rateLimitReady] = await Promise.all([
      verifyQueueContract(db),
      verifyRateLimitContract(db),
    ]);
    if (queueReady !== true || rateLimitReady !== true) {
      throw new ModerationActivationDatabaseContractsError();
    }
    return true;
  } catch (error) {
    if (error instanceof ModerationActivationDatabaseContractsError) throw error;
    throw new ModerationActivationDatabaseContractsError();
  }
}
