# Validation record — 29 October 2026

## Current increment

| Check                              | Result                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run assets:verify`            | Passed: 20,484 vertices, 40,960 triangles; both source hemispheres, annotations and binary checksums unchanged                                                                             |
| `npm run typecheck`                | Passed; production build also completed TypeScript validation                                                                                                                              |
| `npm test`                         | 17 passed, 0 failed, 0 skipped; isolated databases and mocked provider calls                                                                                                               |
| Existing workspace browser journey | Passed after final rendering changes: actual 3D memory raycast, rotation/zoom, imports, original branches, dedupe, confirmed edges, citations, workspace isolation, new session and mobile |
| New exploration browser journey    | Passed: actual 3D topic ring click, lobe/tag/untagged navigation, original inspection, cross-lobe links, source focus outside filters, retry, mobile source selection and immersive view   |
| Existing integrity browser journey | Passed: immutable edit versions, filters, confirmed deletion, account deletion and revoked sessions                                                                                        |
| No-WebGL browser journey           | Passed: deliberate renderer failure shows truthful fallback and working auth UI                                                                                                            |
| Delayed-response browser journey   | Passed: stale authenticated library response cannot restore records after logout                                                                                                           |
| `npm run build`                    | Passed: optimised standalone Next.js build                                                                                                                                                 |
| `npm run test:production`          | Passed: all 4 production-mode smoke groups; temporary database removed                                                                                                                     |
| `npm run benchmark`                | Passed: 100, 1,000, 10,000 and 100,000 isolated synthetic records; aggregate counts preserved, <=1,500 draw objects and 50-row library pages                                               |

All five browser scenarios have passing runs. The new exploration scenario first
caught inherited column styling on navigation and small title/caption overlaps.
Those were fixed; the exploration and workspace journeys were rerun against the
final render. The final mobile exploration run reloads at phone size so it uses
the actual default low graphics preset, rather than merely resizing a desktop
canvas. The complete suite initially reported four passes and one layout failure;
that failure is resolved by the targeted reruns, not ignored.

New database tests check topic pagination/clamping, duplicate tag membership,
untagged records, case-insensitive topic lookup, shared date/source/tag filters,
workspace isolation, confirmed-only cross-lobe neighbourhoods and invalid input.
The camera test projects **every original anatomical vertex** for 40 combinations
of view, aspect ratio and asymmetric target, asserting a margin inside the frustum.
This verifies automatic destination framing; deliberate manual zoom can crop.

Browser tests explicitly clear DATABASE_URL and live provider keys, use a fresh
`/tmp/echo-browser-*` database and set their own APP_ORIGIN. The origin unit test
also isolates inherited configuration. No fixture was added to the user's account
or remote database. No paid provider experiment was run.

## Actual rendered visual evidence

Screenshots show only isolated, labelled demonstration/test records:

- [Front](screenshots/front.png): separate hemispheres and fissure, point scaffold.
- [Side](screenshots/side.png): preserved cortical folds and atlas lobe boundaries.
- [Three-quarter](screenshots/three-quarter.png): depth and distinct stored glyph.
- [Topics](screenshots/topics.png): actual tag groups shown as rings and a readable list.
- [Connected memory](screenshots/connected-memory.png): selected original, actual
  neighbour and confirmed edge, with whole-brain/lobe/topic/memory breadcrumbs.
- [Raycast memory selection](screenshots/memory-selected.png).
- [Retrieved sources](screenshots/retrieval.png).
- [Mobile](screenshots/mobile.png), [fresh mobile low preset](screenshots/mobile-low.png),
  [mobile selection](screenshots/mobile-selected.png) and
  [immersive mobile](screenshots/immersive-mobile.png).

The desktop views were visually inspected for recognizable folds, clear lobe
colours and point-led construction. Mobile checks cover source access, framing,
layout separation and navigation. A depth-only surface prevents far-side lobe
colour bleed; the neutral visible mesh is deliberately faint. Graph links and
memory glyphs are drawn as a separate overlay so relevant records stay findable.
No source paragraphs are placed in 3D. Topic groups can overlap spatially; the
paginated list is the deterministic, accessible way to choose overlapping groups.

The licensed fsaverage5 geometry is a genuine group-average cortical surface,
not procedural substitute anatomy. Cerebellum and brainstem are absent. The visual
review is not a medical certification, hardware GPU test or specialist review.

## Performance evidence and limits

Current machine-readable results: [benchmark.json](validation/benchmark.json).

| Records |         Draw objects |    Graph | Full-text search | Library |
| ------: | -------------------: | -------: | ---------------: | ------: |
|     100 |                  100 |    33 ms |             6 ms |   11 ms |
|   1,000 |                1,000 |    78 ms |             8 ms |   13 ms |
|  10,000 |   639 spatial groups |   180 ms |            41 ms |   24 ms |
| 100,000 | 1,272 spatial groups | 2,126 ms |           468 ms |  209 ms |

These are isolated PGlite data-path measurements taken while browser verification
also ran; they are not comparable to dedicated production load tests. GPU FPS,
sustained memory use, topic-group query load at production scale and concurrent
managed-database behaviour remain unmeasured. There is no 60 FPS certification.
Three.js Clock/CommonJS and Node colour-environment deprecation warnings remain;
no shader compilation failures or page errors were found in the successful normal
journeys. The no-WebGL scenario intentionally produces a renderer error.

## Preservation and live scope

Resumption found the original foundation and eight unfinished files intact on
`feat/core-memory-exploration`. Remote `main` was checked at `6f19c18`; it contains
the ECHO application. The increment changes no migrations, original data, anatomy
assets or dependency versions. There is no second implementation checkout.

The existing foundation Vercel preview was previously READY and the user confirmed
it launches. No claim is made that this proves hosted database recovery, live AI
or cross-device acceptance. Existing provider keys are saved in Vercel under the
correct ECHO-prefixed names but absent from this Codex runtime; they were neither
replaced nor requested again. See [DEPLOYMENT.md](DEPLOYMENT.md).

The **complete core milestone has not passed**: semantic indexing/hybrid retrieval,
separate generated summaries/insights and live GPT/Claude grounded citations remain
unfinished or unverified. Voice/meetings, reminders/calendar, remaining connectors,
production security/recovery and comprehensive accessibility testing are also
outstanding. [ROADMAP.md](ROADMAP.md) records every original requirement's status.
