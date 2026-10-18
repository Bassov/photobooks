# Tasks

## 1. Codecov config

- [x] 1.1 Update `codecov.yml`: blocking `patch.default` `target: 85%`, `threshold: 0%` (not informational); retain `project.default` `target: auto`, `threshold: 0.5%`; `project.floor` `target: 80%`, `threshold: 0%`; retain Components `editor`, `project`, `assets`, `render`, `core`, `scripts` with the item path globs (harmless; enforcement moved to backlog); keep photo/perf/lib and existing ignore/flags. Verify with `curl -sf --data-binary @codecov.yml https://codecov.io/validate` printing Valid!

## 2. Spec and owner docs

- [x] 2.1 Keep the change delta under `openspec/changes/codecov-patch-gate/specs/ci-gates/spec.md` aligned with enforced behavior (blocking patch 85% final, multi-flag patch rule); note project/components moved to `docs/backlog/codecov-project-components.md`. Verify `openspec validate codecov-patch-gate --strict` passes.
- [x] 2.2 Update `docs/roadmap/M2.1/INTRO.md` owner one-time setup so only `codecov/patch` is listed as the required check to add on `main` from this item. Verify the INTRO bullet names this item and does not instruct agents to change repo settings.

## 3. Roadmap scope ticks and Done-when proof

- [x] 3.1 After YAML + INTRO land on the feature PR head and Codecov has reported: tick Scope checkboxes in `docs/roadmap/M2.1/codecov-patch-gate.md` only when delivered; record green/red evidence for blocking `codecov/patch`. Evidence: PR #104 green `codecov/patch` (https://app.codecov.io/gh/Bassov/photobooks/pull/104); scratch PR #105 red `codecov/patch` (https://app.codecov.io/gh/Bassov/photobooks/pull/105). Project status and components table Scope moved to backlog (owner decision 2026-10-18).
- [x] 3.2 Prove red patch via draft scratch PR on `scratch/codecov-red-*` (patch <85%); cite failing status links under Manual test scenarios. (Project-drop red GitHub status deferred to backlog — Codecov does not post `codecov/project` here.)

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

Note: e2e/lhci/ui-review/audit/Security Review are N/A (non-UI, no deps). `stryker:diff` N/A locally / CI skipped (no mutate targets). Implementation review runs after owner-approved narrowing.

## Manual test scenarios

N/A for UI ([prep] gate config). Codecov Done-when evidence (narrowed 2026-10-18):

1. **Validate:** `curl -sf --data-binary @codecov.yml https://codecov.io/validate` → Valid! (blocking patch 85%/0%; project/Components keys retained, not enforced as GitHub checks from this item).
2. **Green path (PR #104):** `codecov/patch` **pass** — https://app.codecov.io/gh/Bassov/photobooks/pull/104 ; `codecov/bundles` pass. CI `checks` pass.
3. **Red patch (scratch PR #105):** `codecov/patch` **fail** — https://app.codecov.io/gh/Bassov/photobooks/pull/105 (patch 0%, 404 missing lines). Status via `gh pr checks 105`.
4. **Owner narrowing:** Codecov does not post `codecov/project` or the components table on this repo (verified on PRs #100–#105). Those goals live in `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18).
5. **N/A gates:** e2e / lhci / ui-review / audit / stryker (no mutate targets on yaml/docs-only change; mutation summary skipped on #104).
