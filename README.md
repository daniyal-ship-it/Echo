# Echo — The Holographic Brain

A working first implementation of the Holographic Brain brief: an MRI-derived,
interactive cortical atlas connected to an authenticated, persistent memory
workspace. **The full product vision is not complete.** See the precise status in
[IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

![Anatomical workspace with a stored demonstration memory](docs/screenshots/three-quarter.png)

## Run

Use Node.js 22 or newer (validated with Node 24), npm and Python 3. No API key or
external database is needed for local development.

```sh
bash scripts/setup.sh
bash scripts/start.sh
```

The development server listens on port 3000. Create your private workspace in the
app. No default account or password is installed, and no memories are seeded.
The explicitly labelled demonstration button writes one real record through the
same data layer as your notes. Repeating it does not duplicate the record.

Local PostgreSQL data lives in ignored `.data/postgres`. It survives process
restarts. Run only **one application process per PGlite data directory**. Stop
the server before running `npm run db:migrate` against that same local directory.
The server already applies migrations transactionally at first startup.

Each Codex cloud task is isolated; use this checkout rather than creating a
Git worktree unless explicitly requested.

## What works

- FreeSurfer fsaverage5 geometry: both hemispheres, preserved cortical folds,
  four atlas-derived lobe colours, transparent surface and anatomical dots.
- Rotate, zoom, pan, regional focus, front/side views, memory raycasting,
  immersive view, reduced motion and graphics presets; responsive mobile layout.
- Accounts, opaque sessions, per-workspace access checks, persistent notes,
  immutable source versions, stable anatomical anchors and private originals.
- Official ChatGPT and Claude export imports; Markdown/text and Obsidian ZIPs.
  Conversation roles, ordering, branches and original export metadata are retained.
- Bounded, resumable import batches, archive retention/download, duplicate
  detection and retry. An identical record never creates another memory.
- Full-text source retrieval; source, region, tag and date filters; inspectable
  relationship candidates and manual connections; confirmed links in the brain.
- Original/source export, individual memory deletion, retained archive deletion,
  and password-confirmed account/workspace deletion.
- OpenAI Responses and Anthropic Messages adapters, explicit context consent,
  configurable model IDs, finite comparison/synthesis, usage reporting and
  saving resulting conversations. **Live API calls remain unverified** without
  credentials. Adapter tests use labelled mocks.

The fine anatomical dots are not stored memories. Original source content is
never replaced by summaries. Current previews are extractive opening text,
clearly distinguished from AI-generated analysis. Current retrieval is full-text,
not vector semantic search; the pgvector schema is present for the next phase.

## Validate

```sh
npm run assets:verify
npm run typecheck
npm test
npm run test:e2e
npm run benchmark
npm run build
npm run test:production
```

Browser tests use system Chromium; set `CHROMIUM_PATH` if installed elsewhere.
They create an isolated local database under `/tmp/echo-browser-*`, explicitly
unset `DATABASE_URL`, and never contact AI providers. The benchmark uses an
in-memory database with isolated synthetic records, not a user's workspace.

See [VALIDATION.md](docs/VALIDATION.md) for results and limitations. Screenshots
show a test workspace and labelled demonstration/test records.

## Deployment and credentials

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) and [.env.example](.env.example).
Managed deployment needs a PostgreSQL database with pgvector, certificate-verified
TLS, HTTPS hosting and a fixed `APP_ORIGIN`. API access needs separate provider
credentials and an available model ID; consumer subscriptions do not grant API
credits or access to past consumer conversations.

The local data directory is not suitable for ephemeral serverless storage.
The Dockerfile and standalone build prepare a deployment artifact; they do not
publish the application or establish a live cloud database.

## Design and provenance

- [Architecture and milestones](docs/ARCHITECTURE.md)
- [Anatomical source, licences and limitations](docs/ANATOMY.md)
- [Current schema and planned entities](docs/SCHEMA.md)
- [Security and data ownership](docs/SECURITY.md)
- [Implementation checkpoint and remaining work](docs/IMPLEMENTATION.md)

All or portions of this licensed product (such portions are the "Software") have
been obtained under license from The General Hospital Corporation "MGH" and are
subject to the terms and conditions in
[the included FreeSurfer licence](public/licenses/FREESURFER.txt). CBIG attribution
is included in [its MIT licence](public/licenses/CBIG.txt). Anatomy is a group
average research surface, not a clinical model or a simulation of consciousness.
