## Decisions

1. **Duration-balanced file shards, not `--shard`.** `--shard` splits by test count, which is lopsided here (reader-gl specs ~27 s a test). `scripts/e2e-shard.mjs pick` weights each listed file by `scripts/e2e-shard-durations.json` (unknown files: tests × recorded mean) and assigns longest-first. Whole files keep serial describes and `beforeAll` state together. `verify` in `e2e-report` fails on a dropped or extra file.
2. **N=10 × 2 workers**: fewer, wider shards respect the 20-job concurrency limit.
3. **Build per shard**: the webServer always rebuilds with coverage; the old pre-build step was redundant.
4. **Coverage**: per-shard `nyc merge` (raw dumps are ~8 GB), then `coverage:e2e` in `e2e-report`.
5. **Reports**: blob per shard → `merge-reports --reporter=html,json` into the same `e2e-results` / `playwright-report` artifacts; `integration` and ci-comment need `e2e-report`.

## Touch-set & Test Plan

| Path                                   | Why                               |
| -------------------------------------- | --------------------------------- |
| `.github/workflows/integration.yml`    | shard matrix, `e2e-report`, needs |
| `scripts/e2e-shard.mjs`                | pick / verify / record            |
| `scripts/e2e-shard.test.mjs`           | unit tests                        |
| `scripts/e2e-shard-durations.json`     | recorded per-file seconds         |
| `e2e/fixtures/generate-large-jpeg.mjs` | atomic write (2 workers race)     |

- Tests: unit (split, ties, every file once, filter anchoring, verify gaps, CLI). Local smoke: filters list all tests once; blob merge → `e2e-summary`; merged lcov identical. CI: the PR's run.
