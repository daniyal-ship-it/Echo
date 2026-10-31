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
