# Backend diagnosis and repair — 1 November 2026

Latest authorised implementation: [MIGRATION_SECURITY.md](MIGRATION_SECURITY.md).
003 is implemented and locally tested; hosted execution remains **NO-GO** pending
live preflight, including verified disabled automatic exposure. Earlier statements
below that the security companion is unimplemented are historical and superseded.


## Read-only migration preflight follow-up

The owner has now supplied a connected Supabase inspection: `echo`, project
`pyidklztsnowarqumtki`, eu-west-1, database/inspected role `postgres`; public has
no tables, views, sequences, functions or ECHO migration objects. Creation
permissions are available; vector 0.8.2 is available and not installed. This
supersedes the earlier access-only blocker. The evidence is owner-reported,
not an independent hosted query in this agent session. Do not request DATABASE_URL.

The existing migrations are **not ready for approval as-is**: they contain no
RLS or API-role privilege controls. Actual Data API settings/default grants remain
unverified. See [DATABASE_PREFLIGHT.md](DATABASE_PREFLIGHT.md) for the accepted
identity/emptiness findings, official compatibility/security sources, narrow
remaining read-only query, exact schema scope and proposed atomic security step.
That step is not yet implemented or registered in the existing migration runner.
No migrations, application changes, main or Production changes occurred.

## Current result after the owner's DATABASE_URL update

**PostgreSQL authentication now succeeds. SQLSTATE `28P01` is resolved. The
application remains blocked by `DB_MIGRATION_REQUIRED`, not by TLS or credentials.**

The saved DATABASE_URL update was newer than the running Preview. The same Git
source `c29257434aec44e9e9d9c95c6fb111ca594d75b0` was deployed with the current
environment; no application code or environment binding was changed in this run.

- READY Preview deployment: `dpl_7SnSSc4w7sYJGvGq67wCxMaxA2oW`.
- Feature URL: https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app
- Immutable URL: https://echo-r06nmlmxx-daniyal-1415s-projects.vercel.app
- The alias API confirms that the feature URL points to this deployment.

Both live HTTP requests at 02:25 UTC on 1 November successfully completed the
initial `SELECT 1`. Correlated private logs record `database_connection_ok`,
`storage: postgresql`, `verified_tls: true` and the configured custom CA.
Certificate and hostname verification remain enabled.

| Check | Actual result |
| --- | --- |
| PostgreSQL authentication / SELECT 1 | Passed on both requests; 28P01 resolved |
| `/api/health` | Failed, HTTP 500; request `900258d1-34a9-4965-882b-a7337ac33aa7` |
| `/api/auth/status` | Failed, HTTP 500; request `f4b7ab91-b97c-4a02-b5df-60ff13179211` |
| Current error | `DB_MIGRATION_REQUIRED`, stage `migration.history` |
| Deployed migration assets | Both SQL files present |
| Migration history | `001_foundation` and `002_memory_intelligence` both `applied: false` |
| pgvector | Available, but not installed, visible or in the search path |
| Permissions | Database CREATE and current-schema USAGE/CREATE are true |
| Shared schema changes | None; diagnostics report `writes_authorised: false` |
| Login, notes, persistence, AI acceptance | Blocked by schema readiness; not attempted |

This is live HTTP and runtime-log evidence, not a browser test. The migration
ledger check does not distinguish a missing history table from an existing table
without these versions, and no full relation inventory was performed. Do not
infer that the database is empty or that an eventual migration is guaranteed to
succeed. Local tests were not rerun because application code is unchanged.

### Pending migration scope and next action

Separate approval is required before modifying this shared database. Before
execution, inspect existing relation/constraint/function names read-only for
conflicts with the scripts; most CREATE statements are not conditional.

- `001_foundation.sql`: enables `vector`; creates `schema_migrations` and 13
  application tables (`users`, `workspaces`, `sessions`, `auth_attempts`,
  `data_sources`, `memory_nodes`, `memory_versions`, `memory_edges`, `embeddings`,
  `import_jobs`, `agent_runs`, `retrieval_citations`, `audit_events`), their indexes,
  keys and constraints, then records migration 001.
- `002_memory_intelligence.sql`: creates eight tables (`memory_chunks`,
  `embedding_cache`, `chunk_embeddings`, `intelligence_jobs`,
  `intelligence_operations`, `analysis_parts`, `memory_analyses`,
  `query_embeddings`); adds a unique constraint to `memory_versions`,
  `retrieval_citations.chunk_id` and its foreign key, `memory_edges.semantic_evidence`,
  indexes, and the `invalidate_memory_intelligence` function/trigger; records
  migration 002. The trigger invalidates derived data on later source-version
  changes. The migration does not intentionally rewrite original content.

The existing operator command is `npm run db:migrate -- --apply`; it was **not
run** and must not be run against the shared database without separate approval.
After an authorised migration, rerun both endpoints before account/note checks.
No replacement password or API key is required by the current evidence.

### Configuration scope and cleanup

Contrary to the reported branch scope, Vercel's API shows DATABASE_URL as a single
sensitive binding targeting **Production and Preview**, with `gitBranch: null`.
It was updated at 02:21:38 UTC on 1 November; no feature-branch override exists.
This metadata does not prove the identity of the underlying database. The shared
binding was left untouched, and only the feature Preview was deployed. If
branch-only configuration is intended, correct the scope separately in Vercel;
do not silently alter the Production binding.

DATABASE_CA_CERT remains branch-only Preview with unchanged metadata. All API-key
bindings and deployment protection are unchanged. Existing short-lived OIDC
access worked; no automation-bypass credential was created (zero before/after).
The local OIDC file was removed. The token was not individually revoked and
expires at 14:25:18 UTC on 1 November. No account, note or archive was created.
No AI request was sent: US$0 spent; the total US$1 allowance remains intact.

Evidence: [password-verification-2026-11-01.json](validation/password-verification-2026-11-01.json).
The earlier certificate and password-failure evidence below is historical.

## Certificate installation after environment publication (historical)

**The Supabase certificate-trust failure is resolved. The backend is still not
ready: PostgreSQL rejects the preserved DATABASE_URL credentials with SQLSTATE
`28P01`.** This supersedes the certificate-download blocker described in the
historical sections below. No application code was changed during this follow-up.

The official certificate download now returns HTTP 200 with HTTPS verification
enabled and no redirect. Its URL matches Supabase's official dashboard source.
The certificate is Supabase Root 2021 CA, has CA status and a verified self-signature,
and is valid from 28 April 2021 to 26 April 2031. SHA-256 certificate fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The complete 1,367-byte PEM was saved as encrypted `DATABASE_CA_CERT`, scoped only
to **Preview / feat/core-memory-exploration** in the existing echo project.
Every other environment binding's ID, scope, type and timestamps were unchanged.
DATABASE_URL and all API keys were preserved. Certificate and hostname validation
remain enabled; deployment protection remains `all_except_custom_domains`.

The existing Git source `c29257434aec44e9e9d9c95c6fb111ca594d75b0` was redeployed
with the new branch environment. No application code changed. Vercel completed
its normal deployment build and reports READY:

- Deployment: `dpl_6j79FX6b5mHEFQB2CUx6ngqzxvHP` (Preview, not Production).
- Feature URL: https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app
- Immutable URL: https://echo-eyix1jhs5-daniyal-1415s-projects.vercel.app

The first read-only health request returned HTTP 500 with correlation ID
`c3e146b2-d5aa-4c00-9871-7ee5d9c590a8`. Its private runtime logs show the CA is
configured and the connection now proceeds past TLS to PostgreSQL authentication:

```json
{
  "stage": "connection.check",
  "error_class": "PostgresError",
  "code": "28P01",
  "sqlstate": "28P01",
  "reason": "Database authentication rejected the supplied credentials"
}
```

| Check                                                               | Actual result                                                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Official certificate provenance, CA status, validity and signature  | Passed                                                                |
| Complete PEM and branch-only Preview binding                        | Passed                                                                |
| Existing commit redeployed / source and alias verified              | Passed, c292574                                                       |
| Database certificate and hostname validation                        | Passed; PostgreSQL authentication was reached with strict TLS enabled |
| Database authentication / SELECT 1                                  | Failed, 28P01; query did not succeed                                  |
| Application health                                                  | Failed, HTTP 500 with correlated private error                        |
| Migration history, SQL assets, pgvector and permissions             | Blocked; inspection was not reached                                   |
| ECHO authentication / isolated note create, retrieve and update     | Blocked; no account or note created                                   |
| Logout/login persistence / unauthenticated private-memory rejection | Blocked; no new hosted browser acceptance claimed                     |
| AI acceptance                                                       | Not run; US$0 spent, full aggregate US$1 allowance remains            |

Evidence: [certificate-verification-2026-10-31.json](validation/certificate-verification-2026-10-31.json).
This was live hosted HTTP and private-log verification, not a mocked test. Existing
local test/build results were not rerun because there was no application code change.
No successful SQL query, pending migration or schema state is inferred from TLS
success alone. No shared schema or original data was modified.

### Next prerequisite: check the existing database connection details securely

The next operation requires a valid DATABASE_URL. Compare its saved connection
details against the existing Supabase project's **Connect** dialog, including the
selected connection method, database username and password encoding. The current
evidence identifies rejected credentials, not which particular field is wrong.
Review the value only in [Vercel environment settings](https://vercel.com/daniyal-1415s-projects/echo/settings/environment-variables);
do not paste it or any password into chat. No replacement AI keys are needed.

The user explicitly required preserving DATABASE_URL, so it was not corrected,
rotated, replaced or reset. It remains shared between Preview and Production.
Any subsequent correction needs authorisation for that configuration change;
prefer a feature-Preview override if the owner wants Production left untouched.
After credentials are accepted, rerun SELECT 1, then inspect schema state read-only.
Only if migrations are actually missing should their exact scope be proposed for
separate approval. No schema-change approval exists in this task.

Temporary local OIDC material was removed. No automation-bypass credential was
created; the final project recheck reports zero. The short-lived OIDC token was
not individually revoked and expires at 09:03:27 UTC on 1 November 2026. There are
no test accounts, notes or archives to delete. The certificate binding remains
intentionally installed for the feature Preview.

## Earlier diagnosis and certificate-access blocker (historical)

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

The diagnostic commits `698a839` and `9be7e46` were pushed and deployed to the
existing feature alias. All earlier commits, including `e39cba6`, remain ancestors.
The diagnostic patch passed 34 isolated core tests, typecheck/build and all four
standalone smoke groups before deployment. These are local checks, not proof of
managed database health.

## Confirmed failure

Deployment `dpl_B8YBihgaAhaQP3ozKgBDZXwkH9Cq` at `9be7e46` returned HTTP 500 for
health, auth status and unauthenticated memories. The health correlation ID
`a6eba938-b564-42ae-a53c-578f98358c72` matches private runtime diagnostics:

```json
{
  "stage": "connection.check",
  "error_class": "Error",
  "code": "SELF_SIGNED_CERT_IN_CHAIN",
  "sqlstate": null,
  "reason": "Database TLS chain contains an untrusted self-signed certificate"
}
```

Runtime-only inspection classified the configured hostname as Supabase without
logging it or the URL. Node had 118 default CAs, zero system CAs and no configured
extra CA or system CA file. Adding the system trust store would therefore not
resolve this deployment. No connection query succeeded; no migration inspection
or schema write was reached. Database authentication, migration history, deployed
SQL file presence, pgvector and database permissions remain unverified. TLS occurs
before PostgreSQL authentication, so this is not evidence of a bad password.

The Preview and Production DATABASE_URL binding is shared, with no feature-branch
override. Existing keys remain in Vercel. Metadata reinspection found no saved
DATABASE_CA_CERT, SUPABASE_CA_CERT, PGSSLROOTCERT or NODE_EXTRA_CA_CERTS binding.
No credential correction or replacement is currently justified.

## Targeted trust-chain correction

`lib/database-tls.ts` supports a server-side `DATABASE_CA_CERT` PEM bundle. It
validates that the supplied material contains only public CA certificates, adds
them to the existing Node default roots for this PostgreSQL client, and explicitly
sets `rejectUnauthorized: true`. Hostname verification remains Node's default.
No global TLS policy, connection-pool settings or `prepare: false` setting changed.
No CA fetched from an unverified mirror or live peer is automatically trusted.

The regression tests use a disposable local TLS server and generated test CA.
They verify a successful authorised handshake, rejection without the CA, rejection
of a wrong hostname, and safe rejection of malformed configuration. All 36 isolated
tests and TypeScript checks pass. The generated private test key was removed and
is not a committed artifact. This proves the configuration path, not hosted repair.

Supabase's official documentation requires its server root certificate for
`verify-full`. Its official dashboard source identifies the production download:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Sources inspected over verified HTTPS:

- [Connection documentation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/connecting-to-postgres.mdx)
- [SSL enforcement documentation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/ssl-enforcement.mdx)
- [Dashboard certificate URL configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json)

The cloud proxy denies the official S3 certificate hostname (tunnel 403), including
after an approved sandbox escalation. This is a network-policy denial, not an
automatic approval-review rejection. No certificate was downloaded or configured.
Official repositories inspected contained test certificates, not an authoritative
copy of the production CA; those test certificates were not used.

The cloud onboarding draft now preserves existing hosts and adds the exact
certificate/docs/pricing hosts. Saving the draft does not apply it; it requires
review/save and publication through environment settings. The official certificate
download and hosted repair must be rechecked after publication. No new API key is
needed. Alternatively, the owner can obtain the public CA from Supabase Dashboard
→ Database → Settings → SSL configuration and configure `DATABASE_CA_CERT` in
[Vercel environment settings](https://vercel.com/daniyal-1415s-projects/echo/settings/environment-variables),
scoped to Preview and this feature branch. Do not paste credentials into chat.

## Safe continuation

The tested application checkpoint is **`a7c2db1`**, deployed READY as
`dpl_5int1HxthEEEEsYvUXTBNCB7eH7q` on the existing feature alias:

https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

At 20:41 UTC, after that deployment, health, auth status and unauthenticated
memories still returned HTTP 500. Health request
`d1b07147-a6d9-40a2-a6ab-412391837ff6` matches the same private TLS error and
`custom_database_ca_configured: false`. This is a confirmed unresolved
configuration prerequisite, not a successful hosted fix. Read the
[sanitised evidence](validation/backend-repair-2026-10-31.json).

| Hosted requirement                                              | Before diagnostic patch                     | After CA-support deployment                                           |
| --------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Health / real PostgreSQL query                                  | Failed, HTTP 500 without usable diagnostics | Failed, HTTP 500; TLS trust failure identified before query success   |
| Authentication status                                           | Failed, HTTP 500                            | Failed, HTTP 500; same correlated TLS cause                           |
| Authorised isolated account login                               | Blocked                                     | Blocked, not attempted                                                |
| Harmless note create/read/update                                | Blocked                                     | Blocked, no test records created                                      |
| Logout/login in a new browser session                           | Blocked                                     | Blocked, no hosted browser persistence run                            |
| Unauthenticated private-memory access rejection                 | Unverified                                  | HTTP 500 reveals no data, but expected HTTP 401 could not be verified |
| Import/original/summary/semantic retrieval/GPT/Claude/citations | Blocked                                     | Blocked; no billable requests                                         |

The final local build and all four production smoke groups also passed after the
TLS change. They use isolated PGlite and do not establish hosted PostgreSQL health.
No new browser acceptance is claimed for this repair. The prior visual screenshots
remain historical evidence. Earlier expired OIDC material and the fresh test
token file were removed. The fresh short-lived token expires at 08:41:45 UTC on
1 November; file deletion is not individual server-side revocation. No automation
credential was created, so none required revocation. Protection remains enabled.
No test accounts, records or retained archives need deletion. No credentials were
replaced, no shared schema was modified, and API spending remains US$0.

1. After network publication, retrieve the certificate from the verified official
   source; inspect its CA constraints, issuer, validity and fingerprint. Configure
   only the feature Preview's DATABASE_CA_CERT using existing authorised Vercel
   access, without changing DATABASE_URL or AI credentials. Deploy the existing
   feature branch and correlate a new health request with its private logs.
2. Only after SELECT 1 succeeds, inspect known migration state/files, pgvector and
   permission booleans from the read-only initialization checks. If a migration is
   pending, prepare its exact scope and obtain separate approval before modifying
   the shared schema. No schema approval has been given in this task.
3. Verify health/auth 200, an authorised isolated account, harmless note
   create/read/update, new-browser-session logout/login persistence and rejection
   of unauthenticated memory access. Preserve registration and ownership checks.
4. Only then verify current model access and official pricing, and continue the
   memory acceptance journey within the unchanged US$1 total budget. No billable
   request has been dispatched; the full allowance remains unspent.

The previous hosted findings and screenshots are retained in
[HOSTED_VERIFICATION.md](HOSTED_VERIFICATION.md); they describe the pre-patch
deployment. The diagnostic patch is not yet evidence that the root cause is fixed.
