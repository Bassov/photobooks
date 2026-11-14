## Implementation

- [x] 1. `scripts/e2e-related.mjs`: hunk id extraction, e2e consumer index with fixture propagation, rank/cap/flaky selection, runner + `--list`, sunset header. (commit 8777d521)
- [x] 2. `scripts/e2e-related.test.mjs`: hunk-only extraction, template prefix, cap ordering, flaky skip, `main` paths. (18 tests)
- [x] 3. `package.json` `test:e2e:changed:quiet` runs the related step after the rig set.
- [x] 4. `docs/agent-loop.md` B row + stage 4 line.
- [x] 5. Replay harness: `--range <a>..<b>` (with `--list`) replays a past diff. (#579/#591/#608 replays in the PR body)

## Manual test scenarios

N/A (agent tooling; no app UI). Evidence = replay table in the PR body.
