# Migration security patch — 2 November 2026

Status: locally tested candidate; **NO-GO for hosted migration**.

Accepted owner evidence: echo / pyidklztsnowarqumtki / postgres, PostgreSQL 17,
vector 0.8.2 available, public empty at inspection, Data API enabled exposing
public and graphql_public. Automatically expose new tables was enabled; its
current disabled state has NOT been verified. No hosted SQL ran in this task.
The available tools contain no Supabase connector. No credentials are requested.

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

Remaining hosted preflight: use the existing connected account and
preflight/security-prerequisites.sql to confirm actual version/role/search_path,
extension install eligibility, global and per-schema default ACLs, inherited
roles, schema CREATE privileges and unchanged object/history inventory. Confirm
Data API automatic exposure is disabled in the dashboard (do not change it under
read-only authority). Confirm usable recovery point and shared Production impact.
Preserve public/graphql_public settings and all managed objects.

Execution approval is withheld until those checks pass. Then approve the exact
hashes of 001/002/003 together for this named target and public schema, including
22 tables, vector and extension objects, six explicit indexes plus constraints,
002 column changes and trigger, RLS/ACL controls and three history records.
Before commit any error rolls back all new objects. On uncertain commit inspect
history/catalog before retry. After commit preserve new data; no DROP/reset/restore
is authorised. Production shares a binding and can be affected without redeploy;
no Production operation or main merge occurred here.
