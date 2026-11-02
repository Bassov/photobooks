# rig-bump-0-2-21

Tag: lite
Milestone: P2
Title: rig-bump-0-2-21: bump ts-agent-rig to v0.2.21 (compact preflight run card)
Status: done

Process item P-20261102-1617-ctx, rig part (docs part: #397 worker-ctx-trim). Bassov/ts-agent-rig#11 → tag v0.2.21 (97941e0).

## Scope

- [x] `package.json` + `pnpm-lock.yaml`: `@albasov/ts-agent-rig` `#v0.2.20` → `#v0.2.21` (same GitHub-tag spec; no rig dependency changes).
- [x] `docs/agent-loop.md`: the preflight reference line names the compact card and `--verbose`.
- Off limits: `src/`, `e2e/`, the rig itself; files owned by remove-cursor-support beyond that one line.
- **Done when:** default `pnpm agent preflight` prints a compact run card ≤40 lines; `--verbose` prints the full card; all CI checks green; PR body lists before/after line + char counts.
- **Browser check:** N/A (agent tooling; no product code).
