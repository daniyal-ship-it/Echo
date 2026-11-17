# Phase 5A — meeting transcription review handoff

## Scope and architecture

Branch: `feat/phase5a-meeting-transcription`, based on `b75191f` from the shared feature branch.
The drafts `96ddd5c` and `fa01ef0` were reviewed, not merged. Their model identifier
`gpt-transcribe` is valid in the current official documentation. Their upload limit,
duration validation, durable retry handling, navigation and test coverage needed correction.

This is a bounded first release for short recordings, not full-length meeting ingestion:
canonical PCM WAV only, mono / 16 kHz / 16-bit, 0.1–90 seconds, at most 3 MiB.
Only fmt/data RIFF chunks are accepted. MP3/M4A/WebM, metadata-bearing WAV and longer
recordings are deferred. Actual file framing, encoding and duration are validated on the
server; browser extensions and supplied MIME types are not trusted. Request reads have a
byte cap and ten-second timeout. These limits leave room under Vercel's 4.5 MB body ceiling.

The authenticated `/meetings` page is linked from workspace navigation. Explicit consent
precedes POST `/api/meetings/transcribe` (raw WAV body, consent and encoded title headers).
POST checks origin, session and workspace rate limit. GET uses `x-echo-audio-hash` to look
up only the caller's saved status without transmitting audio or calling a provider.
The workspace always comes from the authenticated session, never client input.

OpenAI `/v1/audio/transcriptions`, model `gpt-transcribe`, receives an in-memory file with
a generic filename. No audio is stored, logged or sent to another provider. No filename is
placed in a URL. The provider response is byte/time bounded and validated. No automatic
summary, embedding or other paid request follows transcription. API keys remain server-side.
Actual account access, accuracy, latency, billing and provider retention have not been live
tested; they require separately authorized testing. Consent explicitly acknowledges provider
policies, possible costs and participant permission. No diarization or speaker identities
are invented, and recording date remains unknown.

The transcript becomes a Temporal `meeting-audio` memory through existing `storeMemory`,
with immutable source version, machine label, model/provider, timestamp, duration and audio
SHA-256 provenance. It is searchable by existing keyword search and inspectable in Meetings
or the original-memory panel. Semantic indexing remains the existing separate consent flow.

## Durable attempt and billing boundary

Migration 005 adds only `meeting_transcriptions`, with workspace FK/cascade, unique
(workspace, SHA-256), attempt UUID, status, two-attempt ceiling, timestamps and optional
memory UUID. The latter intentionally survives memory deletion as a tombstone; status lookup
checks memory ownership and never recreates a deleted result. No raw audio column exists.
RLS is enabled without browser policies. Object-scoped table/column revocations and effective
privilege checks follow migration 004, including API roles, authenticator memberships and
PostgreSQL 17 MAINTAIN. Unexpected inherited access fails the transaction. No unrelated
schema/default privileges or hosted objects are changed. Privileged backend ownership still
requires all server queries to enforce workspace isolation.

Workspace row locking serializes claims and publication. A committed attempt precedes dispatch;
identical audio returns saved status/result. Timeout, interrupted worker, invalid response or
unknown provider outcome is uncertain, never silently retried. Running attempts older than two
minutes become eligible for an explicit, acknowledged retry using the prior attempt UUID.
At most two dispatches per exact audio fingerprint/workspace are allowed. Stale concurrent
retries cannot dispatch again, and late completion cannot overwrite a newer attempt. Saving
the memory and completing the ledger occur in one transaction. Process/database failure after
provider dispatch can still cost money without yielding a saved transcript: exactly-once
provider billing is not claimed. Modified bytes or another workspace are separate submissions.

## Release and security gates

Migration 005 is prepared and tested only in disposable local databases. Managed startup will
require it; this branch MUST NOT be deployed before separate review/approval of that migration.
No hosted SQL, user data changes, live provider calls or Production actions were performed.
`vercel.json` disables automatic Git deployments for this exact feature branch. The draft PR
target is `feat/core-memory-exploration`; merging or deploying is not authorized.

Independent review should cover the new ledger ACLs, retry semantics, short-format scope and
provider consent before any Preview release. A future longer-recording design needs an approved
storage/retention policy and bounded background processing; this implementation does not imply
approval for storage resources or purchases.

## Documentation checked 2026-11-17

- https://developers.openai.com/api/docs/guides/speech-to-text — `gpt-transcribe`, transcription
  endpoint, supported formats and 25 MB provider upload limit. The application deliberately
  accepts a smaller subset. The older draft's identifier was not replaced with deprecated models.
- https://vercel.com/docs/functions/limitations — 4.5 MB function request/response limit.
- https://vercel.com/docs/project-configuration/git-configuration — branch-specific
  `git.deploymentEnabled: false`.

Validation results are recorded in `docs/VALIDATION.md`. All transcription fixtures are explicitly
mocked; PostgreSQL driver tests use disposable loopback PostgreSQL/pgvector, not echo-dev.
