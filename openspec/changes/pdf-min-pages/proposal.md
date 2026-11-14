## Proposal

Roadmap: `docs/roadmap/P4/pdf-min-pages.md`.

### Scope out

- Pages above the profile maximum (still a Book settings warning only).
- Cover PDF, imposition, UI and `pdf.worker.ts` (calls the painter unchanged).

### Delta / Risk

- skip_specs: true — book-core "Print profile validates trim and bleed" already states the contract.
- Spread-per-sheet profiles end on one single-page sheet for an odd deficit.
