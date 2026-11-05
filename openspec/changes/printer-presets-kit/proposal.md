## Proposal

Roadmap: `docs/roadmap/P5/printer-presets-kit.md` (SoT: scope, Done when). Design: Designer spec `printer-presets` + `uikit#/feature/site-settings`.

### Scope out

- Kit Book settings PRINT and `book-lulu`: printer-presets-kit-book.
- Prod `src/**`, `e2e/`: printer-presets-core / printer-presets. No spec delta (kit only).

### Delta / Risk

- Catalog numbers are kit sample data (D8).
- Happy = `print`, empty = `print-empty`, interact = Duplicate → editor / Delete… confirm. No page-level H/V scroll; the dialog body scrolls only inside the dialog.
