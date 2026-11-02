# Migration security patch — 2 November 2026

Status: patch review passed; **NO-GO for hosted execution pending the remaining
operator/recovery evidence below**. Patch source remains exactly `74f3dc8`.

Accepted new live evidence supplied by the owner: project echo /
pyidklztsnowarqumtki, database postgres, PostgreSQL 17.11, inspected role postgres,
search_path "$user", public, extensions, no public relations/functions, vector
0.8.2 available/not installed and database/public CREATE available. Default ACLs
for postgres-created public objects grant access to anon/authenticated/service_role.
The owner has now disabled Automatically expose new tables and clicked Save.
This confirmation is accepted; automatic exposure is no longer an outstanding
confirmation. Data API remains enabled with public/graphql_public exposed.
These are owner-supplied live findings, not independent agent-hosted SQL results.
No database credential is requested and no hosted SQL ran during this review.

003_server_only_access is now registered after unchanged 001 and 002. All three
run in the existing single transaction with advisory lock on managed PostgreSQL.
Transaction-local lock/statement timeouts are 5/60 seconds; creation schema must
be public. Managed startup remains read-only and refuses pending migrations.

003 enables RLS on all 22 tables, creates no policies, removes table AND column
grants from PUBLIC and existing anon/authenticated/service_role roles, and fails
closed on surviving effective privileges (including inherited grants and PG17
MAINTAIN). It requires expected table ownership by the migration/backend role.
The invalidation function remains SECURITY INVOKER, uses pg_catalog,public and
has no PUBLIC/API role execution. Owner access remains: RLS does not isolate an
owner/BYPASSRLS backend from its own data. Server workspace checks remain essential.

Scope review: no application sequences exist, so no sequence ACL is modified.
Public schema USAGE cannot be broadly revoked without affecting unrelated managed
objects. No schema-wide table/function revokes or managed extension changes are
made. API roles must have no inappropriate public CREATE access; verify this in
the remaining preflight. Unexpected existing policies/owners abort migration.

ALTER DEFAULT PRIVILEGES review: defaults are scoped by creator/schema, not by
an ECHO table-name list. Changing postgres defaults globally or across public
would affect unrelated future objects. This patch intentionally preserves those
shared defaults and removes inherited creation grants before commit on exact
ECHO objects. Every future ECHO table/function migration MUST include equivalent
controls and effective-privilege assertions in its creation transaction; 003
cannot automatically protect objects added later. An ECHO-only creator/schema
would permit narrower defaults but requires a separately reviewed architecture
and privilege change. Do not claim future objects are automatically protected.

Local verification: original 36 core tests pass after registering 003; two new
security tests pass using actual migrations in isolated PGlite with hostile
Supabase-like defaults. Checks cover 22 RLS tables, all three API roles, table and
column privileges, inherited-column-grant rejection, PUBLIC function denial,
function search_path, owner writes, unrelated table access, safe rerun and full
rollback of fresh tables/history/vector installation. Existing upgrade test
preserves original content and anchors across migration and reopen. Typecheck
passes. These are local PostgreSQL-compatible tests, not a Supabase 17/0.8.2
hosted acceptance claim. No live AI calls occurred.

## Final review and remaining evidence

PostgreSQL 17.11 source compatibility: the migration uses supported RLS, ACL,
DO/PLpgSQL and SET LOCAL features. Its version guard includes PostgreSQL 17's
MAINTAIN privilege. The reported path resolves public as creation schema unless
a same-named user schema exists; the runner explicitly rejects any other creation
schema. The function's fixed pg_catalog,public path resolves its ECHO tables.
The official vector 0.8.2 source supports PostgreSQL 13+ and 1,536 dimensions.

An additional isolated run used the unchanged SQL with BOTH hostile table and
function default grants. Direct API grants and MAINTAIN were removed; a surviving
inherited function grant aborted the entire transaction, including vector and
new tables. The installed local runtime was PostgreSQL **18.6 / vector 0.8.7**.
This is actual local test evidence, not an exact hosted-version test. PostgreSQL
17.11/vector 0.8.2 compatibility is based on source review and official support,
not a claim that hosted SQL has executed. Existing 38 passing tests remain valid.

The official vector v0.8.2 installation SQL was retrieved from its pinned upstream
tag and reviewed for transaction-incompatible operations. It defines PostgreSQL
extension objects and has no nontransactional installation requirement. In this
runner, CREATE EXTENSION, tables, indexes (not CONCURRENTLY), function/trigger,
ACL/RLS changes and all three history rows are inside one transaction. There is
no commit between stages. A successful DB commit may precede a client/log failure,
so a failed command alone does not establish rollback.

Owner postgres retains ownership/administrative access; API roles receive no
application privileges. Effective inherited table/column/function privileges
cause rollback rather than modifying unrelated parent roles. Existing owner-mode
authentication/memory/indexing/retrieval passed the local suite. This does not
prove the current hosted app's runtime role or post-migration operation.

Remaining evidence (not new permission to alter anything):

1. The current role-membership and schema-grant matrix: especially API-role public
   CREATE, privileged/SET ROLE memberships, and confirmation that ECHO's actual
   backend connects as the intended postgres owner. The supplied role was the
   inspected SQL session; broad database CREATE alone does not answer this matrix.
   No shared schema grants/default ACLs may be silently changed to clear a failure.
2. Supabase's postgres extension-install eligibility (privileged-extension rules)
   and a usable existing recovery point with timestamp/identifier and restore
   procedure. Availability of vector plus schema CREATE is not itself proof of
   untrusted-extension installation authority or backup recoverability.
3. Confirm shared Production dependencies/write coordination for that database.
   A saved shared binding does not prove old runtime snapshots; applying this
   schema can affect Production without deploying new code.

Use the existing connected account and preflight/security-prerequisites.sql for
metadata only. Backup/restore and runtime identity evidence may require its
management view. No connector is available in this agent session. Do not ask for
DATABASE_URL, replace credentials, create a paid backup or test restoration on
Production. These pre-existing gates remain open; the empty-schema, server-version,
search-path, default-grant and automatic-exposure questions are resolved by the
owner's evidence.

## Exact rollback and uncertain-commit procedure

Before execution, record object/extension/history inventory, all three SQL hashes,
the named target, migration/backend role and recovery point. Use one operator,
verified TLS and the reviewed runner; do not run SQL files individually.

- On a SQL/security/lock-timeout error before commit, PostgreSQL aborts the whole
  transaction. The driver rolls it back; connection loss before commit also rolls
  back on session termination. Confirm session termination and inventory before
  claiming rollback. Do not drop any object or reset the database.
- On disconnect, cancellation or missing success acknowledgement, stop other
  migration attempts. Reconnect through authorised read-only access and first
  inspect to_regclass('public.schema_migrations'), public objects and vector.
  Only if history exists, SELECT its version records. Check all 22 expected tables,
  columns/constraints, RLS flags, function configuration and effective API-role
  table/column/function privileges; the ledger alone is insufficient.
- If all three records and the complete secured schema exist, treat the migration
  as committed and perform authorised acceptance checks; do not reapply it.
- If the exact before-state remains (for this fresh target: no ECHO/history objects
  and no vector), the transaction did not commit. Investigate the error before a
  supervised retry within explicit approval. Do not infer this from a CLI exit code.
- If any partial or inconsistent state appears, stop. It may represent concurrent
  activity or an unrelated/manual change. Preserve evidence; do not auto-retry,
  delete history, drop objects or restore over it.
- After confirmed commit, there is no automatic down migration. Preserve new
  writes, prefer an approved forward fix, and require separate explicit approval
  for any destructive reversal or shared-database restoration. A code rollback
  does not undo schema changes. Restore only from a verified recovery point under
  a separately approved plan accounting for every affected schema and later write.

The existing rerun test proves data-preserving skipping of already-recorded
migrations; it is not a substitute for the above uncertain-commit inspection.

## Approval boundary

No execution approval is requested yet because recovery and role/operational
checks remain unverified. When closed, the request must explicitly authorise one
transactional application of 001,002,003 at source 74f3dc8 to echo /
pyidklztsnowarqumtki / postgres / public as the verified backend/migration owner,
including vector, 22 tables, six explicit indexes plus constraints/types, the 002
column/function/trigger changes, scoped RLS/ACL restrictions and three history
records. It must acknowledge shared-Production database implications but exclude
Production deployment, global default-privilege changes, resets, destructive
rollback and paid actions. Immediate identity/inventory drift must abort the run.
