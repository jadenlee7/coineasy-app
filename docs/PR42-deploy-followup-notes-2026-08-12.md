# EasyGo Deploy Follow-up Notes (PR-Style) — 2026-08-12

## Context
- Scope: unresolved items from `backend/docs/DEPLOY_CHECKLIST.md` that remain unchecked after Build 102/102+ rollout and Telegram rollout.
- Current branch: `agent/easygo-next-feature-spec-3`.
- Goal: keep release clean by tracking only production-blocking and verification-blocking items.

## Required follow-up (PR-ready checklist)

1. **Consent publish parity**
   - `backend/docs/DEPLOY_CHECKLIST.md` item: Verify published privacy/terms version equals `EASYGO_CONSENT_VERSION`.
   - Current issue: deployed privacy/terms documents are legacy (`ThePivot` dated 2023-08-26 and unversioned terms reference).
   - Next action: finalize and publish EasyGo-branded legal docs in one release candidate, then set `EASYGO_CONSENT_VERSION` parity and confirm manifest visibility.

2. **Remaining security / audit findings**
   - Item: Approve or remediate remaining Squid, Privy/Solana, Expo audit findings.
   - Current issue:  backend has pending findings (notably Squid update + `@privy-io/node` migration), mobile has high/critical Expo 51 toolchain findings.
   - Next action: produce risk/mitigation proposal or dependency PR bundle for approved security track.

3. **Core read-path QA (Path C flags off)**
   - Item: Verify feed/profile/follow/notification/Orange balance/Squid quote without enabling Path C flags.
   - Current issue: this verification batch not recorded after recent deployment cycle.
   - Next action: execute staging smoke matrix and attach pass/fail evidence with request IDs.

4. **Worker SIGTERM with flags enabled**
   - Item: Exercise SIGTERM for enabled worker only in approved environment.
   - Current issue: worker SIGTERM verified only during dormant mode (`SEGMENTS_ENABLED=false`).
   - Next action: prepare controlled approved test window and capture stop/start behavior + graceful cleanup logs.

5. **Monitoring stack activation**
   - Item: Activate Sentry/Better Stack before production traffic.
   - Current issue: intentionally unset pending privacy/vendor approval.
   - Next action: complete approvals, set env vars, verify heartbeat/eventing and alerting baseline.

6. **Path C rollout sequencing**
   - Item: Enable one Path C feature only after baseline is stable.
   - Current issue: rollout intentionally blocked.
   - Next action: run single-feature rollout runbook and rollback drill before expanding flag surface.

7. **Release close gate**
   - Item: Release close only after monitoring window completes.
   - Current issue: completion evidence not yet appended.
   - Next action: close release on explicit monitoring-complete milestone.

## Notes for next PR
- Keep these items in a dedicated follow-up PR so Build 102 QA can remain isolated.
- Any code/security changes should be split by domain (backend vs mobile vs infra) to simplify rollback.
- Do not enable production traffic until all seven items are closed or formally waived.
