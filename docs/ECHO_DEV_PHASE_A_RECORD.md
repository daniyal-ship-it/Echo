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

| Setting | Status | Evidence |
|---|---|---|
| Data API enabled | Yes (database evidence) | A `PostgREST 14.18` session is connected as `authenticator` |
| Default exposure of new `public` tables | On (database evidence) | Default privileges grant all table rights to `anon`, `authenticated`, `service_role`; a probe table was selectable by `anon` |
| Exposed schemas | **Not yet recorded** | Dashboard-only; no override is stored in the database, which suggests the default set |
| Dashboard toggle "automatically expose new tables" | **Not yet recorded** | Dashboard-only |

Final security acceptance is open until the two dashboard values are recorded here.
Migration 003 removes API-role access to ECHO tables in the creating transaction, whatever
these settings are. Any later migration that adds tables must do the same.

## Migration bundle

`docs/preflight/echo-dev-bundle-001-003.sql` is the exact SQL proposed for execution: a guard,
migrations 001–003 unmodified from `db/migrations`, and a final verification, in one
transaction. The guard binds execution to echo-dev's cluster identifier
(`7703760980994770283`) and to an empty `public` schema, so it aborts unchanged anywhere else.
Not executed. Requires explicit owner approval.
