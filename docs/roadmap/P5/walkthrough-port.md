# walkthrough-port

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item walkthrough-port
Status: done

## Scope

Owner 2026-11-24: port the product walkthrough guide from the old DEMO PR #565 (branch `fix/product-walkthrough`) onto current main as a clean kit change. Take only what the guide needs and rebuild it on today's kit structure; no merge or wholesale cherry-pick.

- [x] Guide page `#/guide` (21 chapters, figures in `uikit/public/guide`) behind a visible "Walkthrough" item in the KitBar, reachable from the kit home
- [x] Copy matches main: chapters cover the tools added since 2026-11-16 (direct crop, filmstrip resize, copy / paste, frame context menu, placed badge, Fill book, layout cycle, interface size, cover PDF); no dead kit routes
- [x] Figures recaptured on main with `uikit/scripts/guide-shots.mjs` (`pnpm guide:shots`), with no change to `demo-capture.mjs`
- [x] Nothing from the old branch that main replaced (old Shell / router / main.tsx wiring, demo-capture.mjs changes, guide-qa.mjs); `uikit/scripts/qa.mjs` unchanged
- [x] `e2e/kit-guide.spec.ts`: nav item painted and opens `#/guide`, chapter list, every figure loads, every kit link resolves, kit imposition copy equals prod
- **Done when:** `#/guide` is reachable from the kit nav; 0 broken images and 0 dead kit links (checked in `e2e/kit-guide.spec.ts`); uikit build + kit e2e green; no `uikit/scripts/qa.mjs` diff; no `src/**` diff.
- **Browser check:** kit `/uikit/#/` → "Walkthrough" in the top bar → `#/guide`: TOC with 21 chapters + "All features", every figure shows, "Kit page" links open existing pages; `#/guide/print-home` deep link lands on chapter 16 and the 2-up / 4-up panel switches sheets.
- **Hard nos:** no edits to `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `uikit/scripts/qa.mjs`, `uikit/scripts/demo-capture.mjs`, `src/**`.
- **UI kit:** `uikit/src/kit/Shell.tsx` `KitBar` nav (`UI ref: uikit#/guide`); the guide itself is kit-only, no prod counterpart.
- **Source:** Owner 2026-11-24 19:15 / 19:18; supersedes PR #565.
