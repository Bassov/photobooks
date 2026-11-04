## Implementation

- [x] 1. `.site` token block, root font / colours, `.site-h1` and card lift in `uikit/src/index.css` (kit qa token lint PASS)
- [x] 2. Slides n + 1, `slideLabel`, default cover, Fullscreen `label` prop, Home / End keys; Preview opens at `st.cur + 1` (qa "site-viewer D1/D5 §3")
- [x] 3. Root-width layout: narrow header / paddings / type, catalog columns + book height, stage width + constant `site-stage` height, fixed 176 indicator (qa "D2", "§3 catalog", "D4")
- [x] 4. Share: width-locked label swap, 2000 ms, hidden `role=status`, no `site-share-link` (qa "D3")
- [x] 5. Kit qa: walk Share checks; §3 block labels, constant rects, landscape fit, 390 px overflow (kit qa 360 PASS / 0 FAIL after merging origin/main)

## Manual test scenarios

0. `#/demo` baseline capture (site-catalog, site-book, site-share, site-fullscreen) as evidence.

1. Kit `#/demo` publish → Open site → book: Next to the last spread; labels Cover, Page 1 · 1 / n … Page 2(n−1) · n / n; the stage and pager never move.
2. Share: label "Link copied" for 2 s, button width unchanged, no link line.
3. Root at 390 px: catalog 2 columns, book page Share under the meta, no horizontal scroll.

- harness problem: `pnpm agent manual-qa` drives prod only (waits for `editor-shell`); kit-only item, evidence below from kit qa (`uikit/scripts/qa.mjs`, 1440 × 900) and the demo capture.
- OK 0: `demo:baseline` 69 steps, 50–53 site-catalog / site-book / site-share / site-fullscreen captured (not tracked in git).
- OK 1: 11 slides for 10 spreads, labels Cover … `Page 1 · 1 / 10` … `Page 18 · 10 / 10`; stage 760 × 539.19 and pager rect drift 0 px on every slide; indicator 176; Home → Cover, End → last.
- OK 2: Share 120.84 wide before, during and after "Link copied" (back to "Share" after 2000 ms); status "Link copied: https://aleksandr.photos/lake-trip"; stage y unchanged.
- OK 3: 390 px root: catalog `165px 165px`, scrollWidth = clientWidth = 390 on catalog and book; Share under the meta; landscape book 235 in a 235 column at 1440.
- OK ui-review: focus-visible 2 px solid on 10 controls; card lift −2 px / 160 ms, `none` with reduced motion.
