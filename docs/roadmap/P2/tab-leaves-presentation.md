# tab-leaves-presentation

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item tab-leaves-presentation
Status: done

## Scope

- [ ] Prod presentation (`src/render/SpreadPager.tsx`, opened by `PresentationMode`): opening moves focus into the dialog; Tab / Shift+Tab never leave it (was: focus stayed on Present behind the overlay and Tab walked the editor chrome)
- [ ] Esc (and the Esc chip) still closes it and focus returns to the control that opened it
- [ ] Kit `#/demo` Preview (`uikit/src/demo-parts/presentation.tsx`) does the same; no visual change in either
- **Bug rule:** every caller of the same overlay path is listed in the PR body as fixed or left out with a reason
- **Done when:** Playwright e2e on the `?fixture=` editor: open presentation, Tab ×10 and Shift+Tab ×10 keep `document.activeElement` inside it every step, Esc puts focus on the opener; kit qa has the same check for the kit presentation; `#/demo` baselines unchanged; typecheck + unit green, full e2e at the end
- **Perf:** N/A — one keydown branch and two focus calls per open / close
- **Browser check:** open a book, press Present, press Tab repeatedly: focus never lands on the editor chrome behind; Esc → Present is focused
- **Hard nos:** `uikit/src/sandbox/chrome.tsx` ThumbGrid, `uikit/src/features/site-*`, `library.tsx`, `docs/roadmap/RULES.md`, roadmap tooling
- **Source:** Designer parity note 2026-11-04
