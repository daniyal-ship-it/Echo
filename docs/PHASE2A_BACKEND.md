# Phase 2A backend handoff

Base: `9efffe27a7aa1189b65b792d6ee0208de49db968`.
Branch: `feat/phase2a-memory-backend`; isolated worktree `/workspace/Echo-phase2a`.
Scope: backend libraries, the assistant publication transaction in the backend API route,
backend tests, offline evaluation and this handoff.
No frontend component, stylesheet, route contract, browser-test source, migration,
hosted record, environment binding, Production setting or shared feature ref changed.
Integration/push/deployment require owner approval. The prior JSON repair is not
part of this work and was not executed. No paid model calls were made.

## Implemented behaviour

- Hybrid search retains its keyword + pgvector cosine + reciprocal-rank fusion
  architecture. Context now covers distinct originals before adding a second
  passage from any original; repeated exact passages within one version do not
  consume multiple context slots. Existing filter predicates, six-source limit,
  cosine cutoff 0.45, candidate limits and explicit semantic consent are retained.
- Vector joins verify cache ownership, exact content hash and dimensionality,
  not merely workspace membership. A corrupt index mapping cannot supply another
  original's vector as evidence. Injected/replayed embedding results must match
  the requested model, batch size and 1,536 dimensions and contain finite,
  nonzero vectors before indexing. This is integrity validation, not model quality.
- Query text is trimmed before hashing/caching. Explicit retryable rejection
  (429, not uncertain) releases the query claim so an explicit resubmission can
  retry. Interrupted/uncertain sends remain blocked from automatic repetition.
- Assistant publication locks the workspace and revalidates sources INSIDE the
  save transaction, closing the gap between the last source check and persistence.
- Fallback excerpts are checked against immutable `memory_versions.content`.
  Chunk citations are checked against immutable message text, message index/ID,
  speaker role, active branch, UTF-16 offsets and content hash. Metadata/node
  substitutions are rejected. Source edits invalidate citations for NEW context
  transmission; historical passage access remains available and validated.
- Repeated source text is embedded only once per batch. The next step links all
  matching passages to the per-original cache. Original message passages/IDs are
  preserved. This does not share embeddings across distinct originals/workspaces.
- Successful late responses after cancellation remain journaled but do not
  publish embeddings/analyses. Resume reuses durable success. Existing tests also
  cover expired leases, unknown outcomes, safe 429 backoff, source deletion,
  version invalidation, restart persistence and bounded attempts.
- Analysis evidence receives source-derived provenance. Explicit model-supplied
  speaker roles must match ALL cited messages. Assistant/tool-only evidence cannot
  establish a user commitment; inference-tagged decisions/commitments are rejected.
  New jobs use `grounded-analysis-v2`; historical v1 jobs retain their v1 prompt.
  Unknown prompt versions fail closed. Stored historical analyses are not rewritten.
- Semantic candidate refresh updates its score and explanation together. Manual,
  confirmed and dismissed relationships retain their user-controlled state.
  Similarity is explicitly described as an association proposal, never proof of
  factual agreement. The proposal threshold remains 0.72, not a calibrated probability.

## Interface contract for Claude

All existing request payloads and endpoint paths remain unchanged. The server
continues to derive workspace identity from the authenticated session. Semantic
question transmission and original processing still require existing explicit
consent. No new frontend action is required to integrate these backend changes.

| Response field | Contract |
| --- | --- |
| `Citation.id` | Original memory ID, also the existing brain-node ID |
| `Citation.brainNodeId?` | Additive explicit alias of `id`; never an invented spatial node |
| `Citation.version`, `chunkId?` | Exact immutable version and passage; use existing memory/passage endpoints |
| `Citation.speakerRole?`, `messageIndex?`, `messageId?` | Source message attribution; null for non-conversation notes |
| `Citation.startOffset?`, `endOffset?` | UTF-16 offsets into that message, or immutable content for fallback excerpts |
| `Citation.contentHash?` | SHA-256 of exact excerpt text |
| Retrieval `evidence.status` | `retrieved` or `insufficient`; describes whether any evidence was selected |
| Retrieval `evidence.entailsAnswer` | Always false: retrieval alone never certifies that the question is answerable |
| Retrieval `evidence.keywordCandidates`, `semanticCandidates`, `distinctMemories` | Counts for diagnostics, not confidence scores |
| Claim `speakerRole?`, `certainty?` | Optional model assertion validated structurally; certainty is `explicit`, `uncertain`, or `inference`, not a calibrated probability |
| Claim citation `memoryId?`, `version?`, `messageId?`, `speakerRole?`, `startOffset?`, `endOffset?` | Server-derived provenance of the exact quoted substring |
| Edge `semantic_evidence.scoreKind?` | `cosine-similarity`; not factual confidence |
| Edge `semantic_evidence.requiresConfirmation?`, `interpretation?` | Explains proposal semantics; existing edge `status` determines whether the user already confirmed/dismissed it |

Consumers must tolerate absent additive fields in older stored analyses and
responses. Preserve exact source/version/passage links, and show uncertainty as
uncertainty. Do not label `rank`, cosine similarity or `confidence` as truth or
an answer correctness probability. Newly enforced evidence errors return existing
HTTP 409/422 classes; keep the original visible and offer a fresh search/review,
not silent repair or deletion. Summary quote checks do NOT prove logical entailment
or detect every invented claim/negation/speaker assertion in free text.

## Reproducible retrieval evaluation

Corpus: `tests/fixtures/retrieval/corpus.json`, eight synthetic originals, nine
labelled cases: exact, paraphrased, cross-memory, irrelevant-source and insufficient
support. Deterministic fixture IDs, exact-text hashes and per-case relevance labels
make the run repeatable. This harness never contacts a provider and always creates
an isolated local database, ignoring any application DATABASE_URL.

```sh
npx tsx scripts/evaluate-retrieval.ts
npx tsx scripts/evaluate-retrieval.ts --manifest
npx tsx scripts/evaluate-retrieval.ts --embeddings /private/path/real-embedding-artifact.json
```

The optional artifact must contain actual 1,536-dimensional model outputs for
EVERY manifest input, keyed by its SHA-256, plus `corpus`, `model`, `dimensions`,
`generatedAt`, `generatedBy` and `vectors`. No synthetic/one-hot vectors are shipped
as semantic-quality fixtures. The runner validates dimensions/model metadata and
records an artifact hash; provenance still requires trusting the producer. Obtain
outputs only with a separately authorised budget or an approved offline model.
All original excerpts are synthetic; no personal archive belongs in this fixture.

Recorded lexical results: [evaluation JSON](validation/phase2a-retrieval-evaluation.json).
Exact-match recall@6 is 1 for both cases; cross-memory recall is 1. Both paraphrases
have recall 0 without semantic vectors. The codes paraphrase retrieves unrelated
software text through English stemming; the Mercury question retrieves paint
rather than planetary evidence. These are exposed false positives, NOT passing
answer-support checks. Source filtering excludes the unrelated chat, but another
Orion note can still be returned. Empty-scope/no-source cases correctly abstain.

**Genuine semantic-quality evaluation was not run.** No approved new API budget
exists and the official pretrained-model source was denied by the proxy. The
existing one-hot mocked transport tests demonstrate state-machine/retrieval wiring
only; their paraphrase result is not counted as semantic-quality evidence. This
work does not claim that either GPT or Claude generated or verified a summary.

## Validation and remaining limitations

See [validation record](validation/phase2a-backend.json) for actual executed
checks. Real PostgreSQL tests use a disposable loopback-only Docker database
`echo_json_test`, pgvector 0.8.2, and the production driver. All three unchanged
migrations run only there, with hostile Supabase-like default ACLs; no hosted
migration was attempted. Effective permissions, JSON types, source references,
reopen persistence and cross-workspace denial are checked. Local regression
services remain explicitly mocked where testing cancellation/retry state machines.

Remaining work before claiming full memory-intelligence acceptance:

1. Generate/replay genuine model embeddings and assess paraphrase precision/recall,
   cross-memory coverage, false positives and threshold calibration on a larger
   independently labelled corpus. Do not tune thresholds to this tiny fixture.
2. Evaluate live summaries/answers for entailment, negation, uncertainty and speaker
   attribution with human-reviewed ground truth. Exact quotation alone is not enough.
3. Requests remain the job runner; no background worker was added. A cancellation
   cannot unsend an in-flight provider request. Query-embedding unknown outcomes
   still require keyword fallback; there is no new automatic billing retry path.
4. There is no unified dollar ledger across retrieval, jobs and assistant answers;
   provider budgets and model access still need explicit operational checks.
5. This does not repair pre-existing malformed JSON, remove orphaned data_sources,
   change extension placement, alter RLS/default ACLs or migrate schemas.
6. Stronger integrity checks deliberately reject corrupted/stale derived evidence.
   That may expose pre-existing bad records; preserve originals and diagnose rather
   than silently trusting or rewriting them.

### Re-running database tests

Use a NEW disposable loopback-only Docker database named `echo_json_test` from
`pgvector/pgvector:0.8.2-pg17` (tested digest in the validation JSON). Set
`ECHO_TEST_POSTGRES_URL` only for that temporary database; unset `DATABASE_URL`
and provider API-key variables before `npm test`. The real PostgreSQL test creates
fixture roles/default ACLs and applies migrations there, so do not reuse a live
or nonempty database. Stop/remove the container afterwards. Without that test
URL, the two real-server tests skip; that is not equivalent to the recorded run
of 58 tests with zero skips. The checked image contains PostgreSQL 17.10; hosted
Supabase 17.11 was not queried. Do not run browser tests concurrently with the
production build because both regenerate Next.js type artifacts.
