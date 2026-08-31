import { readFileSync } from 'node:fs';
import { Router } from 'express';

export const EASYGO_SUPPORT_EMAIL = 'contact@coineasy.xyz';

const SUPPORT_HTML = readFileSync(
  new URL('../../support/easygo.html', import.meta.url),
  'utf8',
);

export function createSupportPageHandler() {
  return function supportPage(_req, res) {
    res.set('Cache-Control', 'public, max-age=300');
    res.set(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.type('html').send(SUPPORT_HTML);
  };
}

export const supportRouter = Router();
supportRouter.get('/', createSupportPageHandler());
