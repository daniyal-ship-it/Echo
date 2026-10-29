# Runtime and deployment

## Local development

Run `bash scripts/setup.sh`, then `bash scripts/start.sh` in the checkout.
`GET /api/health` must return `{"ok":true,...}` and account creation should work.
Use the existing checkout; cloud tasks are already isolated. Do not create a
worktree unless requested.

Dependencies and `.data/postgres` survive a filesystem snapshot. Running servers,
connections and API authentication must be re-established in a new environment.
Do not run `db:migrate`, another app instance or another worker against the same
PGlite data directory while its application process is running.

## Managed PostgreSQL

Set these in the hosting platform's secure configuration, never in a committed file:

| Variable                 | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `DATABASE_URL`           | Private PostgreSQL connection string; use a database with pgvector |
| `APP_ORIGIN`             | Exact HTTPS application origin, with no trailing slash             |
| `ALLOW_REGISTRATION`     | Keep `false` after controlled initial account creation             |
| `ECHO_OPENAI_API_KEY`    | Optional OpenAI API credential                                     |
| `ECHO_OPENAI_MODEL`      | An actual model ID available to that API account                   |
| `ECHO_ANTHROPIC_API_KEY` | Optional Anthropic API credential                                  |
| `ECHO_ANTHROPIC_MODEL`   | An actual model ID available to that API account                   |
| `DAILY_TOKEN_LIMIT`      | Reported-usage guard, default 100,000; see security limitations    |

Conventional `OPENAI_API_KEY` / `OPENAI_MODEL` and `ANTHROPIC_API_KEY` /
`ANTHROPIC_MODEL` aliases also work. In Codex cloud configuration, the `OPENAI_`
prefix is reserved for proxy secret targets, so use the supported `ECHO_` names.
Proxy-backed credentials must target `api.openai.com` or `api.anthropic.com`.
Never copy proxy placeholders into credential files or assume they are raw tokens.
Database connection credentials need a normal secure runtime binding; an HTTPS
proxy secret is not a PostgreSQL TCP authentication mechanism.

TLS certificate verification is enabled. `DATABASE_SSL=disable` is accepted only
for a deliberately local development PostgreSQL connection, and rejected in
production. Do not disable TLS verification to work around an untrusted certificate.

On a fresh database, grant the migration account permission to create the `vector`
extension (or have the operator install it first). The server applies the SQL
migration transactionally, with an advisory lock on managed PostgreSQL. The remote
database path is implemented but has not been live-validated in this environment.

## Hosting artifact

`npm run build` produces a Next.js standalone server. The Dockerfile uses Node 24,
copies the standalone runtime, assets, static chunks and migrations, and runs as
a non-root account. Build/run instructions:

```sh
docker build -t echo-brain .
# Supply configuration securely through the hosting platform or a protected env file.
docker run --rm --env-file /secure/location/echo.env -p 3000:3000 echo-brain
```

Use a managed PostgreSQL connection for Vercel or any other ephemeral/multi-instance
host. Never rely on a PGlite directory in a serverless filesystem. For an explicitly
single-server evaluation only, `ECHO_ALLOW_LOCAL_DB=1` permits production-mode
PGlite with a durable `ECHO_DATA_DIR` volume and one process. Production still
requires `APP_ORIGIN`.

The existing Vercel project is `daniyal-1415s-projects/echo`, linked to
`daniyal-ship-it/Echo`. The foundation preview at
https://echo-git-main-daniyal-1415s-projects.vercel.app was reported READY for
commit `6f19c18`; the user subsequently confirmed it launches. This is historical
deployment evidence, not verification that later feature commits are hosted there.
No production promotion is part of the exploration increment.

Previous Vercel metadata checks found `DATABASE_URL`, `ECHO_OPENAI_API_KEY` and
`ECHO_ANTHROPIC_API_KEY` in Preview and Production. Provider keys are absent from
the current Codex process. Their absence here is not a reason to replace the saved
Vercel keys: use that runtime or securely bind the existing secrets to this one.
The API model names previously configured for Preview are `gpt-6.1-sol` and
`claude-sonnet-5-5`; live account access still needs a bounded real request for
each provider. Never infer API availability from a Codex model label.

Preview and Production must be checked separately. A new feature-branch preview
needs its own exact application `APP_ORIGIN` (not a Vercel dashboard URL), because
mutations enforce same-origin checks. Keep existing provider/database secrets;
do not copy their values into documentation. Codex runtime templates for database
and origin are not proof of usable production configuration. Hosted smoke checks
were previously blocked by the network proxy, so remote database health and
cross-device persistence remain unverified here. Long-running comparisons and
future media jobs also need execution limits that fit the existing hosting plan.

## Backup and recovery

For development, stop the app and archive the complete `.data/postgres` directory
to a protected location. A file copy while PGlite is running is not a verified
backup. Restore to a separate directory, start a single instance with that
`ECHO_DATA_DIR`, sign in and verify original records before replacing a live copy.

For managed PostgreSQL, enable encrypted backups and point-in-time recovery.
Exercise a restore to an isolated database. Check row counts, archive hashes,
versions, session policy and workspace isolation before changing the application
connection. User JSON exports preserve content but are not a complete operational
database backup or a currently supported one-click restore format.

## Network

Installation uses npm registries already covered by the cloud package-manager
preset. Pinned anatomical redownloads use `raw.githubusercontent.com`. Provider
runtime access additionally needs `api.openai.com` and `api.anthropic.com`.
No external connector is connected, and no production emails, events or reminders
have been created during tests.
