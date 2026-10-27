# Echo project guidance

Read `README.md`, `docs/IMPLEMENTATION.md` and `docs/VALIDATION.md` before resuming.
The full product brief is preserved in `docs/PRODUCT_BRIEF.md`. Keep implemented,
mock-tested, live-verified and planned features distinct.

- Use the existing checkout. Cloud tasks are isolated; create no Git worktree
  unless the user explicitly requests one.
- The anatomy is verified FreeSurfer fsaverage5 geometry. Preserve its topology,
  source annotations and licences; verify with `npm run assets:verify`.
- Never seed unlabelled fake memories or draw random edges as if they were data.
- Keep original source versions. Import replay must remain idempotent.
- Keep provider secrets server-side. Inspect variable presence, never values.
- Tests must use isolated databases. Never point test fixtures at a user's
  configured `DATABASE_URL` or open a running PGlite directory from another process.
- For relevant changes, run core tests and TypeScript checks; use the existing
  browser journeys for interaction/persistence changes. Inspect actual renders
  after visual changes. Record remaining limitations in the checkpoint docs.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
