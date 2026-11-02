# worker-ctx-trim

Tag: lite
Milestone: P2
Title: worker-ctx-trim: compact preflight output and a short must-read for unattended workers

Process item P-20261102-1617-ctx (Owner 2026-11-02: workers hit the 200K context BREAK; largest single outputs were the whole `docs/agent-loop.md` Read, `pnpm agent preflight --json`, whole-dir `cat`, unbounded `sed -n` / `grep -rn`).

## Scope

- [ ] `pnpm agent preflight` text output is a compact run card (≤40 lines): goal clipped, skips counted, artifact rules behind `pnpm agent instructions <id>`; `--verbose` prints everything; `--json` unchanged. Deferred: the rig change (ts-agent-rig `feat/preflight-compact` 97941e0, v0.2.21) is not published yet; this PR keeps the `#v0.2.20` pin.
- [ ] `docs/agent-loop.md`: a short top section (≤40 lines) that is all an unattended worker must read; the rest by heading on demand.
- [ ] The unattended runner (`.cursor/commands/next-roadmap-item.md`, Claude wrapper `.claude/commands/`) points to that section only and adds the output-capping rules: ranged reads, capped grep/test output, no whole-directory `cat`.
- Off limits: `src/`, PERF_BUDGETS, quality gate thresholds, photobooks-orch.
- **Done when:** preflight output in a fresh worktree ≤40 lines / ≤3K chars, and the runner's start-up reads (AGENTS.md + command + must-read) total ≤ half of today's chars (before/after numbers in the PR body); `pnpm agent preflight` still works for the launcher.
- **Browser check:** N/A (process docs; no product code).
