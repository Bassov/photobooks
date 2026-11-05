## Implementation

- [x] 1. `site-viewer.tsx`: `share` prop, `siteLayout` `allBooks` term for `single`, book-page keys on document capture. Evidence: kit qa "site-preview-mode §3" (1440 × 900 and 1280 × 720 stage).
- [x] 2. `site.tsx`: `DemoSitePreview` (bar, Back, label, scroll box, key guard, focus take / return). Evidence: kit qa "site-preview-mode §2", "§4" ×3.
- [x] 3. `editor.tsx` + `root.tsx`: Preview renders `DemoSitePreview` with optional initial state; delete `presentation.tsx`. Evidence: kit qa "v0.9.1 §2".
- [x] 4. `pages.tsx` `site-preview-mode`: states preview, spread, fullscreen + notes. Evidence: kit qa "site-preview-mode kit page".
- [x] 5. `qa.mjs`: site-preview checks replace KS14; `demo-capture.mjs` step comment. Evidence: `uikit:qa:quick` 421 passed, 0 failed.

## Manual test scenarios

1. `#/demo` editor → Preview: site book page under the 48 px bar, Back on the Library link, "Cover".
2. → steps a slide; Delete / ⌘Z change nothing in the editor.
3. Fullscreen → Esc closes it only; Esc again closes the preview, focus on Preview.
