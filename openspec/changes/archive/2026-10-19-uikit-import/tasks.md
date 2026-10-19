# Tasks

## 1. Import kit package

- [x] 1.1 Copy verified zip `source/` into `uikit/` (scripts, 77 pages, photos, PHOTO-CREDITS); drop `package-lock.json` and `site/`; add `pnpm-workspace.yaml` + root `uikit:*` scripts; install into root lockfile
- [x] 1.2 Point kit Vite `base` to `/uikit/` and `outDir` to `../dist/uikit`; write `uikit/README.md` (what it is, how to run, `UI ref: uikit#/feature/<slug>`, roadmap as source of truth)

## 2. Serve and isolate

- [x] 2.1 Root Vite middleware plugin so `pnpm dev` serves the kit at `/uikit/`; root `pnpm build` also builds the kit into `dist/uikit/`
- [x] 2.2 Depcruise rule: `src/**` must not import `uikit/` / `photobooks-ui-kit`; `scripts/assert-no-uikit-in-app-bundle.mjs` (+ unit test) fails if app `dist/assets` contain uikit markers; wire assertion after Build in `checks.yml`
- [x] 2.3 Exclude `uikit/**` from root ESLint/Prettier; keep coverage and mutation file sets unchanged; size-exclude `uikit/**` when a diff-size script exists (else document owner exclusion)

## 3. CI and proof

- [x] 3.1 Add `.github/workflows/uikit.yml` job: install, `uikit` typecheck + build + `qa:quick`
- [x] 3.2 Prove Done-when on this head: preview build, all 77 pages at `/uikit/` with no console errors in Light and Dark; record results in Manual test scenarios (this is the required Manual evidence; `pnpm dev` smoke is optional only)

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A for app e2e (kit is separate `/uikit/` surface; CI `qa:quick` + preview proof cover kit)
- [x] pnpm stryker:diff — OK (no mutate-list delta vs main; coverage/mutation sets unchanged per Done-when)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (kit excluded from size limit; app main bundle unchanged aside from separate `dist/uikit/`)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — see Manual test scenarios + preview proof JSON
- [x] Docs/rules sync: AGENTS.md module map + `uikit:*` commands; `uikit/README.md`; roadmap item checkboxes
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — pass (no known high vulns)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): preview-build proof below (Done-when); `pnpm dev` optional only
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

1. **Sha verify:** `sha256sum` of zip = `601cf5b7c6ae682e9a839f0c9c7587194c8505c401def67d6ec072d957d1a458`. Observed match.
2. **Build:** `pnpm build` → app `dist/assets/*` + kit `dist/uikit/`. `pnpm assert:no-uikit-in-app` → `OK assert-no-uikit-in-app-bundle`.
3. **CI smoke:** `pnpm uikit:qa:quick` → `50 passed, 0 failed; console errors/warnings: 0` (includes all 77 pages render cleanly at 1440×900, light).
4. **Done-when preview proof:** `node scripts/with-playwright-env.mjs node scripts/uikit-preview-proof.mjs` after build:
   - base `http://127.0.0.1:4173/uikit/`
   - pages: **77**
   - themes: Light + Dark
   - **consoleErrors: 0**
   - errorsByTheme: Light **0**, Dark **0**
   - indexSearchVisible: true
5. **UI lock-ins (observed in proof + qa):** empty index search visible; happy `#/feature/m0-photo-card` demo; theme Light/Dark toggle exercised for all pages.
6. **Coverage/mutation sets:** `git diff origin/main -- vite.config.ts stryker.config.mjs` — only `uikitDevMiddleware` plugin wiring in `vite.config.ts`; **no** coverage include/exclude or `mutate` list changes. `stryker.config.mjs` unchanged vs main.

7. **ui-review:** preview `/uikit/` empty+happy+Dark toggle; verdict **pass**, findings [].
8. **audit:ci:** re-run `No known vulnerabilities found` (AUDIT_EXIT:0).
9. **Security Review:** no medium+ findings on reviewed surface; same-origin kit accepted per design; no `dangerouslySetInnerHTML` in `uikit/src`.
