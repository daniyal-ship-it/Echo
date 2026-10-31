# Backend diagnosis and repair — 31 October 2026

Continue from preserved `e39cba6` on `feat/core-memory-exploration`.
The user now authorises safe diagnostics, an evidence-based repair and feature
Preview deployment. Main/production promotion, credential replacement, database
reset and plan changes remain outside scope. The aggregate AI budget is US$1;
no billable provider requests have been dispatched.

## Diagnostic patch

- A generated response correlation ID matches private structured error logs.
- Logs record initialization stage, a constrained error class/code/SQLSTATE and
  a fixed safe reason. Raw errors, SQL values, URLs, headers and secrets are omitted.
- A real `SELECT 1` precedes migration inspection. Read-only history/catalogue
  queries distinguish connection failure from initialization failure. Migration
  assets, known migration states, pgvector visibility and permission booleans are
  inspected only after successful connection.
- Managed startup no longer applies pending migrations. Preview/Production share
  the sensitive DATABASE_URL binding, with no branch override. No hosted schema
  write is authorised. Pending migrations fail closed until separate approval.
- Local isolated PGlite migrations retain their existing behaviour. The operator
  migration command requires explicit `--apply` for managed schema changes; that
  command is not permission to modify the shared database and has not been run.
- Public errors remain generic. No database-debugging endpoint was added.

Before deployment: 34 isolated core tests and production build/typecheck passed.
New checks cover safe logging, malformed/placeholder configuration, read-only
migration inspection and correlation IDs on generic health failures. Production
smoke and hosted diagnostic results will be recorded here after completion.

The previous hosted findings and screenshots are retained in
[HOSTED_VERIFICATION.md](HOSTED_VERIFICATION.md); they describe the pre-patch
deployment. The diagnostic patch is not yet evidence that the root cause is fixed.
