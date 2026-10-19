# Tasks

## 1. Deduplicate rule owners

- [x] 1.1 Apply the design owner map: shrink `AGENTS.md` Toolchain/Doc budget (drop verify/flake/finish/watch restatements); fold `agent-workflow.mdc` into `overview.mdc` (delete file); retarget soft ≤150 wording in config + implementation-reviewer to `agentRules.budgets`. Record each removed duplicate → kept owner for the PR body.
- [x] 1.2 Measure post-dedup line/char counts for every scoped rule file; confirm total bytes of the scoped set are lower than pre-change `origin/main` (44641 → ~43309+ before config retarget; reconfirm after final budget sync).

## 2. Rule-file budgets in gates + pr-policy

- [x] 2.1 Add `agentRules.budgets` to `quality/gates.json` with post-dedup `maxLines`/`maxChars` for every scoped path; extend `compareGateTrees` via `agent-rules-budget.mjs` for lower-stricter ratchet + absolute over-budget / missing-path / missing-budget failures; add RULE_IDS + FIXTURE_IDS.
- [x] 2.2 Unit + fixture CLI proofs: scratch over-budget head fails; within-budget head passes; real-tree scan asserts every scoped file is within head budgets. Keep new helpers table-driven (mutation ≥85%, 0 NoCoverage).

## 3. Specs / roadmap

- [x] 3.1 Keep delta specs aligned with shipped behavior; tick matching Scope boxes in `docs/roadmap/M2.1/rules-dedup.md`.
- [x] 3.2 Document Manual evidence: pre/post total bytes, over-budget fixture red / current green, and the removed-duplicate → owner list.

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (within agentRules.budgets), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface (N/A — not security-tagged; no security-surface code)

## Manual test scenarios

Non-UI `[prep]` — gate proofs (no `pnpm dev`):

1. Pre-change scoped total (`origin/main`): **44641** UTF-8 bytes.
2. Post-change scoped total (this head): **43369** UTF-8 bytes (lower).
3. Fixture `agent-rules-over-budget`: CLI FAIL with `agent rule over budget: AGENTS.md` (observed).
4. Fixture `agent-rules-within-budget`: CLI OK for size rules (observed). Fixture `agent-rules-budget-raised`: FAIL `maxLines raised` (observed). Real-tree unit test: 0 violations.
5. Removed duplicates → kept owners (PR body):
   - AGENTS Toolchain verify/flake/`repeat-each` restatement → `.cursor/rules/testing.mdc`
   - AGENTS finish / no CI watch restatement → `.cursor/rules/git-finish.mdc`
   - AGENTS Stack Node/English/OpenSpec restatement → `.cursor/rules/overview.mdc`
   - `.cursor/rules/agent-workflow.mdc` (pointer-only alwaysApply) → folded into `overview.mdc`; OpenSpec mandates remain `openspec/config.yaml`
   - Soft Doc budget “≤150 lines” prose in config + implementation-reviewer → `quality/gates.json` `agentRules.budgets`
   - Repeated finding → check: already owned by `openspec/config.yaml` quality bar (no new prose elsewhere)
