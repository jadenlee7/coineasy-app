/** Dedicated, fail-closed account-deletion provider worker process. */
import 'dotenv/config';

import { accountDeletionProviderCleanupEnabled } from './lib/account-deletion-gates.js';

const once = process.argv.includes('--once');

function safeErrorCode(error) {
  const candidate = String(error?.code || error?.name || 'account_deletion_worker_fatal');
  return /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/u.test(candidate)
    ? candidate
    : 'account_deletion_worker_fatal';
}

async function runEnabledWorker() {
  // These imports initialize Prisma, telemetry, and provider adapters. Keep
  // them strictly behind both the compile-time and environment release gates.
  const [
    { prisma },
    { logger },
    { createTelemetry },
    { runAccountDeletionCleanupLoop },
  ] = await Promise.all([
    import('./lib/db.js'),
    import('./lib/logger.js'),
    import('./lib/telemetry.js'),
    import('./lib/account-deletion-worker.js'),
  ]);

  const abortController = new AbortController();
  const telemetry = createTelemetry({ env: process.env, appLogger: logger });
  let fatal = false;

  function stop(signal) {
    logger.info({ signal }, 'account deletion provider worker stopping');
    abortController.abort();
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => stop(signal));
  }

  function captureFatal(error, reason) {
    fatal = true;
    const errorCode = safeErrorCode(error);
    const safeError = new Error(errorCode);
    safeError.name = 'AccountDeletionWorkerFatalError';
    telemetry.captureException(safeError, {
      tags: { process: 'account-deletion-worker', reason, errorCode },
    });
    logger.error(
      { errorType: safeError.name, errorCode },
      'account deletion provider worker stopped after a fatal error',
    );
    process.exitCode = 1;
    abortController.abort();
  }

  process.once('uncaughtException', (error) => captureFatal(error, 'uncaughtException'));
  process.once('unhandledRejection', (reason) => captureFatal(reason, 'unhandledRejection'));

  try {
    logger.info(
      { once, sentryEnabled: telemetry.enabled },
      'account deletion provider worker starting',
    );
    await runAccountDeletionCleanupLoop({
      db: prisma,
      env: process.env,
      logger,
      signal: abortController.signal,
      once,
    });
  } catch (error) {
    captureFatal(error, 'fatal');
  } finally {
    const cleanup = await Promise.allSettled([
      prisma.$disconnect(),
      telemetry.close(2_000),
    ]);
    if (cleanup.some((result) => result.status === 'rejected')) process.exitCode = 1;
    logger.info(
      { exitCode: process.exitCode || 0, fatal },
      'account deletion provider worker stopped',
    );
  }
}

if (!accountDeletionProviderCleanupEnabled(process.env)) {
  // Fixed text only: dormant startup must not initialize Prisma, provider SDKs,
  // or print any environment value.
  process.stdout.write('account deletion provider worker dormant\n');
} else {
  await runEnabledWorker();
}
