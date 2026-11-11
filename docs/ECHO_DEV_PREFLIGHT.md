# echo-dev migration preflight — 11 November 2026

## Target and decision

Only permitted candidate: **echo-dev / dtcxlxehqiuhmhuypqbm**, organisation
rttaltwkawyehzqregon, eu-central-1. The owner reports ACTIVE_HEALTHY,
PostgreSQL 17.11, database/session inspection role postgres, search_path
`"$user", public, extensions`, zero public application objects, empty migration
history, and vector 0.8.2 available but not installed. These are accepted
owner-supplied connected-account findings, not independently repeated here.

**NO-GO for execution until the remaining read-only evidence below is reviewed,
then separate migration approval is required.** The project now exists; earlier
Free-slot/creation gates in the handoff are superseded. f08377b and 74f3dc8 are
preserved; application and migration SQL are unchanged.

No Supabase connector is callable in this session, no SUPABASE_ACCESS_TOKEN is
configured, and the local DATABASE_URL fails URI parsing. No connection attempt
was made, no secret value is reproduced, and no credential replacement is needed
for the connected-account/SQL Editor route. Vercel access does not grant database
management access. The old Preview binding must NOT be used to run this preflight.

## Remaining read-only checks

Run [echo-dev-security.sql](preflight/echo-dev-security.sql) using the existing
connected account/SQL Editor **in dtcxlxehqiuhmhuypqbm**, as the intended execution
role postgres. It uses read-only transactions, catalog queries and timeouts;
returns no row contents or credentials. Its expected-reference label is not an
identity assertion: verify the dashboard project reference separately. It reports:

- Effective/session identity, creation schema, role flags, all membership edges
  (including PG17 inherit/set options), schema/database rights and default ACLs.
- pgvector control metadata and actual Supautils delegation/schema overrides.
- PL/pgSQL, English full-text configuration and vector visibility prerequisites.

Inspect echo-dev's Data API enabled state, exposed schemas and Automatically
expose new tables state without changing them. The old project's OFF setting
is NOT evidence of echo-dev's setting. An absent pgrst GUC proves nothing about
the dashboard. If automatic exposure is enabled, stop and request separate
approval to turn it off on echo-dev before execution. Disabling Data API entirely
on this server-only development project is optional defence in depth and would
also need approval; it is not a substitute for migration 003.

Installation authority is NOT established by availability, role name postgres,
or schema CREATE alone. Require either a genuine superuser, an applicable trusted
extension route with database CREATE, or verified loaded Supautils delegation
covering vector for the executing role. Inspect both extension-specific schema
overrides and default install schema. Null settings are inconclusive. If catalog
metadata cannot establish delegation, seek provider evidence for this project;
no trial CREATE EXTENSION is authorised in a read-only review. Confirm the actual
planned installation schema is visible through public,extensions and usable by
the intended backend. No Supabase-managed schema or role changes are proposed.

Require API roles to lack public CREATE, superuser/ownership access and usable
membership paths to the owner. Review inherited grants in both directions;
postgres inheriting API roles does not grant them ownership. Defaults granting
API roles access are handled by exact-object revokes in 003 before commit.
Unrevokable inherited access causes full rollback, not broad role/default changes.

## Security and compatibility review

Source review passes for PostgreSQL 17.11/vector 0.8.2. Migration 003 enables RLS
on all 22 tables (including schema_migrations), creates no browser policies,
revokes table AND column grants from PUBLIC/anon/authenticated/service_role and
asserts effective privileges including inherited grants and PG17 MAINTAIN.
The invalidation function is SECURITY INVOKER with pg_catalog,public search_path;
PUBLIC/API execution is revoked and checked. No application sequences exist.

Shared schema/default ACLs remain unchanged; every FUTURE ECHO object must receive
equivalent restrictions in its creation transaction. RLS does not constrain the
owner/privileged backend: server workspace checks remain necessary. The intended
new backend is postgres, but its actual runtime identity must be verified AFTER
an approved new binding/deployment. The old Preview's runtime diagnostic cannot
prove a new connection's identity. Prior isolated tests passed; they used
PGlite PostgreSQL 18.6/vector 0.8.7, not this hosted target. No tests or hosted
migration were executed for this documentation-only review.

## Exact atomic execution plan — NOT authorised to run

1. One operator opens echo-dev's SQL Editor under the verified project reference;
   rechecks identity/empty state and the security evidence above immediately before
   execution. Verify the migration hashes below. Abort on drift or another target.
   A generic database name postgres cannot identify a Supabase project.
2. Assemble ONE SQL submission in the following order, with no intermediate commit:
   `BEGIN;`, `SET LOCAL lock_timeout = '5s';`,
   `SET LOCAL statement_timeout = '60s';`,
   `SET LOCAL idle_in_transaction_session_timeout = '60s';`.
   Assert current_database() = 'postgres', current_user = 'postgres',
   session_user = 'postgres', current_schema() = 'public', and the reviewed
   effective search path. Do not silently change role or search_path.
   Acquire `SELECT pg_advisory_xact_lock(68182041);`.
   Assert all expected ECHO tables/function/history remain absent and vector
   remains uninstalled. Stop on any unexpected existing public objects.
3. Append the COMPLETE UNCHANGED contents of 001_foundation.sql, then
   002_memory_intelligence.sql, then 003_server_only_access.sql. 001 creates the
   ledger itself; all three files insert their own version records. Do not paste
   each into separately committed executions and do not rerun this fresh-install
   bundle against an already-applied schema.
4. Before COMMIT, verify installed vector version/schema/visibility, all three
   history rows, all 22 RLS flags, expected owners, no policies, and zero effective
   API table/column/function permissions. Turn any mismatch into an exception.
   Then COMMIT once. Preserve the non-secret result and inspect the same metadata
   from a separate read-only transaction after commit.

The executable combined submission and its guard/assertion text must be reviewed
before execution; this document is the execution specification, not a claim that
a bundled SQL artifact has been run or validated on Supabase.

Proposed objects: vector extension and its extension-owned types/operators/functions;
22 public application tables including the migration ledger; six explicit indexes
plus PK/unique/FK constraints and their implicit indexes/row types; the additional
memory_versions unique constraint, retrieval_citations.chunk_id and
memory_edges.semantic_evidence columns; invalidate_memory_intelligence function
and update trigger; scoped RLS/ACL changes and three migration history rows.
See [object inventory](preflight/migration-manifest.json) for 001/002 names and
[003](../db/migrations/003_server_only_access.sql) for exact security scope.
CREATE EXTENSION and these DDL/ACL operations are transactional; there are no
concurrent indexes or transaction-incompatible operations in these migrations.

Reviewed exact migration SHA-256:
- `001_foundation.sql`: `e2aa042caac73f5c9bfcc6670e1d2ebaf02fd16663af32cb92865d54965ec8d5`
- `002_memory_intelligence.sql`: `03a8133818c74bc51882a2c91f1b57019ae5080ab11a4b61e233e59da28d26c7`
- `003_server_only_access.sql`: `1d853c35afa1a37e30c3395b727158b80fd8db5ac23b993df98fd4476afde44e`

## Recovery and isolation

Before COMMIT failure, PostgreSQL aborts the entire transaction; issue ROLLBACK
if the session remains open and confirm the original inventory. On uncertain
commit, STOP and reconnect read-only: inspect history, all objects/security and
vector. Complete secured schema + three ledger rows means committed; exact
before-state means not committed; anything partial means investigate without
retry/reset/drop. Never infer rollback from a client error alone. After commit,
prefer a separately approved forward fix. No destructive down migration or
restore is authorised. No backup is claimed. This empty disposable target may
be evaluated without a Production restore point; only harmless fixtures may be
introduced later, and real data requires an actual export/recovery plan.

All subsequent approved database actions must target dtcxlxehqiuhmhuypqbm only.
Never use/modify pyidklztsnowarqumtki or splejgaknxvjpkblqnhz. No current operation
has connected to or changed either. Production, main, deployment protection,
provider keys, environments and existing CA bindings are preserved.

After migration acceptance, prepare a NEW Vercel DATABASE_URL binding with
`target: ["preview"]`, `gitBranch: "feat/core-memory-exploration"`, using the
new project's Connect-panel transaction-pooler URI stored securely (not chat/Git).
Validate its reference/username against dtcxlxehqiuhmhuypqbm before submission.
Do not edit the existing shared Production/Preview binding. Independently verify
the new database's official CA; preserve certificate/hostname verification and
change only the branch CA override if separately approved and required. No
connection value is invented or decrypted here. Setting the override and deploying
remain separate approval gates. Never remove the override as automatic rollback
because that would reconnect Preview to the old shared database.

## Separate approval request — held until checks pass

After remaining evidence is reviewed and the guarded SQL artifact prepared:
“Approve one atomic execution of unchanged migrations 001–003, including pgvector
installation and scoped security controls, ONLY on echo-dev
(dtcxlxehqiuhmhuypqbm), database postgres, as postgres, followed by read-only
schema/security acceptance. Exclude both existing projects, Vercel environment
changes, deployments, Production, paid resources and AI calls.”

Do not interpret the present planning request as this approval. Immediate next
action: obtain only the read-only query results and echo-dev dashboard exposure
settings through the already connected account. No credentials in chat.
