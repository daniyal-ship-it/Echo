# Session-pooler migration route preflight — 16 November 2026

## Actual connectivity evidence

Credential-free investigation from the current Codex execution environment targeted
`db.dtcxlxehqiuhmhuypqbm.supabase.co:5432` using AF_INET6 TCP sockets.
System getaddrinfo failed with EAI_AGAIN (-3), Temporary failure in name resolution.
No target address was obtained, so no TCP handshake was completed and no PostgreSQL
protocol/authentication bytes were sent. `ip -6 route` showed only fe80::/64
link-local routes for eth0, eth1 and docker0; no global/default IPv6 route.
A public AAAA lookup through dns.google HTTPS was denied by the network proxy
(403 tunnel denial). No repeated network changes or credential attempts followed.

Conclusion: direct IPv6 is blocked/unverified from this environment. This does
not establish that Supabase is down or that its port rejects connections.
No Production host was accessed. Session-pooler connectivity from this environment
was not tested: the exact trusted pooler hostname has not been supplied here.
The owner's successful encrypted backup and cluster-ID verification through the
Session pooler are accepted as owner-reported evidence, not independently rerun.

## Session pooling assessment

Official pages retrieved successfully over verified HTTPS on 16 November 2026:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI

Supabase documents direct endpoints as IPv6 unless an IPv4 add-on is enabled,
and Session mode as an IPv4-compatible persistent connection alternative on 5432.
Transaction mode uses 6543 and has different session/pipelining constraints.
Documentation recommends direct connections for migrations, but this migration's
ordinary transactional DDL and pg_advisory_xact_lock require transaction affinity,
not a direct physical network path. Session mode can provide that affinity.

A Session-pooler route is technically suitable CONDITIONALLY, not yet executable:

1. Obtain the exact Session-mode hostname from echo-dev's trusted Connect panel or
   existing verified backup configuration. Pin that exact endpoint, not a wildcard
   supabase.com suffix or an arbitrary operator-provided pooler. A shared hostname
   alone does not attribute a project.
2. Require explicit Session-mode authorization, port 5432, database postgres and
   login postgres.dtcxlxehqiuhmhuypqbm. Reject other project suffixes, port 6543,
   query/host overrides, ambiguous alternatives and Production contexts.
3. Preserve certificate AND hostname verification for that exact pooler endpoint;
   never use rejectUnauthorized=false or skip hostname validation. Verify any
   required public CA through its official source; do not change credentials here.
4. Retain the hard-coded system identifier 7703760980994770283. Backend effective
   and session roles must resolve to the expected postgres role, not merely trust
   the qualified client username. Missing pg_control_system permission fails closed.
5. Keep a single explicit PostgreSQL transaction for lock, final identity check,
   history checks and all DDL. Revalidate after acquiring the lock and before DDL.
   The precheck alone never authorizes execution. No reconnect/replay on failure;
   uncertain COMMIT requires independent history/catalogue inspection.
6. Before execution, validate the Session route with separately authorized read-only
   identity/permission checks from the actual execution environment. Backup success
   elsewhere does not prove this environment's routing or the runner's TLS setup.

Recommended route: assess and pin the existing verified Session pooler rather than
purchase infrastructure or weaken identity checks. Direct IPv6 is not a semantic
requirement. However the current guard STILL intentionally rejects all poolers.
No Session allowlist/credential/environment change was made in this task. The exact
non-secret Session hostname and a reviewed narrowly scoped guard extension are
needed before the proposed route can be used. This document is not execution approval.

## Implemented local changes

Initial identity inspection now uses a dedicated READ ONLY transaction with
statement_timeout=3s and lock_timeout=1s. SET LOCAL settings expire with that
transaction. The separate migration transaction retains its original 5s lock and
60s statement timeouts, transaction advisory lock, final identity check and rollback.
These are server query/lock deadlines, not a claimed 3s bound on DNS/network/pool
acquisition. Driver connection establishment has its separate timeout.

Five real-driver tests now run the full developmentMigrationTransaction function
using the existing postgres.js-backed Database wrapper. Test-only instrumentation
executes the actual identity SELECT, substituting only the returned cluster ID and
database name that differ in the disposable fixture. No production test bypass or
configurable expected-ID override was added. All roles, transaction state, backend
PIDs, locks, SQL errors, timeouts, DDL and rollback behavior are actual PostgreSQL.

Verified scenarios:
- Read-only bounded precheck; final identity/lock/DDL and inserted default PID agree;
  migration transaction is writable and retains its 60-second statement timeout.
- A separate connection cannot take the held advisory transaction lock.
- Changed identity on the migration transaction prevents the DDL callback entirely;
  no target table appears and another transaction can acquire the released lock.
- A real SQL error rolls back earlier fixture DDL.
- Real advisory contention times out in about five seconds before DDL.
- A 30-second simulated stalled precheck query is cancelled in about three seconds,
  before any migration lock/DDL, and fails closed.

These tests exercise a local PostgreSQL server, not a deployed Supavisor pooler,
TLS connectivity, or the actual hosted cluster. No hosted acceptance is claimed.

Validation: **116 tests passed, zero failures/skips**, with PostgreSQL 17.10 and
pgvector 0.8.2; TypeScript and serial production build passed. The disposable
container was removed. [Machine-readable evidence](validation/session-pooler-migration-preflight.json).

## Decision

**NO-GO for hosted migration.** Local guard regression validation passed, but current
execution-environment direct routing is blocked; Session support is not enabled,
and exact endpoint attribution plus read-only runtime verification remain pending.
Preserve the owner's verified recovery evidence and obtain separate explicit
migration approval after all gates pass. No paid resources, hosted migrations,
Production access, deployments, pushes or credential modifications occurred.
