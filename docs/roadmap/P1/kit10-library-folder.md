# kit10-library-folder

Tag: feature
Milestone: P1
Title: Welcome and library folder: kit v0.10 look

## Scope

- [ ] Welcome, choose / change library folder and the empty library look like kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/open-save-project` (`uikit/src/features/pages.tsx` page `open-save-project`); parts: `uikit/src/features/library.tsx` (`WelcomeScreen, LibraryBar, LibraryEmpty`), `uikit/src/demo-parts/library.tsx` (`DemoLibrary`)
- **Demo:** `uikit#/demo` steps 01 `welcome`, 02 `welcome-folder-picker`, 03 `library-empty`, 04 `library-change-folder-confirm` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Change library folder confirms first and never moves books; empty state as `LibraryEmpty`
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; no new storage behavior (look only)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 01–04, signed off by Designer review
- **Depends:** none
- **UI kit:** `uikit#/feature/open-save-project` (`uikit/src/features/pages.tsx` page `open-save-project`); parts: `uikit/src/features/library.tsx` (`WelcomeScreen, LibraryBar, LibraryEmpty`), `uikit/src/demo-parts/library.tsx` (`DemoLibrary`)
