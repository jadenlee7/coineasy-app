# UserBlock staging rollout and authenticated QA — 2026-08-31 UTC

## Outcome and authority

**PASS within the approved server-smoke scope:** encrypted backup and isolated
restore, the single UserBlock migration, exact staging web deployment, two-account
Block/Unblock and export checks, and cleanup of newly created QA data. This is
not physical-device evidence, complete privacy coverage, or App Store approval.

The owner separately approved the staging rollout and then two disposable QA
fixtures, no-reward smoke, and cleanup. One new Privy test credential was added
after action-time confirmation. Existing credentials were preserved. This
documentation follow-up authorizes only a branch, commit, push, and Draft PR;
it does not repeat the rollout or authorize merge, migration, activation, or
another app build.

Production, worker, EAS/TestFlight, external groups, App Store review, moderation
activation, and swap execution were unchanged. The GCRA migration remains pending
and unapproved. Existing test-account disable/renewal gates remain open; this
receipt does not extend their authorization indefinitely.

## Exact release evidence

| Field | Observed value |
| --- | --- |
| Target | `easygo-app-staging` / `staging` / `easygo-web-staging` |
| Release | `db8b15fb2dd55008a2419f0082521c95e6e40dcd` |
| PR | [#79](https://github.com/jadenlee7/coineasy-app/pull/79), merged `2026-08-31T15:27:10Z` |
| CI-tested PR head | `2649f9c2dcffef5c57e91f9bf5422bd5eda827d0` |
| Head and merge tree | `fa1125769c24067b0fafd09a069bcab423865cdb` |
| CI | [33407165762](https://github.com/jadenlee7/coineasy-app/actions/runs/33407165762), Backend and Mobile SUCCESS |
| Railway deployment | `e52770fd-836d-4833-8e5f-472177f88505`, SUCCESS |
| Deployment created | `2026-08-31T15:52:48.017Z` |
| Image digest | `sha256:90d120ad64a51206620f6fccff885ae93dda43f954a93bbc1dd3089f63aadf04` |
| Exact backend archive SHA-256 | `85a5cec8fc5b26a105ee75e9f40125221fef4d396bb1a72c78958f117eaba3ba` |

Target service IDs remain in the [deployment inventory](../DEPLOY_CHECKLIST.md#railway-staging-inventory).
The CI receipt is for the PR head with an identical merge tree, not a separate
CI run on the merge SHA. The archive proves the uploaded source, not a
cryptographic binding between Git and the Railway image.

A clean, detached exact-source worktree produced one backend archive upload.
Only `RELEASE_SHA` was updated with deploys skipped before that upload. Web uses
`/backend/railway.web.json`, `node src/index.js`, `/ready`, and no pre-deploy
command. Preflight returned zero failures and three optional/disabled-integration
warnings. The running container's UserBlock model, actual query, app-role
SELECT/INSERT/DELETE privileges, and the hashes of `blocks.js`, `user-blocks.js`,
`posts.js`, and `schema.prisma` matched the intended source contract.

## Backup, restore, and the single approved migration

- Recovery point: `easygo-staging-20260831T153656Z.dump.enc`, created
  `2026-08-31T15:36:56.567Z`.
- Encrypted SHA-256:
  `3cd8bfa0d337a9b82cbcbba445978af4c1877caa45740ec4221af7b8c480f29b`;
  encrypted/raw bytes `83664 / 83634`.
- AES-256-CBC, PBKDF2 200000, verified metadata; directory `0700` and
  ciphertext/metadata `0600`. The key remains privately in Keychain. No key,
  dump, metadata file, local credential location, or plaintext data is committed.
- An isolated PostgreSQL 18.6 restore with `pg_restore --exit-on-error
  --single-transaction --no-owner --no-privileges` matched the source's eight
  completed migration receipts and representative counts. UserBlock application
  and ledger resolution were rehearsed there first. The isolated database was
  removed and its absence verified; the encrypted backup was retained.
- Two migrations were initially pending. Broad `prisma migrate deploy` was
  deliberately not used against staging. Only
  `20260831120000_user_blocks` SQL ran in one transaction, followed by
  `prisma migrate resolve --applied` for that migration.
- SQL/ledger checksum:
  `e2c698aa7d48aee09ddfaf7b2cc34d8f3555dc84a7b9117fc90dea8213fe2841`.
  The first ledger command stopped before execution because the web service had
  no public DB URL; the corrected Postgres-service invocation succeeded without
  reapplying SQL.
- Catalog readback verified the composite primary key, self-block CHECK, both
  CASCADE foreign keys, and two auxiliary indexes plus the primary index, all
  valid/ready. Completed migrations became `9`, unfinished `0`, rolled back `0`.
- The only remaining pending migration is
  **`20260827193000_moderation_rate_limit_gcra`**. It was not approved or applied;
  a nonzero Prisma status for this pending item is not a failed UserBlock apply.

## Authenticated server-smoke receipt

Run ID: `15319030-aa0a-499f-9d93-7917932d5db5` (non-secret correlation ID).
The reviewed one-shot operator script `auth-block-fixture-smoke.cjs` had SHA-256
`b7045e0ed0e2793199a1bfb52ac2346dec3497cb1d304bd035cb2d63b4a6fa26`.
It ran with the exact deployed `/app` Prisma Client after environment, release,
Privy app, and UserBlock-model fences passed. The one-shot fixture and credential
scripts stay outside the repository and are not a release entrypoint.

Both provider identities initially had no local app user (`/auth/me` 404).
The script preserved provider A and created only provider B; it then created
two isolated local users and one B-owned post directly, without `/auth/sync` or
Orange rewards. Every request below has ID prefix
`eg-fixture-15319030-aa0a-499f-9d93-7917932d5db5-` followed by the listed suffix.
No token, OTP, email, Privy DID, fixture identity, post body, or export body is
included in the receipt.

| Suffix | Check | Observed result |
| --- | --- | --- |
| 1–3 | Health, readiness, social mode | 200; exact release; active |
| 4–5 | Local users before fixture creation | 404 `not_found` |
| 6–7 | Local users after creation | 200; respective own user |
| 8–10 | Both profiles; A's marker-filtered post list | 200; actual B post visible |
| 11–12 | Initial Block lists | 200; both empty |
| 13–14 | Self / nonexistent target | 409 `cannot_block_self` / 404 `target_not_found` |
| 15–16 | A blocks B, then replay | 200; `changed=true`, then `false` |
| 17–19 | A list, cursor tail, B list | One outbound entry, empty tail, no inbound disclosure |
| 20–24 | A→B profile, follow status, author posts, filtered posts, Follow | 404/404/404/200/409; B post excluded; `blocked_interaction` |
| 25–29 | Corresponding B→A boundaries | 404/404/404/200/409; reverse post-list coverage limited by no A post |
| 30–31 | A→B Like / Reply | Both 409 `blocked_interaction` |
| 32–35 | A/B each `/me/data` and `/me/social-export` | All 200; scoped shape/privacy assertions below |
| 36–37 | A unblocks B, then replay | 200; `changed=true`, then `false` |
| 38–39 | Block lists after unblock | 200; both empty |
| 40–43 | Both profiles and follow status | 200; `following=false` |
| 44–45 | Both marker-filtered post lists after unblock | 200; B post visible |

Block lists proved `Cache-Control: no-store`, `Vary: Authorization`, and limited
public summaries. Post-list checks used `/posts?q=<fixture marker>` rather than
the unfiltered home feed, search UI, or mobile cache.

### Export assertions and limits

- Four calls total: each account/endpoint once while blocked. Schema version,
  scope, timestamp, `no-store`, own-account binding, and outbound block data
  matched; no inbound `blocksTaken` was exposed.
- Social export checked its attachment name, limited profile/public summaries,
  and recursive exclusion of the script's forbidden sensitive keys.
- Full `/me/data` intentionally includes the requesting user's own `privyDid`.
  The test confirmed it, excluded nonce/challenge keys, and checked limited
  outbound summaries and push-token/stable-identity array shapes. It does not
  claim that every sensitive field is absent from a personal data export.
- Push-token and stable-identity arrays were empty in these new fixtures;
  populated-row token/hash redaction remains unproven by this live test.
- **SKIPPED:** exports after unblock, to keep a conservative call budget. The
  explicit unblock/list/profile/post checks, not another export, prove unblock.

## Cleanup and final readback

The smoke exited `0` with `passed=true`, `contractFailed=false`,
`cleanupFailed=false`, `localCleanupConfirmed=true`, and no local/provider
cleanup pending. Exact fixture fields and absence of foreign interactions were
checked before deleting only the two new local users and one post. The new
email-only, wallet-free provider B was removed; provider A remained intact.

Only the newly added credential row was then removed through the dashboard,
after matching its displayed selector to the API target in memory. At
`2026-08-31T16:35:29.177Z`, API readback proved one credential remained, its full
canonical hash was unchanged, provider A remained, and provider B was absent.
The final additional UI read timed out; the cleanup verdict uses the successful
API readback. Existing credential/OTP values and the Test accounts toggle were
not rotated. The disposable records were permanently deleted, not trashed;
equivalent fixtures can be recreated for a separately approved run.

| Aggregate | Before | After cleanup | Final read-only check |
| --- | ---: | ---: | ---: |
| User | 5 | 5 | 5 |
| Post | 12 | 12 | 12 |
| Follow | 1 | 1 | 1 |
| Like | 5 | 5 | 5 |
| UserBlock | 0 | 0 | 0 |
| Orange ledger rows | 7 | 7 | 7 |
| Orange delta sum | 530 | 530 | 530 |

Fixture-specific Orange rows and sum were also zero during the test and before
cleanup. Equal aggregates are not proof that every database field is identical.

- `2026-08-31T16:36:14.077Z`: a read-only transaction confirmed these totals,
  zero run-marker User/Post residue, nine completed migrations, zero unfinished,
  and only the unapproved GCRA migration pending.
- The source/runtime moderation and swap-execution Ready/Enabled values all
  remained `false`. This is not a new authenticated moderation-route test.
- `16:34:41.705Z–16:34:42.504Z`: health/ready 200 with exact release, social
  active 200, anonymous blocks and both export endpoints 401. Health request ID
  `01e9889d-28b8-4c77-962c-7b2e841ce4cf`; ready request ID
  `2fb88b8d-cfc1-4877-a218-2703173eeca7`.
- Queried runtime logs: 79 rows spanning
  `15:53:39.686799029Z–16:34:42.752089985Z`; no error-level,
  schema-missing/deadlock/pool/fatal event observed. The exact deployment's HTTP
  5xx query returned zero rows. This is not continuous-load monitoring or a
  measured percentile; total request denominator was not collected, so an
  aggregate error rate is **not calculable**.

## Rollback and next gates

The prior `48bc35fca41fa8f693a95aee8c4b8dc339fee581` deployment
`a2b6bf2d-4042-420a-b5a7-bb4517ac8d1d` is now `REMOVED`, not a runnable rollback
snapshot. Its exact backend archive has SHA-256
`6f2d51161c4ee4c5d9338ae8a6835aece3b11ab064644016f63c497ea6efc1e3`.
No rollback ran. A separately approved code rollback must preserve additive
UserBlock data/ledger; returning to a pre-UserBlock app loses server Block
enforcement and is not a transparent safety-preserving fallback. This receipt
does not promote the [formal minimum reviewed source floor](../OPERATIONS.md#minimum-safe-web-rollback-baseline).

Still open:

- Existing account-local Block preservation/import on first server sync,
  particularly an empty server list, before another mobile build.
- Physical Block/Unblock, refresh/relaunch, account switching, stale requests,
  and cached-post behavior on an explicitly approved internal build.
- Actual A post for B→A post exclusion, B→A Like/Reply, removal of existing
  mutual follows, multi-page/cap behavior, and populated export redaction.
- Overall moderation, account-deletion, legal, release-bundle, and production
  gates remain independent. Prior Build 102/110 device passes are historical
  and do not prove this new server synchronization path.

Use the [device checklist](../../../docs/DEVICE_QA_CHECKLIST.md#account-bound-block--server-receipt-and-device-gates-2026-08-31)
for the next approved internal QA; do not mark its open items complete from this
server receipt.
