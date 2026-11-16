# Phase 4A migration 004: local review and release gate

Prepared 13 November 2026. **No hosted SQL has been executed.** The only authorized
hosted development target for a future separately approved change is echo-dev
(`dtcxlxehqiuhmhuypqbm`). Original project `pyidklztsnowarqumtki`, main, Production,
Vercel bindings and existing memories are outside this task.

## Exact proposed changes

`004_collaboration.sql` creates four ordinary tables in `public`:

| Table                   | Purpose                                                                                         | Integrity and access                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration_threads` | workspace-owned conversation identity                                                           | UUID PK; workspace FK cascade; workspace/id and workspace/idempotency unique                                                      |
| `collaboration_turns`   | questions, source/history snapshots, consent, immutable limits, model config, stages and leases | thread/workspace composite FK cascade; ordinal 1–100; unique thread/ordinal and thread/idempotency; status/mode/stage/JSON checks |
| `collaboration_calls`   | every provider attempt, raw and validated output, measured usage, errors/billing                | turn/workspace composite FK cascade; unique turn/stage/provider/attempt; attempt 1–8 and enum/JSON checks                         |
| `collaboration_steps`   | durable request idempotency                                                                     | turn/workspace composite FK cascade; turn/key PK; request hash                                                                    |

Two explicit indexes support workspace thread listing and call history. Primary
and unique constraints also create their PostgreSQL indexes. The migration adds
one `schema_migrations` row: `004_collaboration`. No sequence, function, trigger,
policy, role, extension, existing-table column or old migration is changed.
There are now 26 ECHO tables, including the migration ledger.

The existing runner executes pending DDL, constraints, ACL restrictions and history
in **one transaction**, with advisory lock and existing lock/statement timeouts.
No nontransactional index or operation is introduced. On managed startup the
application only inspects migration readiness; it does not apply migration 004.
A Phase 4 deployment against a database still at 003 will intentionally fail
readiness, so hosted migration approval is a prerequisite to release.

## Supabase Data API protection

The migration follows the existing object-scoped security patch:

- Enable RLS on each new table, with no browser-access policies.
- Require the expected migration/backend role to own each new table; unexpected
  policies/ownership fail closed.
- Revoke all table privileges and relevant column privileges from PUBLIC, anon,
  authenticated, service_role, authenticator, and every role authenticator can
  reach by membership/SET ROLE.
- Verify effective table privileges (including PostgreSQL 17 MAINTAIN) and column
  privileges. Inherited grants that remain cause an exception and full rollback.
- Do not revoke schema access or alter default privileges used by unrelated
  Supabase objects. Unsafe creation defaults are removed from these four objects
  before the transaction becomes visible. Future migrations must do the same.
- Introduce no executable function, so no new PUBLIC function execution exists.

RLS does not protect against the table owner, superusers or BYPASSRLS. ECHO's
privileged backend role retains access by ownership; application session and
workspace predicates remain the primary isolation boundary. Composite FKs prevent
cross-workspace references between the new tables. The migration cannot protect
against a future privileged administrator explicitly regranting access. Verify
Data API automatic exposure remains off and inspect effective grants again at
any future hosted preflight.

## Validation and recovery

Local tests use isolated PGlite and a disposable loopback PostgreSQL 17.10 /
pgvector 0.8.2 container, never a configured application database. This is not a
claim of an executed Supabase PostgreSQL 17.11 migration. SQL uses PostgreSQL 17
features already required by the existing patch; no extra extension authority is
needed for 004 on an already migrated target.

Checks cover hostile Supabase-style default grants, service_role BYPASSRLS,
authenticator membership, column grants, effective privileges across all 26
ECHO tables, owner operations, rerun preservation, inherited-access failure and
rollback. The 004 failure test starts with existing 001–003 data and verifies
that both data and history remain intact while all new tables disappear.
Real-driver tests also persist JSON call results, cross-provider stages and
follow-ups, exercise isolation/recovery, and close/reopen/re-run the migration
runner without losing call history.

After separate owner approval, the narrow execution procedure would be:

1. Attribute the connection to echo-dev and verify existing history 001–003,
   expected owner, no conflicting 004 objects, appropriate permissions, and
   unchanged production/original bindings. Do not infer identity from an alias.
2. Establish and verify a usable private recovery copy/restore procedure for
   echo-dev before applying anything. This task did not create or assert a hosted
   backup. Stop on target, permissions or recovery uncertainty.
3. Run the existing reviewed migration runner, pinned to the approved commit,
   with its one transaction. It skips recorded 001–003 and applies only 004.
4. In a fresh connection verify history, four tables, FKs, RLS, effective API-role
   privileges and intact pre-existing rows. Perform separately authorized isolated
   backend smoke checks before deploying/accepting the feature.

A known pre-commit failure rolls back all 004 changes. If the connection drops
around COMMIT, **do not guess, reset, or blindly replay SQL**: inspect history and
catalogue from a fresh connection. A committed marker and matching objects/ACLs
mean applied; no marker and no new objects mean rolled back; any inconsistent
state requires investigation. The runner's advisory lock and history check make
an already applied migration a no-op.

For application rollback, return to the previous application commit while keeping
the additive tables and their security intact. Older code accepts its required
001–003 history and does not use the new tables. Do not delete new conversation
history to roll back code. Any destructive schema reversal or private-data restore
requires a separate reviewed plan and approval; no DROP/reset is authorized.

**Assessment:** local security/compatibility validation is suitable for review.
Hosted execution/deployment remains **NO-GO pending separate approval, fresh target
and recovery checks**. No claim of hosted
migration or live-provider acceptance is made.

## Integration review — 14 November 2026

The combined Phase 4A + 4B validation is now complete locally; that former gate
is closed. See [integration evidence](validation/phase4-integration.json). Migration
004 is unchanged: SHA-256
`22c8e5343d3ac76ba16085df7c3c66bfa707e82f28966ee66f703dee012f1289`.
No hosted connection was opened. Separate execution approval and fresh echo-dev
target/ownership/ACL/readiness/recovery checks remain mandatory; no backup or
hosted acceptance is claimed. Local approval readiness does not authorize execution.
