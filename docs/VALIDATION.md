# Validation record — 27 October 2026

## Current-instance results

| Check                           | Result                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable `scripts/setup.sh`     | Passed: frozen dependency install, asset verification, generated route types and TypeScript                                                                 |
| `npm test`                      | 14 passed, 0 failed, 0 skipped                                                                                                                              |
| Browser workspace journey       | Passed: real raycast selection, original content, imports, deduplication, branches, confirmed edges, citation retrieval, isolation, logout/login and mobile |
| Browser integrity journey       | Passed: note edit, old-version retrieval, graph filtering, deletion confirmation, account deletion and session revocation                                   |
| Browser without WebGL           | Passed: truthful fallback and usable authentication UI                                                                                                      |
| Optimised Next.js build         | Passed                                                                                                                                                      |
| Standalone production smoke     | Passed: 4 groups of checks covering startup/migration, assets, auth/persistence/export and session revocation                                               |
| Anatomical checksums/conversion | Passed for both pial surfaces, both annotations and derived binary                                                                                          |
| Dependency audit                | 0 known vulnerabilities reported by `npm audit --omit=dev`                                                                                                  |

The final browser run passed all four scenarios. The fourth scenario deliberately
delays an authenticated response and verifies that it cannot restore private
records after logout.

The browser tests originally found a development-origin mismatch, a mobile list
overlap and a textarea label lookup problem during note editing. Final review
also added a guard against stale authenticated responses after logout. These
were fixed and the affected checks rerun successfully. The normal journey reports
no browser page errors. The no-WebGL test deliberately produces a renderer error
and verifies the fallback, rather than treating that forced failure as a
successful render.

Three.js/React Three Fiber emit upstream `Clock`/CommonJS deprecation warnings.
These are recorded as warnings, not hidden failures. The renderer works with the
installed compatible packages; future package upgrades should recheck those APIs.

## Visual review

Actual rendered screenshots were captured and inspected:

- [Front](screenshots/front.png): both hemispheres and longitudinal fissure.
- [Left lateral](screenshots/side.png): major cortical folds and all four lobe colours.
- [Three-quarter](screenshots/three-quarter.png): anatomical depth and separate sample/memory layers.
- [Selected memory](screenshots/memory-selected.png): actual stored content opened by 3D raycasting.
- [Retrieved sources](screenshots/retrieval.png): cited original records.
- [Mobile](screenshots/mobile.png): whole-brain framing, touch-sized primary controls and no horizontal overflow.

The mobile camera framing and sidebar scrolling were corrected after inspection.
Anatomical geometry was checked against its documented FreeSurfer source and
label alignment. This is not a medical certification or a specialist review.

## Scaling benchmark

The latest machine-readable result is [benchmark.json](validation/benchmark.json).
All fixtures were isolated in an in-memory database and discarded.

| Stored records | Render objects returned | Graph query | Full-text retrieval | Library page |
| -------------: | ----------------------: | ----------: | ------------------: | -----------: |
|            100 |                     100 |       10 ms |                3 ms |         5 ms |
|          1,000 |                   1,000 |       18 ms |                4 ms |         4 ms |
|         10,000 |            639 clusters |      107 ms |               25 ms |        13 ms |
|        100,000 |          1,272 clusters |    1,002 ms |              238 ms |        97 ms |

Assertions verify every record is represented by the aggregate counts, no view
exceeds 1,500 memory/cluster objects, the library page returns 50 records, and
retrieval returns actual fixtures. These are one-machine data-path measurements,
not a production load test or a 60 FPS certification. GPU FPS, prolonged memory
usage and concurrent multi-user managed-database behaviour remain unmeasured.

## Interruption / duplicate audit

The source checkout remained the same repository and branch. The remote had no
commits. Anatomical checksums, the lockfile and current core tests passed after
resumption. The primary workspace has no seeded user accounts or memories.

The earlier ignored `.data/e2e` database contains four recognisable isolated test
accounts and six memories with six distinct workspace/source identities. These
are separate from `.data/postgres`. Current browser runs use fresh directories
under `/tmp/echo-browser-*`; they explicitly unset any configured `DATABASE_URL`.
No duplicate implementation checkout was created and no existing user data was
deleted during the resumption audit.

## Not verified

No managed PostgreSQL service, provider credential, cloud deployment or OAuth
account was supplied. Live GPT/Claude, semantic embeddings, meetings, reminders,
external connectors, encrypted managed storage, backups/restores and cross-device
cloud access are not claimed as passing. Provider adapter tests are explicit
mocks. Dockerfile preparation is not a completed container deployment.

The reusable environment configuration is a saved draft. Publication and fresh-task
restoration are separate product actions and have not been demonstrated here.
