# Data model

## Implemented schema

The reproducible migration is `db/migrations/001_foundation.sql`. It runs in a
transaction. Managed PostgreSQL initialisation uses an advisory lock to prevent
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
| `embeddings`          | Reserved 1,536-dimensional pgvector records, model and content hash; no indexing worker yet                                               |
| `agent_runs`          | Question, provider outputs, outcome, timestamp and reported token use                                                                     |
| `retrieval_citations` | Agent run, source memory/version and exact supplied excerpt                                                                               |
| `audit_events`        | Sensitive action name and resource ID, without source text or credentials                                                                 |

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
| Consolidation jobs                        | Versioned inputs, extraction model, retry lease, idempotency key, cancelled/failed/succeeded state                            |

Large recordings belong in private object storage, never `public/`. Durable
background workers must claim jobs with leases, retries and idempotency. Summary,
fact and contradiction records must cite immutable source spans and preserve
historical statements rather than overwrite them.
