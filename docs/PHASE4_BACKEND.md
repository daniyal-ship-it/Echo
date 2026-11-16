# Phase 4A backend handoff

Local implementation based on `256a036449db1e1de6a2c484a39d98258239d922`, on
`feat/phase4a-collaboration-engine`. Frontend work remains Claude-owned.

The implementation adds persistent multi-provider threads, independent parallel
analysis, actual exchange of peer analyses, separate cross-reviews and grounded
synthesis. Follow-ups retain bounded prior discussion and retrieve current source
evidence. Request idempotency, transactionally reserved calls, leases, explicit
recovery and per-turn limits prevent automatic repeat spending. Every completed
or interrupted attempt remains visible; generated outputs never overwrite
originals or create automatic memory nodes.

Read [the versioned frontend contract](PHASE4_COLLABORATION_CONTRACT.md) and
[the migration/security review](PHASE4_MIGRATION_SECURITY.md) before integrating.
The existing assistant API and Phase 2/3 UI remain unchanged. New APIs use the
same session, origin, rate-limit, workspace and sanitized-error boundaries.

## File inventory

- `lib/collaboration.ts`: orchestration, source checks, checkpoints, recovery,
  cancellation, history and result publication.
- `lib/collaboration-types.ts`: versioned inputs, statuses, limits and structured
  reasoning validation.
- `db/migrations/004_collaboration.sql`: four additive, RLS-protected server-only
  tables and effective privilege verification.
- `lib/db.ts`: register 004; retain read-only managed startup behavior.
- `lib/providers.ts`: preserve whether token usage was actually reported.
- `app/api/[...path]/route.ts`: collaboration routes behind existing authentication
  and origin controls; no frontend files changed.
- `tests/collaboration.test.ts`, `tests/fixtures/collaboration-suite.ts`: stage,
  billing, source, isolation, rollback and recovery regression scenarios.
- `tests/collaboration-api.test.ts`: authenticated API through real adapters with
  mocked official HTTP responses, including actual peer context and synthesis.
- `tests/managed-postgres-intelligence.test.ts`: run collaboration scenarios with
  the real postgres.js driver, pgvector, hostile default grants and persistence.
- Existing migration/security/diagnostic tests: validate the fourth migration,
  all 26 table ACLs and rollback while preserving earlier data.
- Phase 4 contract/security/handoff documentation and checkpoint pointers.

## Verification

Final verification results are recorded in `docs/validation/phase4a.json`: 100
unit/integration tests (zero skips), 23 existing browser regressions, TypeScript,
serial production build, four standalone smoke checks and anatomy verification
all passed. The browser suite ran before the final collaboration-only late-lease
fix; that fix passed the final complete unit/real-PostgreSQL suite and build. All AI outputs in these checks are labelled mocks. Real PostgreSQL
validation means the actual driver/database/pgvector, not live provider calls.
The existing 23 browser tests exercise Phase 2/3 regressions; no Phase 4 UI exists
to claim a collaboration browser journey. No test uses a hosted database, private
archive, existing workspace, or production credentials.

A targeted regression first reproduced a late-worker race: a response arriving
after an acknowledged lease recovery could change the set of published answers.
The fix preserves late raw output and usage while excluding a superseded
worker's answer from stage/public result selection. The same regression runs
against both PGlite and real PostgreSQL.

## Limitations and integration gates

- Collaboration retrieval is the existing keyword path. No hidden embedding
  request is made. A semantic-query operation needs its own consent/usage ledger.
  Other existing hybrid retrieval features remain available and unchanged.
- Source identity and exact quotes are verified. Semantic truth, speaker
  interpretation and whether a review fully captures disagreement need live
  evaluation; strict JSON and prompt rules cannot prove these properties.
- Models and account availability were not checked live, and no provider call
  was paid for. Actual model quality, pricing and context capacity require a
  separately approved budget and acceptance run.
- Request-driven execution needs explicit advances from the future UI. There is
  no background worker. Verify the hosted function duration before release.
- Long threads are capped at 100 turns; GET currently loads their bounded full
  history and revalidates source snapshots. Large-thread performance and richer
  pagination need measurement before raising limits.
- Historical private snapshots survive original deletion but are marked stale.
  Workspace/account deletion cascades them. Individual thread deletion and UI
  export are outside this increment.
- Parallel mode intentionally has two independent results; only deliberate mode
  synthesizes. OpenAI is the fixed v1 synthesizer. Calls are capped, not priced;
  no monetary estimate or exactly-once billing guarantee is invented.
- Phase 4 frontend integration, browser journeys and accessibility review remain
  to be completed with Claude's interface. Existing brain hardware/performance
  limitations from Phase 3 remain unchanged.
- **No push, merge, deployment, hosted schema change or production change is
  authorized by this handoff.** Migration 004 and Preview deployment need separate
  approval. A deployment before 004 would fail managed schema readiness.
