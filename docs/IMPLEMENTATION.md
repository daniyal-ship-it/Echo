# Implementation checkpoint — 29 October 2026

The foundation remains intact at `6f19c18` on GitHub `main`. The resumed increment
uses the same checkout on `feat/core-memory-exploration`. Nothing was rebuilt from
a template; no anatomy, original records, migrations, credentials or hosting plan
were replaced. The full core milestone is **Partially implemented**.

The complete [roadmap](ROADMAP.md) maps the original brief to four explicit
statuses. The newer [milestone brief](CORE_MILESTONE_BRIEF.md) is preserved too.

## This increment

- Point-led cortex built from the same MRI-derived vertices, normal-sensitive
  luminosity and a subdued neutral surface. A depth pass suppresses far-side lobe
  colour bleed; genuine memory glyphs and confirmed connections remain distinct.
- Camera fitting checks all anatomical vertices for each automatic focus and
  viewport. Camera transitions orbit around the cortex instead of crossing it.
  Manual zoom/pan remains freely controlled by the user.
- Whole brain → lobe → explicit-tag topic/project group → individual original.
  Rings represent actual groups, not additional memories. Topics have search,
  stable pagination (24 per page), counts and an explicit untagged group. A record
  can belong to several groups; group counts are not an exclusive partition.
- Memory selection loads the actual node plus up to 100 confirmed neighbours,
  including cross-lobe links outside previous filters. Search citations open the
  same original and glyph. Back navigation restores the previous scope; Whole
  brain resets the scope. Source text remains in the inspector.
- Shared library/graph predicates, date validation, loading/error/retry states,
  workspace guards, mobile layout and isolated tests. No database migration.

## Preserved foundation

Authentication and opaque sessions; scoped persistent storage; immutable original
versions and stable anatomical anchors; idempotent demonstration record; official
ChatGPT/Claude JSON/ZIP and Markdown/Obsidian imports; roles/branches/metadata;
bounded retryable imports and retained archives; full-text citations and filters;
tag/reference link candidates with explanations, confirmation and manual links;
export/delete/revocation; independent OpenAI/Anthropic adapters with context
consent and bounded comparison/synthesis.

See [VALIDATION.md](VALIDATION.md) for actual test results and screenshot links.
Tests use isolated databases and no live provider calls. The anatomical surface
is genuine FreeSurfer fsaverage5 cortex, not a procedural approximation; cerebellum
and brainstem are absent, and this is not medical-grade certification.

## Current limits and next task

Explicit-tag groups are useful progressive navigation, not semantic clustering
or a first-class project model. Current previews are opening source text, not
AI-generated summaries. Search remains full-text. Automatic links cover explicit
references/shared tags, not semantic/entity evidence. Live GPT/Claude grounding,
citations, account/model access and cloud persistence are not yet verified.

Next implement **durable semantic indexing and source-grounded consolidation**:

1. Versioned derived summaries/insights and chunk citations stored separately from
   immutable originals. Preserve source hashes and version provenance.
2. Consent-bound bounded indexing jobs, durable status/leases, cancellation and
   recovery; select a real embedding provider/model supported by the existing
   account. Do not silently add paid worker infrastructure.
3. Hybrid keyword/vector retrieval with a transparent ranking explanation and
   evidence-bearing connection candidates. Similarity is not factual truth.
4. Reuse existing Vercel provider keys for one small authorised source-grounded
   verification per provider, then run the entire acceptance gate in ROADMAP.md.

The current Codex process lacks the provider keys; this does not invalidate or
require replacement of the existing Vercel credentials. See DEPLOYMENT.md for the
exact distinction. Voice/meetings, calendar/reminders, remaining connectors and
production hardening follow the core acceptance gate.

## Resume safely

Read this file, ROADMAP.md and VALIDATION.md; inspect `git status` and recent
commits. Continue the feature branch unless a later checkpoint supersedes it.
Keep `main` history intact. Do not reimport fixtures into a user's database.
Run only one app process per local PGlite directory. Browser tests explicitly
override inherited database/origin settings and disable live provider keys.
For deployment, check branch-specific Preview origin before a Git preview build;
do not assume the existing main preview already contains this increment.
