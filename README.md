# EasyGo mobile app

EasyGo is the CoinEasy social onboarding app: Privy authentication, an EasyGo
social feed, game-like Web3 education, a display-only Base route-estimate lab,
and the server-backed Orange reward ledger. The App Store client has no swap
signing/broadcast path. The mobile client uses Expo / React Native; the API lives in
[`backend/`](./backend/README.md).

## Local setup

```bash
npm install
cp .env.example .env
npm run preflight
npm start
```

Required public mobile configuration:

```env
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-mobile-client-id
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
EXPO_PUBLIC_EASYGO_SUPPORT_URL=https://your-public-support-page.example.invalid/support
```

The app can boot and authenticate with only the Privy identifiers. Feed,
profile, notifications, and Orange mutations require a reachable EasyGo
backend URL. See [`backend/.env.example`](./backend/.env.example) for private
server configuration; never place server secrets in the Expo `.env` file.

The current local `.env` has both Privy identifiers but no backend URL, so
`npm run preflight` reports disconnected-API and support-URL warnings. For
staging, use `npm run preflight:staging`; it fails until HTTPS backend and
official public support URLs are configured. The example value above is
deliberately invalid and must never be used for a release.
The Privy mobile client must allow both native identifiers—iOS
`com.coineasy.coineasysocial` and Android `com.coineasy.coineasy`—plus the
`coineasyapp` URL scheme.

## Commands

```bash
npm start       # Expo dev client
npm run ios     # native iOS run
npm run android # native Android run
npm run preflight         # local config check
npm run preflight:staging # staging config gate
npm run test:preflight    # config-check unit tests
npm run appstore:bundle-check -- <ios-bundle> # stop-ship legacy marker scan
```

Settings always shows `contact@coineasy.xyz` as the EasyGo support email and
opens the public support page configured by `EXPO_PUBLIC_EASYGO_SUPPORT_URL`.
Staging and production preflight reject missing, HTTP, local/private,
placeholder, credential-bearing, query-bearing, fragment-bearing,
nonstandard-port, or non-`/support` URLs. Production additionally requires the
support URL to equal the configured backend origin plus `/support`. The backend
serves the static, tracker-free page at that path; configure the exact deployed
HTTPS URL only after it is reachable and approved. A local build may omit the
page URL and receives a warning instead.

The project uses `tailwind-rn` for existing presentation styles. The legacy
social-service shim and its mobile polyfills have been removed; identity is
owned by Privy and application data is owned by the EasyGo API.
