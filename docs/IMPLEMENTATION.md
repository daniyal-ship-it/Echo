# Implementation checkpoint — 31 October 2026

Continue `feat/core-memory-exploration`, descended from `4b19901`. The foundation
on `main` remains `6f19c18`. The anatomy, renderer, navigation, original records,
authentication, saved credentials and hosting plan are preserved. The complete
core milestone is **Partially implemented**, with live acceptance outstanding.

Read the [current request](MEMORY_INTELLIGENCE_BRIEF.md), [roadmap](ROADMAP.md),
[validation evidence](VALIDATION.md) and [deployment instructions](DEPLOYMENT.md).

## Implemented in this increment

- Real OpenAI embedding adapter (`text-embedding-3-small` by default, 1,536
  dimensions), account/model lookup before transmission, and pgvector retrieval.
  No production fake-vector fallback or configurable provider endpoint.
- Stable, exact original passages retain workspace, source version/hash, message
  ID/index/role, active branch, timestamp and UTF-16 offsets. Metadata records
  chunker, model, API version, dimensions and analysis prompt version.
- Consent-bound per-original jobs persist progress, leases, bounded provider
  operations and their results. Successful work is reused after recovery;
  duplicate enqueue returns the same job. Rate limits back off, cancellation
  stops subsequent work, and unknown billing outcomes require explicit retry
  acknowledgement. A completed unchanged chunk can reuse its embedding after
  a new source version. This is not an exactly-once billing guarantee.
- Separately stored generated summaries and decision/question/commitment insights.
  Strict schemas and exact quote checks reject fabricated passage references.
  Speaker attribution, uncertainty and no invented commitments are prompt rules;
  exact quote validation does not prove a generated interpretation is entailed.
- Keyword plus cosine retrieval combined by reciprocal rank fusion, filtered by
  the existing source/tag/lobe/date/library predicates when the user opts in.
  Cached question embeddings avoid repeated billing for the same question/model
  in a workspace. Results open the exact version/passage and actual brain node.
- Evidence-bearing semantic link candidates coexist with tag/reference evidence.
  The UI shows both original passages, model, cosine similarity and stale state.
  Dismissals, confirmations and manual links are preserved. Only confirmed links
  appear in the brain. Explicit-tag groups remain distinct from inferred links.
- Source edits remove obsolete active-index mappings and supersede unfinished
  jobs; historical passages/analyses remain tied to original versions. Source
  deletion cascades derived records. Workspace ownership is checked before
  retrieval/provider egress and rechecked before answer publication.
- Intelligence tab, saved-job controls, generated analysis and source citations;
  Settings can check each configured API model without sending memory content.
  Existing context consent, original views, export and deletion remain available.

`002_memory_intelligence.sql` is additive. An upgrade test starts at migration 001
and verifies original content, versions and anatomical coordinates survive. The
legacy reserved `embeddings` table remains untouched. See [SCHEMA.md](SCHEMA.md).

## Verified and not yet verified

Thirty core tests pass, including real local database close/reopen, duplicate
processing, successful-result replay, unknown outcomes, deletion during a call,
source invalidation, dismissed connections and cross-workspace isolation.
The complete tiny archive journey passes with **labelled mock provider transport**:
import → separate summary/index → paraphrase → each provider → exact passage/node
→ sign out/in → retrieve again. This proves plumbing, not live model quality.
See VALIDATION.md for final browser/build results and rendered screenshots.

Existing Vercel project `daniyal-1415s-projects/echo` is linked to the correct Echo
repository. The feature preview is READY at documentation checkpoint `ae08e7f`,
with unchanged application code from `30a337e`. Its branch-specific Preview
APP_ORIGIN matches:

https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

Existing Vercel authentication obtains a short-lived same-project OIDC identity
accepted by the protected Preview. No automation credential was created and
protection remains enabled. Chromium now renders the hosted brain after narrowly
allowing its existing NSS certificate database to initialize in read/write mode;
TLS checks remain enabled. Front/side/three-quarter views, rotation and zoom passed
real browser inspection. Saved keys and DATABASE_URL have sensitive Preview
bindings; no credentials were replaced, disclosed or requested again.

The later authorised [backend repair](BACKEND_REPAIR.md) preserved and pushed
`e39cba6`, deployed safe diagnostics, and identified the health/auth failure:
`SELF_SIGNED_CERT_IN_CHAIN` during the Supabase connection check, before migration
inspection or execution. The deployed runtime has no system or additional CA.
Managed startup now verifies connectivity and schema state without applying
pending migrations; the shared database must not change without separate approval.

The targeted correction supports server-side `DATABASE_CA_CERT` with certificate
and hostname verification enabled. Its regression tests pass, but the official
Supabase certificate download is proxy-blocked and no CA is configured yet.
The network draft has the required host additions and needs environment publication.
Hosted repair, login and persistence are not yet verified. All 36 isolated tests,
TypeScript/build and four local production smoke groups pass; these do not prove
managed health. No AI call was dispatched; the approved US$1 total remains unspent.
See BACKEND_REPAIR.md for current deployment evidence and continuation steps.

## Deliberate limits / continuation

1. Jobs are durable but request-driven. Keeping the Intelligence panel open drives
   bounded steps; reopening resumes saved work. No independent background worker,
   cron service or new paid infrastructure was added. In-flight calls may finish
   and bill after cancellation or disconnect. Existing Vercel function limits apply.
2. At most 64 nonempty passages per original, each around 1,600 UTF-16 characters;
   eight per provider operation, three attempts per step. Oversized originals are
   retained and explicitly rejected for processing, never silently truncated.
   Inactive branches remain preserved but are excluded from analysis/retrieval.
   Multi-batch analyses concatenate cited batch summaries; no global reduce pass.
3. Cosine thresholds (0.45 retrieval / 0.72 candidate links) and English full-text
   ranking need live relevance evaluation. No cross-encoder reranker, entity graph,
   contradiction detection, semantic topic hierarchy or large-vector benchmark.
   Unindexed sources use versioned keyword excerpts rather than chunk citations.
4. A failed question-embedding outcome is not automatically retried; use keyword
   search until a reviewed recovery control is added. Intelligence token reservations
   and assistant reported-usage limits are separate, not a shared dollar budget.
   There is no provider-side exactly-once guarantee across a lost response.
5. Generated claims still require human review. Citation-number checks and exact
   quote checks cannot establish factual truth or full entailment. No retrieved
   sources means an explicit insufficient-evidence response without an answer call.
6. Verify live providers using only a tiny authorised fixture in an isolated test
   workspace through the protected branch preview. Do not reimport into the user's
   workspace, enable public signup, replace existing keys, merge main or promote
   production. Preview and Production currently share a DATABASE_URL binding;
   the additive schema is compatible, but this is not database isolation.
7. Follow the live checklist in DEPLOYMENT.md, record actual results, then update
   ROADMAP.md. Voice/meetings, calendar/reminders and connectors remain later work.

## Resume safely

Inspect `git status`, recent commits and the remote feature SHA first. Reuse this
checkout. Never open a running PGlite directory from another process. Tests use
isolated directories and explicitly clear inherited database/provider settings.
The original `4b19901` Git bundle is preserved outside the repo in
`/workspace/artifacts/echo-exploration-2026-10-29/`. Main was not merged or reset.
