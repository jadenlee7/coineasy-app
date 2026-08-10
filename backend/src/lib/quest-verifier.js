import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
} from 'viem';
import { base } from 'viem/chains';
import { BASE_CHAIN_ID } from './quest-requirements.js';

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';

export class QuestError extends Error {
  constructor(code, { status = 422, retryable = false, cause } = {}) {
    super(code, cause ? { cause } : undefined);
    this.name = 'QuestError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function errorChainIncludes(error, names) {
  let current = error;
  while (current) {
    if (names.has(current.name)) return true;
    current = current.cause;
  }
  return false;
}

function addressesEqual(left, right) {
  try {
    return isAddressEqual(getAddress(left), getAddress(right));
  } catch {
    return false;
  }
}

function rpcError(error) {
  if (errorChainIncludes(error, new Set([
    'TransactionReceiptNotFoundError',
    'TransactionNotFoundError',
  ]))) {
    return new QuestError('transaction_not_mined', {
      status: 409,
      retryable: true,
      cause: error,
    });
  }
  return new QuestError('base_rpc_unavailable', {
    status: 502,
    retryable: true,
    cause: error,
  });
}

export function createBaseQuestPublicClient(env = process.env) {
  const rpcUrl = env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;
  if (env.NODE_ENV === 'production' && !rpcUrl.startsWith('https://')) {
    throw new Error('BASE_RPC_URL must use HTTPS in production');
  }
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 10_000, retryCount: 1 }),
  });
}

export function createQuestVerifier({
  publicClient = createBaseQuestPublicClient(),
} = {}) {
  return {
    async verifyBaseTransaction({ requirements, txHash, verifiedAddress, startedAt, now = new Date() }) {
      let chainId;
      let receipt;
      let transaction;
      let block;
      let latestBlockNumber;

      try {
        chainId = await publicClient.getChainId();
        receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        [transaction, block, latestBlockNumber] = await Promise.all([
          publicClient.getTransaction({ hash: txHash }),
          publicClient.getBlock({ blockNumber: receipt.blockNumber }),
          publicClient.getBlockNumber(),
        ]);
      } catch (error) {
        if (error instanceof QuestError) throw error;
        throw rpcError(error);
      }

      if (chainId !== BASE_CHAIN_ID || requirements.chainId !== BASE_CHAIN_ID) {
        throw new QuestError('wrong_chain');
      }
      if (receipt.status !== 'success') throw new QuestError('transaction_reverted');
      if (
        !addressesEqual(receipt.from, verifiedAddress)
        || !addressesEqual(transaction.from, verifiedAddress)
      ) {
        throw new QuestError('transaction_sender_mismatch');
      }
      if (
        requirements.toAddress
        && (!transaction.to || !addressesEqual(transaction.to, requirements.toAddress))
      ) {
        throw new QuestError('transaction_recipient_mismatch');
      }
      if (
        requirements.functionSelector
        && transaction.input.slice(0, 10).toLowerCase() !== requirements.functionSelector
      ) {
        throw new QuestError('transaction_function_mismatch');
      }
      if (
        requirements.minimumValueWei
        && transaction.value < BigInt(requirements.minimumValueWei)
      ) {
        throw new QuestError('transaction_value_too_low');
      }
      if (requirements.requiredEvent) {
        const eventFound = receipt.logs.some((log) => (
          addressesEqual(log.address, requirements.requiredEvent.contractAddress)
          && log.topics[0]?.toLowerCase() === requirements.requiredEvent.topic0
        ));
        if (!eventFound) throw new QuestError('required_event_missing');
      }

      const blockTimeMs = Number(block.timestamp) * 1_000;
      if (!Number.isSafeInteger(blockTimeMs)) throw new QuestError('invalid_block_timestamp');
      // Base block timestamps have one-second precision. The one-second allowance
      // avoids rejecting a transaction mined in the same second as quest start.
      if (blockTimeMs + 999 < startedAt.getTime()) {
        throw new QuestError('transaction_predates_quest_start');
      }
      if (blockTimeMs > now.getTime() + 60_000) {
        throw new QuestError('invalid_block_timestamp');
      }

      const confirmations = latestBlockNumber >= receipt.blockNumber
        ? latestBlockNumber - receipt.blockNumber + 1n
        : 0n;
      if (confirmations < BigInt(requirements.minimumConfirmations)) {
        throw new QuestError('transaction_underconfirmed', {
          status: 409,
          retryable: true,
        });
      }

      return {
        schemaVersion: 1,
        kind: 'base_transaction',
        chainId: BASE_CHAIN_ID,
        txHash: txHash.toLowerCase(),
        blockNumber: receipt.blockNumber.toString(),
      };
    },
  };
}
