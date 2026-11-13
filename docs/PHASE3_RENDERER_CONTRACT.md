# Phase 3A renderer integration contract

Base: `5d35bceae979df03a11c135bfa24d211b698e2b5`.
Branch: `feat/phase3a-brain-renderer`. Local implementation only.

## Public interface

`Brain` props and `ViewCommand` are unchanged. Claude can retain all existing
workspace controls, callbacks, CSS and panel components. No migration, provider,
authentication or graph API change is required.

- Commands: reset/front/side/quarter, region, topic and memory. Increment `key`
  to repeat a command; supply the existing position or region as appropriate.
- Quality: low samples half the atlas points at DPR 1; balanced/full samples at
  DPR up to 1.5; high/full samples at DPR up to 2. No postprocessing dependency.
- Reduced motion: immediate camera destinations; orbit damping disabled. No
  animated pulses, simulated reasoning or automatic rotation were introduced.
  The surrounding workspace samples the OS preference on mount; its explicit
  setting updates the prop live. Automatic OS preference changes after mount are
  outside this renderer patch.
- Graph nodes remain real memories, declared spatial aggregations or explicit tag
  topics. Marker scale reflects count; selection and hover enlarge individual
  glyphs. The surrounding library supplies keyboard-equivalent selection.
- Only confirmed graph edges with both endpoints present draw. Selected-memory
  views restrict edges to incident relationships. Colours interpolate between
  existing endpoint lobe colours; no semantic relationships are inferred here.

## Rendering implementation

The unchanged FreeSurfer fsaverage5 mesh supplies positions, normals, regions and
hemisphere topology. A depth prepass prevents far-side cortical colour bleed. A
translucent shader uses directional normal lighting and restrained Fresnel rim
illumination to expose folds. Authentic vertex points remain a separate,
noninteractive layer. Focus is a shader uniform: choosing a lobe does not rebuild
its geometry. Neutral anatomical regions retain their original classification.

Instanced memory halos use a smooth camera-facing falloff rather than uniformly
lit spheres. Their shader explicitly tolerates the initial frame before Three.js
has an instance-colour attribute. Existing x-ray memory/topic markers remain
selectable through cortex; this is an interface convention, not biological depth.
Confirmed filaments now use one line-segment buffer/draw rather than one wide-line
object per edge. The fixed 24-segment curves remain derived from actual endpoints.
Filaments depth-test against the cortex, so interior segments can be hidden.

Camera destinations retain the previous framing and navigation contract. The
minimum orbit radius conservatively accounts for the cortex and target offset;
maximum distance is increased for portrait framing. Coincident desired/target
vectors have a finite fallback. This is bounding-sphere clearance, not a
triangle-level collision system.

## Failure handling and ownership

The loader validates the v1 binary's positions, indices, region and hemisphere
array lengths. It does not substitute geometry after failure. Asset fetch failure,
WebGL creation failure and context loss retain the ordinary memory library.
Context loss requests a reload; automatic context restoration is not claimed.
Owned point/line geometries and context listeners are disposed on teardown;
late asset-load rejection cannot set state after unmount. No global error handler
or scene-specific keyboard interception was added.

Changes are confined to the renderer/camera, new renderer helpers/tests and this
documentation. No edits to workspace.tsx, globals.css, memory-intelligence UI,
authentication, providers or migrations belong to this patch.

## Limits

This is a research atlas cortex, not a clinical tool or a complete anatomical
brain (no newly invented brainstem/cerebellum). Lobe knowledge categories remain
metaphorical. Halos provide local glow without expensive full-screen bloom.
Native WebGL line widths remain one pixel and interior paths are occluded.
No temporal edge animation is added without a genuine directional activity event.
GPU hardware certification and a measured 60-FPS claim require representative
physical devices. Software Chromium measurements are described separately in
PHASE3_RENDERER_VALIDATION.md.
