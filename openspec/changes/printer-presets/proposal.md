## Proposal

Roadmap: `docs/roadmap/P5/printer-presets.md`; Designer spec `printer-presets` (2026-11-05) item 3. UI ref: `uikit#/feature/site-settings` (`print*`), `uikit#/feature/inspector` (`book-lulu`).

### Scope out

- Catalog data (`src/core/print/catalog.ts`) and `uikit/`.
- Preflight-in-a-worker and the PDF browser check: moved to `P4/preflight-core.md` / `P4/pdf-export.md` (Owner brief 2026-11-05).
- No `openspec/specs` delta (lane rule).

### Delta / Risk

- Settings scrolls only in `settings-scroll`, the editor body inside the dialog; no page-level scroll; no new security surface.
