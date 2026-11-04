## Proposal

Roadmap: [`docs/roadmap/P3/static-export-writer.md`](../../../docs/roadmap/P3/static-export-writer.md) (scope / Done when). Designer spec: `static-export/spec.md` §2–3.

### Scope out

- UI, store, export pill / dialog, `publishBook`, derivative encoding for missing photos (`static-export`).
- e2e and the drag-while-writing perf scenario (`static-export`).

### Delta / Risk

- Security: writes only inside the picked folder's `dist/`, segment by segment; a `dist/` without our `site.json` is never changed (`not-our-export`).
