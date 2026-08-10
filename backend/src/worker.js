/** Dedicated consent-gated segment worker process. */
import 'dotenv/config';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { runSegmentWorkerLoop } from './lib/segment-worker.js';
import { createTelemetry } from './lib/telemetry.js';
import { PHASE } from '../utils/easygo.js';

const once = process.argv.includes('--once');
const abortController = new AbortController();
const telemetry = createTelemetry({ env: process.env, appLogger: logger });
let fatalError = null;

function stop(signal) {
  logger.info({ signal }, 'segment worker stopping');
  abortController.abort();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stop(signal));
}

process.once('uncaughtException', (error) => {
  fatalError = error;
  telemetry.captureException(error, { tags: { process: 'worker', reason: 'uncaughtException' } });
  logger.error({ errorType: error?.name || 'Error' }, 'segment worker uncaught exception');
  process.exitCode = 1;
  stop('uncaughtException');
});

process.once('unhandledRejection', (reason) => {
  fatalError = reason instanceof Error ? reason : new Error('Unhandled rejection');
  telemetry.captureException(fatalError, {
    tags: { process: 'worker', reason: 'unhandledRejection' },
  });
  logger.error({ errorType: fatalError.name }, 'segment worker unhandled rejection');
  process.exitCode = 1;
  stop('unhandledRejection');
});

async function main() {
  if (!PHASE.SEGMENTS_ENABLED) {
    logger.info('segment worker dormant because SEGMENTS_ENABLED is false');
    return;
  }

  logger.info({ once, sentryEnabled: telemetry.enabled }, 'segment worker starting');
  await runSegmentWorkerLoop({
    db: prisma,
    signal: abortController.signal,
    once,
  });
}

main()
  .catch((error) => {
    fatalError = error;
    telemetry.captureException(error, { tags: { process: 'worker', reason: 'fatal' } });
    logger.error({ errorType: error?.name || 'Error' }, 'segment worker stopped after a fatal error');
    process.exitCode = 1;
  })
  .finally(async () => {
    const cleanup = await Promise.allSettled([
      prisma.$disconnect(),
      telemetry.close(2_000),
    ]);
    if (cleanup.some((result) => result.status === 'rejected')) process.exitCode = 1;
    logger.info(
      { exitCode: process.exitCode || 0, fatal: Boolean(fatalError) },
      'segment worker stopped',
    );
  });
