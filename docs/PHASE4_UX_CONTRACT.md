# Phase 4B — collaboration experience: frontend API contract

Base commit: `256a036`. Branch: `feat/phase4b-collaboration-ux`. Frontend only.

This is what the collaboration interface sends and what it needs back. It was written before
the Phase 4A backend existed and was exercised only against a mock
(`tests/fixtures/collaboration-mock.ts`). **Nothing here is confirmed by the real backend.**
Reconcile it at integration; the two files to change are `lib/collaboration-client.ts`
(transport) and `lib/collaboration-view.ts` (reading and presentation). TypeScript shapes are in
`lib/collaboration-types.ts`.

Not modified: `lib/providers.ts`, `lib/retrieval.ts`, `lib/intelligence.ts`, API routes,
migrations, security and authentication internals, `components/brain.tsx`, anatomy, shaders.

## 1. Endpoints

All are same-origin, use the existing session cookie and the existing origin check, and return
JSON. Errors use the existing `{ "error": "message" }` body.

| Endpoint                               | Request body                                            | Success             |
| -------------------------------------- | ------------------------------------------------------- | ------------------- |
| `GET /api/collaborations`              | —                                                       | `200` List          |
| `POST /api/collaborations`             | `{ task, mode, consent: true, filters? }`               | `201` Collaboration |
| `GET /api/collaborations/:id`          | —                                                       | `200` Collaboration |
| `POST /api/collaborations/:id/advance` | `{ action: "continue" \| "retry", acknowledgeCharge? }` | `200` Collaboration |
| `POST /api/collaborations/:id/cancel`  | `{}`                                                    | `200` Collaboration |
| `POST /api/collaborations/:id/turns`   | `{ prompt, consent: true }`                             | `200` Collaboration |

`mode` is `"parallel"` or `"deliberate"`. `filters` is the same optional library scope object
the existing `POST /api/assistant` accepts.

## 2. Behaviour the interface relies on

1. **Creating does not bill.** `POST /api/collaborations` records consent and saves the run as
   `queued`. No provider request is made until `advance`.
2. **`advance` performs at most one stage** and returns the saved collaboration. The interface
   calls it repeatedly only while the status is `queued` or `running`, only for a run the reader
   started or resumed in this window, and only while that run is open.
3. **The server does no background work.** A `queued` or `running` run that no window is
   advancing stays where it is. The interface shows it with a "Resume run" control.
   _If the backend instead advances by itself, the "Resume run" control and the sentence "This
   window is not advancing the run" must be removed and replaced by polling `GET`._
4. **`awaiting_continuation`** means the next stage needs an explicit `advance` with
   `action: "continue"`. The interface never sends that without a click.
5. **`needs_review`** means a provider request's billing outcome is unknown. The interface
   sends `advance` with `action: "retry"` only with `acknowledgeCharge: true`, after the reader
   ticks an acknowledgement. The server should refuse a retry without it (`409`).
6. **A failed request is never repeated by the interface.** After any failed `advance`, it
   stops, shows the error and reads the saved state with `GET`.
7. **`cancel`** stops further stages. The interface tells the reader that a request already
   with a provider may still finish and be billed.
8. **`turns`** is accepted only when `canFollowUp` is `true`. The new turn is saved as `queued`.
9. **Citations** use the existing `Citation` shape (`id`, `title`, `excerpt`, `source`,
   `region`, optional `version`, `chunkId`). The interface opens them with the existing
   `GET /api/memories/:id?version=&passage=`, so `id`, `version` and `chunkId` must refer to real
   saved originals and passages in the reader's workspace.

## 3. Collaboration

| Field                      | Type                       | Used for                                            |
| -------------------------- | -------------------------- | --------------------------------------------------- |
| `id`                       | string                     | Addressing, history                                 |
| `task`                     | string                     | Title, history                                      |
| `mode`                     | `parallel` \| `deliberate` | Mode label                                          |
| `status`                   | see Statuses               | State card, controls                                |
| `participants[]`           | `{ provider, model }`      | Model chips, tabs, lane order                       |
| `limits.maxProviderCalls`  | number                     | "N of at most M provider requests used"             |
| `limits.usedProviderCalls` | number                     | Same                                                |
| `canFollowUp`              | boolean                    | Shows the follow-up form                            |
| `savedMemoryId`            | string \| null (optional)  | "Open the memory saved from this collaboration"     |
| `createdAt`, `updatedAt`   | ISO string                 | Display; `updatedAt` must change on every `advance` |
| `turns[]`                  | Turn                       | Everything below                                    |

`provider` is `"openai"` or `"anthropic"`. Any other value is refused by the interface.

### Statuses

| Value                   | Shown as              | Controls offered                           |
| ----------------------- | --------------------- | ------------------------------------------ |
| `queued`                | Queued                | Resume run (if not advancing here), Cancel |
| `running`               | Running               | Resume run (if not advancing here), Cancel |
| `awaiting_continuation` | Awaiting continuation | Continue to next stage, Cancel             |
| `completed`             | Completed             | Follow-up, when `canFollowUp`              |
| `failed`                | Failed                | Retry stage                                |
| `needs_review`          | Needs review          | Retry stage, after acknowledgement         |
| `cancelled`             | Cancelled             | —                                          |

An unrecognised status, stage, step status or provider makes the interface show "ECHO could not
read the collaboration returned by the server" instead of rendering it.

### Turn

| Field                    | Type           | Used for                                      |
| ------------------------ | -------------- | --------------------------------------------- |
| `id`, `index`            | string, number | Turn selector                                 |
| `prompt`                 | string         | "Your task"                                   |
| `status`                 | status         | Empty-result wording                          |
| `createdAt`, `updatedAt` | ISO string     | —                                             |
| `steps[]`                | Step           | Workflow lanes and the live activity sentence |
| `messages[]`             | Message        | Per-model output                              |
| `citations[]`            | `Citation`     | Sources tab; targets of citation numbers      |
| `result`                 | Result \| null | Combined result                               |
| `error`                  | string \| null | Alert                                         |

### Step (saved orchestration stage)

`{ id, stage, provider?, model?, status, startedAt?, completedAt?, error? }`

- `stage`: `preparing_context` \| `analysis` \| `cross_review` \| `synthesis`
- `status`: `pending` \| `running` \| `succeeded` \| `failed` \| `uncertain` \| `skipped` \| `cancelled`
- `provider` is null for stages no model performs.

Labels are derived from these two fields, in the tense the status supports: `analysis` +
`openai` + `running` reads "GPT analysing"; `succeeded` reads "GPT analysed"; `pending` reads
"GPT analysis". The interface shows a step as in progress only when its saved status is
`running`.

### Message

`{ id, stage, provider, model, reviewOf?, text, createdAt, usage?, citations? }`

- `stage`: `analysis` \| `cross_review` \| `synthesis`
- `reviewOf`: for `cross_review`, the provider whose analysis is reviewed.
- `usage`: `{ inputTokens, outputTokens }` or null. When null the interface says "token usage
  not reported" and shows no number.
- `citations`: 1-based numbers into the turn's `citations`. Numbers with no matching source
  are dropped.

### Result

```
{
  jointConclusions: [{ text, citations? }],
  disagreements:    [{ topic, positions: [{ provider, text }], citations? }],
  openQuestions:    [{ text, citations? }],
  unverified:       [{ text, citations? }]
}
```

All four lists are required (empty lists are fine). The interface shows them as four separate
sections and adds a notice when `disagreements` or `openQuestions` is non-empty. It does not
merge them into one answer. A completed turn with `result: null` is shown as "finished without
a combined result".

## 4. List

`{ collaborations: Summary[], modes? }`

- Summary: `{ id, task, mode, status, participants, turnCount, createdAt, updatedAt }`
- `modes` (optional): `{ parallel: { maxProviderCalls }, deliberate: { maxProviderCalls } }`.
  When present the composer says "At most N". When absent it says "About N", using the planned
  sequence: 3 for parallel (two analyses, one synthesis), 5 for deliberate (two analyses, two
  cross-reviews, one synthesis).

## 5. Errors the interface distinguishes

| Condition                                        | Shown as                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `404` with `Endpoint not found.` (today's state) | "The collaboration service is not available on this server yet." |
| Network failure                                  | "ECHO could not reach the server", and no automatic repeat       |
| `401`                                            | The existing session-ended handling                              |
| Other `4xx`                                      | The server's `error` text                                        |
| `5xx` or a non-JSON body                         | The server's `error` text, or a generic failure                  |
| Response outside this contract                   | "ECHO could not read the collaboration returned by the server"   |

## 6. Questions for the backend

1. Does `advance` run one stage per request, or does the server run stages itself?
2. Does a deliberate run pause (`awaiting_continuation`) before cross-review, or run through?
3. Is `maxProviderCalls` enforced per run or per turn? The interface shows the run total.
4. Does retrieval add an embedding request, and is it counted in `usedProviderCalls`?
5. Which model writes the synthesis, and is that fixed or chosen per run?
6. Is the conversation saved as a memory, and when is `savedMemoryId` set?
7. Is there a server-side limit on turns per collaboration?

## 7. Limits of this phase

- No test here ran against the real collaboration backend. Every collaboration test is a
  mock-contract test, except one that shows the real server's current "not available" reply.
- The mock always uses the models `mock-openai-model` and `mock-anthropic-model` and writes
  text labelled `[MOCK …]`. It is in `tests/fixtures/` and is not part of the application.
- Stages advance only while the collaboration is open in a window. Opening a cited memory
  leaves the run paused until the reader returns and resumes.
- The collaboration list is fetched whole; there is no paging.
- A reload starts at the whole brain. Saved collaborations are reopened from "Collaborations".
