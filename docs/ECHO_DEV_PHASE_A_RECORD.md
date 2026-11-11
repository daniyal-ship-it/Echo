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
