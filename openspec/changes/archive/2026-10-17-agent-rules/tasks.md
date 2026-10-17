# Tasks

## 1. Non-weaken mandates

- [x] 1.1 Add non-weaken rule to `openspec/config.yaml` quality bar; extend `docs/lessons.md` tsconfig/ESLint line to coverage/mutation/thresholds/inline disables; add one AGENTS.md nav line — verify by grepping those files for the rule and `wc -l AGENTS.md` ≤150
- [x] 1.2 Update `.cursor/rules/git-finish.mdc` so red checks are fixed with code/tests only, never gate config — verify the rule text is present

## 2. Growth and reviewer disposition

- [x] 2.1 Strengthen `rules.proposal` / `operations.apply` and `docs/roadmap/RULES.md` Change size for over-budget + deferred findings via `pnpm roadmap add --after` — verify `openspec instructions proposal --change agent-rules` (or any change) surfaces the growth wording and RULES.md names deferred findings
- [x] 2.2 Add apply/archive guidance for blocking critical/high findings (proposal/design/implementation/Security Review/adversarial-reviewer): fix or schedule next checkbox; PR records verdicts — verify text in `openspec/config.yaml`

## 3. Unattended flow and review severities

- [x] 3.1 Update `.cursor/commands/next-roadmap-item.md`: remove security-tagged stop; continue with Security Review; gate-config edits need no stop (stricter-only) — verify stop list omits security-tagged and continue wording is present
- [x] 3.2 Update `.cursor/agents/openspec-implementation-reviewer.md` with gate-file / out-of-touch-set → high and same-diff exclusion → critical; add `rules.design` touch-set gate-file reason mandate — verify both files

## 4. Dry-run and roadmap item

- [x] 4.1 Fill `## Oversized-item dry-run` below with the hypothetical `pnpm roadmap add` command and “not executed” note — verify section is complete and `pnpm roadmap check` still passes (no fictional add)
- [x] 4.2 Tick matching scope checkboxes in `docs/roadmap/M2.1/agent-rules.md` as each item lands — verify scope boxes match shipped files

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green (1 pre-existing flaky filmstrip LoAF/filechooser, passed on retry)
- [x] pnpm stryker:diff — No mutable src files changed vs origin/main; skipping Stryker
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (docs/rules only)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (non-UI prep)
- [x] Docs/rules sync: AGENTS.md (76 lines), git-finish, next-roadmap-item, implementation-reviewer, lessons, RULES.md, config.yaml, roadmap item scope ticked; README/future-architecture unchanged (no product behavior)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass (medium/low only; Decision 3 gate-config continue fixed before apply)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — Verdict: pass (low: scenario title kept as “stops” because OpenSpec MODIFIED forbids dropping/renaming scenarios)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI prep — recorded under Manual test scenarios
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A (docs/rules only)

## Oversized-item dry-run

Hypothetical: bundling the next M2.1 item `gate-ratchet` into this PR would exceed the size/subsystem budget (process rules + CI ratchet machinery).

Command that would be used (not executed — this change stayed in budget):

```bash
pnpm roadmap add gate-ratchet --after agent-rules --tag prep --title "CI gate ratchet refuses non-stricter threshold edits"
```

Overflow (CI ratchet scripts/workflows) would move to that new checkbox; this PR would keep only agent docs/rules. `pnpm roadmap check` was run after apply with no fictional add.

## Manual test scenarios

N/A — non-UI `[prep]` (docs/rules only). Spec scenarios validated via file grep and `openspec validate agent-rules --strict`.
