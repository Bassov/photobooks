## Implementation

- [ ] 1. `scripts/e2e-related.mjs`: hunk id extraction, e2e consumer index with fixture propagation, rank/cap/flaky selection, runner + `--list`, sunset header.
- [ ] 2. `scripts/e2e-related.test.mjs`: hunk-only extraction, template prefix, cap ordering, flaky skip, `main` paths.
- [ ] 3. `package.json` `test:e2e:changed:quiet` runs the related step after the rig set.
- [ ] 4. `docs/agent-loop.md` B row + stage 4 line.
- [ ] 5. Replay harness: `--range <a>..<b>` (with `--list`) replays a past diff.

## Manual test scenarios

N/A (agent tooling; no app UI). Evidence = replay table in the PR body.
