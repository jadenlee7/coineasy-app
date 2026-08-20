# ADR: Automatic startup with same-build diagnostic recovery

**Status:** Accepted
**Date:** 2026-08-13

## Context

Builds 97 through 107 used a five-step, user-operated startup diagnostic to
isolate earlier iOS Privy crashes. The diagnostic made those crashes observable
and Build 107 proved the full path on the affected iPhone, but requiring every
healthy launch to repeat the diagnostic is no longer an acceptable user flow.
The startup root must also continue owning deep links before authentication and
navigation are ready.

## Decision

Healthy launches load EasyGo automatically after restoring the persisted
startup marker and evaluating the required polyfills. The root continues to
capture initial and foreground URLs and passes the latest event into the full
app.

The existing manual diagnostic remains the recovery path. It is shown only
when the persisted last marker belongs to the current native build, names a
known startup step, and has `pending` or `failed` status. Successful markers,
markers from older builds, malformed records, and unrelated steps do not block
startup.

Every automatic step uses the existing persisted marker chain. If startup is
interrupted before `full-provider-ready` passes, the next launch enters manual
recovery. The diagnostic still mounts one Privy Provider and hands that Provider
to the full app; the normal automatic path uses the full app's existing Provider
fallback.

## Options considered

1. Keep the manual diagnostic on every launch. Safest operationally, but adds
   repeated tester-only work to every user session.
2. Remove the diagnostic and always mount the full app. Simplest, but loses the
   proven recovery and last-step evidence if a native startup regression returns.
3. Automatically start with persisted same-build recovery. Selected because it
   removes normal friction while retaining the diagnostic and deep-link boundary.

## Consequences

- Normal users see one fixed EasyGo-branded launch surface and then the app.
  Step labels, persisted markers, build diagnostics, and diagnostic controls
  render only after the recovery policy selects the recovery path.
- A same-build interrupted startup deliberately requires the existing manual
  recovery flow on the next launch.
- The first internal build containing this decision requires physical-device QA
  for automatic cold launch, foreground launch, recovery entry, Apple login,
  wallet/Base/Orange retention, and cold-launch profile links.
- No backend, Railway, database, consent, distribution, or feature-flag change
  is part of this decision.

## Device validation note

Build 108 proved that automatic initialization, login, and full-app entry work
without a user tap, but its normal launch surface still displayed changing
startup step labels. The 2026-08-20 follow-up keeps the persistent marker chain
unchanged while separating healthy presentation from recovery presentation.
