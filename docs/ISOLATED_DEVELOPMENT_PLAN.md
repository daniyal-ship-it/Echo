# Separate disposable development database — 11 November 2026

Recommendation: a separate Supabase project `echo-dev` on an existing Free-plan
organisation, preferably eu-west-1. This is a new independent project, not a
paid Supabase database branch. No resources or remote settings have changed.
Preserve current checkpoint 15470a6 and the hardened 001/002/003 migrations.

Owner-reported account inspection, 11 November: organisation
`daniyal-ship-it's Org` (`rttaltwkawyehzqregon`), Free subscription.
Existing projects are `echo` (`pyidklztsnowarqumtki`) and
`daniyal-ship-it's Project` (`splejgaknxvjpkblqnhz`), both reported INACTIVE.
Neither may be deleted, restored, modified or repurposed without separate approval.

Official billing policy rechecked on 11 November: paused projects do not count
against the two Free-project allowance. Two existing project records alone do
not establish that quota is exhausted. Confirm that the dashboard identifies
INACTIVE as paused and that there are fewer than two active Free projects across
ALL organisations where the owner is Owner/Administrator. This session has no
connected Supabase tool or browser tool, so account-wide quota and the actual
New Project eligibility screen have not been independently inspected.

Next read-only owner check: open New Project, select the named organisation,
confirm it permits an additional Free project and shows $0, but do not submit.
No credential is needed in chat. An available slot is not creation approval.

Official billing/pricing checked on 2 November: two active Free projects across
organisations where the user is Owner/Administrator; paused projects do not count.
All projects in an organisation use that organisation's plan. A new project in a
paid organisation is not a Free project. Do not pause, transfer or delete an
existing project to free quota, and do not upgrade or create a paid resource.
Free was $0/month with 500 MB database storage and inactivity pausing after one
week; automatic backups/PITR were not included. Recheck displayed terms at creation.
Sources: https://supabase.com/pricing and
https://supabase.com/docs/guides/platform/billing-on-supabase .

## Protected boundary

- Never modify pyidklztsnowarqumtki, its permissions, data, settings or credentials.
- Never change Production deployment, its DATABASE_URL binding or main.
- Retain the shared Production/Preview DATABASE_URL binding exactly as it is.
- Create a NEW override only for Preview / feat/core-memory-exploration.
- Existing immutable deployments retain old settings. Do not use their URLs for
  write tests; validate the new deployment and feature alias before any test write.
- Do not remove a branch override as an automatic rollback: that would fall back
  to the old shared database. Keep Preview isolated, even if the new DB fails.
- Only harmless disposable test records go into echo-dev. No personal archive.

## Shortest execution route and approvals

1. **Creation approval only:** confirm Free organisation name/ID and $0 quota,
   then create echo-dev in eu-west-1. Generate/store its credential securely in
   the existing account's secret workflow, never chat or Git. Record the new
   project reference and prove it differs from pyidklztsnowarqumtki. Stop at any
   paid-plan/add-on requirement. No existing project is changed.
2. **New-project preflight/configuration approval:** use its SQL Editor/connected
   account to inspect actual PostgreSQL/vector versions, role, creation schema,
   default ACLs and extension authority. Availability alone is not installation
   permission. Prefer disabling Data API and automatic exposure on this NEW
   ECHO-only project, since ECHO uses direct PostgreSQL. Keep RLS and migration
   003 as defence in depth regardless. No global change on the old project.
3. **Migration approval for the named NEW reference only:** prepare a reviewed
   SQL Editor bundle of the unchanged 001/002/003 files in one explicit transaction,
   with the existing advisory transaction lock, public-schema guard and 5s/60s
   lock/statement timeouts. Confirm the dashboard target/reference before execution.
   Do not run three independent scripts. SQL Editor/connected cloud execution
   avoids installing a local database, Docker, WSL or Supabase CLI.
   pgvector installation and the security assertions then execute on the disposable
   database. Failure must roll back; no permission weakening to get past failure.
4. **Preview configuration/deployment approval:** obtain the new project's shared
   transaction-pooler connection from its Connect panel (appropriate for serverless;
   existing driver uses prepare:false). Store the complete correctly encoded value
   directly as the branch-only DATABASE_URL override. Validate the new provider CA
   and update only the branch-scoped DATABASE_CA_CERT if necessary; retain strict
   TLS/hostname verification. Leave Production and shared bindings untouched.
   Redeploy only the feature Preview; verify source SHA, alias and new DB binding.
5. **Hosted acceptance approval:** run health/auth, verify migration history, all
   22 RLS tables, effective table/column/function privileges and intended backend
   access. Check API roles including inherited grants and BYPASSRLS service_role.
   Then use an isolated account for note creation/read/update and logout/login
   persistence, plus unauthenticated rejection. No AI calls are needed for this.
   Use only the newly attributed Preview, never a retained old deployment.

Each stage requires explicit approval before its remote mutations. A later owner
may approve a clearly bounded bundle of stages, but the current request approves
planning only. The user's earlier diagnostic approval does not authorise these.
No migrations or new-environment compatibility checks have run because echo-dev
does not yet exist. Existing 40 local passing tests are historical evidence, not
proof of a new hosted database. The actual create+security transaction and post-
migration checks on the new disposable target provide the hosted compatibility
validation; existing PostgreSQL 17/vector 0.8.2 source compatibility is documented.

## Prepared connection scope (no credential or target invented)

| Setting | Proposed scope/value source |
| --- | --- |
| DATABASE_URL | New sensitive binding, target preview, gitBranch feat/core-memory-exploration; new project's pooler URI from its Connect panel |
| DATABASE_CA_CERT | Same branch-only scope; official CA valid for new connection; reuse only after verification |
| APP_ORIGIN | Existing feature Preview origin retained |
| API keys/models | Existing bindings retained; no replacement requested |
| Diagnostic flags | Remain absent; any new temporary identity probe needs explicit scope/cleanup approval |

The actual connection cannot be populated before project creation. Do not place
passwords/connection URLs in a review document. The runtime must be attributed to
the new project using its known branch binding plus safe runtime diagnostics;
the database name postgres alone is not a unique project identifier.

## Recovery and cost boundaries

This route removes the old shared database's backup/dependency issues as blockers
for experimenting on the NEW disposable target; it does not resolve or dismiss
those risks on the old database. No claim is made that Free provides a recovery
point. Failed initial transactions roll back. Before importing anything valuable,
arrange an appropriate export/recovery plan. Recreating or deleting even the new
project requires separate approval, and never permits touching the old one.

Expected new Supabase subscription cost: $0 if the chosen organisation/slot is
Free and the creation summary agrees. No paid IPv4 add-on, dedicated pooler,
branching product, compute upgrade or PITR. Use the included shared pooler.
Vercel uses the existing plan/quotas; confirm any platform limit rather than buying
capacity. AI spending in this plan is $0; the existing $1 aggregate allowance is
unchanged and does not authorise calls before backend acceptance and pricing checks.

## Decision

GO for this isolation approach; NO-GO for executing changes until approval.
Immediate next owner input: confirmation of the New Project screen eligibility
for the supplied organisation, followed by explicit approval to create only
echo-dev at $0. No connection credential is
requested. Stop after creation/read-only identity reporting unless later stages
are also explicitly approved. If the Free slot is no longer available, stop;
do not disturb the existing project or silently choose a paid route.


If the screen rejects creation despite both projects being paused, record the
non-secret quota message and check account-wide active-project usage before
choosing another route. A second Free organisation does not evade this limit.
Do not infer that the unrelated inactive project is safe to reuse. If Supabase
cannot provide a Free slot, a separate hosted PostgreSQL provider with a Free
plan and pgvector is a possible zero-cost alternative, subject to verifying its
current limits, TLS, extension permissions and migration compatibility first.
This would still use only a new branch-specific Preview connection and preserve
both Supabase projects and Production. Provider selection/account creation would
require separate approval; no such alternative has been provisioned or tested.
