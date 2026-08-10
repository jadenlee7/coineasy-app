/**
 * Turns a CAIP-10 did:pkh into the address + chain shape consumed by the
 * legacy UI. Keeping this tiny parser local removes the final direct import
 * from the discontinued Orbis SDK.
 */
export default function useDidToAddress(did) {
  if (!did || typeof did !== 'string') {
    return { address: null, chain: null };
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(did)) {
    return { address: did, chain: null };
  }

  const segments = did.split(':');
  if (segments[0] !== 'did' || segments[1] !== 'pkh' || segments.length < 5) {
    return { address: null, chain: null };
  }

  return {
    address: segments.at(-1),
    chain: segments.slice(2, -1).join(':'),
  };
}
