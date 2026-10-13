## 1. OpenSpec config SoT

- [x] 1.1 Expand `openspec/config.yaml` rules for proposal (UI/security), design (touch-set, composition, workers, security section, design-reviewer), tasks verification checklist (agent-docs, audit:ci, design-reviewer evidenced, implementation-reviewer, conditional Security Review), and apply/archive operation guidance including **always sync specs on archive**
- [x] 1.2 Slim `.cursor/rules/agent-workflow.mdc` to a pointer at `openspec/config.yaml`
- [x] 1.3 Update `.cursor/rules/architecture.mdc` with capability-folder and composition bullets

## 2. Agent navigation and skills

- [x] 2.1 Add root `AGENTS.md` (map-only, ≤150 lines)
- [x] 2.2 Add `.cursor/skills/react-composition/SKILL.md`
- [x] 2.3 Add `.cursor/skills/react-perf-spa/SKILL.md`
- [x] 2.4 Add `.cursor/skills/ui-review/SKILL.md`

## 3. Reviewers

- [x] 3.1 Ensure `.cursor/agents/openspec-design-reviewer.md` matches config design rules
- [x] 3.2 Strengthen `.cursor/agents/openspec-proposal-reviewer.md` (UI success criteria, security risks)
- [x] 3.3 Strengthen `.cursor/agents/openspec-implementation-reviewer.md` (agent-docs, design-reviewer evidence, audit when deps)

## 4. Security CI

- [x] 4.1 Add `pnpm audit:ci` script to `package.json`
- [x] 4.2 Add audit step to `.github/workflows/checks.yml`
- [x] 4.3 Add `.github/workflows/codeql.yml` for javascript-typescript

## 5. Verify

- [x] 5.1 Run `pnpm verify:fast` (and e2e if needed)
- [x] 5.2 Run `pnpm audit:ci` and triage any failures
- [x] 5.3 Confirm `AGENTS.md` line count ≤150 and no workflow checklist duplication

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI/bundle change)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — no FS/workers/blob/CSP/export; audit script prod-only, no dep version bumps)
