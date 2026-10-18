# Tasks

## 1. Pace helper

- [x] 1.1 Export `pacePasteboardWindow` from `pasteboardWindow.ts` (viewport-cover union, cap new mounts, shrink immediate) and verify unit tests in `pasteboardWindow.test.ts` cover cover-invariant + paced growth + shrink
- [x] 1.2 Wire paced range into `Pasteboard.tsx` (rAF + ~32ms watchdog toward target; spacers from paced lead/tail) and verify `Pasteboard.view.test.tsx` shows multi-frame expand on stride shrink

## 2. E2E lock-in

- [x] 2.1 Extend main-parity continuous zoom-out LoAF through gesture-end remount; nest under `retries: 0` in `e2e/spread-view.spec.ts`; verify one green targeted Playwright run of that spec (CI burn-in owns `--repeat-each=20`)
- [x] 2.2 Tick roadmap item scope checkboxes when Done-when behavior is met; verify item file matches shipped scope

## 3. Mutation / coverage

- [x] 3.1 Run `pnpm stryker:diff` and `pnpm test:coverage`; add public-API tests for survived/no-coverage mutants in touched behavior; list skipped survivors with one-line reasons under this item
  - Skipped: `Pasteboard.tsx` ResizeObserver/IntersectionObserver chrome and slot `data-active` / intrinsic-size attribute literals — equivalent DOM chrome; behavior locked by view + e2e.
  - Skipped: `pasteboardWindowsEqual` lead/tail mutants that stay equivalent when callers recompute extents from start/end before compare (covered start/end inequality cases).

## Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (prep; no security surface)

## Manual test scenarios

1. Open `/?fixture=painter&perf=1`, zoom to fit-all then to ≥400%, wait for gesture end and covering tier.
2. Clear LoAF; continuous zoom-out burst (default settle); wait until gesture ends, then until paced remount mounts all 40 pasteboard slots.
3. Expected: zero LoAF across that settle remount window; document fits viewport; budgets unchanged. Evidenced by Playwright `main parity` case under `retries: 0`.
4. UI-review: empty N/A for pace; happy + zoom-out interact covered by that e2e; no new chrome aesthetics.
