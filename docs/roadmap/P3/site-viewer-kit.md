# site-viewer-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-viewer-kit
Status: done

## Scope

Kit part of the site viewer (Designer design `site-viewer`, 2026-11-04; Item 1 of 3, kit first). Design source: orch `shared/design/site-viewer/spec.md` §1 tokens, §3 catalog, §4 book page, §7 kit changes. Kit only, no prod files.

- [ ] `uikit/src/features/site-viewer.tsx`: D1 slides n + 1 (cover + every spread); D2 constant stage height (cover centred); D3 Share width locked to "Link copied", 2000 ms, no `site-share-link`, text into `role=status`; D4 root-width layout (ResizeObserver on `[data-testid=site]`, narrow < 768, columns 4/3/2, stage width §4); D5 `slideLabel` (`Cover`, `Page 1 · 1 / n`, `Pages 2–3 · 2 / n`)
- [ ] Catalog book object height = min(200, column / ratio); card hover lift 2 px 160 ms (none with reduced motion); Home / End keys; `data-testid="site-stage"`. Fullscreen stays in the kit. `spreadLabel(i, n)` stays exported unchanged (site-photographer uses it)
- [ ] `uikit/src/index.css`: `.site { --site-* }` token block (§1); SiteViewer classes use the tokens
- [ ] `uikit/scripts/qa.mjs` site blocks: Share label / status instead of `site-share-link`; indicator denominator = spread count; slide 1 label check
- [ ] Re-baseline `#/demo` steps site-catalog, site-book, site-share, site-fullscreen
- **Done when:** kit `#/demo` (DOM): slide labels as above; stage rect constant across all slides (≤ 0.5 px); Share width unchanged after click; pager indicator width 176 with no jump; at 390 px root width `scrollWidth === clientWidth` on catalog and book page; landscape book fits its catalog column. Kit qa green; baselines captured.
- **Browser check:** kit `#/demo` publish → Open site → book: step Cover → last spread, Share, Fullscreen; narrow 390 px root.
- **Hard nos:** no prod `src/` changes; no edits to `uikit/src/sandbox/*`, `uikit/src/features/site-photographer.tsx` or site-awards demo files; no blue / teal; no layout shift or page-level horizontal scroll
- **UI kit:** `uikit#/demo` steps `site-catalog`, `site-book`, `site-share`, `site-fullscreen`; parts `uikit/src/features/site-viewer.tsx` (`SiteViewer`)
