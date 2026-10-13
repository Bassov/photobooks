# Tasks

## 1. TypeScript and ESLint gates

- [x] 1.1 Enable `noUncheckedIndexedAccess` in `tsconfig.app.json`, `tsconfig.node.json`, and `tsconfig.e2e.json`; verify `pnpm typecheck` fails only on real indexed-access issues then fix those call sites
- [x] 1.2 Set lint script to `eslint . --max-warnings=0`; fix any existing warnings; verify `pnpm lint` exits 0 with zero warnings
- [x] 1.3 Update Quality bar in `openspec/config.yaml` to mention `noUncheckedIndexedAccess` and `--max-warnings=0`; verify the strings appear in the file

## 2. knip and dependency-cruiser

- [x] 2.1 Add `knip` and `dependency-cruiser` as devDependencies; add `knip` and `deps` scripts; verify `pnpm install` succeeds and both CLIs run
- [x] 2.2 Add knip config (Vite/`src/main.tsx`, workers, scripts entries); fix or narrowly allow real findings; verify `pnpm knip` exits 0
- [x] 2.3 Add `.dependency-cruiser.cjs` with `src/lib` purity and pure `src/photo` helper no-React rules; verify `pnpm deps` exits 0
- [x] 2.4 Fold `deps` and `knip` into `verify:fast` and into `.github/workflows/checks.yml` after lint; verify script text and workflow steps are present
- [x] 2.5 Update `AGENTS.md` and `README.md` command/script tables for `deps`, `knip`, and `verify:fast` composition; verify docs mention both

## 3. Docs and OpenSpec process

- [x] 3.1 Create `docs/lessons.md` with seeded lessons (persisted model ids not File/Blob; workers for heavy image work; do not weaken tsconfig/eslint; MCP/explore → e2e); verify file exists
- [x] 3.2 Create `docs/future-architecture.md` covering deferred `src/core`/shared render and visual regression; verify file exists
- [x] 3.3 Wire lessons read/update and MCP→e2e lock-in into `openspec/config.yaml` quality bar and apply guidance; verify both rules are present
- [x] 3.4 Add AGENTS.md navigation links to `docs/lessons.md` and `docs/future-architecture.md` without duplicating checklists; verify links present and AGENTS.md ≤150 lines

## 4. Future tracking

- [x] 4.1 Create GitHub issue for visual regression e2e (toHaveScreenshot, Docker Playwright parity, fixtures); link it from `docs/future-architecture.md`; verify issue URL is in the doc

## 5. Integration verification

- [x] 5.1 Run `pnpm verify:fast` and confirm typecheck, lint, deps, knip, and test all pass as part of that script

## Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI/bundle budget change)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive

## Workflow follow-up

- Archive the change after implementation review and Security Review pass; sync delta specs into main `openspec/specs/`.
