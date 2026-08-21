export const SQUID_QUOTE_PREVIEW_CHAIN_ID = '8453';

export const SQUID_QUOTE_PREVIEW_TOKENS = Object.freeze({
  ETH: Object.freeze({
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    decimals: 18,
    chainId: SQUID_QUOTE_PREVIEW_CHAIN_ID,
  }),
  USDC: Object.freeze({
    symbol: 'USDC',
    name: 'USDC',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
    chainId: SQUID_QUOTE_PREVIEW_CHAIN_ID,
  }),
});

export const SQUID_QUOTE_PREVIEW_DIRECTIONS = Object.freeze({
  ETH_TO_USDC: Object.freeze({
    id: 'ETH_TO_USDC',
    fromToken: SQUID_QUOTE_PREVIEW_TOKENS.ETH,
    toToken: SQUID_QUOTE_PREVIEW_TOKENS.USDC,
  }),
  USDC_TO_ETH: Object.freeze({
    id: 'USDC_TO_ETH',
    fromToken: SQUID_QUOTE_PREVIEW_TOKENS.USDC,
    toToken: SQUID_QUOTE_PREVIEW_TOKENS.ETH,
  }),
});

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const INTEGER_RE = /^\d+$/;
const DECIMAL_RE = /^\d+(?:[.,]\d*)?$/;

function invalidAmount(code, message) {
  return Object.freeze({ ok: false, code, message });
}

export function parseSquidQuotePreviewAmount(value, token) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const decimals = Number(token?.decimals);

  if (!raw) return invalidAmount('amount_required', 'Enter an amount.');
  if (raw.length > 80) return invalidAmount('amount_too_large', 'Enter a smaller amount.');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return invalidAmount('token_invalid', 'This token is not available for preview.');
  }
  if (!DECIMAL_RE.test(raw) || (raw.includes('.') && raw.includes(','))) {
    return invalidAmount('amount_invalid', 'Enter a valid decimal amount.');
  }

  const normalized = raw.replace(',', '.');
  const [wholePart, fractionPart = ''] = normalized.split('.');
  if (fractionPart.length > decimals) {
    return invalidAmount(
      'amount_precision',
      `${token.symbol} supports up to ${decimals} decimal places.`,
    );
  }

  const significantWhole = wholePart.replace(/^0+/, '');
  if (significantWhole.length > 30) {
    return invalidAmount('amount_too_large', 'Enter a smaller amount.');
  }

  const scale = BigInt(10) ** BigInt(decimals);
  const paddedFraction = fractionPart.padEnd(decimals, '0');
  const baseUnits = (BigInt(wholePart) * scale)
    + BigInt(paddedFraction || '0');
  if (baseUnits <= BigInt(0)) {
    return invalidAmount('amount_zero', 'Amount must be greater than zero.');
  }

  return Object.freeze({
    ok: true,
    normalized: fractionPart ? `${wholePart}.${fractionPart}` : wholePart,
    baseUnits: baseUnits.toString(),
  });
}

export function buildSquidQuotePreviewRequest({
  amount,
  direction = 'ETH_TO_USDC',
  walletAddress,
}) {
  const pair = SQUID_QUOTE_PREVIEW_DIRECTIONS[direction];
  if (!pair) {
    return Object.freeze({
      ok: false,
      code: 'direction_invalid',
      message: 'Choose a supported token pair.',
    });
  }
  if (typeof walletAddress !== 'string' || !EVM_ADDRESS_RE.test(walletAddress)) {
    return Object.freeze({
      ok: false,
      code: 'wallet_unavailable',
      message: 'Connect the signed-in Base wallet before requesting a quote.',
    });
  }

  const parsedAmount = parseSquidQuotePreviewAmount(amount, pair.fromToken);
  if (!parsedAmount.ok) return parsedAmount;

  return Object.freeze({
    ok: true,
    pair,
    params: Object.freeze({
      fromToken: pair.fromToken.address,
      fromAmount: parsedAmount.baseUnits,
      toToken: pair.toToken.address,
    }),
  });
}

export function formatSquidBaseUnits(value, decimals, maxFractionDigits = 6) {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  if (
    !INTEGER_RE.test(raw)
    || raw.length > 80
    || !Number.isInteger(decimals)
    || decimals < 0
    || decimals > 36
    || !Number.isInteger(maxFractionDigits)
    || maxFractionDigits < 0
    || maxFractionDigits > 36
  ) return null;

  const padded = raw.padStart(decimals + 1, '0');
  const splitAt = padded.length - decimals;
  const whole = decimals === 0 ? padded : padded.slice(0, splitAt);
  if (decimals === 0 || maxFractionDigits <= 0) return whole;

  const fraction = padded
    .slice(splitAt, splitAt + Math.min(decimals, maxFractionDigits))
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function compactDecimal(value, maxFractionDigits = 6) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  const compactFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${compactFraction ? `.${compactFraction}` : ''}`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 60) return `${Math.max(1, Math.round(value))} sec`;
  return `${Math.max(1, Math.ceil(value / 60))} min`;
}

function sumUsdCosts(costs) {
  if (!Array.isArray(costs)) return null;
  const values = costs
    .map((cost) => Number(cost?.amountUsd))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function tokenForPreview(_value, fallback) {
  return {
    // The pair is fixed locally and response addresses are bound on the server.
    // Never let upstream symbol/decimal metadata drive allocation or display.
    symbol: fallback.symbol,
    decimals: fallback.decimals,
  };
}

export function presentSquidQuotePreview(response, fallbackPair) {
  const preview = response?.preview;
  if (!preview || !fallbackPair) return null;

  const fromToken = tokenForPreview(preview.fromToken, fallbackPair.fromToken);
  const toToken = tokenForPreview(preview.toToken, fallbackPair.toToken);
  const fromAmount = formatSquidBaseUnits(
    preview.fromAmount,
    fromToken.decimals,
    Math.min(fromToken.decimals, 8),
  );
  const toAmount = formatSquidBaseUnits(
    preview.toAmount,
    toToken.decimals,
    Math.min(toToken.decimals, 8),
  );
  const toAmountMin = formatSquidBaseUnits(
    preview.toAmountMin,
    toToken.decimals,
    Math.min(toToken.decimals, 8),
  );
  if (!fromAmount || !toAmount) return null;

  const gasUsd = sumUsdCosts(preview.gasCosts);
  const feeUsd = sumUsdCosts(preview.feeCosts);
  const totalUsd = gasUsd === null && feeUsd === null
    ? null
    : (gasUsd || 0) + (feeUsd || 0);
  const providers = Array.isArray(preview.actions)
    ? [...new Set(preview.actions
      .map((action) => action?.provider || action?.description || action?.type)
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim()))]
    : [];

  return Object.freeze({
    fromLabel: `${fromAmount} ${fromToken.symbol}`,
    toLabel: `${toAmount} ${toToken.symbol}`,
    minimumLabel: toAmountMin ? `${toAmountMin} ${toToken.symbol}` : null,
    rateLabel: compactDecimal(preview.exchangeRate, 8),
    priceImpactLabel: compactDecimal(preview.aggregatePriceImpact, 4),
    slippageLabel: compactDecimal(preview.aggregateSlippage, 4),
    durationLabel: formatDuration(preview.estimatedRouteDuration),
    feeUsdLabel: totalUsd === null
      ? null
      : totalUsd > 0 && totalUsd < 0.01
        ? '<$0.01'
        : `$${totalUsd.toFixed(2)}`,
    providersLabel: providers.length ? providers.join(' · ') : null,
    chainLabel: response.defaultChain === SQUID_QUOTE_PREVIEW_CHAIN_ID ? 'Base' : null,
  });
}
