# Design

## Context

`gate-ratchet` fails any added `Stryker disable` (`countStrykerDisable` + `stryker-disable-added`). `agent-context` still says “no Stryker disable until stryker-diff-gate defines a budget.” `stryker-pr-summary` totals Ignored but does not list disables or per-file Ignored. Budget value does not exist in `quality/gates.json`.

## Goals / Non-Goals

**Goals:** Only budgeted next-line disables legal; illegal forms + over file/repo budget fail `pr-policy`; `mutation.disableBudget` ratchets (lower-stricter, start 0); summary lists disables with reasons + per-file Ignored; agent/reviewer text stops treating `tasks.md` survivor notes as sufficient; fixture + real-repo proofs; mutation ≥85% / 0 NoCoverage on touched helpers.

**Non-Goals:** Product UI; raising `disableBudget` above 0 on main; new parallel rule engine; GitHub required-check settings.

## Decisions

1. **Extend detectors in place** — Replace blanket “any disable added” with parse+classify helpers in `check-gate-ratchet.mjs` (same conventions as existing NEEDLES/MSGS/RULE_IDS). Keep `stryker-disable-added` for illegal forms and net growth of illegal comments; add rule ids for per-file over-cap and repo over-budget (join `RULE_IDS`/`FIXTURE_IDS` supersets). Case/whitespace-insensitive match on `Stryker` + `disable` so variants cannot bypass.

2. **Legal form** — `//` line comments only (after trim): `Stryker disable next-line <Mutator>(,<Mutator>)*: <reason>` with reason trimmed length ≥ 10. Mutator tokens non-empty. File-wide (`disable <x>` without `next-line`), `disable all`, and block `disable` / `restore` pairs fail.

3. **Caps** — ≤3 legal next-line disables per source file on head. Repo-wide: count of legal next-line disables across `src/` + `scripts/` (excluding the detector file’s own string needles if needed, same pattern as today) ≤ `quality/gates.json` `mutation.disableBudget`. Add `mutation.disableBudget: 0` and `GATES_NUMERIC` entry with `lower-stricter` (raising budget = weaker).

4. **Legal-within-budget path** — Adding a legal next-line does **not** fail when head total ≤ budget and per-file ≤ 3. With budget 0 on main, production PRs cannot add disables; Done-when “passes” is proven on fixture trees where base budget ≥ 1.

5. **Summary** — `stryker-pr-summary.mjs`: for each report file, count Ignored; scan changed/source files (or report file paths) for disable comments and list path + reason; keep aggregate Ignored. No stub proofs.

6. **Agent policy** — Update `openspec/config.yaml` quality bar + `operations.apply`; implementation-reviewer check 5: survivors justified only by budgeted next-line (or equivalent dead-code deletion), not a free-text `tasks.md` excuse. Delta `agent-context` accordingly.

7. **Proofs** — Real CLI on fixture base/head: file-wide fails; 4th next-line fails; over budget fails; one legal with budget room passes. Unit test scans real `src/` + `scripts/` and asserts disable count === 0. Clear ambient `GIT_*` in any git-using tests; tmp repos only.

## Security

- `pr-policy` remains base-exec / head-as-data; detectors parse text only.
- No new dependencies.

## Touch-set

| Path                                                 | Reason                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `quality/gates.json`                                 | add `mutation.disableBudget: 0` (stricter ceiling)              |
| `scripts/check-gate-ratchet.mjs`                     | parse/classify disables; budget + per-file rules; GATES_NUMERIC |
| `scripts/check-gate-ratchet.test.mjs`                | fixture Done-when CLI + real-repo count 0 + case/ws variants    |
| `scripts/stryker-pr-summary.mjs`                     | list disables + per-file Ignored                                |
| `scripts/stryker-pr-summary-cli.mjs`                 | thin CLI entry for CI workflows                                 |
| `scripts/stryker-pr-summary.test.mjs`                | unit tests for summary (new or extend)                          |
| `.github/workflows/stryker-diff.yml`                 | call summary CLI entry                                          |
| `.github/workflows/stryker-full.yml`                 | call summary CLI entry                                          |
| `stryker.config.mjs`                                 | mutate include for `stryker-pr-summary.mjs`                     |
| `openspec/config.yaml`                               | quality bar + apply: budgeted next-line only                    |
| `.cursor/agents/openspec-implementation-reviewer.md` | check 5: no tasks.md survivor excuse                            |
| `openspec/specs/ci-gates/spec.md`                    | archive sync                                                    |
| `openspec/specs/agent-context/spec.md`               | archive sync                                                    |
| `openspec/changes/stryker-disable-budget/**`         | planning + deltas                                               |
| `docs/roadmap/M2.1/stryker-disable-budget.md`        | tick / Done note only                                           |
| `docs/lessons/` (if needed)                          | one lesson if a new pitfall appears                             |

## Risks / Trade-offs

- [Budget 0 blocks all new disables on main] → intentional; fixtures cover the pass path.
- [Comment-shape false negatives] → case/ws table tests + real-repo scan.
- [Summary needs file text] → read report paths from workspace; fail loud if path missing when listing.

## Open Questions

N/A
