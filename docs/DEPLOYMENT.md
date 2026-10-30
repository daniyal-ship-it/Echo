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

| Variable                 | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Private PostgreSQL connection string; use a database with pgvector                              |
| `APP_ORIGIN`             | Exact HTTPS application origin, with no trailing slash                                          |
| `ALLOW_REGISTRATION`     | Keep `false` after controlled initial account creation                                          |
| `ECHO_OPENAI_API_KEY`    | Optional OpenAI API credential                                                                  |
| `ECHO_OPENAI_MODEL`      | An actual model ID available to that API account                                                |
| `ECHO_ANTHROPIC_API_KEY` | Optional Anthropic API credential                                                               |
| `ECHO_ANTHROPIC_MODEL`   | An actual model ID available to that API account                                                |
| `ECHO_EMBEDDING_MODEL`   | Optional; defaults to `text-embedding-3-small`, 1,536 dimensions                                |
| `DAILY_TOKEN_LIMIT`      | Default 100,000; separate intelligence reservations and assistant usage guard, not a dollar cap |

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

## Feature preview and saved configuration

The existing project is [daniyal-1415s-projects/echo](https://vercel.com/daniyal-1415s-projects/echo),
linked to GitHub `daniyal-ship-it/Echo`; `main` remains its production branch.
Use the actual feature alias for this increment:

**https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app**

On 29–30 October the API verified a READY Preview for source commit `4b19901`,
deployment `dpl_Du2CEyRYkR7iNBdtz83SXvcURopf` (immutable host
`echo-ours6c9pb-daniyal-1415s-projects.vercel.app`). This applied the corrected
**Preview-only, branch-specific APP_ORIGIN**, exactly the feature alias above.
Global main-origin configuration was preserved. Subsequent feature pushes update
that alias; consult the delivery report / Vercel Source metadata for the latest SHA.
Use the alias for authenticated mutations: arbitrary immutable URLs are not the
configured application origin and should correctly fail origin checks.

Protection remains `all_except_custom_domains`; sign in to the owning Vercel team
when prompted. No protection bypass, public deployment or main merge is required.
The project uses its existing Fluid compute/basic build configuration; no plan or
paid service was added. API calls are bounded, but combined comparison requests
can still exceed runtime limits; verify the existing project's timeout in Vercel.
Durable intelligence steps can resume without repeating journalled success.

The Vercel metadata API verifies `DATABASE_URL`, `ECHO_OPENAI_API_KEY` and
`ECHO_ANTHROPIC_API_KEY` have sensitive **Preview and Production** bindings. Their
values were not printed, extracted or replaced. Preview and Production currently
share the DATABASE_URL binding, so Preview is not an isolated database. Migration
002 is additive and tested against a migration-001 fixture; managed execution is
still unverified. Do not put fixtures into the owner's workspace.

Preview model IDs are `gpt-6.1-sol` and `claude-sonnet-5-5`. The official SDK type
lists were inspected on 29 October 2026:

- [OpenAI model IDs](https://github.com/openai/openai-python/blob/main/src/openai/types/shared/chat_model.py)
- [Anthropic model IDs](https://github.com/anthropics/anthropic-sdk-python/blob/main/src/anthropic/types/model.py)
- [Embedding model IDs](https://github.com/openai/openai-python/blob/main/src/openai/types/embedding_model.py)

A listed model is not proof of this account's entitlement. Settings → **Check model
access** performs each provider's authenticated metadata lookup without memory
content. Indexing also verifies the embedding model. Real answer/embedding calls
must be checked separately. The app reuses the saved ECHO-prefixed keys.

The current Codex process has VERCEL_TOKEN, but **no OpenAI or Anthropic runtime
key**. That does not mean Vercel's keys are missing. No replacement keys are
requested. To run calls from Codex later, securely bind the existing secrets here,
or run the tiny test through the existing Vercel runtime. Do not paste keys into
chat, files or public client variables. Local DATABASE_URL/APP_ORIGIN templates
are not evidence of usable local configuration; tests override them.

## Hosted verification / dashboard fallback

After the environment was republished on 30 October, the feature-host network
check passed. `/api/auth/status` now returns 302 to Vercel SSO, then 307 to Vercel
login (200). This is deployment protection, not ECHO application authentication.
Existing VERCEL_TOKEN allows management API reads but does not establish a browser
session. No existing automation credential or authenticated test session was found.
Chromium navigation also fails certificate validation before rendering; normal
HTTP requests succeed. Keep these findings distinct from application defects.

The current [hosted handoff](HOSTED_VERIFICATION.md) records the verified `30a337e`
deployment, exact results, conditional cost estimate and missing approval. No
hosted fixture or billable provider call has been run. Do not create a project-wide
automation credential implicitly through `vercel curl`; obtain explicit authority
if an existing authorised browser session cannot be used.

1. Open the project dashboard → **Deployments**, filter to Preview and
   `feat/core-memory-exploration`. Confirm the Source SHA matches the delivered
   Git commit. If the push did not trigger a build, choose **Create Deployment**
   from that Git branch, or redeploy its latest Preview. Never promote to Production.
2. In Settings → Environment Variables, confirm the branch-specific Preview
   APP_ORIGIN equals the feature alias above. Keep the saved sensitive keys and
   database binding; do not enter them again. Keep deployment protection enabled.
   Configuration changes need a new Preview deployment.
3. Open the feature alias, pass Vercel team authentication and sign in to a
   **separate authorised test workspace**. Do not use a full archive or the owner's
   existing memories. If no isolated test account exists, arrange controlled account
   creation behind protection; do not enable unrestricted public signup.
4. In Settings check OpenAI and Anthropic model access independently. Record only
   status and returned model IDs. The check sends no memory and generates no answer.
5. Confirm a numeric test-spend ceiling and current pricing before any billable
   request. Then import a tiny supported export with a clearly labelled synthetic statement,
   for example “TEST FIXTURE: Store the access codes in a sealed envelope inside
   the desk.” Verify the original roles/timestamps/raw JSON. In Intelligence,
   consent to this original only, run summary/index, inspect progress and open
   each summary's exact original passage. Repeating enqueue should reuse the job.
6. Filter Source to the imported provider and check **Use these filters for
   questions**. Search “Where were the credentials secured?” using Hybrid, then
   OpenAI and Anthropic independently. Approve only that tiny context. Verify the
   answer is supported, the citation opens the matching version/message/passage,
   and the corresponding brain node is selected. Ask an unrelated question and
   verify an honest insufficient-evidence response; relevant-looking citations
   alone do not establish grounding.
7. Sign out/in and retrieve again. Close/reopen a processing panel to check saved
   progress. Delete only the fixture and its retained import archive when done;
   source deletion should remove its active index and derived analyses.
8. Record HTTP/app results, model IDs, source/deployment SHA, job completion and
   new-session persistence without secrets. Until these live checks pass, keep the
   core milestone marked incomplete even if Vercel reports READY.

The network policy now permits the feature host. Automated hosted checks still
need authorised deployment access and a separate ECHO test session, plus approved
spend. These are **not replacement API keys or disabled origin/protection checks**.

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
