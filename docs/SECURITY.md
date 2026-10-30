# Security and ownership

## Present controls

- Scrypt passwords with independent random salts; 32-byte random session tokens,
  stored only as SHA-256 hashes, with seven-day expiry and HttpOnly/SameSite cookies.
- Cookies are Secure when the configured application origin is HTTPS.
- Mutations require an exact matching Origin and reject cross-site fetches.
  Production requires a fixed `APP_ORIGIN`; forwarded origin headers are not trusted.
- Client state is cleared on logout; delayed responses from an old workspace are
  discarded, and active provider requests are cancelled where possible.
- Parameterised SQL and a session-derived workspace on every private API path.
  Cross-workspace graph edges are also rejected by database foreign keys.
- Validation and bounded request reads; 20 MiB upload, 40 MiB ZIP expansion,
  2,000 entries, 1,000 records, safe paths and no filesystem ZIP extraction.
- Sources render as text, not executable HTML. Provider context is untrusted data,
  with no tool execution, email, calendar write or arbitrary URL-fetch capability.
- Provider credentials stay on the server. API failures do not relay raw provider
  error bodies or credential material. Logs record event/type, not source content.
- Explicit permission before each provider context transmission; fixed official
  endpoints; at most two independent calls plus one synthesis; 1,200 output tokens
  per call, request timeouts, cancellation, rate limiting and a daily usage guard.
- Export and original download; separately confirmed record/archive deletion;
  account deletion requires both an exact confirmation phrase and the password.

Prompt wording alone is not a complete defence against prompt injection.
Untrusted content can still influence generated prose. The architectural boundary
is that providers have no privileged action tools, and users inspect original
sources. Provider answers are not automatically treated as proven facts.

## Development limitations and deployment gates

Local database files are private to the application filesystem, but **this app
does not encrypt the local database at rest**. Deploy on encrypted managed storage
with backups and access controls before using real sensitive data. Application-level
encryption is not implemented; encrypting searchable content would require a
separate plan for indexing, key management and provider context disclosure.

The first local registrant becomes the workspace owner; later signup is closed
unless explicitly enabled. Do initial production account creation behind restricted
access, then keep `ALLOW_REGISTRATION=false`. Do not expose an uninitialised instance
publicly. A stronger invitation/bootstrap flow, email verification, password reset,
MFA and external identity provider integration remain production hardening work.

API ownership checks are the current access-control boundary. RLS is not enabled,
and direct browser access to PostgreSQL/Supabase must not be added. Use a scoped
database account and do not expose administrative credentials.

The CSP blocks foreign connections/frames and unsafe object embedding, but still
allows inline scripts/styles and eval for the framework/WebGL development runtime.
A production nonce policy and a dedicated security review remain outstanding.

Uploaded supported text/JSON is parsed without executing source code. ZIP expansion
and entry sizes are checked before decompression. This is not an antivirus service;
PDF, Word, image and media execution/parsing is deliberately not implemented yet.

Intelligence jobs reserve a conservative byte-based token allowance before each
bounded call under a workspace lock. Successful operations persist usage/results;
unknown outcomes pause for explicit acknowledgement rather than automatic replay.
Assistant requests retain the existing reported-usage guard, and question vectors
have a scoped cache/rate limit. These are separate controls, not a unified financial
cap. Cancelled or interrupted calls can still be billed, including the window
between a provider response and its durable journal write. Provider-side billing
limits and a verified pricing ledger are needed for strict monetary budgets.

New derived records enforce workspace/source foreign keys. The authenticated
workspace and current original version are checked before sending source context.
Generated summaries require exact quotes in active source passages; answers reject
invalid numbered citations. These structural checks do not prove entailment or
prevent every model hallucination. Empty retrieval returns insufficient evidence
without asking an answer provider. Production adapters have no mock fallback;
Playwright's labelled transport requires an isolated local database and no live keys.

Workspace export is currently an in-memory JSON response; very large exports need
a streaming job/object-store implementation. Historical archive bytes can also
contain deleted individual memories until the archive itself is deleted. The UI
explains this; deleting the entire account removes both. Operator backups follow
their own documented retention and deletion policy.
