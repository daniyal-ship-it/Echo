Continue ECHO on feat/core-memory-exploration from commit 4b19901,
or its latest descendant if further work already exists.

This increment is acknowledged, but the full core milestone and final
visual specification remain incomplete.

Read docs/ROADMAP.md, docs/IMPLEMENTATION.md and docs/VALIDATION.md.
Preserve the current anatomical renderer, navigation, original records,
authentication and existing credentials. Do not restart or redesign
the application.

FIRST: MAKE THE CURRENT INCREMENT REVIEWABLE

Find the existing Vercel preview for this feature branch and verify
which commit it serves. If no preview exists, deploy this branch as
Preview only, within the existing project and plan.

Return the actual preview URL. Do not give me the older main-branch URL.
Check branch-specific APP_ORIGIN and authentication without weakening
origin checks or disabling deployment protection.

Provide accessible screenshot attachments or working repository links,
not just /workspace/... paths.

Do not merge into main or promote to production in this task.

THEN IMPLEMENT THE NEXT CORE INCREMENT:
DURABLE MEMORY INTELLIGENCE

1. REAL SEMANTIC INDEXING

Implement genuine embeddings for imported conversations and notes,
using a supported provider/model and the existing database architecture.

Preserve source versions, message boundaries, timestamps and stable
references from indexed chunks to their original content.

Store embedding model/version/dimension metadata. Handle changed or
deleted sources correctly, including removing obsolete index entries.

Indexing must have durable progress, retries, cancellation and recovery.
Repeated processing must not create duplicate records or unnecessary
duplicate provider charges.

Enforce workspace access restrictions before retrieval results or
source content can reach an AI provider.

2. GENERATED SUMMARIES AND INSIGHTS

Create actual generated summaries, separately stored from originals.
Do not label opening excerpts as generated summaries.

Produce concise summaries and useful structured insights, such as
decisions, unresolved questions and explicitly stated commitments.

Retain source references, source version, generation metadata and
processing status. Preserve originals unchanged.

Do not invent owners, deadlines, decisions or facts that the source
does not establish.

3. HYBRID RETRIEVAL AND MEMORY CONNECTIONS

Combine keyword and semantic retrieval with the existing filters.

Demonstrate a query that retrieves relevant information even when the
query uses different wording from the source.

Connect results to their actual brain nodes and original source passages.

Add evidence-backed semantic connection candidates alongside existing
tag/reference connections. Explain the basis for each connection.
Similarity must not be presented as proof that two claims are true.

Keep inferred groups distinguishable from user-defined tags.
Respect user corrections and dismissed connections.

4. VERIFY GPT AND CLAUDE INDEPENDENTLY

Reuse the existing server-side credentials:
ECHO_OPENAI_API_KEY
ECHO_ANTHROPIC_API_KEY

Do not recreate, reveal or move secrets into public client configuration.
Missing credentials in the Codex process do not mean Vercel's credentials
need replacing.

Verify currently supported API model identifiers and actual account
access before making calls. Do not assume model names used elsewhere
are valid API identifiers.

Test each provider against a tiny authorised fixture in an isolated
test account/workspace. Clearly separate mocked tests from live calls.
Obtain approval for API spending if it has not already been authorised;
do not process my full archive or add paid infrastructure.

Answers must use retrieved evidence and provide citations that open
the correct original passages. An unsupported question should produce
an honest insufficient-evidence response, not an invented memory.

ACCEPTANCE FOR THIS INCREMENT

Demonstrate this complete journey:

Import a small supported conversation archive
→ preserve the original
→ generate a separately stored summary
→ index the content
→ retrieve it using a paraphrased question
→ answer with each provider separately
→ open the cited original and corresponding brain node
→ sign out and back in
→ retrieve the same saved material again.

Also test duplicate processing, interrupted-job recovery, source
deletion, invalid citation handling and cross-workspace isolation.

Mock-only tests do not satisfy live-provider acceptance.
A successful build does not satisfy hosted persistence acceptance.

DELIVERY

Commit and push the working changes to the feature branch.
Update the roadmap with exact evidence and remaining gaps.
Return the latest preview URL, commit, tests performed, live-provider
results and any precise configuration blockers.

Make substantive implementation progress; do not stop at another plan.
If the task ends mid-increment, preserve the work and write an accurate
continuation handoff rather than claiming completion.

Keep voice, meetings, calendar, reminders and other connectors on the
roadmap, but do not broaden this task into those features before the
core memory journey is working.