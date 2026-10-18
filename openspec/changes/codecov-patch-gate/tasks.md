# Tasks

## 1. Codecov config

- [x] 1.1 Update `codecov.yml`: blocking `patch.default` `target: 85%`, `threshold: 0%` (not informational); `project.default` `target: auto`, `threshold: 0.5%`; `project.floor` `target: 80%`, `threshold: 0%`; add Components `editor`, `project`, `assets`, `render`, `core`, `scripts` with the item path globs; keep photo/perf/lib and existing ignore/flags. Verify with `curl -sf --data-binary @codecov.yml https://codecov.io/validate` printing Valid!

## 2. Spec and owner docs

- [x] 2.1 Keep the change delta under `openspec/changes/codecov-patch-gate/specs/ci-gates/spec.md` aligned with shipped YAML (patch 85 final, project auto/0.5% + floor 80%, multi-flag patch rule, expanded components). Verify `openspec validate codecov-patch-gate --strict` passes.
- [x] 2.2 Update `docs/roadmap/M2.1/INTRO.md` owner one-time setup so `codecov/patch` and `codecov/project` (and any `codecov/project/*` contexts Codecov posts for default/floor) are listed as required checks to add on `main`. Verify the INTRO bullet names this item and does not instruct agents to change repo settings.

## 3. Roadmap scope ticks and Done-when proof

- [ ] 3.1 After YAML + INTRO land on the feature PR head and Codecov has reported: tick Scope checkboxes in `docs/roadmap/M2.1/codecov-patch-gate.md` only when delivered; record green evidence (status contexts + comment component table showing editor/project/assets/scripts). Verify citations point at this PR's head commit statuses/comment.
- [ ] 3.2 Prove red cases via draft scratch PR(s) on `scratch/codecov-red-*` (patch <85% and project drop >0.5%); close each PR and delete its branch; cite failing status links in this file under Manual test scenarios. Verify both red cases observed, or leave Done-when unticked and mark BLOCKED with the exact missing case.

## 4. Verification

- [ ] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [ ] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [ ] pnpm stryker:diff
- [ ] pnpm test:lhci when UI or bundle size is affected
- [ ] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [ ] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [ ] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [ ] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [ ] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [ ] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

(N/A for UI — [prep] gate config. Record Codecov Done-when evidence here during apply.)
