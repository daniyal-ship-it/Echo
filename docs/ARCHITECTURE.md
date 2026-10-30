# Echo / The Holographic Brain

## First deliverable

A real, authenticated memory workspace centred on the FreeSurfer fsaverage5
cortical surface. The first gate is anatomical quality, then persistence,
archive import, retrieval and explainable relationships. No connector is
represented as connected without successful authorised access.

## Runtime

- Next.js 16, React 19, TypeScript, Tailwind 4; React Three Fiber 9 / Three.js.
- Node server handles authentication, ownership checks, ingestion and retrieval.
- PostgreSQL + pgvector schema. PGlite provides the **local single-process**
  PostgreSQL development database on persistent disk. A `DATABASE_URL` selects
  ordinary PostgreSQL for deployment; never deploy PGlite on ephemeral Vercel
  storage or share its data directory between processes.
- Private source records stored in the database for the bounded first release.
  Large media needs a private object-store adapter, not public static files.
- Cookies contain opaque random session tokens; only hashes are persisted.
  Scrypt password hashes, expiry, origin validation, parameterised SQL and
  workspace checks protect the API. Remote database credentials stay server-side.
- Import jobs preserve original archives, progress, failures and content hashes.
  Processing can resume after interruption; unique source/version fingerprints
  make replay idempotent. Separate workers become necessary beyond bounded imports.

## Anatomical scaffold

Paired pial surfaces and Desikan–Killiany annotations come from the FreeSurfer
fsaverage5 subject distributed in CBIG. Mesh vertices and topology are retained.
Four lobe groups are derived from named anatomical parcels; cingulate, insula,
and medial wall remain neutral. See `ANATOMY.md` and the public manifest.

One draw layer renders noninteractive anatomical sample points. A separate
instanced layer renders identifiable memories. Saved vertex anchors and positions
stay stable. Lobe occupancy is allocated deterministically, avoiding occupied
slots. Large views aggregate records into spatial clusters; detail is paginated.
Only actual stored edges draw pathways. Reduced motion disables transitions.

## Memory / graph

Original sources are versioned, never replaced with summaries. Opening previews
are explicitly extractive. With consent and configured API access, durable bounded
jobs create versioned message passages, real embeddings and separately stored
generated summaries/insights. A provider operation journal supports recovery and
pauses unknown billing outcomes. Steps are request-driven, not an independent worker.
Shared-tag/reference and semantic-passage relationships are candidates; users
confirm or dismiss them. Manual relationships require an explanation. Cosine
similarity is relevance evidence, not proof of factual truth.

Full-text retrieval works without a provider. Opt-in hybrid retrieval combines
keyword and vector rankings within the authorised filtered workspace. Exact
passage citations open immutable source versions and their actual brain nodes.
Live semantic quality and provider-grounded acceptance remain unverified;
isolated tests use explicitly labelled mocks. See IMPLEMENTATION.md for bounds.
Provider adapters use fixed official HTTPS endpoints and configurable model IDs.
Retrieved text is untrusted data; models receive no action tools. The UI requires
explicit consent before transmitting context to a provider.

## Deployment boundary

Local operation can be tested without cloud credentials. Production requires a
managed PostgreSQL database with pgvector, TLS, encrypted storage and backups,
HTTPS hosting, signup policy, and a private object store before large uploads.
Provider APIs require separate paid API credentials; consumer subscriptions do
not grant archive access. Deployment, cross-device access, provider responses,
meeting transcription and OAuth cannot be certified without those services.

## Budgets

- 20,484 cortical vertices; 40,960 triangles. Two surface draws plus point layers.
- At most 1,500 individually rendered memories; larger sets aggregate by region
  and spatial cell. Library pages are bounded to 50 records.
- Imports: 20 MiB compressed, 40 MiB expanded, 2,000 archive entries,
  1,000 conversations per job; text content maximum 500,000 characters per item.
- No external side effects in tests. Synthetic benchmarks use a separate store.
- Desktop target 60 FPS; low preset reduces scaffold density and pixel ratio.
  Software-rendered CI is functional validation, not a hardware FPS certification.

## Milestones

1. Anatomy and provenance; camera, surface, point layers, regional selection.
2. Authenticated persistent notes, versions, graph, export and deletion.
3. ChatGPT / Claude exports and Markdown/Obsidian imports, deduplication, jobs.
4. Durable indexing/analysis, hybrid citations and independent providers; live acceptance required.
5. Consent-based meetings and real transcription; not a simulated recorder.
6. OAuth integrations, reminders with reliable scheduling, large-file storage.
7. Security hardening, GPU benchmarks, managed deployment and recovery exercise.
