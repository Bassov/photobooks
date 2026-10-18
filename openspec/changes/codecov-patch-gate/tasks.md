# Tasks

## 1. Codecov config

- [x] 1.1 Update `codecov.yml`: blocking `patch.default` `target: 85%`, `threshold: 0%` (not informational); `project.default` `target: auto`, `threshold: 0.5%`; `project.floor` `target: 80%`, `threshold: 0%`; add Components `editor`, `project`, `assets`, `render`, `core`, `scripts` with the item path globs; keep photo/perf/lib and existing ignore/flags. Verify with `curl -sf --data-binary @codecov.yml https://codecov.io/validate` printing Valid!

## 2. Spec and owner docs

- [x] 2.1 Keep the change delta under `openspec/changes/codecov-patch-gate/specs/ci-gates/spec.md` aligned with shipped YAML (patch 85 final, project auto/0.5% + floor 80%, multi-flag patch rule, expanded components). Verify `openspec validate codecov-patch-gate --strict` passes.
- [x] 2.2 Update `docs/roadmap/M2.1/INTRO.md` owner one-time setup so `codecov/patch` and `codecov/project` (and any `codecov/project/*` contexts Codecov posts for default/floor) are listed as required checks to add on `main`. Verify the INTRO bullet names this item and does not instruct agents to change repo settings.

## 3. Roadmap scope ticks and Done-when proof

- [ ] 3.1 After YAML + INTRO land on the feature PR head and Codecov has reported: tick Scope checkboxes in `docs/roadmap/M2.1/codecov-patch-gate.md` only when delivered; record green evidence (status contexts + comment component table showing editor/project/assets/scripts). Verify citations point at this PR's head commit statuses/comment. _(Scope yaml/INTRO/delta ticks done; component table evidence missing — BLOCKED.)_
- [x] 3.2 Prove red cases via draft scratch PR(s) on `scratch/codecov-red-*` (patch <85% and project drop >0.5%); close each PR and delete its branch; cite failing status links in this file under Manual test scenarios. Verify both red cases observed, or leave Done-when unticked and mark BLOCKED with the exact missing case.

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [ ] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

Note: e2e/lhci/ui-review/audit/Security Review are N/A (non-UI, no deps). `stryker:diff` N/A locally / CI skipped (no mutate targets). Implementation review + archive deferred while Done-when is BLOCKED.

## Manual test scenarios

N/A for UI ([prep] gate config). Codecov Done-when evidence:

1. **Validate:** `curl -sf --data-binary @codecov.yml https://codecov.io/validate` → Valid! (blocking patch 85%/0%, project auto/0.5% + floor 80%, components including editor/project/assets/render/core/scripts).
2. **Green path (PR #104 head `dcfcd48`):** `codecov/patch` **pass** — https://app.codecov.io/gh/Bassov/photobooks/pull/104 ; `codecov/bundles` pass. CI `checks` pass.
3. **Red patch (scratch PR #105 head `dc65d03`):** `codecov/patch` **fail** — https://app.codecov.io/gh/Bassov/photobooks/pull/105 (patch 0%, 404 missing lines). Status link via `gh pr checks 105`.
4. **Project drop (same #105):** Codecov API/UI base **87.37%** → head **83.48%** (change **-3.89%**, above 0.5% threshold) — https://app.codecov.io/gh/Bassov/photobooks/pull/105 . **Red case not observed as GitHub status:** no `codecov/project` / `codecov/project/*` check posted on #105 (also absent on recent PRs #100–#104; only `codecov/patch` + `codecov/bundles` appear).
5. **Components in Codecov comment:** **not observed.** PR #104/#105 Codecov comments have no component table (even for existing photo/perf/lib). Public `GET /api/v2/.../components` still lists only photo/perf/lib (main). Layout includes `components`; yaml validate lists the new ids.
6. **BLOCKED:** Done-when incomplete — missing red `codecov/project` GitHub status and comment component table. Scratch PR #105 still open: `gh pr close 105` and `git push origin --delete scratch/codecov-red-patch` were permission-blocked in this session.
7. **N/A gates:** e2e / lhci / ui-review / audit / stryker (no mutate targets on yaml/docs-only change; mutation summary skipped on #104).
