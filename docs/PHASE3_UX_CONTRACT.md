# Phase 3B — brain experience: navigation and renderer contract

Base commit: `5d35bce`. Branch: `feat/phase3b-brain-experience`. Frontend only.

Not modified: `components/brain.tsx`, `lib/brain-camera.ts`, `lib/anatomy.ts`, backend
retrieval and intelligence logic, migrations, provider integrations, API routes. The `Brain`
props and `ViewCommand` type are used exactly as they were.

## 1. Navigation model

`lib/exploration-trail.ts` is the single record of where the reader has been. The breadcrumb,
the in-app Back control and the browser's Back/Forward all read it.

| Place       | Reached by                                                       | Level shown      |
| ----------- | ---------------------------------------------------------------- | ---------------- |
| Whole brain | Start, breadcrumb, Reset view                                    | 01 / WHOLE BRAIN |
| Lobe        | Sidebar, lobe chips, overview cards, double-click on the surface | 02 / LOBE        |
| Topic       | Topic ring on the canvas, topic list                             | 03 / TOPIC       |
| Memory      | Point on the canvas, any list, a citation, a link                | 04 / MEMORY      |
| Results     | Asking a question                                                | SEARCH RESULTS   |

Rules:

- Arriving somewhere new appends an entry and calls `history.pushState`. The URL does not change.
- A new passage or version of the memory already open updates its entry; it does not add one.
- Back (button, `Escape`, browser Back, phone back gesture) returns to the previous entry and
  restores its lobe, topic, memory or exact result set. Results are not fetched again.
- "Close memory" keeps its existing meaning: go up to the lobe or topic the memory was opened
  from. That is recorded as a new entry, so Back returns to the memory.
- Sign-out and session end reset the trail. Browser entries from an earlier run or account are
  ignored, not replayed.
- Library filters (search text, source, dates) are not part of a place and are left as they are.

Keyboard: `/` focuses the question field; `Escape` goes back one place, or leaves a field, or
closes the phone drawer. Shortcuts are ignored while a dialog is open or a field has focus.

## 2. What the surrounding interface sends to the renderer today

Unchanged `Brain` props: `graph`, `selected`, `region`, `command`, `quality`, `reducedMotion`,
`onSelect`, `onRegion`, `onReady`.

Integration adds optional `onStatus(loading | ready | unavailable)` and the workspace
uses it for its scene-status label. It reports resource availability, not R3's
camera-settled event. Existing props and camera commands remain compatible.

| Interaction                | Command sent                   |
| -------------------------- | ------------------------------ |
| Whole brain, reset         | `{ type: 'reset' }`            |
| Enter or return to a lobe  | `{ type: 'region', region }`   |
| Enter or return to a topic | `{ type: 'topic', position }`  |
| Open or return to a memory | `{ type: 'memory', position }` |
| View buttons               | `front`, `side`, `quarter`     |

The canvas container (`[data-testid="brain-viewport"]`) changes size when context opens:

- Desktop: the grid column narrows or widens when the context panel is shown or hidden.
- Immersive with a memory open: the container's right edge moves in by the floating panel.
- Phone portrait: the container's bottom edge rises above the sheet.
- Phone landscape: the container's right edge moves in beside the side sheet.

The renderer must keep fitting the anatomy to its container on resize, as it does now. The
interface never covers the container with a panel.

CSS custom property available to the renderer's overlays: `--place` on `.viewport` holds the
colour of the active lobe (or the neutral blue).

## 3. Renderer capabilities requested (not implemented here)

Each is something the interface cannot do without changing `components/brain.tsx`. None is
faked in this patch.

| #   | Capability                       | Proposed addition                                                                             | Used for                                                                                   |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R1  | Hover reporting                  | `onHover(node)` called with a `GraphNode`, or `null` when the pointer leaves                  | A label naming the memory or topic under the pointer. Today hover only changes the cursor. |
| R2  | Screen position of the selection | `onAnchor(point)` with `{ x, y }` in container pixels, or `null`, updated as the camera moves | A leader line or label attached to the selected point                                      |
| R3  | Transition settled               | `onSettled(command)` when the camera has arrived                                              | Ending the "updating view" state when the camera has arrived, not only when data has       |
| R4  | Keyboard focus in the scene      | Focusable memory and topic nodes, or a `focusNode(id)` command                                | Selecting a point without the lists. Today the lists and lobe chips are the keyboard path. |
| R5  | Tap tolerance on touch           | A larger hit radius for coarse pointers                                                       | Reliable selection of small points on phones                                               |
| R6  | Visible-area inset               | An `inset` prop with `top`, `right`, `bottom`, `left`                                         | Centring the anatomy in the unobscured area without resizing the canvas                    |
| R7  | Lobe hover and press feedback    | Highlight of the lobe under the pointer before double-click                                   | Showing that a lobe is clickable                                                           |

Until R1–R7 exist the interface behaves as follows: no hover label; selection is shown in the
panel, trail and lists; loading state follows data requests; lobes are entered from chips,
cards, the sidebar or a double-click.

## 4. Layout requirement outside this patch's files

`env(safe-area-inset-*)` is used for the bottom navigation, sheet and side rail. It resolves to
zero until the page's viewport declares `viewport-fit=cover`, which belongs in
`app/layout.tsx`. That file is outside this phase's ownership and was not changed.

Resolved during local integration: `app/layout.tsx` now declares `viewportFit: 'cover'`.
The header, drawer, expanded sheet and landscape rail/sheet also account for the
top inset. Browser checks include simulated top/bottom inset values; physical
iOS Safari and keyboard/safe-area behaviour still require device acceptance.

## 5. Limits

- All browser checks ran in headless Chromium with software rendering, at 1600×1000, 390×844
  and 844×390. No physical phone, no iOS Safari, no on-screen keyboard was tested.
- Touch was not simulated beyond layout and `touch-action`; pinch and drag conflicts on real
  devices are unverified.
- Hover feedback covers the interface controls only (see R1, R7).
- Focus is not moved when the place changes; the new place is announced through a polite live
  region instead.
- The trail lives in memory. Reloading the page starts again at the whole brain.
- The typeface is the system UI stack; no web font is loaded.
