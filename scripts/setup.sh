#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22 or newer is required")'
npm ci --no-audit --no-fund
npm run assets:verify
npm run typecheck
# The application applies its transactional database migration at first startup.
# Do not open a PGlite directory from two processes at once.
