# Data model

## Implemented schema

The reproducible migrations are `001_foundation.sql` and the additive
`002_memory_intelligence.sql` in `db/migrations/`. They run in a transaction. Managed PostgreSQL initialisation uses an advisory lock to prevent
concurrent first-start migrations. `schema_migrations` records the applied version.

| Table                 | Responsibility                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | Email identity, name, scrypt password hash                                                                                                |
| `workspaces`          | One owner per private workspace                                                                                                           |
| `sessions`            | Hashed opaque token, owner, expiration                                                                                                    |
| `auth_attempts`       | Hashed rate-limit keys and bounded time windows                                                                                           |
| `data_sources`        | Provider + stable source key, unique within workspace                                                                                     |
| `memory_nodes`        | Current title/content, extractive preview, category, tags, source date, importance, stable anchor/coordinates, privacy and indexing state |
| `memory_versions`     | Immutable original payload, content, ordered messages, fingerprint and version                                                            |
| `memory_edges`        | Endpoints, relation, written evidence, confidence, strength, creation method, validation time, status and pin                             |
| `import_jobs`         | Original archive bytes, parsed items, durable cursor, counts, status and errors                                                           |
| `embeddings`          | Legacy reserved table, retained for compatibility; new active indexing uses the tables below                                              |
| `agent_runs`          | Question, provider outputs, outcome, timestamp and reported token use                                                                     |
| `retrieval_citations` | Agent run, source memory/version, exact supplied excerpt and optional stable chunk ID                                                     |
| `audit_events`        | Sensitive action name and resource ID, without source text or credentials                                                                 |

Migration 002 adds:

| Table                     | Responsibility                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `memory_chunks`           | Stable original-version passages, message identity/role/timestamp, active branch, UTF-16 offsets, hash/chunker version and full-text index |
| `embedding_cache`         | Scoped per-memory content/model cache, actual vectors, provider/API version, 1,536 dimensions; source deletion cascades                    |
| `chunk_embeddings`        | Active passage-to-cache mapping; invalidated on source-version change                                                                      |
| `intelligence_jobs`       | Consent, frozen model/chunker/prompt configuration, source hash, progress/status, lease and retry schedule                                 |
| `intelligence_operations` | Durable provider dispatch/result journal, attempt, conservative reserved tokens and reported usage                                         |
| `analysis_parts`          | Validated cited analysis per bounded batch, reused during recovery                                                                         |
| `memory_analyses`         | Separate published generated summaries/insights with provider/model/prompt/source-version provenance                                       |
| `query_embeddings`        | Workspace-scoped question hash/model/vector cache; no plaintext question; unknown outcomes pause automatic replay                          |

`memory_edges.semantic_evidence` contains the candidate model, cosine score and
both exact source-version/passage references. Source updates remove old active
index mappings, supersede unfinished work and flag preserved edge evidence as
stale. Historical chunks and analyses remain available with immutable originals;
record deletion cascades them. Query vectors contain the user's question rather
than original text; they are workspace data and cascade on workspace deletion.

No independent worker is installed. The API claims bounded steps transactionally;
a client can resume persisted jobs. Embedding cache reuse is per memory/model and
content hash, not a cross-user cache. The provider's model identifier and API version
are recorded; this is not an immutable fingerprint of provider model weights.

In this release, a document/conversation is a typed memory node, while immutable
message and attachment metadata live in the versioned original JSON. Full
normalised message/document/attachment tables are a later migration, not claimed
as already implemented. This bounded model preserves source fidelity without
inventing extraction results.

All private API queries require the authenticated workspace. Graph endpoints
have composite foreign keys preventing cross-workspace links. Tokens, hashes
and database credentials never form part of the client workspace response.

An unchanged source fingerprint is idempotent. A changed source with the same
provider/key appends a version while keeping its memory ID and coordinates.
Reimporting an older known fingerprint does not roll back the current version.
Memory deletion cascades versions, edges and citations. Retained archive deletion
is separate and explained to the user. Account deletion cascades all workspace data.

## Planned schema expansion

The following is a design specification, **not installed tables or completed
features**. Every private entity includes `workspace_id`; references must enforce
matching workspace IDs, with RLS if direct database access is ever introduced.

| Planned entities                          | Key fields and relationships                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Provider connections                      | Provider, granted scopes, encrypted token reference, expiry, revocation; owned by workspace                                   |
| Documents / attachments                   | Original object key, checksum, MIME, byte count, retention, malware-scan status; reference source/version                     |
| Conversations / messages                  | Provider conversation ID, message ID, parent branch, role, timestamp, model, structured content; retain immutable source JSON |
| Categories / topics                       | Stable label, membership evidence and confidence; many-to-many memory references                                              |
| Entities / aliases                        | Canonical entity and observed forms; extraction source spans and confidence                                                   |
| Projects                                  | Name, owner, time range, memory membership and versioned consolidated summaries                                               |
| Meetings / speakers / transcript segments | Consent/session state, recording retention, timestamps, speaker labels and correction history                                 |
| Decisions / action items                  | Exact transcript/message span, owner/due-date only if evidenced, approval state and revision history                          |
| Calendar events                           | Remote calendar/event IDs, timezone, sync cursor, etag; approved external writes only                                         |
| Reminders                                 | Due time/timezone, recurrence, approval, completion, delivery channel and deduplicated durable delivery jobs                  |
| Extended consolidation jobs               | Cross-original entity/contradiction/project reduction beyond current per-original jobs                                        |

Large recordings belong in private object storage, never `public/`. Durable
background workers must claim jobs with leases, retries and idempotency. Summary,
fact and contradiction records must cite immutable source spans and preserve
historical statements rather than overwrite them.
