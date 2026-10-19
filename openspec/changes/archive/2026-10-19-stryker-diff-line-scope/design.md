# Design

## Context

`stryker-diff` today takes ACMR paths vs `STRYKER_DIFF_BASE` / `origin/main` and passes whole files to Stryker `--mutate`. Stryker already supports mutation ranges (`path:startLine-endLine`). Thresholds stay in `quality/gates.json` (unchanged). Helpers that decide the mutate set and NoCoverage live in `stryker-diff-gate.mjs` (unit-tested, in mutation scope).

## Goals / Non-Goals

**Goals:**

- Score only mutants whose start line falls in a changed-line range from the merge-base (or configured base) diff.
- Skip (pass) when in-scope files have no mutable changed lines (comment-only, deleted-only new-side empty, etc.).
- Surface scored ranges in the gate log / mutate list / PR mutation summary.
- Keep break 85 and zero NoCoverage semantics on that scored set only.

**Non-Goals:**

- Nightly/full mutation scope or thresholds.
- Changing `quality/gates.json` values, Codecov, e2e, or product UI.
- New dependencies.

## Decisions

1. **Stryker mutate ranges, not post-filter-only.** Build `--mutate` as `file:start-end` (one entry per contiguous range). Break + NoCoverage evaluate that scored set. Post-filter the report by the same ranges (outside-range mutants ignored; never fail on them).

2. **Changed lines = new-side hunk lines.** Parse `git diff -U0 --diff-filter=ACMR <base>` (working tree + `--cached`) for new-side start/count; merge overlapping/adjacent ranges. Untracked → `1..lineCount`. Deleted-only / modify with only deletions → no new-side lines → no mutate entry for that file.

3. **Skip vs allowEmpty (exact):**
   - (a) No scored ranges after in-scope ∩ new-side ranges → **skip** (no Stryker, exit 0) — covers deleted-only and empty new-side.
   - (b) Non-empty scored ranges → **always invoke** Stryker with those `path:start-end` only (never whole-file mutate solely because the path changed).
   - (c) Comment-only / non-mutable lines still produce ranges; Stryker may emit **zero** mutants → pass. Pass `--allowEmpty` **only** when every mutate entry is a mutation range (`path:start-end`). Never use `--allowEmpty` to skip mutation while unscored whole files remain the mutate target.
   - (d) Never mutate/score outside those ranges.
   - (e) `quality/gates.json` thresholds unchanged.

4. **Reporting.** `reports/mutation/mutate-files.txt` + log + PR summary list each scored `path:start-end`.

5. **Touch-set:** `scripts/stryker-diff.mjs`, `scripts/stryker-diff-gate.mjs`, their tests, `scripts/stryker-pr-summary.mjs` (+ test) as needed; openspec artifacts; roadmap ticks. No deps; no gate threshold edits.

## Risks / Trade-offs

- **Hunk parse bugs** could under-mutate (false pass) or over-mutate (legacy pain returns). Mitigate with table-driven parser tests plus tmp-repo fixtures through `planDiffMutation` / `buildStrykerArgs` / NoCoverage gate (real helpers, isolated git via `git-test-helper`).
- **Untracked whole-file** is broader than “touched lines” but matches “this file is new content”; acceptable.
- **Security:** N/A (CI script only; no new trust boundary).
