# Phase 3 local integration — 13 November 2026

Branch: `integration/phase3a-3b`. This checkpoint is local only.

## Preserved inputs and history

- Base: `5d35bceae979df03a11c135bfa24d211b698e2b5`.
- Phase 3A ancestor: `b15b84275e098e2e702dfcf1863b85ccbe9404ae`.
- Phase 3B patch source identifier: `12e4ffb4a6896c2290dafc0cd0429d5b9a8dbac5`.
- Phase 3B SHA-256: `2ee593f04d8c0078a1c6e31bfd204f2486cee5f411c2e462674268c26e2d13a7`.
- `git am --3way` applied it as `7cbb0fd` on top of Phase 3A, without conflicts.
  The patch also passed a clean application check against the stated base in a
  temporary index. An email patch's source identifier does not independently prove
  the original commit's parent; the integrated ancestry is verifiable locally.
- The source Phase 3A branch and shared feature branch are unchanged. Existing
  backup branches remain, plus `backup/phase3a-before-3b-b15b842`.
- The original complete-history bundle remains outside Git with SHA-256
  `fff1b7a38a7ce7c152b32d0b6b74a55b94bdb5de25af9a92ded4b50cd6493650`.
  The standalone Phase 3B source branch was not present in this checkout; its
  verified patch is retained and its applied commit is preserved in this history.

## Both implementations retained

Phase 3A supplies the normal-lit cortex, authentic atlas points, instanced memory
halos, batched confirmed connections, camera clearance and WebGL failure handling.
Phase 3B supplies the exploration trail, browser Back/Forward, accessible lobe
controls, context-panel preferences, mobile dock/sheets, truthful empty/loading
states and keyboard navigation. No replacement brain, fabricated user record,
inferred-as-confirmed edge or new provider transport was introduced.

The renderer and UX contracts are reconciled in
[PHASE3_RENDERER_CONTRACT.md](PHASE3_RENDERER_CONTRACT.md) and
[PHASE3_UX_CONTRACT.md](PHASE3_UX_CONTRACT.md). Existing props, camera commands,
graph structures, citations, source versions and intelligence APIs remain compatible.

## Compatibility fixes

1. **Stale Back failure:** a delayed failed memory request from history could
   clear a newer selected memory. A browser regression reproduced the failure
   before the fix. Failed requests now use the same request/workspace guards as
   successful responses, preserving the newer selection and announcement.
2. **Renderer availability:** optional `onStatus(loading | ready | unavailable)`
   reports asset/WebGL failure to the workspace. The status label no longer says
   `3D ANATOMICAL VIEW` after context loss or stays at loading after WebGL failure.
   Existing `onReady` remains available. This is not a camera-settled event.
   The supported context recovery is reload; automatic restoration is not claimed.
3. **Safe-area integration:** the layout declares `viewport-fit=cover`. Header,
   drawer, expanded sheet and landscape offsets include the top safe area in
   addition to Phase 3B's bottom/side insets. Tests use explicit simulated inset
   values; they do not establish physical iOS Safari behaviour.

## Seven proposed renderer enhancements

These are the R1–R7 proposals in the UX contract, distinct from the original
Phase 3A rendering improvements. None is claimed fully implemented by implication.

| Request | Status | Actual support and remaining work |
| --- | --- | --- |
| R1 Hover reporting | Partial | Individual memory hover enlarges its marker and changes the cursor. No `onHover(node)` callback or named scene hover label. |
| R2 Selected screen anchor | Deferred | Selection appears in panels/trail/lists; no projected-pixel callback or attached leader label. |
| R3 Transition settled | Partial | Camera easing and reduced-motion destinations work. No `onSettled(command)`; updating-view state follows graph requests. `onStatus` does not substitute for this. |
| R4 Scene keyboard focus | Partial | Lobes, topics, memories and citations have tested keyboard paths through controls/lists. No focusable 3D nodes or `focusNode` command. |
| R5 Coarse-pointer tolerance | Deferred | Mobile controls and layout work; point raycasting has no enlarged coarse-pointer hit radius. Physical tapping/pinch conflicts remain unverified. |
| R6 Visible-area inset | Partial | Normal panel layouts resize the actual canvas and the renderer refits it; tested in portrait/landscape and desktop. No renderer `inset` prop. |
| R7 Lobe hover/press feedback | Deferred | Active-lobe illumination and accessible controls work, but there is no scene lobe pre-selection hover/press highlight. |

## Validation

The initial unmodified combination passed all 22 browser tests. The added stale
history regression then failed as expected and passed after the guard fix. All
nine updated UX journeys passed together before the final complete-suite run.

Verified application/test code: `700986a4a6a70cfcd575a7e1f2a8858ee274b4a4`.

| Check | Result |
| --- | --- |
| Unit/integration | **77 passed**, zero failures/skips |
| Real PostgreSQL/pgvector | Passed on disposable **PostgreSQL 17.10 / pgvector 0.8.2**; container removed |
| Complete browser suite | **23 passed together**, zero failures/skips, 4.8 minutes |
| TypeScript | Passed |
| Production build | Passed, serially after browser teardown |
| Standalone smoke | All **4** local production-mode groups passed; isolated PGlite removed |
| Anatomy | Passed: **20,484 vertices / 40,960 triangles**, original hashes unchanged |

[Machine-readable evidence](validation/phase3-integration.json). The PostgreSQL
image is not the hosted Supabase 17.11 environment. Expected deliberate WebGL and
error-boundary faults log errors in those tests; normal journeys assert no page
errors. Existing Three.Clock/CommonJS and terminal-colour warnings remain.

**Recommendation: ready for separately approved feature-Preview deployment for
hosted evaluation**, with the performance/device limitations below. No release
or production readiness certification is implied.

Tests use isolated local PGlite and disposable Docker PostgreSQL, never hosted
Supabase. Real PostgreSQL tests exercise driver serialization, persistent vectors,
migration security, immutable citations and workspace isolation. Provider calls
are labelled mock transport: citation/consent/job wiring is tested, live provider
quality is not. Registration limits were not weakened; the complete browser suite
uses ten isolated registrations and reuses accounts within the UX/intelligence files.

## Visual and accessibility evidence

Screenshots in `docs/screenshots/phase3-integration/` show labelled fixture records
and the actual combined renderer. Desktop atlas, selected/linked memory, portrait
sheet, landscape side sheet, simulated safe areas, fallback and Phase 2 intelligence
views were inspected:

- [Desktop atlas](screenshots/phase3-integration/desktop-whole.png),
  [selected memory](screenshots/phase3-integration/desktop-memory.png) and
  [confirmed connection](screenshots/phase3-integration/connected-memory.png).
- [Front](screenshots/phase3-integration/front.png),
  [side](screenshots/phase3-integration/side.png) and
  [three-quarter](screenshots/phase3-integration/three-quarter.png).
- [Portrait sheet](screenshots/phase3-integration/phone-portrait-memory.png),
  [landscape sheet](screenshots/phase3-integration/phone-landscape-memory.png) and
  [simulated safe area](screenshots/phase3-integration/phone-simulated-safe-area.png).
- [WebGL fallback](screenshots/phase3-integration/webgl-unavailable.png) and
  [Phase 2 mock summary](screenshots/phase3-integration/intelligence-mock-summary.png).

The brain remains real FreeSurfer fsaverage5 geometry;
memory points and anatomical scaffold dots remain distinct.

Browser checks cover keyboard `/` and Escape navigation, keyboard source selection,
visible focus outlines, live place announcements, mobile control dimensions,
reduced motion, browser history and access to originals without WebGL. This is
not a complete screen-reader or WCAG certification. Normal portrait sheets leave
a smaller brain visible above the content; expanding the sheet prioritises reading.

## Performance and remaining acceptance

The renderer density benchmark uses a local intercepted graph response with
explicitly labelled synthetic nodes, capped at 1,500 rendered objects for 100,000
represented records. It does not insert records into a hosted workspace. Actual
persisted fixture relationships are separately covered by navigation tests.

Chromium uses SwiftShader software rendering. RAF timings and available GPU timer
query draw sums are instrumented observations, not representative hardware FPS.
GPU draw sums exclude unavailable queries, clears and presentation and can include
partial frames. JS heap is not GPU memory. No paired baseline hardware comparison,
60-FPS certification or sustained GPU-memory/leak claim is made.

| Represented records | Rendered nodes | RAF median / p95 (ms) | Available GPU draw-sum median (ms) | JS heap (MiB) |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 83.4 / 166.7 | 73.8 | 29.2 |
| 100 | 100 | 99.9 / 166.7 | 80.7 | 40.6 |
| 1,500 | 1,500 | 250.1 / 499.9 | 242.4 | 53.6 |
| 100,000 | 1,500 | 300.0 / 566.6 | 274.8 | 31.0 |

The software run **does not meet the 60 FPS target**. This is not a performance
comparison to the earlier layout, whose canvas dimensions differ.

Physical phones, iOS Safari, screen-reader behaviour, on-screen keyboards, pinch/
drag conflicts and real-device performance still require acceptance. Memory/topic
markers retain x-ray visibility while confirmed filaments depth-test against cortex;
internal path segments can be occluded. Native lines are one pixel. Reduced-motion
OS preference is sampled on mount; the explicit application setting is live.

No Production/main change, shared-branch push, deployment, hosted SQL, user-memory
modification, secret replacement or paid API processing was performed. Any Preview
deployment requires separate approval and its own deployed-commit/binding/health
checks. Local acceptance is not hosted acceptance or completion of all R1–R7 work.
