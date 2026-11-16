# Development migration identity guard — 16 November 2026

Based on Phase 4 integration 331eeb20eed303f0fc2b62ca422fd81355b9a2e4.
Local implementation only. No hosted connection, migration, credential change,
Preview deployment or push is authorized by this patch.

## Required authorization and attribution

Managed migration application now requires both `--apply` and exactly one
`--target=echo-dev` CLI option. Programmatic callers must explicitly provide
`applyManagedMigrations: true, migrationTarget: 'echo-dev'`. Missing managed URL
cannot silently select PGlite when application is explicitly requested.

The code pins project dtcxlxehqiuhmhuypqbm and system identifier
7703760980994770283 (the owner-supplied identifier, compared as exact text to
avoid JavaScript integer rounding). Neither pin can be overridden by environment
variables or CLI arguments. This is an execution safeguard, not migration approval.

Only the direct TLS endpoint db.dtcxlxehqiuhmhuypqbm.supabase.co, port 5432,
database postgres and login postgres are accepted. Verified certificate/hostname
checks remain enabled through the existing TLS module. URL query parameters,
fragments, shared poolers, alternative endpoints, incompatible PG overrides,
disabled TLS, explicit Production context or another Vercel Git branch fail
before connection. Explicit endpoint attribution plus TLS and independently pinned
cluster identity are required; a friendly database name is insufficient.

This intentionally does not support poolers or automatic fallback. If direct
connectivity is unavailable, stop for a separately reviewed solution rather than
loosening the target checks. No credentials or full URLs enter guard errors/logs.
Only variable names and non-secret target constants are documented here.

## Transaction behavior

The URL is captured after authorization and used to construct the client. A
read-only SELECT of pg_catalog.pg_control_system(), database, effective/session
roles and creation schema checks identity before migration transaction entry.
The existing transaction then sets 5-second lock/60-second statement timeouts,
acquires advisory transaction lock 68182041, rechecks unchanged target
configuration, and reads identity again on the actual transaction connection.
Only then can history-table creation or other DDL execute. Expected SQL identity:
postgres database, postgres effective/session roles, public creation schema.
Missing/multiple rows, numeric rather than text system IDs, wrong cluster, wrong
roles/schema/database, unavailable function or permission errors fail closed.

All pending migration SQL and ledger inserts still use one transaction. Recorded
migrations are skipped. Driver errors roll back; initialization closes the client
and emits only sanitized diagnostics. An uncertain COMMIT still requires fresh
history/catalogue inspection. No checksum tracking or destructive rollback was
introduced. Migrations 001–004 are byte-identical to the reviewed checkpoint.

## Test interpretation

Unit fixtures verify matching identity and rejection of missing, mismatched,
ambiguous, Production and conflicting configuration; they verify ordering,
transaction-connection revalidation, configuration changes and rollback callbacks.
Matching identity responses are explicitly mocked, not a live echo-dev claim.

The real PostgreSQL fixture cannot match the pinned hosted cluster. It initializes
its disposable loopback schema via a test-only transaction, then exercises the
existing real-driver application regressions. The actual identity query rejects
that cluster, and real PostgreSQL rolls back a fixture table in that transaction.
There is no production bypass, alternate expected identifier or test credential
path in the guard. The fixture still tests schema/ACLs/rerun persistence, but it
must not be described as a successful hosted-identity migration run.

Validation: **111 unit/integration tests passed, zero failures/skips**, including
real disposable PostgreSQL 17.10 / pgvector 0.8.2. TypeScript, serial production
build and four isolated standalone smoke checks passed. Browser tests were not
rerun because no UI behavior changed. The disposable container was removed.
See [machine-readable results](validation/development-migration-guard.json).

## Readiness

Local code is ready for independent review after the recorded isolated checks.
Hosted migration remains NO-GO until separately approved. Confirm that the intended
execution role can call pg_catalog.pg_control_system() and that its returned ID
matches the owner's pin, without granting permissions as part of this task.
Confirm direct TLS connectivity, current target history/ACLs, and independently
review the owner's reported encrypted backup/restore evidence. A replacement or
restored cluster can change its identifier and requires explicit review, not an
operator-supplied runtime override. No claim of hosted identity or backup
verification is made here. Preserve echo_recovery, original project and Production.
