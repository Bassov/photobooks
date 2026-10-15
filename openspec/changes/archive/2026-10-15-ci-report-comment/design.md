# Design

## Context

See proposal.md. Sticky comments today use `marocchino/sticky-pull-request-comment` in `checks.yml`, `lighthouse.yml`, and `stryker-diff.yml`. Summary markdown comes from the existing `scripts/*-summary.mjs` files, which also print a note when the report file is missing, so stdout is not proof a report exists. `stryker-full.yml` only writes a Step Summary.

## Goals / Non-Goals

**Goals:**

- One comment, three sections, status rules from the delta spec
- Serialize writers without queueing the long jobs
- Keep Step Summaries and the mutation HTML artifact

**Non-Goals:**

- Merging the three workflows; a final job that waits for all of them; changing Codecov or Cloudflare comments

## Decisions

1. **State is base64 JSON in an HTML comment; the visible body is rendered from it and never parsed.** Markers use `indexOf`. Parsing `<details>` (trial PR #25) nests wrappers and drops status stored outside the parsed span.

2. **Each workflow keeps its long job and adds a short `ci-comment` job** that runs only on `pull_request` (checks and Lighthouse also run on `main`, where there is no PR number). On a pull request it uses `needs` on the long job and `if: always()` except when that job was `cancelled`, plus

   ```yaml
   concurrency:
     group: ci-report-${{ github.event.pull_request.number }}
     queue: max
   ```

   Do not set `cancel-in-progress: true` with `queue: max`. Workflow groups stay unique via `github.workflow`. The long job uploads section JSON on `if: always()` even with no report file: step outcome, whether a report was expected, and summary markdown when present. `ci-comment` checks out the PR, runs Node only (no install), and merges that artifact. A missing artifact is Job failed only when the long job failed, was skipped, or the upload did not run. Retrying PATCH cannot replace the queue: the API has no compare-and-swap.

3. **Before PATCH, compare the run's pull-request head SHA to the live pull-request head.** Mismatch, including a cancelled run that still reaches the script, exits without writing. The first writer creates Waiting for the other two sections.

4. **Classification uses the artifact, not summary stdout.** Report files: `.lighthouseci/lhr-*.json`, `reports/mutation/mutation.json`, `coverage/coverage-summary.json`. File present and step success → Job succeeded, Check passed. File present and step failure → Job succeeded, Check failed, details from the existing summary script. Mutation success with no file → Skipped. Lighthouse or coverage success with no file → Job failed (a report was expected). No file and step failure or skip → Job failed. No details except Job succeeded.

5. **After a successful write, delete comments whose sticky header is `lighthouse-ci`, `stryker-mutation`, or `coverage-summary`.** Leave Codecov and Cloudflare comments.

6. **Composition.** Pure functions live in `scripts/ci-report-comment.mjs`: `classifySection`, `upsertSection`, `renderComment`, `encodeState`, `decodeState`, `shouldWrite`. The CLI is the only GitHub I/O. Tests call those functions with inline inputs and add no shared fixture module. Vitest `include` adds `scripts/**/*.test.mjs`; `coverage.include` stays `src/**`.

## Touch-set

- `scripts/ci-report-comment.mjs`, `scripts/ci-report-comment.test.mjs`
- `vite.config.ts` — test include only
- `.github/workflows/checks.yml`, `lighthouse.yml`, `stryker-diff.yml`
- `openspec/specs/ci-gates/spec.md` — sync on archive

## Risks / Trade-offs

- [Job-level concurrency does not cancel with the workflow group] → head SHA check refuses a superseded run
- [Upload never runs] → missing artifact is Job failed only if the long job failed or was skipped; a successful empty mutate set is Skipped inside the artifact
- [Two pull requests] → the concurrency group includes the PR number

## Migration Plan

Ship on a new branch. Do not continue PR #25. After the new PR is open, close #25 as superseded. Rollback is restoring the three sticky steps and removing `ci-comment`.
