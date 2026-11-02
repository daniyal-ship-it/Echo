# Database migration preflight — 2 November 2026

Latest authorised implementation: [MIGRATION_SECURITY.md](MIGRATION_SECURITY.md).
003 is implemented and locally tested; hosted execution remains **NO-GO** pending
remaining role/extension/recovery and Production-coordination checks. The owner
has confirmed automatic exposure disabled and saved. Earlier statements
below that the security companion is unimplemented are historical and superseded.


**The owner's connected Supabase inspection clears the empty-public-schema
blocker. The existing migrations are not ready for approval as-is: their Data API
privileges and RLS protections are incomplete. No migration has been executed.**

Continue from preserved `adb61ca`, including `654c09c` and `871349e`. Application
code, both migration files, main, Production, secrets and deployment settings are
unchanged. The prior access-only conclusion is superseded by the owner's supplied
inspection. Do not request DATABASE_URL again. Any remaining metadata can come
from that same connected Supabase account; no database credential is needed in chat.

## Accepted inspection and evidence boundaries

| Check | Result and evidence |
| --- | --- |
| Project | `echo`, reference `pyidklztsnowarqumtki`, region `eu-west-1`; owner-verified through the connected Supabase account |
| Database / inspected role | `postgres` / `postgres`; owner-verified |
| Public objects/data | Owner reports no tables, views, sequences, functions or ECHO migration objects in `public`. No existing ECHO table data or reported public-name conflict |
| Creation permissions | Available, owner-verified |
| pgvector | Version 0.8.2 available, not installed, owner-verified |
| Earlier connection evidence | Live hosted SELECT 1 and strict TLS passed on 1 November; 28P01 resolved |
| Supabase Data API enabled/exposed schemas/automatic grants | Not included in the supplied findings; current project configuration is unverified |
| Default grants, effective API-role memberships/privileges | Not included in the supplied findings |
| Actual PostgreSQL version, creation schema/search path, extension-install role rules | Remaining metadata check, not a reason to repeat the empty-table inspection |
| Existing migrations' security controls | Repository review confirms no ENABLE RLS, policies, GRANT or REVOKE statements |

The owner report is accepted evidence, not an independent SQL run by this agent.
There is no callable Supabase connector or management credential in this tool
session. No new hosted query was run. The report concerns `public`; it does not
say the whole Supabase project, auth/storage schemas or Production are empty.
No independently observed Data API exposure or data leak is claimed.

## Compatibility review

The official [pgvector v0.8.2 source](https://github.com/pgvector/pgvector/tree/v0.8.2)
supports PostgreSQL 13+, 1,536-dimensional vectors and the `<=>` cosine operator
used by ECHO. Its control file is relocatable and has default_version 0.8.2.
The two migrations use ordinary UUID/JSONB, generated English full-text columns,
GIN indexes, relational constraints and PL/pgSQL; no incompatible pgvector feature
was found. Historical local migration tests exist, but these are not a trial
installation on this target. Neither migration was executed in this review.

The scripts use unqualified names. The least-change installation plan is to
confirm `public` is the creation schema and install `vector` there, as migration
001 currently does when public is first. This also creates extension-managed
functions/types/operators/casts/index support objects in public, not just ECHO's
one trigger function. Check the resolved runtime path so unqualified `vector`
and `<=>` resolve. Do not change a shared role's search_path globally.

Supabase's example instead installs vector in `extensions`. That is possible,
but then both the migration and application sessions must resolve that schema;
it must not be silently substituted for the current plan. Available extension
metadata, the actual server version, role rules and search path still need to be
recorded. Creation permission alone is not conclusive proof of permission to
install an untrusted extension. No CREATE EXTENSION trial is authorised yet.

## Confirmed security gap

ECHO authenticates its own `public.users` and hashed `public.sessions` through
server-side direct PostgreSQL queries. It does not use Supabase Auth JWTs or the
Data API. An ECHO session cookie is not `auth.uid()` or a Supabase authenticated
role, so adding an `auth.uid() = user_id` policy would not establish this app's
workspace isolation.

Supabase's current documentation says legacy public-schema defaults can grant
SELECT/INSERT/UPDATE/DELETE and additional privileges to `anon`, `authenticated`
and `service_role`; platform defaults are changing. The actual project's state
must be inspected, not assumed from its age or an empty schema. Raw SQL-created
tables do not automatically receive RLS merely because dashboard-created tables
do. With public exposed, matching grants and no RLS, the new password hashes,
sessions, source archives and memory tables could be accessed outside ECHO's API.
No such exposure exists on these not-yet-created ECHO tables today.

RLS and grants protect different layers. RLS does not cover TRUNCATE or function
EXECUTE; `service_role` bypasses RLS but still requires ordinary table privileges.
Functions receive PUBLIC EXECUTE through PostgreSQL defaults unless revoked.
Turning off automatic table exposure alone does not remove every privilege or
PUBLIC function execution. An unauthenticated REST 401 would not establish
safety for a request using a valid publishable/anon key or service-role credential.

## Proposed security changes — review only, not applied

Add an explicitly reviewed, reproducible security migration/atomic companion to
001 and 002. It must execute **before their transaction commits**, with these
changes limited to the exact ECHO objects listed below:

1. ENABLE ROW LEVEL SECURITY on all 22 ECHO tables, including schema_migrations.
   Create no anon/authenticated access policies: direct API access is denied.
2. REVOKE ALL table privileges from PUBLIC, anon, authenticated and service_role
   on those 22 tables, including privileges not governed by RLS. Verify effective
   table and column privileges through role membership as well as direct ACLs;
   abort if any remain. Unexpected column grants must fail the assertions rather
   than being overlooked by a table-level privilege check.
3. REVOKE EXECUTE on `public.invalidate_memory_intelligence()` from PUBLIC and
   those API roles. Keep it SECURITY INVOKER and fix its search_path to
   `pg_catalog, public`. Do not revoke every function in public or change vector's
   internal functions indiscriminately.
4. Preserve access for the confirmed server connection/table owner. The proposed
   compatibility mode assumes owner `postgres`; verify the application's actual
   role before execution. Owners/BYPASSRLS roles can bypass row policies, so these
   controls block direct Data API access, not a compromised server or an app bug
   running as owner. Do not add FORCE RLS, blanket permissive policies, new roles
   or credential rotations as an unreviewed part of this change.
5. Verify RLS enabled, no unexpected policies, no effective API-role privileges,
   expected owners and preserved server access before commit. On failure, abort
   the entire transaction. After commit, verify denied direct API access with
   appropriate existing credentials and normal ECHO health/auth behaviour.

The exact migration/companion SQL is not implemented or registered in this review.
The current `npm run db:migrate -- --apply` runner executes only 001 and 002; it
is **not yet the approved execution path**. Running it and hardening later would
leave an exposure window. A proposed third migration and registry change, or a
reviewed atomic wrapper, must be prepared and tested before execution approval.

Do not change project-wide Data API settings, exposed schemas, shared default
privileges or Production to implement this plan. Scoped explicit controls protect
these ECHO objects even if public remains exposed. Defaults still matter for
future migrations: every future ECHO table/function must carry equivalent controls
in its creation transaction. Role-specific/default-grant hardening can be reviewed
separately; changing defaults for postgres can affect unrelated future Production
objects. No sequence grants need changing: these two scripts create no sequences.

A harmless isolated PGlite fixture verified 18 privilege denials (six operations
for each of anon/authenticated/service_role), owner read/write access, and
no-policy RLS default denial. These checks validate PostgreSQL control semantics;
they do not verify actual Supabase grants, the entire app, or hosted API denial.

## Exact schema changes in the two existing migrations

The [manifest](preflight/migration-manifest.json) remains unchanged. SHA-256:

- 001: `e2aa042caac73f5c9bfcc6670e1d2ebaf02fd16663af32cb92865d54965ec8d5`
- 002: `03a8133818c74bc51882a2c91f1b57019ae5080ab11a4b61e233e59da28d26c7`

001 enables `vector` and creates `schema_migrations`, `users`, `workspaces`,
`sessions`, `auth_attempts`, `data_sources`, `memory_nodes`, `memory_versions`,
`memory_edges`, `embeddings`, `import_jobs`, `agent_runs`, `retrieval_citations`
and `audit_events` (14 tables including history).

002 creates `memory_chunks`, `embedding_cache`, `chunk_embeddings`,
`intelligence_jobs`, `intelligence_operations`, `analysis_parts`,
`memory_analyses` and `query_embeddings` (eight tables).

Six explicit indexes: `sessions_expiry`, `memories_search`,
`memories_workspace_date`, `memories_tags`, `chunks_search`, `chunks_source`.
Primary/unique constraints add their backing indexes; tables add composite/array
types. Columns, generated expressions, check/foreign-key constraints and defaults
are exactly those in the hashed SQL files. The vector extension adds its own
managed objects. No application sequence, view or schema is created.

002 adds the `versions_workspace_memory_version` unique constraint,
`retrieval_citations.chunk_id` plus its foreign key, and
`memory_edges.semantic_evidence`. It creates the `invalidate_memory_intelligence`
function and trigger and records its history row; 001 records its history row.
On later version updates, the trigger removes derived chunk mappings/candidate
semantic edges, supersedes jobs and marks retained semantic evidence stale.
No original-content backfill or rewrite is specified.

The security companion is additional scope, not already contained in 001/002.
If registered as a third migration it also adds its own migration-history row.
Its source and checksum must be included in the later approval request.

## Remaining checks using the connected account — no credentials requested

The [focused read-only query](preflight/security-prerequisites.sql) collects only
server/version/search-path metadata, extension eligibility, roles/memberships,
schema permissions and global/public/extension default ACLs. It uses a read-only
transaction and ROLLBACK. It does not repeat a data scan or run a migration.
Its expected project label is not SQL-derived proof of project identity.

Read the [project Data API settings](https://supabase.com/dashboard/project/pyidklztsnowarqumtki/integrations/data_api/settings)
and record Enable Data API, exposed schemas and Automatically expose new tables.
The latter settings may require dashboard/management access; a null SQL GUC is
not proof of disabled exposure. No Supabase keys or connection URL are requested.
A question about these settings is pending with the owner.

Before any later execution, confirm the existing recovery facility and available
recovery point without purchasing anything, and whether the currently deployed
Production runtime uses this same database. The saved Vercel binding is shared,
but an old deployment's environment snapshot may differ. Do not assume that
empty public means all auth/storage/project data is empty.

## Execution, recovery and Production boundary

Once the remaining metadata and security implementation are reviewed, freeze
its hashes, recheck target/project and public schema, and run one operator under
verified TLS. Use one transaction for the advisory lock `68182041`, both original
migrations, the reviewed security companion, assertions and all history rows.
Set bounded transaction-local lock/statement timeouts in that reviewed path;
the current runner does not supply them. No commit may precede security controls.

Before-commit errors roll back new extension/schema/history changes together.
An uncertain network/commit result requires read-only catalog/history inspection
before retrying. After commit there is no automatic down migration; retain all
new writes and prefer an approved forward repair. Dropping tables, DROP CASCADE,
resetting or restoring the shared database requires separate explicit approval.
A schema inventory is not a data backup, and backup/recovery has not been tested.

Main/Production remain unchanged. Last verified Production source is `6f19c18`,
whose startup can apply foundation migration automatically. Do not invoke it to
"test" the shared schema during this review. Even without a Production deployment,
shared-schema changes, the new trigger and ACLs can affect Production database
users. Coordinate any eventual write window and explicitly include those effects
in approval; never call this a Preview-only schema change.

**Approval verdict: not ready for execution as-is.** Target identity and public
emptiness are accepted; the remaining work is security metadata and an atomic
security implementation, not another DATABASE_URL request. An execution request
must name `echo / pyidklztsnowarqumtki / postgres / public`, the unchanged 001/002
hashes and the reviewed security companion/hash, and acknowledge shared-Production
implications. That final request is premature until the companion exists and
passes its checks. No execution approval is sought or implied in this report.

## Sources and evidence

Official sources retrieved over verified HTTPS on 2 November 2026:

- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [pgvector v0.8.2 README](https://github.com/pgvector/pgvector/blob/v0.8.2/README.md)
- [pgvector v0.8.2 control file](https://github.com/pgvector/pgvector/blob/v0.8.2/vector.control)

[Reconciled evidence](validation/security-preflight-2026-11-02.json) separates the
owner inspection, repository review, public documentation and local simulations.
