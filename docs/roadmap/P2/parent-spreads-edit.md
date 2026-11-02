# parent-spreads-edit

Tag: feature
Milestone: P2
Title: parent spreads: edit in Masters mode
Status: done

## Scope

- [x] Edit parent spreads in Masters mode: the Masters list shows the book's parents (create / rename / delete), the canvas shows the selected parent and its items are added, moved and resized there like spread items; every spread using the parent updates
- **Browser check:** add a logo to a parent, apply it to every spread, move the logo once — all spreads update.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart`; `InspectorPart` → `parent-spreads-inspector`)
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 23 `editor-pages-mode` (step 22 `editor-master-grid-5-cols` → `parent-spreads-inspector`; walk in `uikit/scripts/demo-capture.mjs`)
- **Hard nos:** no fake, dead or disabled-stub controls (D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md); values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor
- **Depends:** parent-spreads
