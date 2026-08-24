/**
 * Compile-time brake for the dormant Squid execution and reward paths.
 *
 * The display-only /swap/quote-preview route does not use this gate. Keep the
 * latch false until route construction, onchain settlement verification, and
 * Orange reward attribution have all shipped in a separately reviewed release.
 * An environment change alone must never expose the legacy execution contract.
 */
export const SWAP_EXECUTION_READY = false;

function explicitlyEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function swapExecutionEnabled(env = process.env) {
  return SWAP_EXECUTION_READY && explicitlyEnabled(env.SWAP_EXECUTION_ENABLED);
}

export function requireSwapExecution(_req, res, next) {
  if (!swapExecutionEnabled()) {
    return res.status(404).json({ error: 'not_found' });
  }
  return next();
}
