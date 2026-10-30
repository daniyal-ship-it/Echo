# Hosted verification handoff — 30 October 2026

This is a verification-only follow-up after the environment was republished.
No application features were rebuilt, no source code was changed, no credentials
were replaced and no personal archive was accessed. The fetched feature branch
and local HEAD both contain `30a337e04f1939af06d2f2392d8281c5e7ecdf25`.
`main` remains `6f19c18bab3656e90de77f168cda88fe409f126a`.

Preview: https://echo-git-feat-core-memory-exploration-daniyal-1415s-projects.vercel.app

## Actual checks

| Check                                              | Result                      | Evidence                                                                                                                                                 |
| -------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch feature branch / checkpoint ancestry         | Passed                      | Existing origin is daniyal-ship-it/Echo; local and remote feature SHA both 30a337e, clean tree before documentation updates                              |
| Exact feature-host network access                  | Passed                      | Certificate-verified HTTP request to `/api/auth/status` receives HTTP 302, rather than the former proxy tunnel 403                                       |
| Vercel deployment protection                       | Blocked for this runner     | Redirect chain: feature host 302 → vercel.com/sso-api 307 → vercel.com/login 200. This is Vercel authentication, not ECHO login                          |
| Existing Vercel management authentication          | Passed                      | Existing VERCEL_TOKEN reads the correct team/project, deployment and environment metadata; it is not a Vercel browser session                            |
| Deployed application commit                        | Passed                      | READY Preview dpl_HT5SRLLB4P2pBafuX7ieEn7N2q5q serves 30a337e and owns the exact feature alias                                                           |
| Origin / credential binding metadata               | Passed                      | Branch-specific Preview APP_ORIGIN matches; both ECHO provider keys and DATABASE_URL have sensitive Preview bindings; values not printed or replaced     |
| API model catalogue identifiers                    | Passed, catalogue only      | Official SDK type lists include gpt-6.1-sol and claude-sonnet-5-5; actual account/model access remains unverified                                        |
| ECHO authentication / isolated account             | Blocked                     | Application endpoint not reached through Vercel protection; no test login/session available in the runner                                                |
| Tiny import and original preservation              | Blocked                     | No hosted fixture created                                                                                                                                |
| Generated summary and structured insights          | Blocked                     | No hosted generation call made                                                                                                                           |
| Semantic index and paraphrased retrieval           | Blocked                     | No live embedding call made                                                                                                                              |
| Source-grounded GPT answer                         | Blocked                     | No live OpenAI generation call made                                                                                                                      |
| Source-grounded Claude answer                      | Blocked                     | No live Anthropic generation call made                                                                                                                   |
| Citation / original-passage / brain-node selection | Blocked                     | No hosted application browser journey executed                                                                                                           |
| Sign out/in and retrieve persisted material        | Blocked                     | No hosted authenticated session available                                                                                                                |
| Chromium navigation                                | Failed, runner prerequisite | Playwright and system Chromium are installed, but normal certificate validation fails before any page renders. Certificate verification was not disabled |
| Billable test approval                             | Blocked                     | No recorded numeric budget found; this verification incurred no provider charges                                                                         |

Machine-readable evidence: [hosted-verification-2026-10-30.json](validation/hosted-verification-2026-10-30.json).
Redirect query strings, cookies, credentials and private source content are excluded.
The previous 30 core tests, 6 browser journeys and production build/smoke checks
are **local historical evidence**, with labelled provider mocks. They were not
rerun here and do not count as live hosted acceptance.

## Authentication boundary

The saved network change has taken effect for the exact feature hostname.
Further allowlist publishing is not the current blocker for that hostname.
Vercel protection is still enabled (`all_except_custom_domains`). This runner has
management API authentication but no authenticated Vercel browser session.
The project metadata reports no existing automation bypass credential, and
VERCEL_AUTOMATION_BYPASS_SECRET is absent locally. Existing API keys in Vercel
remain usable by the application once it is accessible; do not replace them.

Vercel's supported `vercel curl` command can **generate** an automation token when
none exists. It was not run implicitly: creating a project-wide bypass credential
would add access beyond the user's instruction to reuse existing authentication.
An automation credential applies to the project's deployments, not just this
feature Preview. Do not silently create one, disable protection, create a public
share link, change signup policy or repurpose the management token as a browser cookie.

References: [vercel curl](https://vercel.com/docs/cli/curl) and
[automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## Concrete bounded live-test proposal — not approved

Use a separate authorised ECHO test workspace and one synthetic two-message
conversation. For example: “TEST FIXTURE: Store the access codes in a sealed
envelope inside the desk.” Preserve raw roles/timestamps. Exclude saved assistant
outputs using the imported-source filter when asking the paraphrase.

One successful run needs approximately two embedding requests (source and cached
question) and three generation requests (one summary, one GPT answer, one Claude
answer), with no synthesis or automatic retry. Existing caps allow at most 1,600
summary output tokens plus 1,200 per answer: **4,000 output tokens**. A planning
allowance of **5,000 input tokens** includes prompts/context across generation
calls; exact usage must be measured and verified against the prepared fixture.
Sign-out/in and repeating the identical semantic query should reuse its embedding.

A conditional planning estimate is **US$0.13 plus embeddings**, assuming $10 per
million input tokens and $20 per million output tokens. **These are illustrative
rates, not verified prices for gpt-6.1-sol or claude-sonnet-5-5.** Official pricing
pages at openai.com and www.anthropic.com still receive proxy tunnel 403 in this
runner. No reliable current model-specific quote was obtained. A proposed ceiling
is **US$1 for the single fixture run**, subject to user approval and verified
current rates fitting that ceiling before dispatch. This document does not grant
approval; no provider call should begin from this estimate alone.

## Next steps

1. Make an existing authorised Vercel browser session available through a supported
   secure mechanism. If automation access is preferred, obtain explicit permission
   for a temporary project automation credential, explain its project-wide scope,
   keep it secret and revoke it after the checks. Preserve deployment protection.
2. Diagnose Chromium's certificate-validation failure without disabling TLS.
   The platform proxy CA is already in the runtime trusted bundle and NSS store;
   do not assume a missing certificate or blindly add a duplicate. HTTP requests
   succeed with their normal certificate checks; that is not browser UI certification.
3. Reach ECHO's own authentication endpoint and establish a separate test workspace.
   Use existing test-account access securely if one exists. Do not enable public
   signup or touch the owner's archive to get past an authentication blocker.
4. Verify current provider model/account access and pricing through the authorised
   runtime, secure the user's explicit test budget, then run the exact tiny journey
   above. No bulk run, plan upgrade or new feature phase is authorised.
5. Record each real provider output, source version/passage and persisted job state
   without secrets. Verify no-source handling, duplicate enqueue, cancellation and
   deletion where feasible within the approved test scope. Clean up only fixture
   records and retained fixture archives; report any in-flight billing uncertainty.
6. Update this handoff, VALIDATION.md and ROADMAP.md with actual outcomes. The full
   core acceptance gate remains incomplete until the live checks pass.
