# Session-pooler guard candidate — 16 November 2026

Base: de8900148587e95c311dca464a4883c62f611fec.
Scope: local implementation and isolated tests only. No hosted connection or
migration execution is authorized by this change.

## Exact accepted connection identities

Both routes require explicit echo-dev migration authorization and database postgres:

| Route | Exact host | Connection login | Port |
| --- | --- | --- | --- |
| Existing direct | db.dtcxlxehqiuhmhuypqbm.supabase.co | postgres | 5432 (default allowed) |
| Approved Session pooler | aws-0-eu-central-1.pooler.supabase.com | postgres.dtcxlxehqiuhmhuypqbm | explicit 5432 |

The new host and login are one paired predicate, not independent allowlists.
No wildcard endpoints, operator-controlled expected IDs or automatic fallback.
Port 6543, missing Session port, wrong tenant/login/region/host, Production context,
query/host overrides, fragments, conflicting PG overrides and disabled TLS fail
closed. Existing direct support remains unchanged.

Connection configuration is only the first attribution gate. Both routes still
require the exact text cluster identifier 7703760980994770283, database postgres,
effective/session roles postgres/postgres and public creation schema from the
actual server. The Session client login is tenant-qualified; expected server roles
are deliberately NOT changed to match that client login.

## Preserved execution and TLS behavior

- Explicit --apply plus --target=echo-dev (or equivalent programmatic authorization).
- Existing verified certificate chain and hostname validation; no TLS-module or
  driver options change. The pinned pooler hostname is the TLS peer identity.
- Initial READ ONLY identity transaction: 3s statement / 1s lock timeout.
- Migration transaction: advisory xact lock 68182041, 5s lock / 60s statement timeout,
  immutable URL revalidation, final server identity check on the same connection
  as DDL, then all pending migrations and ledger writes atomically.
- Failed/ambiguous identity or permission check stops DDL; rollback is unchanged.
  Unknown COMMIT outcome still requires fresh history/catalogue inspection.
- No changes to migrations 001–004, credentials, Vercel settings or recovery schema.

## Changed files for independent review

- lib/migration-target.ts: adds only the exact Session host/login/port alternative.
- tests/migration-target.test.ts: positive/negative Session configuration matrix.
- tests/fixtures/migration-guard-postgres.ts: runs existing real-driver scenarios
  with either approved policy input, strictly confined to the isolated test fixture.
- tests/managed-postgres-intelligence.test.ts: invokes the Session scenarios too.
- This handoff, validation record and checkpoint documentation.

The production change does not alter the SQL identity predicate, transaction helper,
TLS configuration, credential handling, or migration SQL.

## Test scope and limits

The Session scenario uses an actual disposable loopback PostgreSQL/pgvector server
and the application's postgres.js-backed Database wrapper. Approved endpoint URLs
with synthetic passwords are policy inputs only, never network destinations in
tests. Only the returned system ID and database name are substituted inside the
test fixture. Actual query execution, effective/session roles, backend PIDs, read-only
state, timeouts, advisory-lock contention, DDL and rollback are real PostgreSQL.

Both routes exercise identical guarded-transaction scenarios: consistent backend
PID through final identity/lock/DDL; rejection before DDL on changed identity;
lock release after rollback; rollback of earlier DDL on error; five-second lock
contention timeout; cancellation of a stalled initial query at about three seconds.
Configuration tests also reject wrong tenant usernames, route mixing, Production
context, explicit TLS disable, endpoint suffix attacks and query overrides.
Existing TLS tests reject untrusted certificates and wrong hostnames.

This is NOT a live Supavisor integration, TLS reachability test, hosted identity
check or execution approval. The owner's prior successful Session-pooler backup
and cluster-ID observation remain owner-reported evidence.

Validation: **123 tests passed, zero failures/skips**, including PostgreSQL 17.10 /
pgvector 0.8.2 and five real-driver scenarios for each route. TypeScript and serial
production build passed. The disposable container was removed. No browser tests
were rerun because no UI behavior changed.
[Machine-readable evidence](validation/session-pooler-guard.json).

## Recommendation and remaining gates

Candidate for separately authorized READ-ONLY echo-dev preflight after independent
source review. Hosted migrations remain NO-GO/unapproved. From the actual execution
environment, preflight must establish reachability, pooler certificate/hostname
validation, authenticated tenant attribution, actual server roles/cluster ID and
permission to read pg_control_system(). Never weaken the guard if any check fails.
No Production or original-project access is needed.

Review the preserved backup/restore evidence and current 001–003 history, object
ownership, ACLs and lack of 004 conflicts before any subsequent migration approval.
The runner still checks version markers rather than file checksums and applies all
missing migrations, so independently pin source/checksums and confirm only 004 is
pending. Owner/BYPASSRLS connections remain privileged. Server failover/restore can
change identity and requires explicit review; do not provide a runtime override.
