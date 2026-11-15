## Proposal

Roadmap: `docs/roadmap/P4/booklet-imposition.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/pdf-export`.

### Scope out

- Painter and worker `paint` protocol (`pdf-streaming` follows).
- Printer-driver settings: the dialog only says which duplex flip to pick.

### Delta / Risk

- e2e locks: default 1 per sheet (unchanged run); 2-up / 4-up radios change the summary; Export shows "Imposing sheets", then sheets + duplex text and a `-2up` / `-4up` file. No page-level scroll; only the Check list scrolls.
- Security: the existing PDF worker and `exports/` write paths; no new surface.
