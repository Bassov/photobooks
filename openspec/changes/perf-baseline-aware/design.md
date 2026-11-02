## Decisions

1. Push runs on main write `perf-runs/verdict.json` (`{ red: [scenario key] }`) and upload it as artifact `perf-verdict`.
2. On `pull_request`, a `continue-on-error` step takes the newest completed push run on the base branch with conclusion success or failure (cancelled runs carry no verdict) and `gh run download`s `perf-verdict`. Any failure → no file → no baseline.
3. Pure `classify(scenario, base, changed)` in `scripts/perf-baseline.mjs` → `pre-existing` | `touched` | `new` | `no-baseline`; only `pre-existing` is forgiven. Unknown changed files → `no-baseline`.
4. Touched = the PR changes the scenario's spec, a shared perf source (`SHARED_SOURCES`) or the spec's source list; thumb/filmstrip specs have a narrow list, all others use any `src/`.
5. Forgiven scenarios go to stdout and the step summary as `pre-existing on main (<run url>)`; missing reports still fail.
6. Security: `actions: read` only (read-only token); the artifact comes from our own main run and is parsed as JSON data.

## Touch-set & Test Plan

| Path                             | Reason                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `scripts/perf-baseline.mjs`      | decision module                                                                            |
| `scripts/perf-lane.mjs`          | `verdict --base/--base-url/--base-ref/--out`; `judge` returns red scenarios                |
| `.github/workflows/perf.yml`     | gate config: verdict upload, base download, `actions: read`; thresholds and runs unchanged |
| `scripts/perf-baseline.test.mjs` | 4 decision cases + dry-run fixture (vitest)                                                |
| `docs/agent-loop.md`             | one sentence on the pre-existing rule                                                      |
| `scripts/perf-lane.test.mjs`     | `collectScenarios` rows carry the spec path                                                |
