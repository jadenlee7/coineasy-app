function boundedTimeout(value, fallback = 10_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1_000, Math.min(parsed, 30_000));
}

export async function closeHttpServer(server, { timeoutMs = 10_000 } = {}) {
  if (!server?.listening) return true;
  const waitMs = boundedTimeout(timeoutMs);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (closed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(closed);
    };
    const timer = setTimeout(() => {
      server.closeAllConnections?.();
      finish(false);
    }, waitMs);
    timer.unref?.();

    server.close((error) => finish(!error));
    server.closeIdleConnections?.();
  });
}

export function createShutdown({
  server,
  db,
  telemetry,
  stopBot,
  appLogger,
  processRef = process,
  timeoutMs = 10_000,
} = {}) {
  let shutdownPromise;

  return function shutdown({ reason = 'shutdown', error, exitCode = 0 } = {}) {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      if (error) {
        telemetry?.captureException(error, { tags: { process: 'web', reason } });
        appLogger?.error(
          { errorType: error?.name || 'Error', reason },
          'easygo-backend stopping after a fatal error',
        );
      } else {
        appLogger?.info({ reason }, 'easygo-backend stopping');
      }

      const closedCleanly = await closeHttpServer(server, { timeoutMs });
      if (!closedCleanly) {
        exitCode = 1;
        appLogger?.warn('http shutdown deadline exceeded; open connections were closed');
      }

      const results = await Promise.allSettled([
        stopBot?.(),
        db?.$disconnect?.(),
        telemetry?.close?.(2_000),
      ]);
      if (results.some((result) => result.status === 'rejected')) {
        exitCode = 1;
        appLogger?.warn('one or more shutdown cleanup steps failed');
      }

      processRef.exitCode = Math.max(Number(processRef.exitCode) || 0, exitCode);
      appLogger?.info({ reason, exitCode: processRef.exitCode }, 'easygo-backend stopped');
    })();

    return shutdownPromise;
  };
}

export function registerProcessHandlers({ processRef = process, shutdown } = {}) {
  const handlers = {
    SIGINT: () => { void shutdown({ reason: 'SIGINT' }); },
    SIGTERM: () => { void shutdown({ reason: 'SIGTERM' }); },
    uncaughtException: (error) => {
      void shutdown({ reason: 'uncaughtException', error, exitCode: 1 });
    },
    unhandledRejection: (error) => {
      const normalized = error instanceof Error ? error : new Error('Unhandled rejection');
      void shutdown({ reason: 'unhandledRejection', error: normalized, exitCode: 1 });
    },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    processRef.once(event, handler);
  }

  return () => {
    for (const [event, handler] of Object.entries(handlers)) {
      processRef.removeListener(event, handler);
    }
  };
}
