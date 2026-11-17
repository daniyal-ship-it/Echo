# Validation record — 1 November 2026

Latest update — 17 November 2026: [Phase 5.1 review fixes](PHASE51_REVIEW.md)
passed **130 unit/integration tests (zero skips)** and **all 32 browser tests in one clean run**.
TypeScript, serial production build, four standalone smoke checks and anatomy verification passed.
Consent/dispatch-intent auditing, bounded authorization-rejection retries, best-effort save-failure
handling, WAV metadata, diagnostics, export/retention and fixture reuse are covered. Migration 005
is unchanged and remains unapplied by this task. All providers were mocked; no hosted DB access,
deployment or Production changes. See [validation evidence](validation/phase51-review.json).
The old report's 33 browser scenarios double-counted Meetings; the correct total is 32.

Latest local update — 17 November 2026: [Phase 5A meetings](PHASE5A_MEETINGS.md)
passed **128 unit/integration checks, zero skips**, including real disposable PostgreSQL
17.10 / pgvector 0.8.2, effective API-role ACL checks, inherited-grant rollback and durable
transcription-attempt persistence. TypeScript, serial production build, four standalone
smoke checks and anatomical source verification passed. All transcription responses were
mocked; no live provider calls or hosted database connections occurred.

Browser validation: the 32 combined scenarios initially returned 30 passes and two failures.
WebGL-disabled trail navigation timed out during a source-edit/hot-reload window; it passed
unchanged in a fresh run. The second-workspace scenario got 401 rather than 404 after its
unchecked registration (consistent with the suite's shared registration quota); it passed
with a fresh fixture. Both reruns passed together. Meetings, already included in that run, also passed separately
with invalid audio, consent, mock transcription, duplicate suppression, transcript inspection,
mobile overflow and logout/login persistence. **32 distinct browser scenarios have passing
results across these runs, not a clean single-run suite.** Authentication limits were unchanged.
Initial new-test Buffer and Next route-announcer selector issues were corrected.

Desktop/mobile Meetings renders were inspected and are saved in `docs/screenshots/phase5a-*`.
Existing regenerated screenshot baselines were preserved unchanged. The only screenshot
content is synthetic, explicitly mock-labeled. All browser servers stopped before the serial
build. See [machine-readable results](validation/phase5a-meetings.json).
Migration 005, Preview deployment and live provider acceptance remain separately gated.
The user's current Phase 4 hosted acceptance supersedes older historical NO-GO entries below;
this task did not independently re-inspect hosted databases.

Latest local update — 16 November 2026: [exact Session-pooler guard candidate](SESSION_POOLER_GUARD_REVIEW.md)
adds the approved echo-dev Session hostname/login/port pair while preserving direct
support, verified TLS and same-transaction cluster checks. All 123 tests passed
with zero skips; TypeScript and serial build passed. No hosted connectivity was
attempted. Candidate for separately authorized read-only preflight; migrations
remain unapproved. Earlier direct-only statements are historical.

Latest local update — 16 November 2026: [Session route preflight](SESSION_POOLER_MIGRATION_PREFLIGHT.md)
records blocked direct IPv6 connectivity, a bounded read-only identity precheck,
and five real-driver guarded-transaction scenarios. All 116 unit/integration tests
passed with zero skips, including disposable PostgreSQL/pgvector; TypeScript passed.
Hosted migration remains NO-GO; no pooler allowlist or hosted configuration changed.

Latest local update — 16 November 2026: [development migration identity guard](DEVELOPMENT_MIGRATION_GUARD.md)
requires explicit echo-dev authorization, pinned direct TLS attribution and exact
cluster identity on the actual migration transaction before DDL. No hosted
execution is approved; the existing Phase 4 source checkpoint is preserved.
Earlier entries below are historical.

Latest local update — 14 November 2026: [Phase 4A + 4B integration](PHASE4_INTEGRATION.md)
is complete on `integration/phase4a-4b`. The strict v1 adapter reconciles all seven
UX contract questions; consent, staged peer review/synthesis, history, scoped
citations and uncertain recovery use the real backend with test-only provider
transports. Validation passed **108 unit/integration tests, zero skips**, including
real disposable PostgreSQL 17.10 / pgvector 0.8.2; **31 browser tests**, TypeScript,
a serial production build, four standalone smoke checks and anatomy verification.
The unchanged renderer benchmark passed in 59.1 seconds; physical-device
performance remains unverified. [Machine-readable evidence](validation/phase4-integration.json).
Migration 004 remains unchanged. Hosted migration/Preview release are **NO-GO**
until separate approval and echo-dev identity/permissions/recovery preflight.
No push, deployment, hosted database access or paid provider calls occurred.
Earlier entries below describe historical checkpoints.

Latest local update — 13 November 2026: [Phase 4A collaboration backend](PHASE4_BACKEND.md)
adds durable parallel/deliberate multi-provider threads, cross-review, follow-ups,
consent/call limits, source checks and explicit interrupted-call recovery. Local
validation passed 100 unit/integration tests (including real PostgreSQL/pgvector,
zero skips), 23 existing browser tests, TypeScript, serial build, four standalone
smoke checks and anatomy verification. Providers were mocked; no paid calls or
hosted changes occurred. Work remains on `feat/phase4a-collaboration-engine`.
Claude's frontend integration and separate approval for migration 004/Preview
release remain required. See the [API contract](PHASE4_COLLABORATION_CONTRACT.md)
and [security review](PHASE4_MIGRATION_SECURITY.md). Earlier entries are historical.

Latest local update — 13 November 2026: [Phase 3A + 3B integration](PHASE3_INTEGRATION.md)
passed 77 unit/integration tests (including real PostgreSQL/pgvector), all 23
browser tests in one run, TypeScript, a serial production build, four standalone
smoke checks and anatomy verification. Three compatibility fixes cover stale
history failures, truthful renderer status and safe-area integration. Work remains
local on `integration/phase3a-3b`; no push, deployment or hosted change occurred.
R1–R7 renderer proposals are explicitly partial/deferred; physical-device and
60-FPS acceptance remain outstanding. Earlier checkpoint entries are historical.

Latest local update — 12 November 2026: [Phase 2A + 2B integration](PHASE2_INTEGRATION.md)
passed 66 unit/integration tests (including real PostgreSQL/pgvector), 13 browser
tests, TypeScript, a serial production build, four standalone smoke checks and
anatomy verification. The two browser journeys affected by the final retry-cost
wording also passed. Work is isolated on `integration/phase2a-2b`; nothing was
pushed or deployed and no hosted database or environment was changed. Live
provider quality remains unverified. Earlier checkpoint entries below are historical.

Latest target update (11 November): the owner has created **echo-dev /
 dtcxlxehqiuhmhuypqbm / eu-central-1**. See [the new-target preflight](ECHO_DEV_PREFLIGHT.md)
for accepted identity/version evidence, remaining read-only security/extension
checks, atomic execution plan and separate approval gates. Earlier creation-pending
statements below are historical. The old project and Production remain unchanged;
no migrations, bindings or deployments have been performed for echo-dev.

Latest result: the authorised diagnostic has executed once on feature Preview
109eb10. Database/effective role/session role are postgres, resolved search path
public,extensions, and transaction read-only=true. Temporary flags were removed
and the disabled cleanup Preview is READY. No migrations or Production changes.
See [verified runtime and cleanup](MIGRATION_SECURITY.md). Earlier preparation-only
or runtime-unverified statements below are historical and superseded.


Prepared, not deployed: [temporary Preview identity diagnostic](PREVIEW_IDENTITY_DIAGNOSTIC.md).
It defaults off and requires separate approval for a feature-only deployment,
short-lived flags, protected read-only probe and cleanup. Current Vercel evidence
is accepted; database sharing remains the assumption. Migration stays NO-GO.


Latest runtime/recovery review: public USAGE/no-CREATE for API roles and postgres's
membership direction are accepted and closed. [MIGRATION_SECURITY.md](MIGRATION_SECURITY.md)
records fresh Vercel metadata and four remaining gaps: runtime identity, extension
installation authority, active database dependencies and actual recovery inventory.
No code, hosted SQL, deployment, role, default privilege or Production change occurred.


Latest authorised implementation: [MIGRATION_SECURITY.md](MIGRATION_SECURITY.md).
003 is implemented and locally tested; hosted execution remains **NO-GO** pending
remaining role/extension/recovery and Production-coordination checks. The owner
has confirmed automatic exposure disabled and saved. Earlier statements
below that the security companion is unimplemented are historical and superseded.


## Owner Supabase inspection and security reconciliation — 2 November

Accepted owner-reported findings: project echo / pyidklztsnowarqumtki / eu-west-1,
postgres database/inspected role, no public tables/views/sequences/functions/ECHO
migration objects, creation permissions available, vector 0.8.2 available and
not installed. This was not independently rerun by this agent. No credentials
were requested, and no hosted SQL was dispatched in the reconciliation.

Repository review confirms unchanged migration hashes and no RLS/GRANT/REVOKE
controls in 001/002. Official Supabase security docs and pinned pgvector 0.8.2
sources were retrieved over verified HTTPS. Current Data API exposure and default
ACLs are unverified, so the existing scripts are not approved as-is.

An isolated in-memory PGlite fixture passed 18 permission-denial checks for
SELECT/INSERT/UPDATE/DELETE/TRUNCATE/function execution across anon, authenticated
and service_role. Owner access and no-policy RLS denial also passed. The new
metadata-only SQL ran in read-only mode. These are control-semantics tests with
minimal harmless fixtures, not full application migrations, actual Supabase
permissions, HTTP/browser checks or proof of hosted security. No ECHO migration,
application change, provider request or Production operation occurred.

See [current decision and plan](DATABASE_PREFLIGHT.md) and
[evidence](validation/security-preflight-2026-11-02.json). Earlier access-only
checks below are retained as historical records, not the current approval blocker.

## Migration preflight preparation

**2 November recheck:** Git ancestry and unchanged application/migration source
passed; live Vercel metadata and feature-alias source remain unchanged. The local
database connection is still a placeholder. No new hosted SQL or local tests
were run, and no schema-readiness verdict is possible. See
[metadata evidence](validation/preflight-access-2026-11-02.json).

Live Vercel metadata confirms the existing project, unchanged binding scopes and
Production source `6f19c18`. Direct hosted SQL inspection is blocked: the local
DATABASE_URL is a placeholder and Vercel's Sensitive value is not returned by
the authenticated environment read. There is no hosted emptiness/conflict or
installation-readiness verdict. No credential, database or deployment changed.

The supplied [preflight SQL](preflight/database-preflight.sql) passed parsing and
execution in an isolated in-memory PGlite database with read-only/repeatable-read
settings. Minimal local table stubs verified row-presence booleans, migration
history counts and an index-name conflict without returning row values. No ECHO
migration or hosted credential was used. These checks validate the inspection
script only; they do not prove hosted PostgreSQL compatibility or data absence.
See [plan and access blocker](DATABASE_PREFLIGHT.md) and
[evidence](validation/preflight-access-2026-11-01.json).

## Password-update verification

The unchanged `c292574` source was redeployed to load the owner's updated
DATABASE_URL. Live health and auth-status requests both completed `SELECT 1`
with verified TLS: **28P01 is resolved**. Both endpoints still return HTTP 500,
now with correlated `DB_MIGRATION_REQUIRED`. Both migration SQL assets are present;
neither migration is recorded as applied. pgvector is available but not installed
or visible. Database CREATE and schema USAGE/CREATE checks pass. All database
inspection was read-only; no schema write or full relation inventory occurred.

The feature alias points to READY deployment `dpl_7SnSSc4w7sYJGvGq67wCxMaxA2oW`.
Vercel metadata shows DATABASE_URL still shared across Production and Preview,
without a branch override; this differs from the reported scope. All environment
metadata remained unchanged during verification. CA/API keys/protection were
preserved. Local OIDC material was removed; no automation bypass was created.

Authentication, notes, persistence and live AI acceptance remain blocked by
pending migrations. No browser check, local test rerun or billable call occurred.
See [handoff and exact next action](BACKEND_REPAIR.md) and
[live evidence](validation/password-verification-2026-11-01.json).

## Certificate configuration after environment publication (historical)

Live results: official HTTPS certificate download and provenance, CA status,
validity/signature, branch-only Preview configuration and c292574 redeployment
**passed**. TLS/hostname validation now reaches PostgreSQL authentication, which
**failed with SQLSTATE 28P01**. The read-only health request returned HTTP 500;
SELECT 1 did not succeed. Migration inspection and application account/note/new-
session persistence checks remain **blocked** and were not attempted. No new
hosted browser acceptance or billable AI call is claimed. No code, shared schema,
DATABASE_URL, API keys or protection settings changed. The local OIDC file was
removed; no persistent automation-bypass credential was created.

See [current handoff](BACKEND_REPAIR.md) and
[correlated evidence](validation/certificate-verification-2026-10-31.json).
Local tests/build were not rerun for this configuration-only change. The earlier
results below are retained as historical evidence, not the current failure cause.

## Backend repair follow-up before CA installation (historical)

See [BACKEND_REPAIR.md](BACKEND_REPAIR.md) for the confirmed private diagnostic
error, correlation IDs, deployed checkpoints and remaining certificate-download
blocker. The later repair adds safe diagnostics, read-only managed initialization
and DATABASE_CA_CERT support. Current local results: **36 core tests passed**,
TypeScript/build passed, and all four standalone production smoke groups passed.
The TLS regression uses actual local TLS handshakes, verifies successful trust,
and rejects both an unknown CA and a hostname mismatch. Disposable TLS keys and
local database fixtures were removed. No real provider request was dispatched.

The hosted diagnostic deployment still returns HTTP 500 with
SELF_SIGNED_CERT_IN_CHAIN; no connection query or migration inspection succeeded.
The official Supabase CA has not yet been downloaded/configured. Local TLS success
is not a hosted repair claim. Account/note/logout-login acceptance remains blocked.
The following section preserves the earlier verification and local/mock evidence.

## Authorised hosted verification

See [HOSTED_VERIFICATION.md](HOSTED_VERIFICATION.md) and the
[new machine-readable results](validation/authorised-hosted-verification-2026-10-31.json).
Git fetch/ancestry, exact-host network, management authentication, READY source
`ae08e7f`, branch APP_ORIGIN and saved credential metadata **passed**. OIDC issued
through the official SDK workflow using existing VERCEL_TOKEN reached ECHO without
creating an automation bypass. Native Chromium TLS validation **passed** after
narrowly granting write access to its existing NSS database. No CA was added and
certificate checks stayed enabled. Hosted brain renders, colours, camera presets,
rotation and zoom **passed** in system Chromium via Playwright.

Health and auth-status endpoints **failed** with HTTP 500. Vercel logs confirm
application errors, but the database initialization/health-query root cause is
unresolved. No isolated account was created. Import, preserved originals,
summaries, semantic retrieval, each live provider, citations and logout/login
persistence remain **blocked**. The user's **US$1 aggregate approval** is recorded;
official pricing requests remain proxy-blocked, so zero billable requests were
dispatched and run cost is US$0. Local OIDC material was removed; no persistent
bypass credential requires revocation. See the handoff for token expiry and
cleanup distinctions. No application code or deployment changed.

The following local results were obtained at the implementation checkpoint and
were **not rerun** during this verification-only follow-up.

## Memory intelligence increment

| Check                                  | Result                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run assets:verify`                | Passed: 20,484 vertices, 40,960 triangles; original anatomy and source checksums unchanged                         |
| `npm run typecheck`                    | Passed                                                                                                             |
| `npm test`                             | 30 passed, 0 failed/skipped; isolated databases and explicit provider mocks                                        |
| `npm run test:e2e`                     | 6 passed in one final run (2.3 minutes), including the complete labelled mock intelligence journey                 |
| `npm run build`                        | Passed: optimised standalone Next.js build, TypeScript and route tracing                                           |
| `npm run test:production`              | All 4 standalone production-mode smoke groups passed; isolated PGlite database removed                             |
| Live provider calls                    | Blocked: runtime failure, unavailable current pricing and unverified model access; US$1 total approved, US$0 spent |
| Hosted smoke / new-session persistence | Health/auth-status failed HTTP 500 after successful OIDC access; hosted login/persistence blocked                  |

The new `tests/intelligence.test.ts` tests exact Unicode/message boundaries,
versioned references and inactive branches; real database close/reopen; unchanged
originals; duplicate processing and chunk cache reuse; recorded-result replay;
lease concurrency; rate-limit backoff; unknown billing acknowledgement; cancel;
source invalidation/deletion (including during a call); semantic candidate evidence
and dismissed links; question-cache reuse; invalid quotes/citation numbers; and
workspace checks before provider egress. `tests/migration.test.ts` upgrades a
migration-001 database without changing original content, versions or anchors.

`tests/browser/intelligence.spec.ts` imports a tiny supported ChatGPT archive,
verifies original roles/raw metadata, separately generates and saves a cited
summary, indexes two messages, retrieves a paraphrase, answers with each provider
independently, opens the exact passage and brain node, then signs out/in and
retrieves the same saved material. It also verifies duplicate enqueue and a
no-evidence answer path. **Every provider response/vector in this test is a labelled
mock**. Settings model-access checks are mocked too, not evidence of entitlement.

The browser mock transport is loaded explicitly by Playwright only; it refuses
nonlocal database/origin settings or live credentials. Production adapters use
fixed official provider APIs with no mock fallback. Mock output visibly says
`[MOCK PROVIDER]`, and the isolated account is labelled. No fixtures were added
to the owner's workspace or remote database, and no provider charges were incurred.

The existing five browser journeys continue to cover anatomical raycasting,
rotation/zoom, topics and back navigation, cross-lobe confirmed connections,
original imports/versions, source focus, logout races, workspace isolation,
new sessions, WebGL fallback, and mobile/immersive layouts. The new journey caught
an incorrect test selector, expanded filter controls overlapping the sidebar
footer, and a test click before authentication hydration; those are corrected.
The no-WebGL scenario intentionally logs a renderer error. Three.js Clock/CommonJS
and Node colour-environment deprecation warnings remain.

Thirty core tests and local browser persistence are not managed PostgreSQL or
live-model acceptance. Citation validation checks references/exact quotes, not
whether a generated claim is semantically entailed. The one-hot mock vectors
exercise search/caching/access logic, not embedding quality or threshold calibration.

## Actual rendered visual evidence

Screenshots show only isolated, labelled demonstration/test records. New UI
renders were visually inspected for readable summary metadata, exact source text,
provider separation and original brain-node focus:

- [Generated summary and index status — MOCK](screenshots/intelligence-mock-summary.png).
- [Exact original passage and source version — MOCK journey](screenshots/intelligence-mock-passage.png).
- [Independent OpenAI answer — MOCK](screenshots/intelligence-mock-openai.png).
- [Independent Anthropic answer — MOCK](screenshots/intelligence-mock-anthropic.png).

Preserved anatomical and navigation views:

- [Front](screenshots/front.png): separate hemispheres and fissure, point scaffold.
- [Side](screenshots/side.png): preserved cortical folds and atlas lobe boundaries.
- [Three-quarter](screenshots/three-quarter.png): depth and distinct stored glyph.
- [Topics](screenshots/topics.png): actual tag groups shown as rings and a readable list.
- [Connected memory](screenshots/connected-memory.png): selected original, actual
  neighbour and confirmed edge, with whole-brain/lobe/topic/memory breadcrumbs.
- [Raycast memory selection](screenshots/memory-selected.png).
- [Retrieved sources](screenshots/retrieval.png).
- [Mobile](screenshots/mobile.png), [fresh mobile low preset](screenshots/mobile-low.png),
  [mobile selection](screenshots/mobile-selected.png) and
  [immersive mobile](screenshots/immersive-mobile.png).

The desktop views were visually inspected for recognizable folds, clear lobe
colours and point-led construction. Mobile checks cover source access, framing,
layout separation and navigation. A depth-only surface prevents far-side lobe
colour bleed; the neutral visible mesh is deliberately faint. Graph links and
memory glyphs are drawn as a separate overlay so relevant records stay findable.
No source paragraphs are placed in 3D. Topic groups can overlap spatially; the
paginated list is the deterministic, accessible way to choose overlapping groups.

The licensed fsaverage5 geometry is a genuine group-average cortical surface,
not procedural substitute anatomy. Cerebellum and brainstem are absent. The visual
review is not a medical certification, hardware GPU test or specialist review.

## Performance evidence and limits

Historical foundation/exploration measurements: [benchmark.json](validation/benchmark.json).
The benchmark was not rerun for this increment and does not measure vector retrieval.

| Records |         Draw objects |    Graph | Full-text search | Library |
| ------: | -------------------: | -------: | ---------------: | ------: |
|     100 |                  100 |    33 ms |             6 ms |   11 ms |
|   1,000 |                1,000 |    78 ms |             8 ms |   13 ms |
|  10,000 |   639 spatial groups |   180 ms |            41 ms |   24 ms |
| 100,000 | 1,272 spatial groups | 2,126 ms |           468 ms |  209 ms |

These are isolated PGlite data-path measurements taken while browser verification
also ran; they are not comparable to dedicated production load tests. GPU FPS,
sustained memory use, topic-group query load at production scale and concurrent
managed-database behaviour remain unmeasured. There is no 60 FPS certification.
Three.js Clock/CommonJS and Node colour-environment deprecation warnings remain;
no shader compilation failures or page errors were found in the successful normal
journeys. The no-WebGL scenario intentionally produces a renderer error.

## Preservation and live scope

Resumption began at committed feature checkpoint `4b19901`; `main` remains
`6f19c18`, and both contain the actual ECHO application. No renderer, anatomy,
dependency versions or original schema were replaced. Migration 002 adds derived
records and source-update invalidation. Its upgrade fixture preserves all original
content and anatomical anchors. An external Git bundle preserves the prior checkpoint.

The Vercel API confirms the correct team/project/GitHub link and enabled deployment
protection. The feature Preview was verified READY at `ae08e7f` with its correct
branch-specific APP_ORIGIN. The main preview must not be substituted for this branch:

https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

The API confirms sensitive Preview bindings for DATABASE_URL and both existing
ECHO-prefixed provider keys. The keys are absent from this Codex runtime and were
not requested again, replaced or printed. Preview and Production share the database
binding; no isolated cloud fixture or managed migration check was performed.

Earlier SDK catalogue checks covered `gpt-6.1-sol`, `claude-sonnet-5-5` and
`text-embedding-3-small`; SDK support does not verify account access. Existing
Vercel authentication now obtains OIDC accepted by the protected Preview, without
creating a persistent bypass or weakening protection. The runtime health failure
and proxy-blocked pricing prevent live model checks; the aggregate US$1 budget
is approved and unspent. Reuse the saved keys through the authorised runtime.
See [DEPLOYMENT.md](DEPLOYMENT.md) and the current hosted handoff.

The **complete core milestone has not passed**. Live embeddings, summary fidelity,
each provider's grounded answer/citation, managed schema/runtime persistence and
new-session hosted retrieval remain unverified. Request-driven processing, the
64-passage bound, approximate ranking thresholds, lack of an independent worker
and unified dollar budget are documented in [IMPLEMENTATION.md](IMPLEMENTATION.md).
Voice/meetings, reminders/calendar, connectors and production hardening remain
on the [roadmap](ROADMAP.md), outside this increment.
