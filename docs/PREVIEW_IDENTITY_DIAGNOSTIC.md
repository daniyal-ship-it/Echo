# Temporary Preview identity diagnostic — prepared, not deployed

Current accepted Vercel evidence: team access works; project echo; Production
6f19c18 READY; feature Preview c292574 READY; DATABASE_URL targets both environments;
DATABASE_CA_CERT is feature-branch Preview only. Treat the database as shared until
actual deployment-attributed runtime evidence proves otherwise. No credentials
were decrypted, displayed or requested. No environment/deployment was changed.

## Smallest procedure (requires separate explicit approval)

1. Review this patch and approve only a feature-Preview diagnostic deployment,
   its temporary non-secret flags, one protected health request, private-log
   inspection and subsequent cleanup. No push or deployment occurred in this task.
2. Verify the existing echo project, exact feature branch and enabled deployment
   protection. Keep DATABASE_URL, DATABASE_CA_CERT, API keys and Production intact.
   Enable ECHO_DB_IDENTITY_DIAGNOSTIC=1 and ECHO_DB_IDENTITY_UNTIL=<UTC ISO expiry>
   only on Preview / feat/core-memory-exploration. Choose an expiry covering build
   and inspection; the hook operates only in the 15-minute window before expiry.
   These flags contain no secrets. Capture the approved source SHA and deployment
   ID and verify the feature alias points to that deployment before requesting it.
3. Using existing authorised Vercel OIDC access, GET exactly:
   https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app/api/health
   Send identity only through the existing secure header to that origin; disable
   redirects. Do not send tokens in URLs, print headers or disable protection.
4. Read the private database_runtime_identity event for that deployment and
   X-Echo-Request-Id. It contains database, effective_role, session_role, search_path,
   resolved_search_path and read_only=true, plus deployment URL/ID and Git source.
   If deployment ID is absent from the system environment, use the private log's
   platform deployment ID and verify URL/SHA against management metadata.
   HTTP 500/DB_MIGRATION_REQUIRED is expected until migrations are authorised;
   it does not negate a separately successful identity event. Do not repeat
   failing probes indefinitely or interpret an absent event as verified identity.
5. Remove both temporary branch flags after collecting evidence and redeploy the
   disabled configuration only within the approved cleanup scope. Existing built
   deployments retain their environment snapshot, so removing flags alone does
   not deactivate them: the expiry independently closes the short window. Confirm
   expiry/disabled state, remove temporary local OIDC material, and remove this
   temporary hook in a later reviewed cleanup commit. No persistent bypass is
   required. Never claim that deleting an OIDC file revokes its server-side token.

## Controls and limits

The hook defaults off, rejects Production/development and other branches, requires
both flags and a valid bounded expiry, and is skipped by the explicit migration
operator. It uses the application's actual PostgreSQL client/pool with unchanged
verified TLS and hostname validation. A fresh transaction is READ ONLY before
any inspection query; statement/lock timeouts are 3/1 seconds. SELECT reads only
session/catalog metadata. Transaction-local settings disappear afterwards.
No application tables, data, URLs, passwords, provider keys, cookies or arbitrary
query parameters are read or logged. There is no new endpoint, public response
payload or client-facing debug state. Failure logs only an unavailable event;
raw driver errors are not included by this hook.

It logs once per database initialization while enabled, not once globally.
Because pending migration startup resets the initialization promise, multiple
requests can produce multiple events. Use one controlled request; do not claim
rate limiting or a single-use credential. Only Vercel operators with private-log
access should collect the metadata. This diagnostic writes observability logs,
but no database data or schema. No diagnostic/protection setting is enabled now.

The new diagnostic deployment loads the saved environment at build time; its
result proves that deployment's runtime identity, not historical c292574's
environment snapshot. It also does not identify Production consumers, grant
extension installation rights, prove project identity merely from database name
postgres, or prove that a backup exists. Correlate the runtime result with the
known project/branch binding and separate dependency/management evidence.
Production 6f19c18 must not be probed for this purpose: its startup can auto-migrate.

## Remaining GO/NO-GO gates

Migration remains NO-GO until the approved diagnostic establishes the intended
backend identity/path, extension-authority.sql establishes migration-role vector
installation eligibility/schema behaviour, active database consumers and shared
Production impact are attributed, and an existing usable recovery point plus
restore procedure are verified through the connected Supabase account. Accepted
schema/membership/default-grant/automatic-exposure findings need not be repeated
without drift. Existing migration hashes and the 74f3dc8 security patch remain
unchanged; this patch only adds a dormant diagnostic hook.

Local validation: 40 tests pass, including default-off, Production/branch/expiry
rejection and an actual isolated PGlite read-only query with session settings
preserved. TypeScript checks pass after correcting the test-input type. No hosted
query, deployment, migration, visual/browser test or billable provider call occurred.
