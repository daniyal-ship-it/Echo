# Phase 2B — memory intelligence experience (frontend)

Integration follow-up: see [Phase 2A + 2B validation](PHASE2_INTEGRATION.md). The
combined branch preserves optional speaker/certainty metadata, clarifies that
request estimates exclude retries, and adds a passing route-boundary retry test.
The six-test report below describes the original frontend patch; the integrated
suite has seven intelligence UX journeys and thirteen browser tests in total.

Base commit: `9efffe2`. Frontend only. No change to `lib/intelligence.ts`, `lib/retrieval.ts`,
migrations, API routes, backend tests or the mock provider fixture. No API response changed.

## What changed

| Area               | Change                                                                                                                                                                                  | Files                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Processing states  | One plain-language state with its meaning, the saved server status beside it, and the four real stages with counts                                                                      | `components/memory-intelligence.tsx`, `lib/intelligence-view.ts`             |
| Preview vs AI      | The extractive preview is plain, dashed and labelled "not AI-generated"; published analysis is labelled "AI-generated" with provider, model, time and prompt version                    | `components/memory-intelligence.tsx`, `components/panels.tsx`                |
| Evidence           | Every claim shows its quoted evidence inline; each cited passage has one number across summary, decisions, questions and commitments                                                    | `components/memory-intelligence.tsx`                                         |
| Passage navigation | The cited passage is highlighted inside the original, with back-to-summary, previous/next cited passage and a fixed version reference                                                   | `components/source-passage.tsx`, `components/panels.tsx`                     |
| Connections        | Confirmed links, suggestions from explicit tags/references, and links inferred from meaning are three separate groups                                                                   | `components/memory-connections.tsx`                                          |
| Consent and cost   | A disclosure of what is sent, who receives it, what it may cost and what is kept; request upper bounds from the saved job                                                               | `components/memory-intelligence.tsx`                                         |
| Faults             | Section boundaries keep a rendering fault inside the inspector; a route-level error screen replaces the framework default                                                               | `components/error-boundary.tsx`, `app/error.tsx`, `components/workspace.tsx` |
| Accessibility      | Live state announcements, labelled progress, focus moved to cited passages, pressed-state tabs, 40px touch targets on phones, reduced-motion support for the system and in-app settings | `app/globals.css`, components above                                          |

## State mapping

Derived only from the existing `GET /api/intelligence` response and whether this open panel is
running steps.

| Shown            | Condition                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Not processed    | No job for the viewed version                                                                                                                  |
| Queued           | Job `queued` with no passage indexed or analysed                                                                                               |
| Running          | This panel is running steps, or a `running` job still holds a live lease                                                                       |
| Waiting to retry | Job `retry_wait`                                                                                                                               |
| Paused           | Job in progress with saved progress, not being run here                                                                                        |
| Completed        | Job `completed`                                                                                                                                |
| Failed           | Job `failed`                                                                                                                                   |
| Needs review     | Job `uncertain`; retry stays disabled until the charge acknowledgement is ticked                                                               |
| Cancelled        | Job `cancelled`                                                                                                                                |
| Outdated         | Job `superseded`; or an earlier version is being viewed; or the latest version is unprocessed while an earlier version has a published summary |

"Paused" and "Queued" are presentation states. The backend has no paused status.

## Verification

- `tests/intelligence-view.test.ts`: unit tests for the state, stage, numbering, grouping and
  highlight logic.
- `tests/browser/intelligence-experience.spec.ts`: six browser tests. Tests titled REAL drive
  the unmodified backend through the isolated mock provider transport. Tests titled STUBBED or
  AUGMENTED replace only the browser's `GET /api/intelligence` (or one memory) response to reach
  states the mock transport cannot produce; their data is labelled as test data.
- The four pre-existing browser specs pass unchanged.

## Limits and what was not done

- No live provider call was made. Everything was exercised with the mock transport.
- Costs are stated as request counts and limits. ECHO has no price data, so no amount is shown.
- Failed, waiting, needs-review, paused-with-progress and running-elsewhere states were verified
  with stubbed responses only; they were not produced by a real backend failure.
- The route-level error screen (`app/error.tsx`) follows this Next.js version's `retry`
  convention but has no browser test; the section boundaries are tested.
- An earlier-version summary is looked up with up to three extra `GET /api/intelligence`
  requests, only when the latest version has no job and no analysis.
- The publication dot on the Intelligence tab reflects the opened memory snapshot until the
  Intelligence section has loaded once.
- The browser suite now registers eight accounts; the server allows ten per fifteen minutes.
- Screenshots are written to `test-results/phase-2b/` and are not committed.
