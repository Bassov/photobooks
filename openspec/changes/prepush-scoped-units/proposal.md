## Proposal

Roadmap: `docs/roadmap/P5/prepush-scoped-units.md` (scope / Done when / Browser / Perf SoT). Success: its Done-when.

### Scope out

- `ts-agent-rig` hook and `lefthook.yml` (unchanged).
- `.github/workflows/checks.yml` and CI numRuns.
- Hard-coded per-test `numRuns` in `src/**`.

### Delta / Risk

- Local `check:fast` misses failures outside the diff's import graph; CI's full run catches them.
- Gate config: local unit step drops global coverage thresholds; `patch-coverage` and CI unchanged.
