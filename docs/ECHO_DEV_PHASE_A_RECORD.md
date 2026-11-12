# echo-dev Phase A record — 11 November 2026

Scope: Supabase project `echo-dev` (`dtcxlxehqiuhmhuypqbm`) only. The original project
`pyidklztsnowarqumtki` was not queried or modified in this work.

## pgvector authority probe

- Result: passed. `postgres` installed `vector` 0.8.2, computed a vector distance, created a
  `vector(1536)` column and an HNSW index. The extension installed into schema `public`.
- Rollback: verified from a fresh session. No `vector` extension and no objects in `public`.
- **Equivalence, not identity.** The owner approved the SQL file
  `docs/preflight/echo-dev-vector-authority-probe.sql` (commit `301b583`). That commit was not on
  GitHub, so the file could not be read. The probe that ran was written separately to the same
  five-step scope: check the target, install in a transaction, validate, roll back, verify from a
  fresh session. It was a single `DO` block that ended by raising an exception, which forces the
  rollback. It was not the approved file.

## authenticator review

- Live shape: `authenticator` is `LOGIN NOINHERIT`, has no direct grants, and holds `SET`-only
  membership of `anon`, `authenticated` and `service_role`.
- Migration 003 now revokes from and verifies `authenticator` and every role it can reach by
  membership. Tests reproduce the live role shape.

## Data API settings

Owner dashboard inspection of echo-dev (`dtcxlxehqiuhmhuypqbm`), 11 November 2026:

| Setting | Value | Source |
|---|---|---|
| Data API | Enabled | Owner dashboard inspection; a `PostgREST 14.18` session is connected as `authenticator` |
| Exposed schemas | `graphql_public`, `public` | Owner dashboard inspection |
| Automatically expose new tables | ON at inspection, then switched OFF by the owner | Owner dashboard; change confirmed in the database afterwards |

### What switching the setting OFF changed

Confirmed by a read-only query after the change. Default privileges for objects created by
`postgres` in `public`:

| Object type | Before (ON) | After (OFF) |
|---|---|---|
| Tables | API roles: all rights | API roles: `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` remain; `SELECT`, `INSERT`, `UPDATE`, `DELETE` removed |
| Sequences | API roles: `SELECT`, `UPDATE`, `USAGE` | API roles: `UPDATE` remains |
| Functions | API roles: `EXECUTE` | No API-role or `PUBLIC` `EXECUTE` |

"API roles" are `anon`, `authenticated` and `service_role`. Default privileges for objects
created by `supabase_admin` are unchanged and still grant everything to the API roles.

### Interaction with migration 003

- Migration 003 does not change default privileges. It revokes and verifies privileges on each
  of the 22 ECHO tables and on the trigger function, in the transaction that creates them.
- The OFF setting alone is not sufficient: new tables still give the API roles `TRUNCATE`,
  `REFERENCES`, `TRIGGER` and `MAINTAIN`. Row level security does not restrict `TRUNCATE`.
  Migration 003 revokes and checks all four, so ECHO's tables end with no API-role privileges.
- The revokes are valid whether the setting is ON or OFF. The bundle was run locally against
  both privilege shapes and finished with zero API-role table privileges in each. The local
  engine was PostgreSQL 18.6, not hosted 17.11.
- ECHO's migrations create no sequences, so the residual sequence grant has no effect today.
- Any later migration that creates tables must repeat the 003 revoke-and-verify step,
  whatever the dashboard setting is.

### Accepted for echo-dev, to fix before Production

`vector` installs into `public`, which is an exposed schema, and its objects are created by
`supabase_admin`, whose default privileges still grant `EXECUTE` to the API roles. The
extension's distance functions are therefore callable through the Data API. They read no
ECHO data. The extension is relocatable, so `ALTER EXTENSION vector SET SCHEMA extensions`
moves it later without a rebuild.

## Migration bundle

`docs/preflight/echo-dev-bundle-001-003.sql` is the exact SQL proposed for execution: a guard,
migrations 001–003 unmodified from `db/migrations`, and a final verification, in one
transaction. The guard binds execution to echo-dev's cluster identifier
(`7703760980994770283`) and to an empty `public` schema, so it aborts unchanged anywhere else.
The final verification also checks `MAINTAIN`.

## Execution — 11 November 2026, 00:44 UTC

Executed once on echo-dev with explicit owner approval. The statements sent were those of the
bundle; only its header comment lines were omitted. The original project was not touched.

Fresh-session verification:

| Check | Result |
|---|---|
| Transaction committed | Yes |
| Tables | 22 of 22 expected, none unexpected, all owned by `postgres` |
| Row level security | Enabled on 22 of 22, no policies |
| API-role privileges (`anon`, `authenticated`, `service_role`, `authenticator`) | None on any table or column; no `PUBLIC` grants; no function `EXECUTE` |
| Trigger function | Security invoker, `search_path=pg_catalog, public`, trigger present |
| Explicit indexes | 6 of 6 |
| pgvector | 0.8.2 in `public`, three `vector` columns |
| Migration records | `001_foundation`, `002_memory_intelligence`, `003_server_only_access` |
| Data | No rows in `users` or `memory_nodes` |

Supabase security advisor afterwards: 22 informational "RLS enabled, no policy" notices,
which is the intended server-only design, and one warning that `vector` is in `public`,
already recorded above as a fix before Production.

## After execution — 11 November 2026

### Owner's independent read-only verification of echo-dev

- 22 application tables exist.
- Row level security is enabled on all 22.
- pgvector is installed.
- `anon`, `authenticated`, `service_role` and `authenticator` have no effective table privileges
  on the 22 application tables.

### Repository and Preview

- GitHub `feat/core-memory-exploration` is at `dcb6691`: the six commits through `723b469`,
  then the four Phase A commits. Migration 003 there has the same SHA-256 as the SQL executed
  on echo-dev (`a480f12b…`).
- Vercel built a Preview (not Production) from `dcb6691`. Its `DATABASE_URL` and
  `DATABASE_CA_CERT` are scoped to this branch; the shared Production/Preview `DATABASE_URL`
  entry was not edited.
- Preview runtime log, `GET /api/health` at 01:20 UTC: database connection ok with verified
  TLS, provider Supabase, custom CA in use, migrations 001–003 reported applied, `vector`
  visible in `public`.
- echo-dev at 01:23 UTC: no users, workspaces, sessions or memories. Three rate-limit rows
  from 01:21, one of them for registration. The owner confirmed these are Codex's live registration,
  login, logout and persistence checks followed by account cleanup. The rows fit that: one
  registration key, one key used twice (two logins) and one key used once (account
  deletion), with the user, workspace, sessions and audit events gone by cascade.

### Cross-workspace isolation

- Design: every authenticated route takes the workspace from the session row, never from the
  request, and every memory query filters on it.
- `scripts/isolation/` holds a 19-check HTTP test: user B attacks user A's note through list,
  filtered list, read, versioned read, overwrite, delete, link, keyword retrieval, graph,
  intelligence status, intelligence queue and export; A's note is then checked intact and
  both test notes are deleted. It never calls the assistant or a paid provider endpoint.
- Local result: 19 of 19 passed over HTTP against this commit's code with a local database
  (PostgreSQL 18.6 engine) and two registered users.
- Hosted result: passed on 12 November 2026; see "Hosted isolation test" below.

### Provider adapters

Not yet verified on the hosted Preview. Budget: US$1 combined.

### Hosted isolation test preparation

- `docs/preflight/echo-dev-isolation-user-b-create.sql` and `…-remove.sql` create and remove a
  temporary second account without opening registration. Both are bound to echo-dev's
  cluster identifier. Not executed on echo-dev.
- Local rehearsal with registration closed: second registration refused (403); user B created
  by the SQL and able to sign in; 19 of 19 isolation checks passed; after a simulated
  interrupted run the removal SQL deleted user B, its session and the leftover test note,
  and left user A and A's own note intact.
- The browser-console script refuses to run on any host other than the feature Preview.

## Hosted isolation test — 12 November 2026

Target: feature Preview at commit `dcb6691`, database echo-dev. Production, the original
project and Vercel configuration were not touched. No paid provider call was made.

| Time (UTC) | Event |
|---|---|
| 00:18 | Owner registered user A through the Preview. One user, one workspace on echo-dev. |
| 00:19 | Temporary user B created with `echo-dev-isolation-user-b-create.sql` (owner-approved). Registration stayed closed. |
| 00:37 | Owner ran `scripts/isolation/browser-console.js` on the Preview. Reported result: `ISOLATION PASS`. |
| 00:38 | User B removed with `echo-dev-isolation-user-b-remove.sql`. |

Database evidence, read before cleanup, consistent with a clean pass:

- Audit trail: A `memory.created`, B `memory.created`, B `workspace.exported`, A
  `memory.deleted`, B `memory.deleted`. No `edge.created`, no `memory.version_created`, and
  only one deletion per workspace, so none of B's write attempts against A's note took effect.
- No rows in `memory_edges`, `intelligence_jobs`, `agent_runs`, `embedding_cache` or
  `query_embeddings`.

The pass/fail table itself was observed by the owner in the browser; it was not captured here.

Fresh-session verification after cleanup:

- One user and one workspace remain: user A, same ids and creation time as before the test,
  password hash unchanged in format.
- User B, its workspace, sessions and audit events: none remain.
- Notes, versions and edges: none. No isolation-test notes.
- Sessions: none. The test signs out at the end, so user A must sign in again.
- User A's audit trail keeps the test's `memory.created` and `memory.deleted` events.

Residue and finding: one `data_sources` row remains in user A's workspace from the deleted test
note. It holds only the provider name `note` and a random id. The application's note deletion
does not remove this row, so every deleted note leaves one behind. Left in place; to be fixed
in the application.
