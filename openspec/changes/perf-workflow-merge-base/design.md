## Decisions

1. Root cause: `git fetch --depth=1 origin <base>` after `fetch-depth: 0` makes the base tip shallow, so `<base>...HEAD` has no merge base. `perf.yml` and `integration.yml` (burn-in targets) drop `--depth=1`.
2. `node … scope | tee` lost the script's exit code (`bash -e`, no pipefail), so the grep fell through to "not in scope". The step now captures `scope=$(node …)` (fails under `-e`), then appends it to `$GITHUB_OUTPUT`.
3. `perf-lane.mjs scope` catches the git error, prints `perf-lane scope: cannot diff <base>...HEAD: <git stderr>` and returns 1. The verdict's `prChangedFiles` keeps its null fallback (null only narrows forgiveness: the stricter side).
4. Only `perf.yml` and `integration.yml` use `--depth=1`; `checks.yml`, `stryker-diff.yml`, `unit-changed.mjs` are safe.

## Touch-set & Test Plan

| Path                                | Reason                                     |
| ----------------------------------- | ------------------------------------------ |
| `.github/workflows/perf.yml`        | full base fetch; scope failure fails       |
| `.github/workflows/integration.yml` | full base fetch (same bug)                 |
| `scripts/perf-lane.mjs`             | scope returns 1 on git failure             |
| `scripts/perf-lane.test.mjs`        | temp repos: in/out, no merge base, bad ref |

- Reuse: script CLI via `spawnSync`, temp repos in `os.tmpdir()` (as `roadmap-done.test.mjs`).
- Tests: unit only; no e2e / PBT.
