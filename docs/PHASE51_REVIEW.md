# Phase 5.1 — independent-review response

Branch: `feat/phase5a-meeting-transcription`; draft PR #2 against
`feat/core-memory-exploration`. Builds on reviewed commit
`1d1805c86d0b31e587ff99f9734e623e2061bd49`.

## Finding disposition

| Finding                                   | Status                             | Change / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Durable consent audit                     | Fixed                              | Existing `audit_events` records initial/renewed consent, explicit duplicate-charge retry acknowledgement and dispatch intent. Resource metadata contains transcription/attempt UUIDs, policy `meeting-transcription-v1`, provider/model and `audio-transcription` purpose. Database timestamps and workspace scope are preserved. Claim, consent and intent commit atomically before dispatch; an audit failure prevents dispatch and rolls back the claim.                                                              |
| Accurate dispatch audit                   | Fixed                              | `dispatch_intent` means a durable reservation to try the call, not proof of transmission, provider receipt or billing. A process can stop between commit and fetch. No event claims audio was successfully sent.                                                                                                                                                                                                                                                                                                         |
| Browser registration quota                | Fixed                              | Intelligence and Meetings share one run-scoped synthetic fixture account through real authentication. Other isolation tests retain separate accounts. The run ID survives worker restarts; no production authentication limit or origin/IP rule changed. The previous registration failure was deterministic quota exhaustion.                                                                                                                                                                                           |
| Rejected credentials exhaust retries      | Fixed                              | Explicit HTTP 401/403 provider authorization rejection is excluded from the potentially billable reservation count. Every retry still needs acknowledgement. At most two potentially billable reservations and four total dispatch intents are permitted. Other errors, 429 and uncertain outcomes do not earn exclusions. Mock tests reject twice, correct the synthetic credential and succeed on the third explicit attempt; a fifth authorization attempt is blocked. Actual provider billing remains authoritative. |
| Save failure after provider processing    | Fixed as best effort               | Try to mark only the matching running attempt uncertain and audit `save_failed`. If the DB is unavailable even this record may fail; expiry still exposes uncertainty. A lost commit acknowledgement cannot downgrade a completed result or cause replay to dispatch again. Guaranteed transcript recovery remains deferred; raw audio storage is not introduced.                                                                                                                                                        |
| Common WAV metadata                       | Fixed within documented subset     | Bounded LIST/JUNK chunks are accepted. RIFF size/padding and unique PCM fmt/data are verified; metadata is stripped before provider dispatch. An actual FFmpeg-produced WAV is tested for validation and unchanged samples after canonicalization. Other encodings/chunks and recordings over 90 seconds remain unsupported.                                                                                                                                                                                             |
| Non-JSON Vercel/platform errors           | Fixed                              | UI catches HTML/non-JSON replies and displays HTTP status plus a status-check instruction, without rendering upstream bodies. Browser coverage includes HTTP 502.                                                                                                                                                                                                                                                                                                                                                        |
| Safe diagnostic identifiers               | Fixed                              | API errors return an opaque UUID correlated with a content-free event containing event name, ID and status. Save-failure audit links the durable attempt. No SQL/provider error details, audio, transcripts, titles, participant names or credentials enter diagnostics.                                                                                                                                                                                                                                                 |
| Environment-specific screenshot paths     | Fixed                              | Meetings uses Playwright `testInfo.outputPath`, not a machine-specific path.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Fingerprint retention / export / deletion | Fixed and documented               | Transcript deletion retains fingerprint/attempt/audit metadata to prevent accidental repeat charges. Export includes the caller's ledger and meeting audit events. Full account/workspace deletion cascades these records. UI explains retention until workspace deletion; tests cover export, transcript tombstones and workspace cascade.                                                                                                                                                                              |
| Test counts                               | Corrected with reproduced evidence | The exact original commit reproduced 128 tests / 128 passes / zero skips in disposable PostgreSQL. Two added test cases bring the revised total to 130. Claude's 127 cannot be attributed without its command/manifest. The prior browser report double-counted Meetings: it was already included in the earlier run. Correct full browser-suite size is 32, not 33.                                                                                                                                                     |
| Release messaging                         | Fixed                              | Short-recording transcription only: PCM WAV mono / 16 kHz / 16-bit, 0.1–90 seconds, at most 3 MiB. Not full-length or general-format meeting ingestion.                                                                                                                                                                                                                                                                                                                                                                  |

## Migration and retry representation

Migration 005 is byte-for-byte unchanged, SHA-256:
`a60bc17f3f15c5b19853f9f0997fa1db2475f65ed261fb09622d86d06d026aff`.
No new columns, migrations or privilege changes are introduced.

The stored `attempts` column remains capped at two for schema compatibility. For audited
attempts, dispatch-intent and authorization-rejection events determine retry allowance.
API `attempts` reflects total intents and `canRetry` is authoritative. Missing/partial legacy
history is treated conservatively, never as evidence of a free retry. Audit history must not
be selectively purged while its ledger remains. Decisions use the existing workspace claim
lock; attempt tokens prevent late results from altering newer attempts.

Original audio bytes remain the fingerprint key, so changing metadata bytes is a different
submission. Provider payloads contain only verified PCM samples and a generic filename.
There is no exactly-once billing or guaranteed transcript-recovery claim.

The fingerprint also remains in existing `data_sources.source_key`, already covered by export
and workspace-deletion cascades. Transcript deletion removes memory/version content but
retains duplicate-protection metadata. Per-record ledger purging is deferred because it would
remove duplicate-charge protection.

## Validation and release gates

See `docs/VALIDATION.md` and `docs/validation/phase51-review.json` for final results. Tests require
Node 24, Chromium and FFmpeg on PATH; missing FFmpeg fails rather than silently skipping its
compatibility test. Real-driver tests use disposable loopback PostgreSQL 17.10 / pgvector 0.8.2.
All provider transports are mocked.

This is a candidate for another independent review. Migration 005 still needs explicit owner
approval; Preview deployment and paid provider testing require separate authorization. No
hosted SQL, paid provider calls, credential changes, merge or Production changes were made.
Long/compressed recordings, live accuracy/account/billing verification and guaranteed recovery
remain deferred.

The original environment became accessible again after its startup failure. Pending source
files were verified and preserved in a local recovery archive/binary patch/full-history bundle
before any resumed work. Interrupted browser output was not treated as a completed run.

## Final results — 17 November 2026

- 130/130 unit/integration tests; zero skips; real disposable PostgreSQL/pgvector.
- 32/32 browser tests in one clean, uninterrupted execution with no retries or source edits.
- TypeScript, serial production build, four standalone smoke checks and anatomy verification passed.
- Desktop/mobile Meetings captures inspected; portable test captures are included as phase51 screenshots.
- The earlier interrupted runs and the missing DELETE confirmation in the extended test were not counted as clean acceptance. The latter was corrected in the test; the production deletion safeguard remained intact.
- All eleven recovered source/config/test files matched the recovery checkpoint through final validation.
