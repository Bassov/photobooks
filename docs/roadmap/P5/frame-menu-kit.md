# frame-menu-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-menu-kit

## Scope

- [ ] Kit part (`#/demo`) of the Designer feature "frame context menu" (Owner Q-20 tool 2; Q-24 2026-11-20 19:34: 14-row menu with Cut), Must FM1 only: Designer spec `frame-context-menu` Decisions M1–M8, Spec (Look, Rows, Page menu, Focus) and "Kit". Pick mode UI (FM2) is `photo-pick-kit`; prod is `frame-context-menu` / `photo-pick`.
- [ ] `uikit/src/sandbox/frame-menu.tsx` (new): document `contextmenu` → frame / multi-selection / override-copy / page menu with the Rows table's rows, groups, separators, disabled rows (`disabledKeys`), mac key glyphs (M7), Cut (M8); M5 focus (pointer open: no focused row; Shift+F10 / menu key: first enabled row). Replace photo… / Place photo… call the store `startPick` stub.
- [ ] `uikit/src/sandbox/store.tsx`: `zMove` (moved from the inspector ArrangeSection, same code) + `zMovesFor`; `pick` / `setPick` state, `startPick`.
- [ ] `uikit/src/sandbox/inspector.tsx`: ArrangeSection uses the store `zMove` (behaviour unchanged).
- [ ] `uikit/src/sandbox/viewport.tsx`: mounts `<FrameMenu />`; Esc ends `pick` first.
- **Done when:** all Spec menus open in `#/demo` by right-click with the exact rows, order, separators, disabled states and key labels of the Rows table; popover 224 px, row look = today's prod menu; filled-frame menu 468.81 ±0.5 px and inside a 1440 × 900 window when opened at y 840; the menu is painted at the pointer (`elementFromPoint`). `e2e/kit-frame-menu.spec.ts` green; `pnpm test:e2e:quiet e2e/kit-` green once before push.
- **Browser check:** kit `#/demo` via `e2e/kit-frame-menu.spec.ts` (new; `qa.mjs` is frozen).
- **Hard nos:** no `src/**`; no `uikit/scripts/**` (demo-capture steps + re-baseline move to `photo-pick-kit`), `uikit/src/sandbox/chrome.tsx`, `uikit/src/demo-parts/**`, `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `.github/**`, `playwright.config.ts`, `scripts/**`, `e2e/fixtures/**`, `stryker.config.mjs`.
- **Test:** e2e `e2e/kit-frame-menu.spec.ts` (new).
- **Depends:** `frame-copy-paste-kit` (done, `clipboard.ts`).
