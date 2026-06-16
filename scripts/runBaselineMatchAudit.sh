#!/bin/bash
# Run automated baseline match audit (May 31 – June 14 before 1 AM).
# Report: docs/chat-history-recovery/reports/baseline-match-*.txt
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/baselineMatchAudit.mjs "$@"
