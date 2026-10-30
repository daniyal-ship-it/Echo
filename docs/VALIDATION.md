# Validation record — 30 October 2026

## Republished-environment hosted check

See [HOSTED_VERIFICATION.md](HOSTED_VERIFICATION.md) and the
[machine-readable results](validation/hosted-verification-2026-10-30.json).
Git fetch/ancestry, exact-host network access, Vercel management authentication,
READY deployment source `30a337e`, branch APP_ORIGIN and saved credential binding
metadata **passed**. Network access now reaches Vercel's SSO/login redirect; the
former proxy denial for this hostname is resolved. Deployment authentication and
ECHO's own login are distinct. No authorised deployment browser session or existing
automation credential is available to this runner, so the live journey is **blocked**.

System Chromium/Playwright are available, but the attempted navigation **failed
certificate validation before page rendering**. The platform proxy certificate
is already present in both the runtime trusted bundle and the NSS certificate
store; the browser failure needs further diagnosis, not an unverified claim that
installing a missing certificate fixes it. TLS validation was not disabled.
No hosted application browser test, import, AI call, citation selection or
new-session persistence test passed. No numeric spending approval was recorded.

The following local results were obtained at the implementation checkpoint and
were **not rerun** during this verification-only follow-up.

## Memory intelligence increment

| Check                                  | Result                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run assets:verify`                | Passed: 20,484 vertices, 40,960 triangles; original anatomy and source checksums unchanged               |
| `npm run typecheck`                    | Passed                                                                                                   |
| `npm test`                             | 30 passed, 0 failed/skipped; isolated databases and explicit provider mocks                              |
| `npm run test:e2e`                     | 6 passed in one final run (2.3 minutes), including the complete labelled mock intelligence journey       |
| `npm run build`                        | Passed: optimised standalone Next.js build, TypeScript and route tracing                                 |
| `npm run test:production`              | All 4 standalone production-mode smoke groups passed; isolated PGlite database removed                   |
| Live provider calls                    | Not run: deployment authentication and explicit test budget pending; saved Vercel keys remain configured |
| Hosted smoke / new-session persistence | Blocked before ECHO: Vercel deployment authentication; network now reaches the feature alias             |

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
protection. The feature Preview was verified READY at `30a337e` with its correct
branch-specific APP_ORIGIN. The main preview must not be substituted for this branch:

https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

The API confirms sensitive Preview bindings for DATABASE_URL and both existing
ECHO-prefixed provider keys. The keys are absent from this Codex runtime and were
not requested again, replaced or printed. Preview and Production share the database
binding; no isolated cloud fixture or managed migration check was performed.

Official SDK model lists were checked for `gpt-6.1-sol`, `claude-sonnet-5-5` and
`text-embedding-3-small`; SDK support does not verify account access. The network now
reaches the feature auth endpoint, which redirects to Vercel authentication. No
existing authorised deployment session is available in this runner; the management
API token is not a browser session. No new bypass credential or weakened protection
was introduced. Existing saved keys must be reused through the authorised runtime. See the exact
live checklist and dashboard fallback in [DEPLOYMENT.md](DEPLOYMENT.md).

The **complete core milestone has not passed**. Live embeddings, summary fidelity,
each provider's grounded answer/citation, managed schema/runtime persistence and
new-session hosted retrieval remain unverified. Request-driven processing, the
64-passage bound, approximate ranking thresholds, lack of an independent worker
and unified dollar budget are documented in [IMPLEMENTATION.md](IMPLEMENTATION.md).
Voice/meetings, reminders/calendar, connectors and production hardening remain
on the [roadmap](ROADMAP.md), outside this increment.
