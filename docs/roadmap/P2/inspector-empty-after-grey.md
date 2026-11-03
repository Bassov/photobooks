# inspector-empty-after-grey

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item inspector-empty-after-grey
Status: done

## Scope

- [ ] The inspector context follows only the selection stores and the active spread, with no hidden "dismissed" state: nothing selected on a book spread → kit Spread context ("Spread" over "Pages … · N empty") for the active spread; it never shows the empty hint while the open book has spreads (no active id yet → the first spread)
- [ ] Repro 1: Esc ×2 on spread 2–3, grey press on page 1, list row 2–3 → "Spread · Pages 2–3" (was the empty hint)
- [ ] Repro 2: crop a photo, Esc ×2 → Spread context of the photo's spread (was the empty hint after the first Esc)
- [ ] Repro 3: Esc with nothing selected, then the page-1 row → "Spread · Page 1" (was the empty hint)
- [ ] Hand: frame selected, Esc, Hand drag → Spread context (was the empty hint), as the kit
- **Bug rule:** every caller that sets selection / active spread (grey press, list rows, Esc handlers, crop exit, Hand, marquee, thumbnails) is listed in the PR body as fixed or unchanged with a reason
- **Done when:** unit + e2e tests for repro 1–3 and Hand fail on main and pass here; PR body has the inspector title DOM text per repro, prod vs kit; unit + typecheck green, full e2e at the end
- **Perf:** N/A — one Escape listener fewer; the resolver stays O(spreads)
- **Browser check:** run repro 1–3 and the Hand case on `/?fixture=painter`; the inspector header reads "Spread" with the active spread's pages each time
- **Hard nos:** ≤6 source files; no `uikit/` edits; no edits in `UnsupportedBrowserScreen.*`, `unsupportedScreenModel.ts`, `browserSupport.ts`, `styles/app.css`, `SpreadView.css` (other lanes)
- **Source:** Designer r17 review 2026-11-03 (`list-click-after-grey`), #428 and #421 Designer notes
