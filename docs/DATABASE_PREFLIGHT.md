# Database migration preflight — 1 November 2026

**Status: blocked on read-only database access. The migrations are not yet
certified ready to execute, and no migration approval is being exercised.**

Rechecked **2 November 2026** after renewed read-only authorisation. Local
DATABASE_URL remains a non-parseable placeholder, with no Supabase management
credential/SQL connector. Vercel environment metadata is unchanged from the
successful 1 November connection check: the working DATABASE_URL remains
Sensitive and shared across Preview/Production; the CA remains branch-only.
The exact feature alias still serves `c292574`. Checkpoints `654c09c` and
`871349e` are preserved, with application and migration source unchanged.
No additional hosted SQL or local fixture run occurred; identity, conflicts,
data presence and migration eligibility remain unverified. The access routes
and conditional approval plan below still apply. New evidence:
[preflight-access-2026-11-02.json](validation/preflight-access-2026-11-02.json).

The user authorised catalog/data-presence inspection and a migration/recovery
plan, explicitly excluding migration execution, deletion, resets, security
changes and Production changes. Checkpoint `654c09c` remains an ancestor. GitHub
still has `c292574` on the feature branch. No application code, deployment,
environment binding or hosted database was changed during this preflight task.

## Actual evidence and limits

| Check | Result |
| --- | --- |
| Preserve local checkpoint | Passed; `654c09c` and all prior history retained |
| Vercel project identity | Passed; `daniyal-1415s-projects/echo`, linked to `daniyal-ship-it/Echo` |
| Actual Supabase project reference/database/role | Blocked; not exposed by the existing hosted diagnostics |
| Read-only direct connection from Codex | Blocked; local DATABASE_URL is a non-parseable placeholder |
| Reuse saved Vercel credential through management API | Blocked; its Sensitive binding does not return a usable value even with the authenticated read/decrypt request |
| Hosted TLS / SELECT 1 | Passed in the preceding run at 02:25 UTC, not rerun here |
| Known migration states | Preceding hosted run: neither migration recorded as applied; not a full schema inventory |
| Existing ECHO objects, conflicts and row presence | Blocked; no hosted catalog/data-presence query ran in this task |
| pgvector availability / installed state | Preceding hosted run: available, not installed or visible |
| Role CREATE privileges | Preceding hosted run: database CREATE and current-schema USAGE/CREATE true |
| pgvector install eligibility in the target schema | Unconfirmed; CREATE privileges alone do not prove permission to install an untrusted extension |
| Target-version / schema compatibility | Unconfirmed until the supplied catalog preflight runs |
| Inspection SQL validation | Passed on isolated in-memory PGlite, including row-presence/history/index-conflict fixtures; not hosted evidence |

Vercel still reports DATABASE_URL targeting Production and Preview with no branch
override. DATABASE_CA_CERT remains encrypted and scoped only to the feature
Preview. No saved value was displayed or written to an artifact. No replacement
database password or API key is needed. There is no authorised Supabase management
credential or SQL connector in this environment, and no arbitrary-SQL endpoint
in the existing application. No new diagnostic deployment was created.

Evidence: [preflight-access-2026-11-01.json](validation/preflight-access-2026-11-01.json).

## Complete the inspection without changing the database

Preferred automated route: securely bind the **existing rotated DATABASE_URL**
to this Codex environment, replacing its local placeholder only. Do not change
Vercel's working value or paste secrets into chat. The already verified public
Supabase CA can be reused; no new API keys or security exceptions are needed.
If database-protocol access is unavailable, use the manual route below rather
than changing network/security settings repeatedly.

Manual route: in the Supabase project linked to the saved Vercel connection,
open SQL Editor and execute the complete
[database-preflight.sql](preflight/database-preflight.sql). Record the dashboard
project reference (not a key) alongside its metadata result. The script begins
a repeatable-read, read-only transaction, sets 15-second statement and 2-second
lock limits, selects metadata and row-presence booleans only, and ends with
ROLLBACK. It creates no temporary objects and runs neither migration. If it
errors, issue ROLLBACK and report the error code; do not remove read-only mode.
Use the same database role as ECHO or explicitly report the role difference.

The script inventories schemas, relations (including indexes and views), column
types, constraints, matching functions, triggers, extensions, role permissions,
default grants and policy metadata. It checks only for the presence of rows in
matching ordinary/partitioned tables in public/the current target schema; no
email, password hash, session token, note, archive or other row value is selected.
History output contains counts for the two known versions and total history
records. It does not execute views or foreign tables. Row absence under active
RLS is not authoritative. `auth.users` is a Supabase object, not automatically
an ECHO object or a conflict with `public.users`.

Required interpretation before declaring ready:

1. Match the connection's non-secret project reference against the Supabase
   dashboard, database name and role. A pooler host alone does not identify a
   project. Confirm whether Production actually connects to the same target;
   the shared saved binding alone does not prove old deployments' snapshots.
2. Confirm the scripts' unqualified names resolve to the intended schema
   (normally `public`). Inventory all matching tables, indexes, composite/array
   types, constraints and the trigger/function name. Existing same-name objects
   are not safe to overwrite even if empty. Missing history does not prove absent
   tables. A missing permission or RLS-filtered result remains blocked.
3. Confirm PostgreSQL supports stored generated columns (12+), English full-text
   search, PL/pgSQL and the SQL/constraint/trigger features used in the scripts.
   Check available vector version, control-file schema/relocatability, required
   dependencies, trusted/superuser flags and the actual Supabase privileged-role
   or extension allowlist rules. Verify the proposed schema is in the app's
   search path so `vector(1536)` and operators resolve. No CREATE EXTENSION
   trial is permitted during this read-only preflight.
4. Inspect table/function default ACLs and Data API schema exposure. These exact
   migrations enable no RLS and revoke no grants. If default privileges would
   expose private ECHO tables through Supabase's Data API, stop: an explicitly
   reviewed access-control plan is required before installation. Do not silently
   change grants, disable the Data API, or rely only on ECHO's application checks.
   A null `pgrst.db_schemas` setting is not proof that the Data API is disabled.
5. Confirm existing recovery facilities and a usable pre-change recovery point
   without purchasing or upgrading anything. The metadata export is not a data
   backup. Backup availability and recoverability have not been verified here.

## Exact proposed changes

The [static manifest](preflight/migration-manifest.json) records the unchanged
SQL paths and hashes. No ECHO migration was executed, including in local validation.

| File | SHA-256 |
| --- | --- |
| `001_foundation.sql` | `e2aa042caac73f5c9bfcc6670e1d2ebaf02fd16663af32cb92865d54965ec8d5` |
| `002_memory_intelligence.sql` | `03a8133818c74bc51882a2c91f1b57019ae5080ab11a4b61e233e59da28d26c7` |

Migration 001 installs `vector` if absent and creates 14 tables including history:
`schema_migrations`, `users`, `workspaces`, `sessions`, `auth_attempts`,
`data_sources`, `memory_nodes`, `memory_versions`, `memory_edges`, `embeddings`,
`import_jobs`, `agent_runs`, `retrieval_citations`, `audit_events`.

Migration 002 creates eight tables: `memory_chunks`, `embedding_cache`,
`chunk_embeddings`, `intelligence_jobs`, `intelligence_operations`,
`analysis_parts`, `memory_analyses`, `query_embeddings`.

The six explicit indexes are `sessions_expiry`, `memories_search`,
`memories_workspace_date`, `memories_tags`, `chunks_search`, `chunks_source`.
Primary/unique constraints additionally create their normal backing indexes;
tables create their normal composite/array types. All column definitions,
foreign keys, checks, defaults and generated search columns are fixed by the
two hashed scripts, which are the complete object-definition authority.

Migration 002 also adds `versions_workspace_memory_version` to `memory_versions`,
`retrieval_citations.chunk_id` with its foreign key, `memory_edges.semantic_evidence`,
and the `invalidate_memory_intelligence()` function and same-named trigger on
`memory_nodes`. Two migration-history rows are inserted. No existing source
content is backfilled or intentionally rewritten. On future source-version
updates, the trigger deletes derived chunk mappings and candidate semantic edges,
supersedes incomplete jobs and marks retained semantic evidence stale.

## Execution plan — only after completed preflight and separate approval

1. Record the verified project reference, database, role, target schema, migration
   hashes and before-state inventory. Resolve any access-control/default-grant
   concern first; it must not be hidden inside a migration approval.
2. Confirm the existing recovery point/export is available and usable. If backup
   creation requires an additional action, obtain that authority; never upgrade
   a plan or purchase infrastructure. Coordinate a period without concurrent
   application writes/startups on the shared database before the final preflight.
   Do not change Production settings or availability without explicit authority.
3. Securely provide the matching DATABASE_URL and verified DATABASE_CA_CERT to
   the existing operator process, keeping strict TLS and hostname checks enabled.
   Never pass credentials in command-line arguments or enable shell tracing.
4. Rerun the read-only inventory immediately before execution. Abort on identity,
   source/hash, schema, privilege, grant or object changes. Use the feature-branch
   operator at this checkpoint, not main's older automatic-startup code.
5. Run exactly `npm run db:migrate -- --apply` once. The existing runner performs
   connection/catalog checks, then takes transaction advisory lock `68182041`,
   creates the history table if needed and executes 001 then 002 inside one
   database transaction. Commit occurs only after both complete. It skips versions
   already in history; any unexpected history changes must be reviewed, not
   treated as proof that an existing schema matches. The current runner has no
   explicit migration lock/statement deadline; agree bounded session settings or
   a supervised cancellation procedure before execution rather than assuming one.
6. Reinspect exact history, tables, columns, constraints, vector schema/type,
   grants and RLS state read-only. Verify both Preview endpoints and strict TLS.
   Account/note mutation tests and all billable AI tests remain separate from
   this migration approval. Do not redeploy or promote Production.

## Rollback and recovery

- **Failure before COMMIT:** the existing runner wraps both migrations and new
  history records in one transaction. An error rolls back the transaction,
  including new pgvector installation and schema objects created inside it.
  Close the connection and verify the original inventory/history read-only.
  Do not delete objects manually to make a retry pass.
- **Lost connection or uncertain commit:** inspect history and the resulting
  catalog before any retry. A client error alone does not prove rollback.
- **Failure after confirmed COMMIT:** there is no supplied down migration.
  Rolling back the deployment does not reverse the database. Preserve all data;
  prefer an approved forward repair. Removing the new objects requires separate
  destructive-change approval and fresh proof that no application has written
  data or created dependencies. Never run DROP CASCADE or reset the database.
- **Restore:** only use a verified existing backup/recovery facility under
  separate restore approval. Restoring a shared database affects other schemas
  and all later writes; it is not an automatic feature-Preview rollback. No
  restore, export of personal data or backup creation was performed here.

## Production implications and approval boundary

The current Production deployment is READY at `6f19c18` on main. It was inspected
through Vercel metadata only; no Production HTTP request or deployment occurred.
Its source includes automatic foundation migration on database startup, unlike
the feature branch's read-only startup guard. The proposed 002 trigger also acts
on subsequent version updates made by that older application. Sharing the
database can therefore affect Production behaviour even without a deployment.
Its connectivity, active credential snapshot and full compatibility are not
certified by this preflight. Do not describe shared-schema migration as a
Preview-only change.

**The required next approval is not migration execution yet: access/metadata is
missing.** Complete the read-only inspection first. Once its identity and all
conditions above are verified, the execution request must name the actual
project/database/schema and ask:

> Authorise one transactional execution of the unchanged, hashed
> `001_foundation.sql` and `002_memory_intelligence.sql` on the verified Supabase
> project/database/schema, including pgvector installation, 22 tables, their
> indexes/constraints/types, the specified column changes and invalidation
> function/trigger, and two history records. Acknowledge that this database is
> shared with Production and the schema/trigger changes may affect it, despite
> no Production deployment. Abort if preflight conditions have changed. No
> deletions, resets, credential/security changes, paid upgrades or automatic
> post-commit restore are authorised.

The target must be filled from actual evidence before presenting that request
for approval. This template is a plan, not a statement that the migrations are
ready or that approval has been granted.
