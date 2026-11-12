# Phase 2A + 2B local integration — 12 November 2026

**Local validation passed. Ready for separate feature-Preview release approval.**
No push, deployment, hosted SQL, environment change or paid provider call occurred.
This is not hosted acceptance or a measurement of live model quality.

## Preserved history and patch verification

- Base: `9efffe27a7aa1189b65b792d6ee0208de49db968`.
- Backend commits `c26aa7f` and `c384068` are successive descendants of the base.
  The existing `/workspace/Echo-phase2a` worktree and backend branch were preserved.
- Frontend attachment: `echo-phase-2b-intelligence-ux.patch`, 135392 bytes, one commit.
  Verified SHA-256:
  `d55f5661dac6e274cf4e9bea498c267400e82f6e9c37b9ed0e7f9e6c65877126`.
- Backup ref: `backup/phase2a-before-frontend-c384068`.
  Verified complete-history bundle:
  `/workspace/artifacts/echo-phase2-integration/before-frontend.bundle`.
- Integration branch: `integration/phase2a-2b`, worktree
  `/workspace/Echo-phase2-integration`, created from `c384068`.
- `git am --3way` applied the frontend patch as `db66328` without conflicts.
  Its original author commit was `ecb2701e8a9663b6f1112fc412d80c0099d832bc`.
- Integration corrections: `7bd65511d2a7c398f424de76fd384be476d33602`.
  A subsequent documentation-only commit records these results.
- Shared local feature branch and its remote-tracking ref remain `9efffe2`;
  `origin/main` remains `6f19c18`. No remote operation was performed during integration.

## Interface review and corrections

| Contract | Result |
| --- | --- |
| Citation identifiers and originals | Existing `memoryId`/memory ID, `source_version`/version and `chunkId`/passage ID remain compatible. Backend validation ties citations to the immutable original and brain node. UI navigation passes the source version and passage ID. |
| Exact passage display | UI highlights only an exact offset/text match. Message index and message ID select the correct speaker's passage, including alternate branches. Historical references remain attached to their original version. |
| Speaker and uncertainty | The frontend numbering helper originally dropped Phase 2A's optional claim metadata. It now retains and displays `speakerRole` and `certainty`. Legacy analyses remain valid, with no invented attribution. A unit regression and augmented browser response verify this contract. |
| Link evidence | Explicit suggestions, semantic candidates and confirmed connections remain separate. Existing passage references, cosine/model and stale-source fields are consumed. Additive backend interpretation fields do not break the UI. Dismissed edges are filtered by the backend; only confirmed edges are drawn. |
| Job states and controls | Saved states, progress counts, leases, retry timestamps and `acknowledgeCharge` match the backend. Paused is a presentation state. Historical versions cannot start processing. Backend authority over uncertain outcomes is preserved. |
| Summaries and insights | Numbering retains all evidence provenance and uses the analysis source version. Generated text remains separate from originals. Claim classification is an interpretation, not a factual guarantee. |
| Request disclosure | Request counts now explicitly exclude retries and warn that retries can add requests and charges. This is not a dollar-cost cap. |
| Error recovery | Added a browser test that injects a malformed library response, reaches the actual route error boundary, restores the response and uses Next.js `retry()` to recover the saved original. The installed Next.js documentation confirms the `retry` prop. Existing section retry coverage also passes. |

Integration corrections changed only `lib/intelligence-view.ts`,
`components/memory-intelligence.tsx`, `tests/intelligence-view.test.ts` and
`tests/browser/intelligence-experience.spec.ts`. Neither implementation was discarded.
No API route, security control, migration, anatomy asset or renderer was changed by
these corrections.

## Validation evidence

Raw logs and screenshots are preserved outside Git under
`/workspace/artifacts/echo-phase2-integration/`. A compact result record is in
[validation/phase2-integration.json](validation/phase2-integration.json).

| Check | Actual result |
| --- | --- |
| Complete combined unit/integration suite | **66 passed, 0 failed, 0 skipped.** Includes both real PostgreSQL tests; the earlier uncorrected integration also passed 65 tests. |
| Real PostgreSQL + pgvector | Disposable loopback Docker database, PostgreSQL **17.10**, pgvector **0.8.2**. Verified JSON arrays/objects, the production driver, hardened migrations and 22 RLS tables, API-role effective table/column denial, citation locking and integrity, isolation, historical versions and close/reopen persistence. Container removed afterwards. This was not Supabase PostgreSQL 17.11. |
| Migration rollback/retry and job recovery | Isolated PGlite tests cover atomic rollback, inherited grants, safe migration reruns, interrupted jobs, leases, cancellation, acknowledgement of uncertain outcomes, deduplication and source invalidation. Provider transports are mocks. |
| Full Chromium suite | **13 passed, 0 failed, 0 skipped** in 2.6 minutes, one worker. Includes the six existing journeys and seven integrated intelligence UX journeys. |
| Final cost-copy checks | After the disclosure wording was clarified, both affected browser journeys were rerun: **2 passed**. No other executable behavior changed after the full browser suite. |
| TypeScript | `npm run typecheck` passed after the browser server stopped. |
| Production build | `npm run build` passed serially after TypeScript. No overlapping browser or Next.js development server. |
| Standalone smoke | **4 checks passed**: health/startup, HTML/assets, authentication/memory/graph/export persistence and logout rejection. Isolated PGlite data removed. This is a local production-mode test, not a Production deployment. |
| Anatomy | **20,484 vertices, 40,960 triangles**, both hemispheres and source checksums verified. Front, side, three-quarter, mobile and intelligence screenshots inspected. |

The full browser suite exercises memory creation and reopening, consent, mock
indexing and summaries, exact cited passages, return to summary, source edits and
historical summaries, explicit/inferred/confirmed connections, cancellation and
resume, error boundaries and retry, mobile/reduced-motion layouts, logout/login
persistence, workspace isolation, anatomy rotation/zoom/raycasting and navigation.

The frontend tests reuse two isolated accounts. The complete suite registers eight
accounts against the existing ten-per-fifteen-minute limit; the added route retry
test reuses an account. Authentication limits were not changed.

## Visual and test limitations

- Tests labelled REAL use actual local application routes and databases, with
  **mocked provider transport**. They are not live OpenAI/Anthropic tests.
- Paused, waiting, failed, uncertain and running-elsewhere UI states use labelled
  stubbed responses. Their backend recovery mechanics have separate isolated tests.
- Structured insight and attribution rendering uses augmented responses tied to
  real test passage IDs. Those injected claims bypass backend generation validation;
  they are not evidence that the backend would accept those particular claims.
- Genuine paraphrase quality, summary entailment and model availability remain
  unverified without approved live processing or a separately obtained evaluation
  embedding artifact. Prior Phase 2A evaluation limitations remain in effect.
- CSS additions are primarily intelligence/inspector scoped. Shared tab overflow,
  mobile touch targets, error boundary wrappers (`display: contents`) and reduced
  motion selectors were reviewed. No anatomy/renderer source changed, and the
  existing anatomical interaction/browser tests pass. GPU-device coverage is limited
  to Chromium with SwiftShader in this environment.
- Expected console errors were deliberately induced by WebGL/error-boundary tests.
  Existing Three.js deprecation and color-environment warnings are non-fatal.

## Release gates and preserved boundaries

**No remaining local integration blocker.** Feature-Preview push/deployment still
requires explicit owner approval for the final integration HEAD. Do not interpret
this report as approval to advance the shared feature branch.

No hosted database was accessed. Existing Preview bindings, Production/main, both
Supabase projects, user memories and private recovery copies were untouched.
Migrations 001–003 are unchanged; migration 003 SHA-256 remains
`a480f12bad249982de869b4a992601edbd14a7d3e0a116d2badc75f707e01a78`.
All AI transport in validation was mocked; no paid API allowance was consumed.

After separate release approval: verify the branch-only echo-dev binding and
deployment target, publish only the approved feature ref, then perform authorised
hosted backend checks. Live AI quality validation needs a separately approved budget.
