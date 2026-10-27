## Proposal

Roadmap: `docs/roadmap/M3/multi-drop-fill.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/multi-drop-fill`.

### Scope out

- No marquee select, gallery drag-reorder, or drop before the first spread.
- No new template-pick logic: reuse `bestTemplateId`.

### Delta / Risk

- e2e: empty (no selection → single drag unchanged), happy (4 → 4-grid in order; 2 portraits in gap → new spread), interact (Shift/Ctrl+click, Ctrl+A, Esc). Scroll only in `filmstrip-scroll` / `pasteboard-scroll`.
- Security: N/A (in-document drag MIME only).
