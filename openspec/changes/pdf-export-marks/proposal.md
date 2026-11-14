## Proposal

Roadmap: `docs/roadmap/P4/pdf-export-marks.md`. Design: pdf-export Designer Spec D4, §2.2 (PE5).

### Scope out

- Print dialog, store, percent math (item pdf-export).
- Profile schema (`cropMarks` stays, the painter ignores it).

### Delta / Risk

- With marks on, MediaBox adds the crop-mark area; BleedBox = trim + 2 × bleed.
- No production caller yet: only tests change.
