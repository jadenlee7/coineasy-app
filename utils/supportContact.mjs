function clean(value) {
  return String(value || '').trim();
}

const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'www.example.com',
  'www.example.net',
  'www.example.org',
]);

function isUnsafeSupportHostname(hostname) {
  const host = clean(hostname).toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.')) return true;
  if (PLACEHOLDER_HOSTS.has(host)) return true;
  if (/\.(?:corp|example|home|internal|invalid|intranet|lan|localhost|local|test)$/.test(host)) return true;
  if (/(?:^|[.-])(?:changeme|example|placeholder|todo)(?:[.-]|$)/.test(host)) return true;

  // An official support surface should use a stable public DNS name, not a
  // loopback, private, link-local, or numeric host.
  if (/^\[.*\]$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) return true;
  return false;
}

export function normalizePublicSupportUrl(value) {
  const candidate = clean(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.port && url.port !== '443') return null;
    if (isUnsafeSupportHostname(url.hostname)) return null;
    if (url.pathname !== '/support') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const EASYGO_SUPPORT_EMAIL = 'contact@coineasy.xyz';

export function createSupportContact({ supportUrl = '' } = {}) {
  const configuredUrl = normalizePublicSupportUrl(supportUrl);
  return Object.freeze({
    email: EASYGO_SUPPORT_EMAIL,
    mailtoUrl: `mailto:${EASYGO_SUPPORT_EMAIL}?subject=EasyGo%20support`,
    url: configuredUrl,
    configured: Boolean(configuredUrl),
  });
}

// Expo replaces direct process.env.EXPO_PUBLIC_* reads in release bundles.
export const EASYGO_SUPPORT_CONTACT = createSupportContact({
  supportUrl: process.env.EXPO_PUBLIC_EASYGO_SUPPORT_URL,
});

export default EASYGO_SUPPORT_CONTACT;
