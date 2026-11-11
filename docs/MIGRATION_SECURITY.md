# Migration security patch — 2 November 2026

Latest target update (11 November): the owner has created **echo-dev /
 dtcxlxehqiuhmhuypqbm / eu-central-1**. See [the new-target preflight](ECHO_DEV_PREFLIGHT.md)
for accepted identity/version evidence, remaining read-only security/extension
checks, atomic execution plan and separate approval gates. Earlier creation-pending
statements below are historical. The old project and Production remain unchanged;
no migrations, bindings or deployments have been performed for echo-dev.

Current direction (11 November): [separate disposable Free development project](ISOLATED_DEVELOPMENT_PLAN.md).
This supersedes attempts to migrate the shared database. The old project and
Production remain untouched. The owner reports a Free slot available; organisation
identity and explicit creation approval remain pending. No new project, connection,
migration or deployment has been created for this plan.


## Verified Preview runtime identity — 2 November 2026

The explicitly authorised diagnostic at source 109eb10 was deployed only to the
feature Preview. A single authenticated health GET produced a private identity
event at 02:33:46 UTC, correlated to request
`5f6b9d97-28cf-4fd9-b657-fd135cf6cc11` and deployment
`dpl_6v5mFoaYpt9wywt2pHrUaMnHZpTu`.

- Database: postgres. Effective role: postgres. Session role: postgres.
- Raw reported search_path: `"\$user", public, extensions` (a literal backslash
  precedes the dollar sign in the runtime value; do not silently normalise it).
- Resolved effective path: public, extensions. No configuration was corrected.
- Diagnostic transaction read_only=true; initial SELECT 1 and verified TLS passed.
- All three migration assets were present and all three history states unapplied.
  writes_authorised=false. HTTP 500 was DB_MIGRATION_REQUIRED, not identity failure.

This closes the feature diagnostic deployment's runtime-role/path gate. It does
not retrospectively establish c292574's identity, prove the Supabase project
reference from the generic database name alone, identify Production consumers or
verify extension authority/backups. Continue treating the database as shared.

Both temporary branch-only flags were deleted immediately after the request;
all original environment-binding metadata was restored exactly. Cleanup Preview
`dpl_9QEGz74Kw5rvewvvzz45tqgBzzba` is READY at the same 109eb10 source, with the
feature alias pointing to it and no diagnostic flags. Its immutable URL is
https://echo-bctcr6nir-daniyal-1415s-projects.vercel.app.
Production deployment dpl_DwWoKnXjC741386ehwxUjHwqpBPH and protection were unchanged.
The actual older snapshot expiry was 02:46:31 UTC, rather than the announced
02:36:31 UTC: the revised timestamp was not persisted during the initial setup
error. No elapsed-expiry claim is made. At 02:38:16 UTC the temporary diagnostic
deployment was removed after verifying it was neither Production nor the active
feature alias; a management GET confirmed 404. The disabled cleanup Preview and
Production were unchanged. Evidence was preserved before removal. No second
health request was sent. Cleanup no longer relies on waiting for that deadline.

Existing OIDC authentication was used only in a secure header to the exact feature
origin with no redirects. Local OIDC material was deleted; no persistent bypass
was created (zero before/after). The short-lived OIDC token was not individually
revoked and expires at 14:33:35 UTC; local deletion is not revocation.

An initial helper response-format error left only the enable flag, without expiry;
it was removed and original settings verified restored. The authorised feature
push triggered an extra inactive Preview build. The diagnostic remained disabled
there because the required expiry was absent. The later diagnostic and cleanup
builds used the exact approved source. No additional authenticated health request,
Production operation, credential modification, migration or paid API call occurred.

**Migration remains NO-GO** pending pgvector installation authority for postgres,
active-consumer/shared-Production attribution and an actual recovery point/restore
readiness. These requirements are unchanged; feature runtime identity is now
verified. No migration approval was granted or exercised.

[Correlated evidence and cleanup](validation/preview-identity-execution-2026-11-02.json).


Prepared, not deployed: [temporary Preview identity diagnostic](PREVIEW_IDENTITY_DIAGNOSTIC.md).
It defaults off and requires separate approval for a feature-only deployment,
short-lived flags, protected read-only probe and cleanup. Current Vercel evidence
is accepted; database sharing remains the assumption. Migration stays NO-GO.


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

## Latest confirmed role evidence and unresolved operational checks

Accepted owner evidence now also confirms public USAGE without CREATE for anon,
authenticated and service_role; postgres has USAGE/CREATE and inherits several
Supabase roles, including those API roles. Those schema checks are closed and
must not be requested again without relevant drift.

Membership is directional: postgres inheriting anon/authenticated/service_role
does not grant those roles postgres ownership. Revoking their grants does not
remove postgres's owner rights. Migration 003 checks effective API-role table,
column and function privileges; any surviving inherited access aborts the whole
transaction instead of editing unrelated parent-role grants. No role membership
change is required by this evidence. It does not establish the role used by a
Vercel function's database connection.

Fresh read-only Vercel metadata confirms feature alias deployment
`dpl_7SnSSc4w7sYJGvGq67wCxMaxA2oW` at c292574 and READY Production deployment
`dpl_DwWoKnXjC741386ehwxUjHwqpBPH` at 6f19c18. The project DATABASE_URL binding
still targets both environments. This is potential shared dependency, not proof
of an active connection to pyidklztsnowarqumtki. Production was built before the
saved credential update and retains its own environment snapshot. READY status
and saved binding metadata cannot establish runtime identity or active traffic.
Other deployments/consumers cannot be excluded from that metadata.

Source review confirms neither deployed version emits current_user/session_user
or its effective search_path. The driver takes its connection configuration from
the runtime secret and applies no explicit role/search-path override in code.
This does not prove the secret's username or session settings. Existing safe
health diagnostics therefore cannot answer the runtime identity question.
No Production HTTP probe was made: its source may auto-apply migration 001 on
startup, violating this task's read-only boundary. No diagnostic deployment was
created and no deployment's secret was extracted.

**Current result: NO-GO, with four remaining evidence gaps:**

1. Actual backend-session identity/path and database attribution for each active
   ECHO environment. Obtain only `current_database(), current_user, session_user,
   current_setting('search_path'), current_schemas(false)` from the running backend
   connection, with its deployment ID. SQL Editor output cannot substitute for
   this. Existing deployed diagnostics do not collect it, so closing this needs
   an existing runtime-observability facility or a separately reviewed diagnostic
   capability. No such deployment is authorised or performed in this review.
2. Extension-install authority for the chosen execution role. Use the new
   [metadata-only query](preflight/extension-authority.sql) via the existing
   connected account. The official Supautils documentation describes delegation
   for allowlisted privileged extensions; actual installed-library/configuration
   evidence must establish that vector qualifies. An absent GUC is inconclusive,
   not proof of permission. Supautils can also override the extension installation
   schema, so search_path alone does not guarantee installation into public.
   Verify the actual resulting-schema plan and runtime visibility; do not change
   the shared search_path or permissions to force it through.
3. Deployment/consumer attribution to this exact database. Correlate actual
   runtime identity/configuration with connection activity and deployment-specific
   tags or management inventory. Anonymous pooler sessions, a generic application
   name or a quiet snapshot are insufficient to exclude other dependencies.
   No raw SQL query text or secrets are needed. Until resolved, assume Production
   and other consumers may be affected and do not invoke old startup migrators.
4. A concrete, usable recovery point. No Supabase connector or management token
   is available here; no backup listing has been read. No backup is claimed to
   exist. Through the connected account, inspect Database > Backups or GET
   `/v1/projects/pyidklztsnowarqumtki/database/backups`. Provide only backup ID/type,
   completion status, UTC time (or enabled PITR recoverable interval), retention
   and available restore action. A plan name or empty public schema is not proof.

### Restore procedure: provider-documented, target availability unverified

Official Supabase backup documentation was retrieved over verified HTTPS. If a
completed scheduled backup exists, the project-specific path is Database >
Backups > select the required pre-change point > Restore > confirmation. The
project is inaccessible during restore; all affected schemas and later writes
must be accounted for. Wait for the dashboard completion state, then verify
connection, schema/history/security and application behaviour. Existing custom
role passwords and any non-Realtime replication/subscription handling must be
reviewed for the selected backup method. Database backups include Storage metadata,
not the stored object bytes. Do not assume restoring the database restores files.

If PITR is already enabled and a valid retained interval exists, select a UTC
point in that interval and use its restore workflow instead. Do not enable or
purchase PITR here. If neither method exists, report recovery unavailable; do
not infer an export or create paid resources. The actual project restore method
cannot be selected or certified until its backup inventory is available. No
restore was tested or initiated. Restoration would require separate destructive-
action approval and Production downtime coordination, not migration approval alone.

Official references: [Supabase backups](https://supabase.com/docs/guides/platform/backups)
and [Supautils privileged extensions/schema overrides](https://github.com/supabase/supautils).
The precise next owner action is to obtain these missing non-secret runtime and
management evidence items through the existing connected accounts; no further
empty-schema/automatic-exposure/schema-CREATE recheck or DATABASE_URL is requested.

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
made. The owner has confirmed API roles have no public CREATE access. Unexpected existing policies/owners abort migration.

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

The latest operational evidence gaps are listed above. They supersede the older
role/schema-grant checklist: public permissions, membership direction, default
grants and disabled automatic exposure are now accepted. Runtime identity,
extension authority, active dependency attribution and recovery inventory remain
unverified. No application/migration code changes were needed for this review.

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
