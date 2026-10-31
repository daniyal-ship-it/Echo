# Validation record — 31 October 2026

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
