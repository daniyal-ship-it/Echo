# Phase 3A renderer checkpoint — 13 November 2026

Base: `5d35bceae979df03a11c135bfa24d211b698e2b5`.
Branch: `feat/phase3a-brain-renderer`. Local implementation and validation only.
The [integration contract](PHASE3_RENDERER_CONTRACT.md) preserves all existing
Brain props, ViewCommand variants and graph API structures for Phase 3B.

## Implemented

- Normal-lit translucent cortex and restrained rim illumination expose the
  original cortical folds. Atlas points remain separate from interactive records.
- Lobe focus updates uniforms instead of rebuilding point geometry. Atlas colours,
  neutral regions, topology and anatomical boundaries are unchanged.
- Instanced soft memory halos and individual hover emphasis preserve selection.
- Confirmed graph connections share one tessellated line buffer and draw, with
  endpoint colour interpolation and selected-relationship filtering. Missing
  endpoints and unconfirmed relationships do not generate paths.
- Conservative orbit clearance, portrait zoom range and finite coincident-camera
  handling improve camera safety without changing the public command contract.
- Invalid/truncated assets and actual WebGL context loss fail to the existing
  library fallback. Point/line buffers and context listeners have teardown paths.

## Evidence and test scope

Machine-readable results are in [phase3-renderer.json](validation/phase3-renderer.json).
All databases were isolated local fixtures. Providers used explicitly labelled
mock transport. No hosted database, user memory, Vercel setting or API key changed;
no paid request, push, merge or deployment was performed.

The 70-test unit/integration suite passed with zero failures or skips, including
real PostgreSQL serialization, persistent vectors/retrieval and security checks.
The disposable image was `pgvector/pgvector:0.8.2-pg17`, PostgreSQL **17.10** with
pgvector **0.8.2**, not a claim of hosted Supabase 17.11 acceptance. The temporary
container was stopped and removed. Other tests use isolated PGlite.

Anatomy verification passed: **20,484 vertices, 40,960 triangles**, both hemispheres
and all source checksums. No anatomical asset or licence was changed. This is a
group-average research cortex, not a clinical model or biological memory map.

Browser coverage includes actual persisted fixture memories, topics, confirmed
connections, front/side/three-quarter views, orbit/zoom, selection, logout/session
isolation and the existing mock intelligence journeys. The new renderer test adds
all four lobe controls, zero/100/1,500/100,000-record render fixtures, desktop/tablet/
phone framing, reduced-motion camera settling, keyboard camera activation, actual
`WEBGL_lose_context` and an intercepted asset HTTP 503. Density fixtures intercept
only the local graph response and are explicitly synthetic; they are not stored
user records or evidence of hosted data capacity.

The new test uses one isolated account. The complete suite remains below the
existing ten-registration limit; authentication limits were not weakened.
All **14 browser journeys** have passing results: the full run passed 13, and the
renderer journey passed separately after correcting its new reduced-motion
assertion. This is not presented as a single 14-green full-suite invocation.
TypeScript, serial production build and four isolated standalone production smoke
groups passed. Browser tests and production builds were not run concurrently.

Initial validation caught and corrected two implementation defects: the binary
length guard must include both region and hemisphere byte arrays, and the halo
shader must tolerate a first frame without instance colours. An intermediate
browser failure was a test looking for Sign out while the mobile drawer was
closed; the test now opens navigation before asserting availability.
The added reduced-motion check initially changed the OS preference after mount,
but the existing workspace samples that preference only on startup. The corrected
test reloads under that preference and asserts it is active before exercising the
camera. No surrounding workspace or CSS changes were made.
Byte-identical PNG comparisons also differed despite reduced motion being active;
the final check observes actual shader model-view matrices instead. It verifies
stable front/side cameras and a different matrix between the two presets, without
claiming sub-frame latency from screenshot timing.

## Visual evidence

| View | Before | After |
| --- | --- | --- |
| Front | [Baseline](screenshots/phase3-renderer/before-front.png) | [Renderer](screenshots/phase3-renderer/after-front.png) |
| Side | [Baseline](screenshots/phase3-renderer/before-side.png) | [Renderer](screenshots/phase3-renderer/after-side.png) |
| Three-quarter | [Baseline](screenshots/phase3-renderer/before-three-quarter.png) | [Renderer](screenshots/phase3-renderer/after-three-quarter.png) |

[Phone, empty workspace](screenshots/phase3-renderer/phone-empty.png).
These are actual Chromium captures, not generated imagery. Before images are the
retained Phase 2 integration browser captures at the base renderer; after images
use the same workspace camera journey. Test account IDs and individual memory
anchors differ, so this is a visual comparison, not a pixel-identical benchmark.
The lateral folds, hemispheric separation, coloured lobes and portrait framing
were visually inspected. Existing CSS and surrounding workspace UI are unchanged.

## Performance interpretation

The renderer test records 30 RAF intervals while rotating each density fixture.
The first interval is excluded. It counts WebGL draws, samples Chromium JS heap
and uses `EXT_disjoint_timer_query_webgl2` when available. Query results are summed
by RAF interval; unavailable/disjoint queries are excluded. Partial intervals
can remain, so GPU draw sums are **not complete GPU frame times**. Clears,
presentation and instrumentation overhead are not separated. JS heap is not GPU
memory. There is no reliable GPU-memory or sustained-leak measurement here.

See the JSON for exact final samples. Chromium uses **SwiftShader software
rendering**, not a representative hardware GPU. These results do **not** achieve
or certify the 60 FPS target. They do not establish a measured speedup over the
previous renderer; no paired baseline performance run was made. The demonstrated
structural improvement is one connection draw instead of one draw object per edge.

| Represented records | Rendered nodes | RAF median / p95 (ms) | Available GPU draw-sum median (ms) | JS heap (MiB) |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 66.7 / 150.0 | 61.8 | 31.0 |
| 100 | 100 | 83.3 / 150.0 | 71.5 | 36.9 |
| 1,500 | 1,500 | 266.6 / 466.6 | 250.5 | 52.6 |
| 100,000 | 1,500 | 283.3 / 716.6 | 284.4 | 29.5 |

The separate PGlite data-path benchmark returned 100/1,000/639/1,272 graph nodes
from 100/1,000/10,000/100,000 records, with graph timings of 8/24/92/1,021 ms.
This single synthetic run overlapped early browser startup and is illustrative,
not a production load test. It is distinct from the 1,500-node render stress fixture.

## Remaining limits and integration gate

- Representative physical desktop/mobile performance, sustained memory use and
  touch-device feel still require acceptance. Software rendering is slow at
  density; do not market this checkpoint as 60 FPS.
- Memory/topic glyphs retain the existing x-ray convention. Filaments now depth-test
  against cortex; internal segments can be hidden. Native lines are one pixel.
- Glow is a local halo, not full-screen bloom. No invented directional activity,
  reasoning animation, brainstem or cerebellum was added.
- Camera safety uses a conservative bounding sphere, not mesh-level collision.
  Automatic WebGL context restoration is not implemented; fallback requests reload.
- Existing Three.Clock and terminal-colour warnings remain. Deliberately losing
  context can also produce a teardown extension warning; normal renders were
  checked for page errors and shader compilation errors.
- No hosted or live-provider acceptance is implied. Phase 3B integration and any
  shared feature-branch push or Preview deployment require separate approval.

## Reproduction

Use Node 22+ and system Chromium. Run `npm run assets:verify`; `npm test` with
`ECHO_TEST_POSTGRES_URL` pointing only to a disposable PostgreSQL/pgvector instance;
`npm run test:e2e`; then, after Playwright/server teardown, `npm run typecheck`,
`npm run build` and `npm run test:production`. Never use a hosted user database
for test fixtures. Without an isolated PostgreSQL URL the real-driver tests skip,
which is not equivalent to the recorded zero-skip run. `npm run benchmark` measures
only the isolated PGlite data path. Set `ECHO_RENDER_REPORT_DIR` to retain renderer
screenshots and instrumented metrics outside disposable Playwright output.
