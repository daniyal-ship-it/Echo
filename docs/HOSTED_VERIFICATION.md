# Hosted verification snapshot — 31 October 2026

**Current continuation:** [BACKEND_REPAIR.md](BACKEND_REPAIR.md) records the later
authorised diagnostic deployments, confirmed Supabase TLS trust failure and
DATABASE_CA_CERT support. The results below preserve the earlier verification run;
they do not describe the current deployed source or the current repair scope.

The protected feature Preview is reachable through authorised Vercel OIDC access,
and its brain renders in Chromium. **The hosted acceptance journey is incomplete:**
ECHO's health and authentication endpoints return HTTP 500. Official pricing is
independently blocked by the network proxy. No billable requests, fixture imports
or account creation were attempted.

Preview: https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

Fetched feature HEAD and deployed source are both
`ae08e7f40e4b6670342776eb3c8fe17bc46b1cfe`, a documentation-only descendant of
implementation `30a337e04f1939af06d2f2392d8281c5e7ecdf25`.
Deployment `dpl_3rRpR64FCj6VJDdumkRWP2hhjYHZ` is READY and owns the exact alias.
`main` remains `6f19c18bab3656e90de77f168cda88fe409f126a`. No application source,
credentials, signup policy, deployment, hosting plan or personal archive changed.
This follow-up is saved as a local documentation checkpoint. Pushing is deferred
to preserve the existing deployment, because it can trigger Vercel's Git build.

## Actual checks

| Check                                              | Result                     | Evidence                                                                                                                                        |
| -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository, branch and checkpoint ancestry         | Passed                     | Fetch from daniyal-ship-it/Echo; feature SHA ae08e7f; 30a337e is an ancestor; main unchanged                                                    |
| Exact-host network access                          | Passed, HTTP and browser   | Unauthenticated request reaches Vercel 302 → SSO 307 → login 200; no proxy denial for this hostname                                             |
| Existing Vercel authentication / deployed commit   | Passed, management API     | Existing VERCEL_TOKEN reads the intended project, GitHub link, READY deployment, alias and source SHA                                           |
| Protected Preview access using OIDC                | Passed, HTTP and browser   | Official SDK token workflow issues a development identity; same-project Trusted Sources accepts it; ECHO page returns 200                       |
| Chromium certificate trust                         | Passed, browser            | Narrow write access to existing NSS database fixes initialization; direct Chromium navigation succeeds with normal TLS checks                   |
| Brain, colours, views, rotation and zoom           | Passed, browser            | Hosted page rendered in system Chromium through Playwright; front, side, three-quarter, rotation and zoom screenshots inspected; no page errors |
| Branch origin and saved credential bindings        | Passed, metadata only      | Branch Preview APP_ORIGIN matches; DATABASE_URL and both ECHO provider keys have sensitive Preview bindings                                     |
| Configured model identifiers                       | Passed, configuration only | Preview variables gpt-6.1-sol and claude-sonnet-5-5; code default embedding text-embedding-3-small, 1,536 dimensions                            |
| Hosted database/application health                 | Failed, HTTP               | /api/health returns 500 with ECHO's generic error; runtime logs show api_error, type Error                                                      |
| ECHO authentication status                         | Failed, HTTP and browser   | /api/auth/status returns 500; browser renders login UI and the error notification                                                               |
| Isolated test account/workspace                    | Blocked                    | Authentication prerequisite fails; no registration or login mutation attempted                                                                  |
| Tiny import                                        | Blocked                    | No hosted fixture created                                                                                                                       |
| Preserved original roles, text and export          | Blocked                    | No imported original to inspect                                                                                                                 |
| Generated summary                                  | Blocked                    | Runtime and pricing prerequisites unavailable; no generation dispatched                                                                         |
| Semantic index and paraphrased retrieval           | Blocked                    | No source or question embedding dispatched                                                                                                      |
| Separate source-grounded GPT response              | Blocked                    | No OpenAI answer dispatched                                                                                                                     |
| Separate source-grounded Claude response           | Blocked                    | No Anthropic answer dispatched                                                                                                                  |
| Citations / exact passage / memory-node selection  | Blocked                    | No authenticated hosted memory or live answer exists for this run                                                                               |
| Persistence after logout/login                     | Blocked                    | No test session established                                                                                                                     |
| Actual provider account/model availability         | Blocked                    | ECHO's authenticated metadata route is unavailable behind the runtime failure; bindings and catalogues do not establish entitlement             |
| Current official pricing and maximum request cost  | Blocked                    | Official pricing requests receive proxy tunnel 403; no reliable model-specific rates obtained                                                   |
| Spending authorisation and accounting              | Passed                     | User authorised US$1 total across providers and retries; zero billable requests dispatched; run cost US$0, full US$1 unspent                    |
| Temporary access cleanup / protection preservation | Passed                     | Local OIDC file removed; management recheck confirms zero persistent bypass credentials and unchanged protection                                |

Evidence: [machine-readable results](validation/authorised-hosted-verification-2026-10-31.json).
The [30 October snapshot](validation/hosted-verification-2026-10-30.json) is retained
as earlier evidence; its missing-budget and inaccessible-browser findings are
superseded. The previous 30 core tests, six browser journeys and production
smoke/build checks remain **historical local evidence with labelled provider
mocks**. They were not rerun or counted as live hosted acceptance.

## Browser evidence and certificate correction

- [Front](screenshots/hosted-2026-10-31/front.png)
- [Side](screenshots/hosted-2026-10-31/side.png)
- [Three-quarter](screenshots/hosted-2026-10-31/three-quarter.png)
- [After rotation](screenshots/hosted-2026-10-31/rotated.png)
- [After zoom](screenshots/hosted-2026-10-31/zoomed.png)

These are hosted screenshots of the unauthenticated ECHO shell, not a populated
workspace or local mock. The geometry remains genuine FreeSurfer fsaverage5
cortical anatomy, not a procedural approximation. No memories or connections
were invented. The shell displays “LOCAL DEVELOPMENT” before settings can load;
that label does not establish the deployed storage backend.

The proxy CA was already present in the runtime bundle and NSS store. Chromium
initializes NSS with NSS_InitReadWrite; the read-only directory prevented that
initialization. Narrow write access to `/home/agent/.pki/nssdb` fixed direct browser
navigation. No CA or certificate exception was added; TLS validation remained on.
The sandbox grant is turn-scoped and may be needed again after resumption.

The direct Chromium control had no interception and reached Vercel login. For
the protected ECHO render, a Playwright request handler attached OIDC only to the
exact feature origin, with automatic redirects disabled. The token was never
forwarded to Vercel login or other hosts. Browser contexts were closed; no trace,
HAR, cookie dump or request-header log was retained.

## Authentication and cleanup

There was no installed Vercel CLI or existing CLI/browser login. The supported
`@vercel/oidc` SDK workflow was used directly with existing VERCEL_TOKEN:
`POST /v1/projects/{projectId}/token?source=vercel-oidc-refresh&teamId=…`.
The development identity was accepted by the existing same-project Trusted Sources
policy for Preview through `x-vercel-trusted-oidc-idp-token`. No policy changed.
This was not execution of the Vercel CLI binary.

The fallback permission to create **one** temporary automation-bypass credential
was unnecessary and unused. Project credential count was zero before and after;
there is no persistent automation credential requiring revocation. Protection
remains `all_except_custom_domains`. The mode-0600 local OIDC token file was removed.
The short-lived token was **not individually revoked**; its recorded expiry is
**31 October 2026, 03:43:56 UTC / Europe/London**. Deletion is not presented as
server-side revocation. No test accounts, records or archives require cleanup.

## Runtime failure and remaining diagnosis

Both `/api/health` and `/api/auth/status` return:
`The operation failed. Your existing data has been preserved.`
Vercel's bounded Observability query returned four matching function errors at
03:20–03:21 UTC, all `{"event":"api_error","type":"Error"}`. The earlier streaming
log request timed out; the bounded query succeeded.

The health route obtains the database and executes SELECT 1 before returning.
This narrows the failure to database initialization/health-query handling,
including connection, TLS, migration loading and setup. The deployed logger omits
error codes and stages, so the specific cause is **unresolved**. A binding proves
neither connectivity nor successful managed migrations. No speculative database
reset, migration replay, credential replacement, TLS relaxation or app patch was made.

Next inspect the existing project's Vercel function/database diagnostics for
this deployment and these paths. Check connectivity, verified TLS, binding
applicability and packaged migrations without exposing connection strings or
querying personal records. If existing diagnostics cannot distinguish them,
prepare a minimal sanitised error-code/stage diagnostic patch for review before
changing the deployed Preview. Never log raw errors, request headers, connection
URLs or source content. Preview and Production share DATABASE_URL; do not reset
or replace that database.

## Cost gate and next acceptance run

The user's **US$1 cumulative** approval persists; do not ask for it again merely
because this run stopped. It includes embeddings, summaries, both answer providers
and every retry. No provider billing dashboard was queried: US$0 is established
by dispatching zero billable provider requests.

Pricing at `https://platform.openai.com/docs/pricing` and
`https://docs.claude.com/en/docs/about-claude/pricing` was blocked by proxy tunnel 403. Earlier requests to `https://openai.com/api/pricing/` and
`https://www.anthropic.com/pricing` were also blocked. The previous illustrative
cost proposal must not be used as verified pricing. Account/model availability
also remains unverified. No request with an unbounded cost was started.

After the runtime and pricing prerequisites are resolved:

1. Reuse authorised OIDC and existing Vercel provider keys. Do not request new keys
   because they are absent locally. Keep protection and registration policy intact;
   establish a separate authorised test workspace.
2. Verify generation and embedding model access through non-generation metadata
   checks. Obtain current official prices for all chargeable token categories.
   Stop if availability or price bounds remain unknown.
3. Use one tiny synthetic conversation, never the user's archive. Prepare input
   bounds, strict output caps, retry policy and a conservative cumulative cost
   ledger. Reserve worst-case cost before every request within the **remaining
   total US$1**. The app's token limits are not a unified dollar cap.
4. Verify import → original → separate summary → semantic paraphrase → separate
   grounded GPT and Claude answers → exact citations → logout/login persistence.
   Record actual usage and grounding evidence separately for each provider.
5. Clean up only test-owned records, archives and account as appropriate. Remove
   short-lived local access material. If the authorised automation fallback is
   needed, create at most one credential and verify revocation on every exit path.
   Update this handoff and roadmap. No production promotion, purchases or new phase.
