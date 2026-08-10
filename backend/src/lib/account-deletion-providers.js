/** Provider adapters for the account-deletion saga. */

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;

export class AccountDeletionProviderError extends Error {
  constructor(code, {
    retryable = false,
    global = false,
    haltCycle = global,
    statusClass = 'unknown',
  } = {}) {
    // Never retain the upstream message or Error as a cause. Provider errors
    // can contain a DID, request URL, credential, or response body.
    super(code);
    this.name = 'AccountDeletionProviderError';
    this.code = code;
    this.retryable = Boolean(retryable);
    this.global = Boolean(global);
    this.haltCycle = Boolean(haltCycle);
    this.statusClass = statusClass;
  }
}

function upstreamStatus(error) {
  const value = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function statusClass(status) {
  return status ? `${Math.floor(status / 100)}xx` : 'network';
}

export function classifyPrivyDeletionError(error) {
  if (error instanceof AccountDeletionProviderError) return error;

  if (error?.name === 'PrivyConfigurationError') {
    return new AccountDeletionProviderError('privy_not_configured', {
      retryable: true,
      global: true,
      statusClass: 'configuration',
    });
  }

  const status = upstreamStatus(error);
  if (status === 401 || status === 403) {
    return new AccountDeletionProviderError('privy_credentials_rejected', {
      retryable: true,
      global: true,
      statusClass: statusClass(status),
    });
  }
  if (status === 408 || status === 425 || status === 429) {
    return new AccountDeletionProviderError(
      status === 429 ? 'privy_rate_limited' : 'privy_request_timeout',
      {
        retryable: true,
        haltCycle: status === 429,
        statusClass: statusClass(status),
      },
    );
  }
  if (status && status >= 500) {
    return new AccountDeletionProviderError('privy_unavailable', {
      retryable: true,
      haltCycle: true,
      statusClass: statusClass(status),
    });
  }
  if (status && status >= 400) {
    return new AccountDeletionProviderError('privy_request_rejected', {
      retryable: false,
      statusClass: statusClass(status),
    });
  }
  return new AccountDeletionProviderError('privy_network_failure', {
    retryable: true,
    haltCycle: true,
    statusClass: 'network',
  });
}

async function defaultPrivyClientFactory() {
  // Keep provider SDK/client initialization behind the cleanup release gate.
  const { getPrivyClient } = await import('./privy.js');
  return getPrivyClient();
}

async function withTimeout(operation, timeoutMs, code) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new AccountDeletionProviderError(code, {
          retryable: true,
          haltCycle: true,
          statusClass: 'timeout',
        })), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function createPrivyDeletionProvider({
  clientFactory = defaultPrivyClientFactory,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new AccountDeletionProviderError('privy_timeout_invalid', {
      retryable: true,
      global: true,
      statusClass: 'configuration',
    });
  }

  let clientPromise;
  async function client() {
    if (!clientPromise) clientPromise = Promise.resolve().then(clientFactory);
    const resolved = await clientPromise;
    if (!resolved || typeof resolved.deleteUser !== 'function') {
      throw new AccountDeletionProviderError('privy_delete_not_supported', {
        retryable: true,
        global: true,
        statusClass: 'configuration',
      });
    }
    return resolved;
  }

  return {
    async deleteUser({ privyDid }) {
      try {
        const privy = await client();
        await withTimeout(
          () => privy.deleteUser(privyDid),
          timeoutMs,
          'privy_delete_timeout',
        );
        return { outcome: 'deleted' };
      } catch (error) {
        const status = upstreamStatus(error);
        if (status === 404) {
          throw new AccountDeletionProviderError('privy_absence_unproven', {
            retryable: false,
            statusClass: '4xx',
          });
        }
        throw classifyPrivyDeletionError(error);
      }
    },
  };
}

export function createFailClosedAppleDeletionProvider() {
  return {
    async resolve() {
      // EasyGo does not yet possess a durable Apple token/disposition record.
      // Never infer revocation from a Privy account deletion or an env label.
      throw new AccountDeletionProviderError('apple_disposition_not_implemented', {
        retryable: true,
        global: true,
        statusClass: 'configuration',
      });
    },
  };
}

export function createAccountDeletionProviders(options = {}) {
  return {
    apple: options.apple || createFailClosedAppleDeletionProvider(),
    privy: options.privy || createPrivyDeletionProvider(options.privyOptions),
  };
}
