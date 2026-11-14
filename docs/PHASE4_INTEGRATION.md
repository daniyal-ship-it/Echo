# Phase 4A + 4B local integration — 14 November 2026

Branch: `integration/phase4a-4b`. Base:
`256a036449db1e1de6a2c484a39d98258239d922`. Backend checkpoint:
`bfae2aba3695ec1c059d3042e9635dd74c14b35d`.

## Provenance and preservation

Transferred `echo-phase-4b-collaboration-ux.patch` is **172,340 bytes** with SHA-256
`3b477c46fa698ded3cd4d62456167b8b859f651d8e3dab12117f851cc6218d5a`.
It contains three mail commits, identifying original commits:

1. `941765013d1add61f1532376c74d0d61396f6453`
2. `e251c5e75f81a22aa8a943657dc8e46a56585300`
3. `f051816504554635988ad5c589c0af36e01ae5df`

The complete transferred series applied cleanly with `git am --3way` on the exact
Phase 3 base. That independently verified reconstruction is preserved as
`backup/phase4b-transferred-series` (`92cb939`, `e331c2d`, `7b8f242`). The original
frontend Git objects/committer metadata were not included in the patch, so their
original parent graph cannot be cryptographically verified from this attachment.
These are reconstructed commits, not a claim that their SHAs equal the original
mail-header identities. The reconstructed branch's ancestry from the supplied
base and its exact transferred content are verified.

Backend ancestry is verified directly. `feat/phase4a-collaboration-engine` remains
at bfae2ab; `backup/phase4a-before-4b-bfae2ab` additionally preserves it. Original
refs and a verified full-history pre-integration bundle are recorded outside Git
under `/workspace/artifacts/echo-phase4-integration/`. Earlier recovery references
and bundles remain intact. Integration started from bfae2ab and applied all three
frontend commits in order as `644118e`, `a999d94`, `352ca6c`.

Exactly two add/add conflicts occurred:

- Backend `lib/collaboration-types.ts` retained; frontend types preserved as
  `lib/collaboration-ui-types.ts` and frontend imports redirected.
- Backend `tests/collaboration.test.ts` retained; frontend presentation tests
  preserved as `tests/collaboration-view.test.ts`.

No implementation was silently selected over the other. The final compatibility
commit adds the strict transport adapter and reconciles behavior. Shared feature
branch, main, Production, hosted databases, recovery schemas, existing memories
and credentials were not changed. Nothing was pushed or deployed.

## Contract reconciliation

The authoritative request/response API remains
[PHASE4_COLLABORATION_CONTRACT.md](PHASE4_COLLABORATION_CONTRACT.md). The frontend's
original proposal is preserved in [PHASE4_UX_CONTRACT.md](PHASE4_UX_CONTRACT.md),
with the seven open questions explicitly resolved there.

- `lib/collaboration-adapter.ts` validates real v1 snapshots using strict enums,
  UUIDs, dates, model configuration, limits, ownership references and exact quote
  references. It translates into the existing presentation types. Production
  does not fall back to accepting the old mock API format.
- The client sends version, current turn ID, idempotency key, consented models and
  limits. Network retries retain operation identity; stale GET responses cannot
  replace a newer cancellation or follow-up. UI refreshes have generation guards.
- Creation performs scoped keyword retrieval and persists a queued turn, without
  a provider call. The existing filter whitelist was added as an optional,
  backwards-compatible turn field; it is passed to the existing parameterized,
  workspace-scoped retrieval layer rather than silently ignoring the UI scope.
- One advance executes one stage. Parallel is two independent answers, without
  synthesis. Deliberate is two answers, two real cross-reviews and one OpenAI
  synthesis. Review and synthesis require explicit continuation. Running state
  is polled only with GET; no background-worker claim or automatic retry exists.
- Consent discloses a per-turn ceiling of 5 requests for parallel or 8 for
  deliberate, including at most three explicitly requested retries. Each call
  has a 1200 output-token cap and 48,000-byte context cap. These are requested
  bounds enforced by the server, not invented prices. Keyword retrieval makes
  no embedding request. Follow-ups require fresh consent and inherit these limits.
- `awaiting-next-step` maps to the presentation's `awaiting_continuation`;
  `uncertain` maps to `needs_review`. Only actual saved call entries appear in
  the workflow. Failed/withheld/uncertain attempts remain in the backend ledger.
- Displayed model prose is reconstructed from validated structured reasoning,
  never from withheld raw output. Synthesis claims are labelled source-grounded,
  not “both models agree.” Reported agreements, disagreements, uncertainty and
  interpretations remain separate. Missing provider positions are not invented.
- Stale/deleted source context withholds results and marks the turn clearly.
  Indexed citations open the actual memory/version/passage and back navigation
  returns to the collaboration. Historical unindexed citations retain offsets.
- List responses now include real latest-turn metadata and use a scoped stable
  chronological cursor. Existing list fields are retained. No schema change was
  needed for this additive API metadata or filter field.

## Testing and evidence

Final result: **108 unit/integration tests, zero skips; 31 browser tests, zero
skips; TypeScript; serial production build; four standalone smoke checks; anatomy
verification — all passed.** Real PostgreSQL was 17.10 with pgvector 0.8.2 in a
disposable loopback container, removed afterwards. Browser/standalone data were
isolated PGlite fixtures. No hosted PostgreSQL 17.11 acceptance is claimed.
See [machine-readable results](validation/phase4-integration.json).
All provider output is labelled test content; no paid/live provider call occurred.

Testing categories remain explicit:

- Eight historical frontend-only presentation/transport fixture tests remain
  under `tests/collaboration-view.test.ts`. Their test-only legacy client and mock
  model exercise the preserved Phase 4B proposal; they do not establish the real
  backend contract. No application file imports those fixtures.
- `tests/collaboration-api.test.ts` exercises authenticated API handlers, actual
  provider adapters with mocked official HTTP, the real frontend client/adapter,
  scope enforcement, source validation, follow-up/cancel and stale GET rejection.
- `tests/browser/collaboration.spec.ts` replaces the obsolete unavailable-backend
  journey and reconciles all eight browser scenarios with the real local backend.
  Seven are real local API/database journeys with provider-only mock transport;
  one stubs malformed/offline/unavailable browser responses. Production contains
  no simulated provider outputs or collaboration-event generator.
- Existing durable-work regressions run on both PGlite and real isolated
  PostgreSQL/pgvector: concurrency, duplicate requests, interrupted leases,
  partial results, late-worker exclusion, cancellation, source invalidation and
  workspace isolation. Hostile ACL/default grants, JSON serialization, migration
  rollback and reopen/rerun persistence are also tested.
- The combined browser suite covers collaboration plus Phase 2 intelligence,
  Phase 3 navigation, accessibility, layouts and renderer regressions. The full
  suite reuses one collaboration account and the frontend patch's shared
  intelligence account, staying within the existing ten-registration limit.
  No live authentication or registration safeguard was weakened.

Initial browser checks found test selector mismatches (whitespace in citation
accessible names, destination-bearing back labels, and Next.js's additional alert
region). Selectors were corrected to match the real accessibility tree. The
subsequent eight-journey run passed. Raw evidence and screenshots are retained
outside Git; selected final screenshots accompany this report.

### Renderer investigation and visual inspection

The unchanged density/context-loss/reload/asset-failure benchmark passed in 59.1
seconds under its existing 150-second timeout. The prior timeout did not recur;
its root cause is not established and no timeout was increased. SwiftShader RAF
median/p95 intervals were 66.7/183.3 ms (empty), 83.3/166.6 ms (100 nodes),
250.0/333.4 ms (1,500 nodes), and 333.2/866.6 ms (100,000 records aggregated to
1,500 nodes). These are slow software-rendered measurements, not hardware FPS
or a performance release pass. Physical devices and browser/GPU combinations
remain untested. The existing THREE.Clock deprecation warning remains; deliberate
malformed-data error-boundary fixtures logged their expected render errors.

Desktop, phone portrait and landscape screenshots were visually inspected. The
brain, model lanes, scrollable panel, model tabs and navigation remain visible;
full browser checks include keyboard and reduced-motion interaction. Test content
and model output are visibly labelled mock fixtures.

- [Desktop collaboration](screenshots/phase4-integration/deliberate-synthesis.png)
- [Cited original](screenshots/phase4-integration/cited-original.png)
- [Uncertain billing](screenshots/phase4-integration/uncertain-billing.png)
- [Phone portrait](screenshots/phase4-integration/phone-portrait.png)
- [Phone landscape](screenshots/phase4-integration/phone-landscape.png)

## Migration 004 and release assessment

Migration 004 is byte-for-byte unchanged from Phase 4A. The review in
[PHASE4_MIGRATION_SECURITY.md](PHASE4_MIGRATION_SECURITY.md) still applies: four
server-only tables, composite workspace FKs, uniqueness/check constraints,
indexes, RLS without browser policies, and revocation plus effective privilege
checks for PUBLIC and API roles including inherited membership paths. No new
function, default-ACL modification, broad schema revocation, extension installation
or private recovery-schema change is introduced by this integration.

Local transaction failures roll back; recorded migration reruns preserve data.
The privileged backend owner bypasses RLS, so server authorization and scoped
queries remain essential. Existing original-memory data and older migrations are
preserved. For rollback, revert the application while retaining secured additive
history tables. For uncertain COMMIT, inspect history/catalogue from a fresh
connection instead of guessing or replaying raw SQL. Never delete conversation
history as an automatic rollback.

**Hosted migration remains NO-GO without separate owner approval and fresh
read-only echo-dev identity/permissions/recovery verification.** No usable hosted
backup is asserted by local tests. Approval must name only echo-dev
`dtcxlxehqiuhmhuypqbm`, preserve the original project and Production, and pin the
reviewed migration/code. Preview deployment also requires separate approval;
deploying before migration 004 would fail managed schema readiness.

## Remaining limitations

- No hosted migration, cloud acceptance or live model quality/pricing verification.
- Collaboration retrieval remains keyword-only; no undisclosed embedding charge.
- Quotes/source identity are checked, not semantic truth or perfect disagreement
  detection. Agreement is not factual verification.
- Fixed OpenAI synthesis, bounded history and a 100-turn thread ceiling remain.
  The current history UI shows the latest 50 threads; further pagination UX is
  deferred. Models or limits changed on the server require reviewing fresh consent.
- Verify hosting request-duration capacity before live release. Request-driven
  stages, leases and explicit uncertain recovery do not guarantee exactly-once
  provider billing or make an abandoned request refundable.
- Software-rendered measurements are not physical-device or 60-FPS certification.
- Exact original frontend commit ancestry requires the original Git objects or
  bundle; the transferred series and its reconstructed base ancestry are verified.
